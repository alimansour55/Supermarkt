/**
 * Online orders as outside systems see them: a stable JSON shape, paged by last change,
 * and acknowledgement ("we took these items out of our own stock").
 */
import mongoose from 'mongoose';
import Order from '../../models/Order.js';
import Product from '../../models/Product.js';
import IntegrationOrderState from '../../models/IntegrationOrderState.js';
import { normalizeOrderStatus } from '../../constants/orderStatuses.js';
import { recomputeProductStock, filterSyncedProducts } from './stockSync.service.js';

const FEED_FIELDS = [
  'orderNumber', 'user', 'items', 'shippingAddress', 'phone', 'subtotal', 'deliveryFee', 'discount',
  'pointsDiscount', 'walletAmount', 'couponCode', 'total', 'paymentMethod', 'paymentStatus', 'orderStatus',
  'deliveryMethod', 'scheduledDate', 'deliveryTimeSlot', 'notes', 'fulfillmentLocationId', 'returns',
  'cancelledAt', 'deliveredAt', 'createdAt', 'updatedAt', 'trash',
].join(' ');

/** Cursor = "<updatedAt ISO>|<order id>" so orders changed in the same millisecond are never skipped. */
export function encodeCursor(order) {
  return Buffer.from(`${new Date(order.updatedAt).toISOString()}|${order._id}`).toString('base64url');
}

export function decodeCursor(cursor) {
  try {
    const [iso, id] = Buffer.from(String(cursor), 'base64url').toString('utf8').split('|');
    const at = new Date(iso);
    if (Number.isNaN(at.getTime()) || !mongoose.Types.ObjectId.isValid(id)) return null;
    return { at, id: new mongoose.Types.ObjectId(id) };
  } catch {
    return null;
  }
}

async function barcodesFor(orders) {
  const ids = [...new Set(orders.flatMap((o) => (o.items || []).map((i) => String(i.product))).filter(Boolean))];
  if (!ids.length) return new Map();
  const products = await Product.find({ _id: { $in: ids } }).select('barcode sku variants._id variants.barcode variants.sku').lean();
  const map = new Map();
  for (const p of products) {
    map.set(`${p._id}:`, { barcode: p.barcode || '', sku: p.sku || '' });
    for (const v of p.variants || []) map.set(`${p._id}:${v._id}`, { barcode: v.barcode || p.barcode || '', sku: v.sku || p.sku || '' });
  }
  return map;
}

export function serializeOrder(order, { codes = new Map(), state = null } = {}) {
  const address = order.shippingAddress || {};
  return {
    id: String(order._id),
    number: order.orderNumber,
    status: normalizeOrderStatus(order.orderStatus),
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    currency: 'EGP',
    subtotal: order.subtotal || 0,
    deliveryFee: order.deliveryFee || 0,
    discount: (order.discount || 0) + (order.pointsDiscount || 0),
    walletAmount: order.walletAmount || 0,
    couponCode: order.couponCode || '',
    total: order.total || 0,
    customer: {
      name: order.user?.name || address.fullName || '',
      phone: order.phone || order.user?.phone || '',
      email: order.user?.email || '',
    },
    deliveryAddress: {
      street: address.street || '',
      building: address.building || '',
      floor: address.floor || '',
      area: address.area || '',
      city: address.city || '',
      governorate: address.governorate || '',
    },
    delivery: {
      method: order.deliveryMethod || '',
      date: order.scheduledDate || null,
      timeSlot: order.deliveryTimeSlot || '',
      branchId: order.fulfillmentLocationId ? String(order.fulfillmentLocationId) : null,
    },
    notes: order.notes || '',
    items: (order.items || []).map((item, index) => {
      const code = codes.get(`${item.product}:${item.variantId || ''}`) || {};
      return {
        line: index,
        productId: item.product ? String(item.product) : null,
        variantId: item.variantId ? String(item.variantId) : null,
        barcode: code.barcode || '',
        sku: item.sku || code.sku || '',
        name: item.nameEn || item.nameAr,
        nameAr: item.nameAr,
        quantity: item.quantity,
        unitPrice: item.price,
        lineTotal: Math.round(item.price * item.quantity * 100) / 100,
        fulfilledBy: item.seller ? 'seller' : 'store',
      };
    }),
    returns: (order.returns || []).filter((r) => r.status === 'approved').map((r) => ({
      id: String(r._id),
      line: r.itemIndex,
      quantity: r.quantity,
      refundAmount: r.refundAmount || 0,
    })),
    acknowledged: Boolean(state?.acknowledgedAt),
    externalReference: state?.externalReference || '',
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    cancelledAt: order.cancelledAt || null,
    deliveredAt: order.deliveredAt || null,
  };
}

export async function serializeOrders(orders) {
  const [codes, states] = await Promise.all([
    barcodesFor(orders),
    IntegrationOrderState.find({ order: { $in: orders.map((o) => o._id) } }).lean(),
  ]);
  const stateByOrder = new Map(states.map((s) => [String(s.order), s]));
  return orders.map((o) => serializeOrder(o, { codes, state: stateByOrder.get(String(o._id)) }));
}

/**
 * Orders changed after `cursor` (or `since`), oldest change first.
 * Options: status (comma list), unacknowledged (bool), limit (≤ 200).
 */
export async function listOrderFeed({ cursor, since, status, unacknowledged, limit = 50 } = {}) {
  const max = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const filter = { $or: [{ 'trash.stage': { $exists: false } }, { 'trash.stage': 'none' }] };
  const and = [];
  const decoded = cursor ? decodeCursor(cursor) : null;
  if (cursor && !decoded) {
    const err = new Error('cursor is not valid — use the nextCursor value from the previous page');
    err.statusCode = 400;
    throw err;
  }
  if (decoded) {
    and.push({ $or: [{ updatedAt: { $gt: decoded.at } }, { updatedAt: decoded.at, _id: { $gt: decoded.id } }] });
  } else if (since) {
    const at = new Date(since);
    if (Number.isNaN(at.getTime())) {
      const err = new Error('since must be a date, e.g. 2026-01-31T00:00:00Z');
      err.statusCode = 400;
      throw err;
    }
    and.push({ updatedAt: { $gt: at } });
  }
  if (status) {
    const list = String(status).split(',').map((s) => s.trim()).filter(Boolean);
    if (list.includes('preparing')) list.push('confirmed');
    and.push({ orderStatus: { $in: list } });
  }
  if (String(unacknowledged) === 'true') {
    // Only the last 30 days — older orders are settled one way or the other.
    const windowStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const acked = await IntegrationOrderState.distinct('order', { acknowledgedAt: { $gte: windowStart } });
    and.push({ _id: { $nin: acked } }, { createdAt: { $gte: windowStart } }, { orderStatus: { $nin: ['cancelled'] } });
  }
  if (and.length) filter.$and = and;

  const orders = await Order.find(filter)
    .select(FEED_FIELDS)
    .populate('user', 'name phone email')
    .sort({ updatedAt: 1, _id: 1 })
    .limit(max + 1)
    .lean();
  const hasMore = orders.length > max;
  const page = orders.slice(0, max);
  return {
    orders: await serializeOrders(page),
    nextCursor: page.length ? encodeCursor(page[page.length - 1]) : (cursor || null),
    hasMore,
  };
}

export async function findOrderByRef(ref) {
  const value = String(ref || '').trim();
  if (!value) return null;
  const filter = mongoose.Types.ObjectId.isValid(value) ? { _id: value } : { orderNumber: value };
  return Order.findOne(filter).select(FEED_FIELDS).populate('user', 'name phone email').lean();
}

/**
 * The outside system took this order's items out of its own stock.
 * With hold mode "ack" this releases the hold, so the website stock is rebuilt.
 */
export async function acknowledgeOrder(connection, ref, { externalReference = '', dryRun = false } = {}) {
  const order = await findOrderByRef(ref);
  if (!order) return { found: false };
  const existing = await IntegrationOrderState.findOne({ order: order._id }).lean();
  if (existing?.acknowledgedAt) {
    return { found: true, alreadyAcknowledged: true, order: (await serializeOrders([order]))[0] };
  }
  if (!dryRun) {
    await IntegrationOrderState.updateOne(
      { order: order._id },
      {
        $set: {
          acknowledgedAt: new Date(),
          acknowledgedBy: connection._id,
          externalReference: String(externalReference || '').slice(0, 120),
        },
        $setOnInsert: { orderStatus: order.orderStatus, paymentStatus: order.paymentStatus },
      },
      { upsert: true },
    );
    const synced = await filterSyncedProducts((order.items || []).map((i) => i.product).filter(Boolean));
    if (synced.length) await recomputeProductStock(synced);
  }
  const fresh = await findOrderByRef(order._id);
  return { found: true, alreadyAcknowledged: false, order: (await serializeOrders([fresh]))[0] };
}
