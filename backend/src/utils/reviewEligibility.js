import mongoose from 'mongoose';
import Order from '../models/Order.js';
import { REVIEWABLE_ORDER_STATUSES } from '../constants/reviewRules.js';
import { getOrderDeliveredAt } from '../services/orderReturn.service.js';

export function normalizeProductId(ref) {
  if (ref == null || ref === '') return null;
  const id = ref._id ?? ref;
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return String(id);
}

export function orderContainsProduct(order, productId) {
  const target = normalizeProductId(productId);
  if (!target || !Array.isArray(order?.items) || !order.items.length) return false;

  return order.items.some((item) => {
    const pid = item.product?._id ?? item.product ?? item.productId;
    return normalizeProductId(pid) === target;
  });
}

/** True when the order reached a completed delivery (status, deliveredAt, or history). */
export function isOrderDeliveredForReview(order) {
  if (!order) return false;
  const status = order.orderStatus || order.status || '';
  if (REVIEWABLE_ORDER_STATUSES.includes(status)) return true;
  return Boolean(getOrderDeliveredAt(order));
}

export async function findReviewableOrderForProduct(userId, productId, orderId = null) {
  const target = normalizeProductId(productId);
  if (!target) return null;

  if (orderId && mongoose.Types.ObjectId.isValid(orderId)) {
    const order = await Order.findOne({ _id: orderId, user: userId });
    if (!order || !isOrderDeliveredForReview(order)) return null;
    return orderContainsProduct(order, target) ? order : null;
  }

  const orders = await Order.find({
    user: userId,
    $or: [
      { orderStatus: { $in: REVIEWABLE_ORDER_STATUSES } },
      { deliveredAt: { $ne: null } },
      { 'statusHistory.status': 'delivered' },
    ],
  })
    .sort({ deliveredAt: -1, updatedAt: -1, createdAt: -1 })
    .limit(80);

  return orders.find(
    (order) => isOrderDeliveredForReview(order) && orderContainsProduct(order, target),
  ) || null;
}
