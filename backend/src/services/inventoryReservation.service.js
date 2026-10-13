import mongoose from 'mongoose';
import Product from '../models/Product.js';
import StockReservation from '../models/StockReservation.js';
import { AppError } from '../utils/AppError.js';
import { RESERVATION_TTL_MINUTES } from '../constants/productCatalog.js';
import {
  resolveProductLine,
  getAvailableStock,
  normalizeVariantId,
} from '../utils/productCatalog.js';
import { formatInsufficientStockMessage } from '../utils/stockMessages.js';

const reservationExpiry = () => new Date(Date.now() + RESERVATION_TTL_MINUTES * 60 * 1000);

const toObjectId = (id) => (id instanceof mongoose.Types.ObjectId ? id : new mongoose.Types.ObjectId(String(id)));

/** True when the item should hit a variant row rather than the product-level stock. */
const usesVariant = (product, variantId) => Boolean(
  variantId && product?.variants?.length && product.variants.id(variantId),
);

async function cleanupExpired(session = null) {
  const expired = await StockReservation.find({ expiresAt: { $lt: new Date() } }).session(session);
  for (const row of expired) {
    await releaseReservationRow(row, session);
  }
}

/**
 * Atomically shift reservedStock by `delta`, clamped at 0. Single-document update
 * pipeline, so concurrent holds/releases can't overwrite each other.
 */
async function adjustReserved(productId, variantId, delta, session = null) {
  const clamp = (field) => ({ $max: [0, { $add: [{ $ifNull: [field, 0] }, delta] }] });

  if (variantId) {
    const vid = toObjectId(variantId);
    const res = await Product.updateOne(
      { _id: productId, 'variants._id': vid },
      [{
        $set: {
          variants: {
            $map: {
              input: '$variants',
              as: 'v',
              in: {
                $cond: [
                  { $eq: ['$$v._id', vid] },
                  { $mergeObjects: ['$$v', { reservedStock: clamp('$$v.reservedStock') }] },
                  '$$v',
                ],
              },
            },
          },
        },
      }],
      { session },
    );
    if (res.matchedCount) return;
  }

  await Product.updateOne(
    { _id: productId },
    [{ $set: { reservedStock: clamp('$reservedStock') } }],
    { session },
  );
}

async function releaseReservationRow(row, session = null) {
  await adjustReserved(row.product, row.variantId, -row.quantity, session);
  await row.deleteOne({ session });
}

export async function releaseUserReservations(userId, session = null) {
  const rows = await StockReservation.find({ user: userId }).session(session);
  for (const row of rows) {
    await releaseReservationRow(row, session);
  }
}

/**
 * Take `qty` units of physical stock. The `stock >= qty` guard lives in the update
 * filter, so two concurrent checkouts can never sell the same last unit.
 * Returns false when there isn't enough stock.
 */
export async function decrementLineStock(product, variantId, qty, session = null) {
  const filter = usesVariant(product, variantId)
    ? { _id: product._id, variants: { $elemMatch: { _id: toObjectId(variantId), stock: { $gte: qty } } } }
    : { _id: product._id, stock: { $gte: qty } };
  const field = usesVariant(product, variantId) ? 'variants.$.stock' : 'stock';

  const res = await Product.updateOne(
    filter,
    { $inc: { [field]: -qty, soldCount: qty } },
    { session },
  );
  return res.modifiedCount === 1;
}

/** Put `qty` units back (order cancelled / checkout rolled back). */
export async function incrementLineStock(product, variantId, qty, session = null) {
  const variant = usesVariant(product, variantId);
  const filter = variant
    ? { _id: product._id, 'variants._id': toObjectId(variantId) }
    : { _id: product._id };
  const field = variant ? 'variants.$.stock' : 'stock';

  await Product.updateOne(filter, { $inc: { [field]: qty } }, { session });
  // soldCount floors at 0 for legacy rows that were never counted.
  await Product.updateOne(
    { _id: product._id },
    [{ $set: { soldCount: { $max: [0, { $subtract: [{ $ifNull: ['$soldCount', 0] }, qty] }] } } }],
    { session },
  );
}

/**
 * Sync cart/checkout holds for a user. Items: { productId, variantId?, quantity }.
 */
export async function syncInventoryReservations(userId, items = [], lang = 'ar') {
  await cleanupExpired();
  await releaseUserReservations(userId);

  const normalized = [];
  for (const item of items) {
    const productId = item.productId || item.product;
    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) continue;
    const variantId = normalizeVariantId(item.variantId);
    const qty = Math.max(1, Number(item.quantity) || 1);

    const product = await Product.findById(productId);
    if (!product?.isActive) {
      throw new AppError(`Product unavailable: ${productId}`, 400);
    }

    const line = resolveProductLine(product, variantId);
    if (!line) throw new AppError('Invalid product variant', 400);

    const available = getAvailableStock(line);
    if (available < qty) {
      throw new AppError(formatInsufficientStockMessage(line, lang), 400);
    }

    normalized.push({ productId, variantId, qty, line });
  }

  for (const { productId, variantId, qty } of normalized) {
    await StockReservation.create({
      user: userId,
      product: productId,
      ...(variantId ? { variantId } : {}),
      quantity: qty,
      expiresAt: reservationExpiry(),
    });
    await adjustReserved(productId, variantId, qty);
  }

  return { reserved: normalized.length, expiresAt: reservationExpiry() };
}

/**
 * Decrement physical stock and clear reservations after an order is placed.
 * Throws 409 (and leaves already-taken lines for the caller's rollback) when any line
 * no longer has enough stock. Pass `session` to run inside a transaction; without one,
 * every decrement registers its own undo via `onRollback`.
 */
export async function commitOrderInventory(
  userId,
  orderItems,
  { session = null, onRollback = () => {}, lang = 'ar' } = {},
) {
  await cleanupExpired(session);

  for (const item of orderItems) {
    const productId = item.product || item.productId;
    const variantId = item.variantId ? normalizeVariantId(item.variantId) : null;
    const qty = item.quantity;

    const product = await Product.findById(productId).session(session);
    if (!product) continue;

    const taken = await decrementLineStock(product, variantId, qty, session);
    if (!taken) {
      const line = resolveProductLine(product, variantId) || product;
      throw new AppError(formatInsufficientStockMessage(line, lang), 409);
    }
    onRollback(() => incrementLineStock(product, variantId, qty));

    const reservation = await StockReservation.findOne({
      user: userId,
      product: productId,
      ...(variantId ? { variantId } : { $or: [{ variantId: null }, { variantId: { $exists: false } }] }),
    }).session(session);
    if (reservation) {
      await adjustReserved(productId, usesVariant(product, variantId) ? variantId : null, -qty, session);
      await reservation.deleteOne({ session });
    }
  }

  await releaseUserReservations(userId, session);
}

export async function checkLineStock(product, variantId, quantity, excludeUserId = null, lang = 'ar') {
  await cleanupExpired();

  const line = resolveProductLine(product, variantId);
  if (!line) return { ok: false, message: 'Invalid variant' };

  let available = getAvailableStock(line);

  if (excludeUserId) {
    const own = await StockReservation.findOne({
      user: excludeUserId,
      product: product._id,
      ...(variantId ? { variantId } : { $or: [{ variantId: null }, { variantId: { $exists: false } }] }),
      expiresAt: { $gt: new Date() },
    });
    if (own) available += own.quantity;
  }

  if (available < quantity) {
    return {
      ok: false,
      message: formatInsufficientStockMessage(line, lang),
      available,
      line,
    };
  }
  return { ok: true, available, line };
}
