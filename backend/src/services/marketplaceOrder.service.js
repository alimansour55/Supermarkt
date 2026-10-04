/**
 * Marketplace orders: one customer order → the store's own lines + one Shipment per
 * (seller × fulfillment mode). The Order stays the customer-facing record and the single
 * payment; shipments carry each seller's lines, status and earnings snapshot.
 *
 * Status rules
 * - Store-fulfilled shipments (seller items the store delivers) mirror the order status.
 * - Seller-shipped shipments move on their own (seller portal).
 * - An order with no store-delivered lines takes its status from its shipments.
 */
import mongoose from 'mongoose';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import Seller from '../models/Seller.js';
import User from '../models/User.js';
import Shipment, { SELLER_SHIPMENT_TRANSITIONS } from '../models/Shipment.js';
import { AppError } from '../utils/AppError.js';
import { normalizeVariantId } from '../utils/productCatalog.js';
import { getMarketplaceSettings, resolveCommissionRate } from './marketplace.service.js';
import { pushStatusHistory } from './orderManagement.service.js';
import { createUserNotification } from './userNotification.service.js';

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const idOf = (v) => String(v?._id || v || '');

// ── Cart planning (shared by cart totals and checkout) ──

/**
 * Who sells and who delivers each cart line, and whether the seller can deliver to the zone.
 * `items` are cart/checkout lines ({ productId | product, quantity, … }).
 */
export async function planMarketplaceItems(items = [], { deliveryZoneId = null, lang = 'ar' } = {}) {
  const ids = [...new Set(items.map((i) => idOf(i.productId || i.product)).filter((id) => mongoose.Types.ObjectId.isValid(id)))];
  const products = ids.length
    ? await Product.find({ _id: { $in: ids } }).select('seller fulfilledBy sellerNameAr sellerNameEn category categoryAncestors mainCategory').lean()
    : [];
  const productById = new Map(products.map((p) => [String(p._id), p]));

  const sellerIds = [...new Set(products.filter((p) => p.seller).map((p) => String(p.seller)))];
  const sellers = sellerIds.length
    ? await Seller.find({ _id: { $in: sellerIds } }).select('nameAr nameEn status deliveryZones commissionRate categoryCommissions').lean()
    : [];
  const sellerById = new Map(sellers.map((s) => [String(s._id), s]));

  const lines = items.map((item, index) => {
    const product = productById.get(idOf(item.productId || item.product));
    const seller = product?.seller ? sellerById.get(String(product.seller)) : null;
    return {
      index,
      product,
      seller: seller || null,
      sellerId: seller ? String(seller._id) : null,
      // A store-owned product is always store-fulfilled.
      fulfilledBy: seller ? (product.fulfilledBy || 'seller') : 'store',
    };
  });

  const problems = [];
  const groups = new Map();
  for (const line of lines) {
    if (!line.seller) continue;
    if (line.seller.status !== 'active') {
      problems.push(lang === 'ar'
        ? `البائع «${line.seller.nameAr}» غير متاح حالياً — احذف منتجاته من السلة`
        : `Seller "${line.seller.nameEn}" is unavailable right now — remove its items from your cart`);
    }
    const key = `${line.sellerId}:${line.fulfilledBy}`;
    if (!groups.has(key)) groups.set(key, { sellerId: line.sellerId, seller: line.seller, fulfilledBy: line.fulfilledBy, indices: [] });
    groups.get(key).indices.push(line.index);
  }

  const zoneId = idOf(deliveryZoneId);
  for (const group of groups.values()) {
    const zones = (group.seller.deliveryZones || []).map(String);
    if (group.fulfilledBy === 'seller' && zones.length && mongoose.Types.ObjectId.isValid(zoneId) && !zones.includes(zoneId)) {
      problems.push(lang === 'ar'
        ? `البائع «${group.seller.nameAr}» لا يوصّل إلى منطقتك`
        : `Seller "${group.seller.nameEn}" does not deliver to your area`);
    }
  }

  const sellerGroups = [...groups.values()];
  return {
    lines,
    hasStoreItems: lines.some((l) => l.fulfilledBy === 'store'),
    hasSellerItems: lines.some((l) => l.seller),
    sellerGroups,
    sellerShippedGroups: sellerGroups.filter((g) => g.fulfilledBy === 'seller').length,
    problems: [...new Set(problems)],
  };
}

// ── Shipment creation ──

/**
 * Create the shipments of a freshly persisted order. `lineTotals[i]` is the promoted line
 * total of order.items[i] (what the customer pays for that line before order-level discounts).
 */
export async function createShipmentsForOrder(order, plan, { lineTotals = [] } = {}) {
  if (!plan.sellerGroups.length) return [];
  const settings = await getMarketplaceSettings();

  const docs = plan.sellerGroups.map((group, n) => {
    const items = group.indices.map((i) => {
      const item = order.items[i];
      const product = plan.lines[i].product;
      const lineTotal = round2(lineTotals[i] ?? item.price * item.quantity);
      const commissionRate = resolveCommissionRate({ seller: group.seller, product, settings });
      return {
        itemIndex: i,
        product: item.product,
        variantId: item.variantId || null,
        sku: item.sku,
        nameAr: item.nameAr,
        nameEn: item.nameEn,
        variantLabelAr: item.variantLabelAr,
        variantLabelEn: item.variantLabelEn,
        image: item.image,
        price: item.price,
        quantity: item.quantity,
        lineTotal,
        commissionRate,
        commission: round2((lineTotal * commissionRate) / 100),
      };
    });
    const subtotal = round2(items.reduce((s, it) => s + it.lineTotal, 0));
    const commissionTotal = round2(items.reduce((s, it) => s + it.commission, 0));
    const units = items.reduce((s, it) => s + it.quantity, 0);
    const deliveryFee = group.fulfilledBy === 'seller' ? round2(settings.sellerShipmentDeliveryFee) : 0;
    const fulfillmentFee = group.fulfilledBy === 'store' ? round2(units * (settings.storeFulfillmentFeePerItem || 0)) : 0;
    return {
      order: order._id,
      orderNumber: order.orderNumber,
      shipmentNumber: `${order.orderNumber}-S${n + 1}`,
      seller: group.sellerId,
      sellerNameAr: group.seller.nameAr,
      sellerNameEn: group.seller.nameEn,
      customer: order.user,
      fulfilledBy: group.fulfilledBy,
      items,
      subtotal,
      deliveryFee,
      commissionTotal,
      fulfillmentFee,
      sellerNet: round2(subtotal + deliveryFee - commissionTotal - fulfillmentFee),
      paymentMethod: order.paymentMethod,
      status: 'pending',
      statusHistory: [{ status: 'pending' }],
    };
  });

  const shipments = await Shipment.insertMany(docs);
  notifySellersOfNewShipments(shipments).catch((err) => console.error('Seller new-order notify failed:', err.message));
  return shipments;
}

async function notifySellersOfNewShipments(shipments) {
  for (const shipment of shipments) {
    // eslint-disable-next-line no-await-in-loop
    const users = await User.find({ seller: shipment.seller, isActive: { $ne: false } }).select('_id').lean();
    const shipsItself = shipment.fulfilledBy === 'seller';
    for (const u of users) {
      // eslint-disable-next-line no-await-in-loop
      await createUserNotification({
        userId: u._id,
        type: 'seller_new_order',
        titleAr: 'طلب جديد',
        titleEn: 'New order',
        messageAr: shipsItself
          ? `لديك شحنة جديدة ${shipment.shipmentNumber} — جهّزها وأكّدها.`
          : `تم بيع منتجاتك في الطلب ${shipment.orderNumber} — يشحنها المتجر.`,
        messageEn: shipsItself
          ? `New shipment ${shipment.shipmentNumber} — prepare and confirm it.`
          : `Your items sold in order ${shipment.orderNumber} — the store ships them.`,
        link: `/seller-center/orders/${shipment._id}`,
        data: { shipmentId: shipment._id },
      });
    }
  }
}

// ── Status sync ──

/** Order status → status of a store-fulfilled shipment. */
const STORE_SHIPMENT_STATUS = {
  pending: 'pending',
  confirmed: 'confirmed',
  preparing: 'confirmed',
  out_for_delivery: 'shipped',
  delivered: 'delivered',
  returned: 'returned',
  cancelled: 'cancelled',
};

const FINAL = new Set(['delivered', 'cancelled', 'returned']);

function setShipmentStatus(shipment, status, { note = '', actor = null, role = '' } = {}) {
  shipment.status = status;
  shipment.statusHistory.push({ status, note, changedBy: actor?._id || null, changedByRole: role });
  const now = new Date();
  if (status === 'confirmed' && !shipment.confirmedAt) shipment.confirmedAt = now;
  if (status === 'shipped' && !shipment.shippedAt) shipment.shippedAt = now;
  if (status === 'delivered' && !shipment.deliveredAt) shipment.deliveredAt = now;
  if (status === 'cancelled' && !shipment.cancelledAt) shipment.cancelledAt = now;
}

/**
 * Called after any order status change (Order post-save hook). A cancelled order cancels every
 * open shipment — the order cancellation already restocked and refunded all lines. Otherwise
 * store-fulfilled shipments follow the order.
 */
export async function syncShipmentsFromOrder(order) {
  const shipments = await Shipment.find({ order: order._id });
  for (const shipment of shipments) {
    let next = null;
    if (order.orderStatus === 'cancelled') {
      if (!FINAL.has(shipment.status)) next = 'cancelled';
    } else if (shipment.fulfilledBy === 'store') {
      const mapped = STORE_SHIPMENT_STATUS[order.orderStatus];
      if (mapped && mapped !== shipment.status && !(shipment.status === 'cancelled')) next = mapped;
    } else if (order.orderStatus === 'returned' && shipment.status === 'delivered') {
      next = 'returned';
    }
    if (!next) continue;
    if (next === 'cancelled') {
      shipment.cancelReason = order.cancellationReason || shipment.cancelReason;
      shipment.cancelledByRole = shipment.cancelledByRole || 'order';
    }
    setShipmentStatus(shipment, next, { note: 'order', role: 'system' });
    // eslint-disable-next-line no-await-in-loop
    await shipment.save();
  }
}

/** Overall status of an order whose every line ships from sellers. */
export function deriveOrderStatus(shipments) {
  const live = shipments.filter((s) => s.status !== 'cancelled');
  if (!live.length) return 'cancelled';
  if (live.every((s) => s.status === 'returned')) return 'returned';
  if (live.every((s) => ['delivered', 'returned'].includes(s.status))) return 'delivered';
  if (live.some((s) => ['shipped', 'delivered'].includes(s.status))) return 'out_for_delivery';
  if (live.some((s) => ['confirmed', 'packed'].includes(s.status))) return 'preparing';
  return 'pending';
}

/**
 * Seller-only orders: apply the status derived from the shipments, with the same side effects
 * as a staff status change (deliveredAt, COD marked paid, loyalty, customer notifications).
 */
async function applyDerivedOrderStatus(orderId, actor) {
  const order = await Order.findById(orderId);
  if (!order || order.hasStoreItems) return order;
  const shipments = await Shipment.find({ order: order._id }).lean();
  const next = deriveOrderStatus(shipments);
  const previous = order.orderStatus;
  if (next === previous || (previous === 'confirmed' && next === 'preparing')) return order;

  order.orderStatus = next;
  pushStatusHistory(order, next, { note: 'shipments', changedBy: actor?._id || null });
  if (next === 'delivered') {
    order.deliveredAt = order.deliveredAt || new Date();
    if (order.paymentMethod === 'cod' && order.paymentStatus === 'pending') order.paymentStatus = 'paid';
  }
  if (next === 'cancelled') {
    order.cancelledAt = new Date();
    order.cancellationReason = order.cancellationReason || 'All shipments were cancelled by the sellers';
  }
  await order.save();

  try {
    const { awardPointsForOrder } = await import('./loyalty.service.js');
    await awardPointsForOrder(order);
  } catch (err) {
    console.error('Loyalty award skipped:', err.message);
  }
  try {
    const [{ notifyOrderStatusChange }, { notifyCustomerOrderStatus }] = await Promise.all([
      import('../utils/sendEmail.js'),
      import('./orderTrackingNotify.service.js'),
    ]);
    await notifyOrderStatusChange(order._id, next, previous);
    const populated = await Order.findById(order._id).populate('user', 'name email phone');
    await notifyCustomerOrderStatus(populated, populated.user, next, previous);
  } catch (err) {
    console.error('Order status notify failed:', err.message);
  }
  return order;
}

async function notifyCustomerOfShipment(shipment, status) {
  const copy = {
    confirmed: { ar: 'أكّد البائع شحنتك', en: 'The seller confirmed your shipment' },
    shipped: { ar: 'تم شحن طلبك', en: 'Your shipment is on its way' },
    delivered: { ar: 'تم تسليم شحنتك', en: 'Your shipment was delivered' },
    cancelled: { ar: 'تم إلغاء جزء من طلبك', en: 'Part of your order was cancelled' },
  }[status];
  if (!copy || !shipment.customer) return;
  const tracking = shipment.trackingNumber ? ` (${shipment.carrier ? `${shipment.carrier} ` : ''}${shipment.trackingNumber})` : '';
  await createUserNotification({
    userId: shipment.customer,
    type: 'shipment_update',
    titleAr: copy.ar,
    titleEn: copy.en,
    messageAr: `الشحنة ${shipment.shipmentNumber} من ${shipment.sellerNameAr}${tracking}`,
    messageEn: `Shipment ${shipment.shipmentNumber} from ${shipment.sellerNameEn}${tracking}`,
    link: `/orders/${shipment.order}`,
    data: { orderId: shipment.order, shipmentId: shipment._id },
  });
}

// ── Seller actions ──

/**
 * Refund the customer for one cancelled shipment: its lines + delivery fee, less its share of
 * order-level discounts. Unpaid cash orders simply owe less; wallet money goes back to the
 * wallet; the rest is refunded through the gateway (or flagged for staff).
 */
async function refundCancelledShipment(order, shipment) {
  const orderSubtotal = Number(order.subtotal) || 0;
  const discounts = (Number(order.discount) || 0) + (Number(order.pointsDiscount) || 0);
  const discountShare = orderSubtotal > 0 ? (discounts * shipment.subtotal) / orderSubtotal : 0;
  let remaining = round2(Math.max(0, shipment.subtotal + shipment.deliveryFee - discountShare));
  const amount = remaining;
  const parts = [];

  if (remaining > 0 && order.paymentStatus === 'pending' && !['paid', 'refunded'].includes(order.paymentStatus)) {
    const { isOnlinePaymentMethod } = await import('../constants/paymentMethods.js');
    if (!isOnlinePaymentMethod(order.paymentMethod)) {
      const cut = Math.min(remaining, Number(order.total) || 0);
      order.total = round2((Number(order.total) || 0) - cut);
      remaining = round2(remaining - cut);
      if (cut > 0) parts.push('reduced_cod');
    }
  }

  if (remaining > 0 && Number(order.walletAmount) > 0) {
    const back = Math.min(remaining, Number(order.walletAmount));
    const { creditWallet } = await import('./wallet.service.js');
    await creditWallet({
      userId: order.user,
      amount: round2(back),
      type: 'refund',
      method: 'order',
      order: order._id,
      note: `Shipment ${shipment.shipmentNumber} cancelled`,
    });
    order.walletAmount = round2(Number(order.walletAmount) - back);
    remaining = round2(remaining - back);
    parts.push('wallet');
  }

  if (remaining > 0 && order.paymentStatus === 'paid') {
    const { processOnlineRefund } = await import('./payments/payment.service.js');
    try {
      const refund = await processOnlineRefund(order, remaining, `Shipment ${shipment.shipmentNumber} cancelled`);
      if (refund.status === 'succeeded') {
        order.refundAmount = round2((Number(order.refundAmount) || 0) + remaining);
        order.refundedAt = new Date();
        remaining = 0;
        parts.push('gateway');
      }
    } catch (err) {
      console.error(`Gateway refund for ${shipment.shipmentNumber} failed:`, err.message);
    }
  }

  let status = 'none';
  if (remaining > 0) status = 'manual_required';
  else if (parts.length === 1) [status] = parts;
  else if (parts.length > 1) status = 'mixed';
  shipment.refund = {
    amount,
    status,
    note: remaining > 0 ? `${remaining} EGP still to refund manually` : '',
  };
}

async function restockShipment(order, shipment) {
  for (const it of shipment.items) {
    // eslint-disable-next-line no-await-in-loop
    const product = await Product.findById(it.product);
    if (!product) continue;
    const variant = it.variantId && product.variants?.length ? product.variants.id(normalizeVariantId(it.variantId)) : null;
    if (variant) variant.stock = (variant.stock || 0) + it.quantity;
    else product.stock = (product.stock || 0) + it.quantity;
    product.soldCount = Math.max(0, (product.soldCount || 0) - it.quantity);
    // eslint-disable-next-line no-await-in-loop
    await product.save({ validateBeforeSave: false });
  }
}

/**
 * Seller (or staff) moves a seller-shipped shipment along. `scope.sellerId` restricts the
 * lookup to that seller — a seller can never touch another seller's shipment.
 */
export async function updateShipmentStatus(shipmentId, nextStatus, {
  scope = {}, actor = null, role = 'seller', trackingNumber, carrier, note = '', force = false,
} = {}) {
  if (!mongoose.Types.ObjectId.isValid(shipmentId)) throw new AppError('Shipment not found', 404);
  const shipment = await Shipment.findOne({ _id: shipmentId, ...(scope.sellerId ? { seller: scope.sellerId } : {}) });
  if (!shipment) throw new AppError('Shipment not found', 404);

  if (shipment.fulfilledBy !== 'seller' && !force) {
    throw new AppError('The store delivers this shipment — its status follows the order', 400);
  }
  const allowed = SELLER_SHIPMENT_TRANSITIONS[shipment.status] || [];
  if (!force && !allowed.includes(nextStatus)) {
    throw new AppError(`Cannot move a ${shipment.status} shipment to ${nextStatus}`, 400);
  }
  if (FINAL.has(shipment.status) && !(force && nextStatus === 'returned')) {
    throw new AppError('This shipment is already closed', 400);
  }

  const order = await Order.findById(shipment.order);
  if (!order) throw new AppError('Order not found', 404);
  if (order.orderStatus === 'cancelled') throw new AppError('The customer order was cancelled', 400);

  if (nextStatus === 'shipped') {
    if (trackingNumber !== undefined) shipment.trackingNumber = String(trackingNumber).trim().slice(0, 80);
    if (carrier !== undefined) shipment.carrier = String(carrier).trim().slice(0, 60);
  }

  if (nextStatus === 'cancelled') {
    const reason = String(note || '').trim();
    if (!reason) throw new AppError('Give the customer a reason for the cancellation', 400);
    shipment.cancelReason = reason.slice(0, 500);
    shipment.cancelledByRole = role;
    await restockShipment(order, shipment);
    await refundCancelledShipment(order, shipment);
    order.markModified('total');
    await order.save();
  }

  setShipmentStatus(shipment, nextStatus, { note: String(note || '').slice(0, 500), actor, role });
  await shipment.save();

  await applyDerivedOrderStatus(order._id, actor);
  notifyCustomerOfShipment(shipment, nextStatus).catch((err) => console.error('Shipment notify failed:', err.message));
  return shipment;
}

/** A customer may cancel only while no seller has shipped yet. */
export async function assertShipmentsCancellable(order) {
  if (!order.sellerIds?.length) return;
  const moving = await Shipment.exists({
    order: order._id,
    fulfilledBy: 'seller',
    status: { $in: ['shipped', 'delivered'] },
  });
  if (moving) throw new AppError('Part of this order has already shipped and can no longer be cancelled', 400);
}

// ── Views ──

const SHIPPING_VISIBLE = new Set(['pending', 'confirmed', 'packed', 'shipped']);

/**
 * Seller view. Customer contact + address are shown only for shipments the seller delivers
 * itself, and only while the shipment is open.
 */
export function formatShipmentForSeller(shipment, order = null) {
  const s = shipment.toObject ? shipment.toObject() : shipment;
  const showContact = s.fulfilledBy === 'seller' && SHIPPING_VISIBLE.has(s.status) && order;
  return {
    _id: s._id,
    shipmentNumber: s.shipmentNumber,
    orderNumber: s.orderNumber,
    fulfilledBy: s.fulfilledBy,
    status: s.status,
    statusHistory: (s.statusHistory || []).map((h) => ({ status: h.status, note: h.note, changedAt: h.changedAt, changedByRole: h.changedByRole })),
    items: s.items,
    subtotal: s.subtotal,
    deliveryFee: s.deliveryFee,
    commissionTotal: s.commissionTotal,
    fulfillmentFee: s.fulfillmentFee,
    sellerNet: s.sellerNet,
    paymentMethod: s.paymentMethod,
    collectOnDelivery: s.paymentMethod === 'cod' && s.fulfilledBy === 'seller'
      ? round2(s.subtotal + s.deliveryFee)
      : 0,
    carrier: s.carrier,
    trackingNumber: s.trackingNumber,
    cancelReason: s.cancelReason,
    refund: s.refund,
    createdAt: s.createdAt,
    confirmedAt: s.confirmedAt,
    shippedAt: s.shippedAt,
    deliveredAt: s.deliveredAt,
    cancelledAt: s.cancelledAt,
    deliveryMethod: order?.deliveryMethod,
    scheduledDate: order?.scheduledDate,
    customer: showContact ? {
      name: order.user?.name || '',
      phone: order.phone,
      alternatePhone: order.alternatePhone || '',
      address: order.shippingAddress,
      notes: order.notes || '',
    } : null,
  };
}

/** Customer / staff view embedded in an order. */
export function formatShipmentForOrder(shipment, { isStaff = false } = {}) {
  const s = shipment.toObject ? shipment.toObject() : shipment;
  return {
    _id: s._id,
    shipmentNumber: s.shipmentNumber,
    seller: { _id: s.seller, nameAr: s.sellerNameAr, nameEn: s.sellerNameEn },
    fulfilledBy: s.fulfilledBy,
    status: s.status,
    itemIndexes: (s.items || []).map((it) => it.itemIndex),
    subtotal: s.subtotal,
    deliveryFee: s.deliveryFee,
    carrier: s.carrier,
    trackingNumber: s.trackingNumber,
    shippedAt: s.shippedAt,
    deliveredAt: s.deliveredAt,
    cancelledAt: s.cancelledAt,
    cancelReason: s.cancelReason,
    statusHistory: (s.statusHistory || []).map((h) => ({ status: h.status, changedAt: h.changedAt })),
    ...(isStaff ? {
      commissionTotal: s.commissionTotal,
      fulfillmentFee: s.fulfillmentFee,
      sellerNet: s.sellerNet,
      refund: s.refund,
    } : {}),
  };
}

export async function shipmentsForOrder(orderId, opts) {
  const shipments = await Shipment.find({ order: orderId }).sort({ shipmentNumber: 1 }).lean();
  return shipments.map((s) => formatShipmentForOrder(s, opts));
}
