import { AppError } from '../utils/AppError.js';
import { RETURN_WINDOW_DAYS, resolveReturnReason } from '../constants/orderReturnReasons.js';
import { parseReturnPickup } from '../constants/returnPickup.js';
import {
  RETURN_FULFILLMENT_VALUES,
  resolveReturnFulfillment,
} from '../constants/returnFlow.js';
import {
  restoreOrderInventory,
  processStripeRefund,
  pushStatusHistory,
} from './orderManagement.service.js';

const RETURNABLE_ORDER_STATUSES = new Set(['delivered']);
const ACTIVE_RETURN_STATUSES = new Set(['pending', 'approved']);
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Once a return for this line item was rejected, the customer cannot request again. */
export function hasRejectedReturnForItem(order, itemIndex) {
  return (order.returns || []).some(
    (r) => r.itemIndex === itemIndex && r.status === 'rejected',
  );
}

function orderStatusValue(order) {
  return order?.orderStatus || order?.status || '';
}

export function latestDeliveredFromHistory(order) {
  const history = order?.statusHistory || [];
  const timestamps = history
    .filter((h) => h.status === 'delivered' && h.changedAt)
    .map((h) => new Date(h.changedAt).getTime())
    .filter((t) => !Number.isNaN(t));

  if (!timestamps.length) return null;
  return new Date(Math.max(...timestamps));
}

/** Resolve when the order was delivered (for return window). Uses the latest delivery moment. */
export function getOrderDeliveredAt(order) {
  const candidates = [];

  if (order.deliveredAt) {
    const t = new Date(order.deliveredAt).getTime();
    if (!Number.isNaN(t)) candidates.push(t);
  }

  const fromHistory = latestDeliveredFromHistory(order);
  if (fromHistory) candidates.push(fromHistory.getTime());

  if (candidates.length) return new Date(Math.max(...candidates));

  if (orderStatusValue(order) === 'delivered') {
    if (order.updatedAt) return new Date(order.updatedAt);
    if (order.createdAt) return new Date(order.createdAt);
  }

  return null;
}

export function getReturnDeadline(deliveredAt) {
  if (!deliveredAt) return null;
  const start = new Date(deliveredAt);
  return new Date(start.getTime() + RETURN_WINDOW_DAYS * MS_PER_DAY);
}

export function isWithinReturnWindow(order, { bypass = false, now = Date.now() } = {}) {
  if (bypass) return true;
  if (!RETURNABLE_ORDER_STATUSES.has(orderStatusValue(order))) return false;

  const deliveredAt = getOrderDeliveredAt(order);
  if (!deliveredAt) return false;

  const deadline = getReturnDeadline(deliveredAt);
  return now <= deadline.getTime();
}

/**
 * Backfill deliveredAt on delivered orders (older rows / status set before field existed).
 * @returns {boolean} whether the document was updated in memory
 */
export function ensureOrderDeliveredAt(order) {
  if (orderStatusValue(order) !== 'delivered') return false;

  const resolved = getOrderDeliveredAt(order) || new Date();
  const current = order.deliveredAt ? new Date(order.deliveredAt).getTime() : NaN;
  const next = resolved.getTime();

  if (!Number.isNaN(current) && current >= next) return false;

  order.deliveredAt = resolved;
  return true;
}

export async function persistOrderDeliveredAtIfNeeded(order) {
  if (!ensureOrderDeliveredAt(order)) return false;
  await order.save();
  return true;
}

export function returnedQuantityForItem(order, itemIndex, { excludeReturnId } = {}) {
  const returns = order.returns || [];
  return returns
    .filter((r) => {
      if (r.itemIndex !== itemIndex) return false;
      if (!ACTIVE_RETURN_STATUSES.has(r.status)) return false;
      if (excludeReturnId && r._id?.toString() === excludeReturnId.toString()) return false;
      return true;
    })
    .reduce((sum, r) => sum + (r.quantity || 0), 0);
}

export function getReturnableQuantity(order, itemIndex, { isStaff = false } = {}) {
  const item = order.items?.[itemIndex];
  if (!item) return 0;
  if (!isStaff && hasRejectedReturnForItem(order, itemIndex)) return 0;
  const already = returnedQuantityForItem(order, itemIndex);
  return Math.max(0, (item.quantity || 0) - already);
}

export function snapshotReturnItem(order, itemIndex, quantity, { isStaff = false } = {}) {
  const item = order.items[itemIndex];
  if (!item) throw new AppError('Invalid item', 400);
  if (!isStaff && hasRejectedReturnForItem(order, itemIndex)) {
    throw new AppError(
      'A return request for this product was already rejected — you cannot submit another request',
      400,
    );
  }
  const returnable = getReturnableQuantity(order, itemIndex, { isStaff });
  const qty = Math.floor(Number(quantity));
  if (!qty || qty < 1 || qty > returnable) {
    throw new AppError(`You can return up to ${returnable} of this item`, 400);
  }
  return {
    itemIndex,
    quantity: qty,
    product: item.product,
    variantId: item.variantId || null,
    sku: item.sku,
    nameAr: item.nameAr,
    nameEn: item.nameEn,
    price: item.price,
    image: item.image,
    lineTotal: item.price * qty,
  };
}

export function assertCustomerCanRequestReturn(order) {
  ensureOrderDeliveredAt(order);
  if (!RETURNABLE_ORDER_STATUSES.has(orderStatusValue(order))) {
    throw new AppError('Returns are only available for delivered orders', 400);
  }
  if (!isWithinReturnWindow(order)) {
    throw new AppError(`Returns must be requested within ${RETURN_WINDOW_DAYS} days of delivery`, 400);
  }
}

export function buildReturnPayload(order, body, { actor, role, autoApprove = false }) {
  const resolved = resolveReturnReason({
    reasonKey: body.reasonKey,
    reasonNote: body.reasonNote || body.reason,
  });
  if (!resolved.ok) throw new AppError(resolved.message, 400);

  const maxPickupDate = getReturnDeadline(getOrderDeliveredAt(order));
  const pickup = parseReturnPickup(body, { maxPickupDate });
  if (!pickup.ok) throw new AppError(pickup.message, 400);

  const isStaff = role === 'staff';
  const snap = snapshotReturnItem(order, Number(body.itemIndex), body.quantity, { isStaff });
  const phone = pickup.contactPhone || order.phone || '';

  const initialFulfillment = autoApprove ? 'confirmed' : 'requested';

  return {
    ...snap,
    fulfillmentStatus: initialFulfillment,
    fulfillmentHistory: [{
      status: initialFulfillment,
      changedAt: new Date(),
      changedBy: actor._id,
      note: autoApprove ? 'Auto-approved' : 'Customer request',
    }],
    reasonKey: resolved.reasonKey,
    reasonAr: resolved.reasonAr,
    reasonEn: resolved.reasonEn,
    customerNote: (body.customerNote || '').trim(),
    returnMethod: pickup.returnMethod,
    pickupDate: pickup.pickupDate,
    pickupSlotId: pickup.pickupSlotId,
    pickupSlotFrom: pickup.pickupSlotFrom,
    pickupSlotTo: pickup.pickupSlotTo,
    pickupSlotLabelAr: pickup.pickupSlotLabelAr,
    pickupSlotLabelEn: pickup.pickupSlotLabelEn,
    itemCondition: pickup.itemCondition,
    itemConditionLabelAr: pickup.itemConditionLabelAr,
    itemConditionLabelEn: pickup.itemConditionLabelEn,
    contactPhone: phone,
    status: autoApprove ? 'approved' : 'pending',
    requestedBy: actor._id,
    requestedByRole: role,
    requestedAt: new Date(),
    reviewedBy: autoApprove ? actor._id : null,
    reviewedAt: autoApprove ? new Date() : null,
    adminNote: autoApprove ? (body.adminNote || '').trim() : '',
    refundAmount: 0,
  };
}

export async function applyApprovedReturn(order, returnDoc) {
  const refundAmount = returnDoc.lineTotal || (returnDoc.price * returnDoc.quantity);
  returnDoc.refundAmount = refundAmount;

  await restoreOrderInventory([{
    product: returnDoc.product,
    variantId: returnDoc.variantId,
    quantity: returnDoc.quantity,
  }]);

  if (order.paymentMethod === 'stripe' && order.paymentStatus === 'paid') {
    try {
      const stripeRefundId = await processStripeRefund(order, refundAmount);
      if (stripeRefundId) returnDoc.stripeRefundId = stripeRefundId;
    } catch (err) {
      console.error('Return stripe refund failed:', err.message);
    }
  }

  order.refundAmount = (order.refundAmount || 0) + refundAmount;
  if (!order.refundReason) {
    order.refundReason = 'Product return';
  }
  order.refundedAt = new Date();

  const totalRefunded = (order.returns || [])
    .filter((r) => r.status === 'approved')
    .reduce((s, r) => s + (r.refundAmount || 0), 0);

  if (totalRefunded >= order.total - 0.01) {
    order.paymentStatus = 'refunded';
  }
}

export function pushReturnFulfillmentHistory(returnDoc, status, { changedBy = null, note = '' } = {}) {
  returnDoc.fulfillmentHistory = returnDoc.fulfillmentHistory || [];
  returnDoc.fulfillmentHistory.push({
    status,
    changedAt: new Date(),
    changedBy,
    note,
  });
}

export function syncOrderReturnedStatus(order, { changedBy = null } = {}) {
  const hasCompleted = (order.returns || []).some(
    (r) => r.status === 'approved' && resolveReturnFulfillment(r) === 'completed',
  );
  if (!hasCompleted || order.orderStatus === 'returned') return false;

  const previous = order.orderStatus;
  order.orderStatus = 'returned';
  pushStatusHistory(order, 'returned', {
    changedBy,
    note: 'Product return received at store',
  });
  return previous !== 'returned';
}

export function updateReturnFulfillment(order, returnDoc, nextStatus, { changedBy = null } = {}) {
  if (returnDoc.status !== 'approved') {
    throw new AppError('Return must be approved before updating pickup status', 400);
  }
  if (!RETURN_FULFILLMENT_VALUES.includes(nextStatus)) {
    throw new AppError('Invalid return fulfillment status', 400);
  }
  if (nextStatus === 'requested') {
    throw new AppError('Cannot revert to requested after approval', 400);
  }

  const current = resolveReturnFulfillment(returnDoc);
  if (current === nextStatus) {
    return returnDoc;
  }

  returnDoc.fulfillmentStatus = nextStatus;
  pushReturnFulfillmentHistory(returnDoc, nextStatus, { changedBy });

  if (nextStatus === 'completed') {
    syncOrderReturnedStatus(order, { changedBy });
  }

  return returnDoc;
}

export function approveReturnRequest(returnDoc, { changedBy = null, adminNote = '' } = {}) {
  returnDoc.status = 'approved';
  returnDoc.reviewedBy = changedBy;
  returnDoc.reviewedAt = new Date();
  returnDoc.adminNote = (adminNote || '').trim();
  returnDoc.fulfillmentStatus = 'confirmed';
  pushReturnFulfillmentHistory(returnDoc, 'confirmed', {
    changedBy,
    note: 'Return approved',
  });
}

/** Undo rejection — return to pending so admin can approve/reject again. */
export function reopenReturnRequest(returnDoc) {
  returnDoc.status = 'pending';
  returnDoc.reviewedBy = null;
  returnDoc.reviewedAt = null;
  returnDoc.adminNote = '';
  returnDoc.fulfillmentStatus = '';
  returnDoc.refundAmount = 0;
  returnDoc.stripeRefundId = null;
}
