/**
 * Online payment orchestration — one entry point per lifecycle step, whatever the gateway:
 *
 *   startOnlinePayment   → hosted checkout URL (Paymob) or reference number (Fawry)
 *   applyPaymobResult /
 *   applyFawryResult     → verified gateway outcome → order paid / failed (idempotent)
 *   reconcileOrderPayment→ pull the live status when a callback may have been missed
 *   processOnlineRefund  → refund through the gateway, or flag a manual refund
 *
 * "Paid" is a compare-and-set on paymentStatus, so duplicate or concurrent callbacks can
 * never award loyalty points or send the receipt twice.
 */
import crypto from 'node:crypto';
import Order from '../../models/Order.js';
import { AppError } from '../../utils/AppError.js';
import { awardPointsForOrder } from '../loyalty.service.js';
import { notifyPaymentSuccessAfterPaid } from '../../utils/sendEmail.js';
import { paymentProviderFor } from '../../constants/paymentMethods.js';
import { getPaymobConfig, isPaymentMethodConfigured, publicApiUrl } from '../../config/payments.js';
import {
  createPaymobCheckout,
  fetchPaymobTransaction,
  interpretPaymobTransaction,
  refundPaymobTransaction,
} from './paymob.service.js';
import {
  createFawryReference,
  fetchFawryStatus,
  newFawryMerchantRef,
  refundFawryPayment,
} from './fawry.service.js';
import { processStripeRefund } from '../orderManagement.service.js';

const toCents = (egp) => Math.round(Number(egp || 0) * 100);

// ── State transitions ─────────────────────────────────────────────────────

/**
 * Mark an order paid exactly once. `payment` fields are merged into order.payment
 * (gateway orders only). Returns the order, or null when it does not exist.
 */
export async function markOrderPaid(orderId, { payment = null, stripeSessionId = null } = {}) {
  const $set = { paymentStatus: 'paid' };
  if (stripeSessionId) $set.stripeSessionId = stripeSessionId;
  if (payment) {
    $set['payment.paidAt'] = new Date();
    for (const [key, value] of Object.entries(payment)) {
      if (value !== undefined && value !== null) $set[`payment.${key}`] = value;
    }
  }

  const order = await Order.findOneAndUpdate(
    { _id: orderId, paymentStatus: { $in: ['pending', 'failed'] } },
    { $set },
    { new: true },
  );
  if (!order) return Order.findById(orderId); // already paid / refunded, or missing

  await awardPointsForOrder(order);
  notifyPaymentSuccessAfterPaid(order._id);
  return order;
}

/** Mark an unpaid order failed (never downgrades a paid or refunded order). */
export async function markOrderFailed(orderId, { reason = '', payment = null } = {}) {
  const $set = { paymentStatus: 'failed' };
  if (payment) {
    $set['payment.failedAt'] = new Date();
    if (reason) $set['payment.failureReason'] = reason;
    for (const [key, value] of Object.entries(payment)) {
      if (value !== undefined && value !== null) $set[`payment.${key}`] = value;
    }
  }
  return Order.findOneAndUpdate({ _id: orderId, paymentStatus: 'pending' }, { $set }, { new: true });
}

export function findOrderByPaymentReference(reference) {
  if (!reference) return null;
  return Order.findOne({ 'payment.references': String(reference) });
}

// ── Starting a payment ──────────────────────────────────────────────────────

function assertPayable(order) {
  if (order.orderStatus === 'cancelled') throw new AppError('This order was cancelled', 400);
  if (order.paymentStatus === 'refunded') throw new AppError('This order was refunded', 400);
}

/**
 * Begin (or resume) paying an online order.
 * @returns {{ action: 'paid' } | { action: 'redirect', url } | { action: 'reference', referenceNumber, expiresAt, amount }}
 */
export async function startOnlinePayment(order, user, { channel = 'web', lang = 'ar' } = {}) {
  if (order.paymentStatus === 'paid') return { action: 'paid' };
  assertPayable(order);

  const provider = paymentProviderFor(order.paymentMethod);
  if (!provider || provider === 'stripe') {
    throw new AppError('This order is not paid through Paymob or Fawry', 400);
  }
  if (!isPaymentMethodConfigured(order.paymentMethod)) {
    throw new AppError('This payment method is temporarily unavailable', 503);
  }

  if (provider === 'fawry') {
    const existing = order.payment;
    if (existing?.fawryReferenceNumber && existing.expiresAt > new Date() && order.paymentStatus === 'pending') {
      return {
        action: 'reference',
        referenceNumber: existing.fawryReferenceNumber,
        expiresAt: existing.expiresAt,
        amount: order.total,
      };
    }
    const merchantRefNum = newFawryMerchantRef();
    const { referenceNumber, expiresAt } = await createFawryReference({
      order,
      user,
      merchantRefNum,
      notificationUrl: `${publicApiUrl()}/payment/fawry/webhook`,
      lang,
    });
    await Order.updateOne({ _id: order._id }, {
      $set: {
        paymentStatus: 'pending',
        'payment.provider': 'fawry',
        'payment.reference': merchantRefNum,
        'payment.fawryReferenceNumber': referenceNumber,
        'payment.expiresAt': expiresAt,
      },
      $inc: { 'payment.attempts': 1 },
      $push: { 'payment.references': merchantRefNum },
    });
    return { action: 'reference', referenceNumber, expiresAt, amount: order.total };
  }

  // Paymob: every attempt is a fresh intention (client secrets are single-use).
  const attempt = (order.payment?.attempts || 0) + 1;
  const reference = `${order.orderNumber}-${attempt}-${crypto.randomBytes(2).toString('hex')}`;
  const checkout = await createPaymobCheckout({
    order,
    user,
    methodId: order.paymentMethod,
    reference,
    notificationUrl: `${publicApiUrl()}/payment/paymob/webhook`,
    redirectionUrl: `${publicApiUrl()}/payment/paymob/return/${channel === 'app' ? 'app' : 'web'}/${lang === 'en' ? 'en' : 'ar'}`,
  });
  await Order.updateOne({ _id: order._id }, {
    $set: {
      paymentStatus: 'pending',
      'payment.provider': 'paymob',
      'payment.reference': reference,
      'payment.intentionId': checkout.intentionId,
      'payment.gatewayOrderId': checkout.paymobOrderId,
      'payment.expiresAt': new Date(Date.now() + 60 * 60 * 1000),
    },
    $inc: { 'payment.attempts': 1 },
    $push: { 'payment.references': reference },
  });
  return { action: 'redirect', url: checkout.checkoutUrl };
}

// ── Applying verified gateway results ───────────────────────────────────────

/** `tx` = interpretPaymobTransaction(...) of a verified callback / inquiry / redirect. */
export async function applyPaymobResult(order, tx, { source = 'webhook' } = {}) {
  if (tx.merchantOrderId && !(order.payment?.references || []).includes(String(tx.merchantOrderId))) {
    console.warn(`[payments] Paymob ${source}: reference ${tx.merchantOrderId} does not belong to order ${order.orderNumber}`);
    return order;
  }
  const details = {
    transactionId: tx.transactionId,
    gatewayOrderId: tx.paymobOrderId != null ? String(tx.paymobOrderId) : undefined,
    sourceType: tx.sourceType || undefined,
    sourceSubType: tx.sourceSubType || undefined,
    maskedPan: tx.maskedPan || undefined,
  };

  if (tx.state === 'paid') {
    const expected = toCents(order.total);
    if (tx.amountCents !== expected || (tx.currency && tx.currency !== 'EGP')) {
      console.error(`[payments] Paymob amount mismatch on ${order.orderNumber}: got ${tx.amountCents} ${tx.currency}, expected ${expected} EGP`);
      await Order.updateOne({ _id: order._id }, { $set: { 'payment.amountMismatch': true, 'payment.transactionId': tx.transactionId } });
      return Order.findById(order._id);
    }
    return markOrderPaid(order._id, { payment: details });
  }
  if (tx.state === 'failed') {
    return (await markOrderFailed(order._id, { reason: 'declined', payment: details })) || Order.findById(order._id);
  }
  if (tx.transactionId && !order.payment?.transactionId) {
    await Order.updateOne({ _id: order._id }, { $set: { 'payment.transactionId': tx.transactionId } });
  }
  return Order.findById(order._id);
}

/** `result` = { state, fawryRefNumber, orderAmount? } from a verified notification / status pull. */
export async function applyFawryResult(order, result) {
  if (result.state === 'paid') {
    if (result.orderAmount != null && toCents(result.orderAmount) < toCents(order.total)) {
      console.error(`[payments] Fawry amount mismatch on ${order.orderNumber}: ${result.orderAmount} < ${order.total}`);
      await Order.updateOne({ _id: order._id }, { $set: { 'payment.amountMismatch': true } });
      return Order.findById(order._id);
    }
    return markOrderPaid(order._id, {
      payment: { fawryReferenceNumber: result.fawryRefNumber || undefined, sourceType: 'fawry' },
    });
  }
  if (result.state === 'failed') {
    return (await markOrderFailed(order._id, {
      reason: String(result.rawStatus || 'expired').toLowerCase(),
      payment: {},
    })) || Order.findById(order._id);
  }
  return Order.findById(order._id);
}

// ── Reconciliation (pull) ───────────────────────────────────────────────────

const lastReconcile = new Map();
const RECONCILE_MIN_INTERVAL_MS = 10_000;

/**
 * Ask the gateway for the live status of a still-unpaid order. Throttled per order;
 * never throws (callers fall back to the stored status).
 */
export async function reconcileOrderPayment(order, { transactionId = null } = {}) {
  if (!order?.payment || order.paymentStatus === 'paid' || order.paymentStatus === 'refunded') return order;
  const key = String(order._id);
  if (!transactionId && Date.now() - (lastReconcile.get(key) || 0) < RECONCILE_MIN_INTERVAL_MS) return order;
  lastReconcile.set(key, Date.now());
  if (lastReconcile.size > 5000) lastReconcile.delete(lastReconcile.keys().next().value);

  try {
    if (order.payment.provider === 'paymob') {
      const txId = transactionId || order.payment.transactionId;
      if (!txId || !getPaymobConfig().apiKey) return order;
      const tx = await fetchPaymobTransaction(txId);
      if (!tx) return order;
      return await applyPaymobResult(order, interpretPaymobTransaction(tx), { source: 'inquiry' });
    }
    if (order.payment.provider === 'fawry' && order.payment.reference) {
      const status = await fetchFawryStatus(order.payment.reference);
      return await applyFawryResult(order, status);
    }
  } catch (err) {
    console.warn(`[payments] reconcile ${order.orderNumber} failed: ${err.message}`);
  }
  return order;
}

// ── Refunds ─────────────────────────────────────────────────────────────────

/**
 * Refund `amount` EGP of a paid online order through its gateway and record it on
 * order.payment.refunds (caller saves the order). Methods a gateway cannot refund
 * electronically (Fawry cash, valU) are recorded as `manual_required` instead of failing.
 * @returns {Promise<{ refundId: string|null, status: 'succeeded'|'manual_required'|'none' }>}
 */
export async function processOnlineRefund(order, amount, reason = '') {
  const provider = paymentProviderFor(order.paymentMethod);
  if (!provider || order.paymentStatus !== 'paid') return { refundId: null, status: 'none' };

  if (provider === 'stripe') {
    const refundId = await processStripeRefund(order, amount);
    if (refundId) order.stripeRefundId = refundId;
    return { refundId, status: refundId ? 'succeeded' : 'none' };
  }

  const record = (refundId, status, note = '') => {
    order.payment.refunds.push({ refundId, amount, status, note });
    return { refundId, status };
  };

  if (provider === 'paymob') {
    if (!order.payment?.transactionId) {
      return record(null, 'manual_required', 'No Paymob transaction id on the order');
    }
    try {
      return record(await refundPaymobTransaction(order.payment.transactionId, amount), 'succeeded');
    } catch (err) {
      if (order.paymentMethod === 'paymob_valu') {
        return record(null, 'manual_required', `valU refund needs manual handling: ${err.message}`);
      }
      throw err;
    }
  }

  // Fawry
  try {
    return record(await refundFawryPayment(order.payment.fawryReferenceNumber, amount, reason || 'Refund'), 'succeeded');
  } catch (err) {
    return record(null, 'manual_required', `Fawry refund needs manual handling: ${err.message}`);
  }
}
