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

async function cleanupExpired() {
  const expired = await StockReservation.find({ expiresAt: { $lt: new Date() } });
  for (const row of expired) {
    await releaseReservationRow(row);
  }
}

async function adjustReserved(productId, variantId, delta) {
  const product = await Product.findById(productId);
  if (!product) return;

  if (variantId) {
    const variant = product.variants.id(variantId);
    if (variant) {
      variant.reservedStock = Math.max(0, (variant.reservedStock || 0) + delta);
    }
  } else {
    product.reservedStock = Math.max(0, (product.reservedStock || 0) + delta);
  }
  await product.save({ validateBeforeSave: false });
}

async function releaseReservationRow(row) {
  await adjustReserved(row.product, row.variantId, -row.quantity);
  await row.deleteOne();
}

export async function releaseUserReservations(userId) {
  const rows = await StockReservation.find({ user: userId });
  await Promise.all(rows.map(releaseReservationRow));
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

/** Decrement physical stock and clear reservations after order placed. */
export async function commitOrderInventory(userId, orderItems) {
  await cleanupExpired();

  for (const item of orderItems) {
    const productId = item.product || item.productId;
    const variantId = item.variantId ? normalizeVariantId(item.variantId) : null;
    const qty = item.quantity;

    const reservation = await StockReservation.findOne({
      user: userId,
      product: productId,
      ...(variantId ? { variantId } : { $or: [{ variantId: null }, { variantId: { $exists: false } }] }),
    });

    const product = await Product.findById(productId);
    if (!product) continue;

    if (variantId && product.variants?.length) {
      const variant = product.variants.id(variantId);
      if (variant) {
        variant.stock = Math.max(0, (variant.stock || 0) - qty);
        if (reservation) {
          variant.reservedStock = Math.max(0, (variant.reservedStock || 0) - qty);
        }
      }
    } else {
      product.stock = Math.max(0, (product.stock || 0) - qty);
      if (reservation) {
        product.reservedStock = Math.max(0, (product.reservedStock || 0) - qty);
      }
    }

    product.soldCount = (product.soldCount || 0) + qty;
    await product.save({ validateBeforeSave: false });

    if (reservation) await reservation.deleteOne();
  }

  await releaseUserReservations(userId);
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
