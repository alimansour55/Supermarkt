import Product from '../models/Product.js';
import Coupon from '../models/Coupon.js';
import User from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { normalizeVariantId } from '../utils/productCatalog.js';
import { getStripe } from '../config/stripe.js';

const CUSTOMER_CANCELLABLE = new Set(['pending', 'confirmed', 'preparing']);
const ADMIN_CANCELLABLE = new Set(['pending', 'confirmed', 'preparing', 'out_for_delivery']);

export async function restoreOrderInventory(orderItems) {
  for (const item of orderItems) {
    const productId = item.product || item.productId;
    if (!productId) continue;

    const variantId = item.variantId ? normalizeVariantId(item.variantId) : null;
    const qty = item.quantity;

    const product = await Product.findById(productId);
    if (!product) continue;

    if (variantId && product.variants?.length) {
      const variant = product.variants.id(variantId);
      if (variant) {
        variant.stock = (variant.stock || 0) + qty;
        product.soldCount = Math.max(0, (product.soldCount || 0) - qty);
      }
    } else {
      product.stock = (product.stock || 0) + qty;
      product.soldCount = Math.max(0, (product.soldCount || 0) - qty);
    }

    await product.save({ validateBeforeSave: false });
  }
}

export async function reverseOrderLoyalty(order) {
  if (order.pointsRedeemed > 0) {
    await User.findByIdAndUpdate(order.user, {
      $inc: { pointsBalance: order.pointsRedeemed },
      $push: {
        pointsHistory: {
          type: 'refund',
          points: order.pointsRedeemed,
          order: order._id,
          amount: order.pointsDiscount,
          note: `Points restored — order ${order.orderNumber} cancelled/refunded`,
        },
      },
    });
    order.pointsRedeemed = 0;
    order.pointsDiscount = 0;
  }

  if (order.pointsEarned > 0) {
    await User.findByIdAndUpdate(order.user, {
      $inc: { pointsBalance: -order.pointsEarned },
      $push: {
        pointsHistory: {
          type: 'adjust',
          points: -order.pointsEarned,
          order: order._id,
          note: `Points reversed — order ${order.orderNumber} cancelled/refunded`,
        },
      },
    });
    order.pointsEarned = 0;
  }
}

export async function reverseCouponUsage(order) {
  if (!order.couponCode) return;
  // Guard against driving usedCount negative (double cancel, or a coupon whose
  // redemption was never counted).
  await Coupon.findOneAndUpdate(
    { code: order.couponCode, usedCount: { $gt: 0 } },
    { $inc: { usedCount: -1 } },
  );
}

export function assertCustomerCanCancel(order) {
  if (order.orderStatus === 'cancelled') {
    throw new AppError('Order is already cancelled', 400);
  }
  if (!CUSTOMER_CANCELLABLE.has(order.orderStatus)) {
    throw new AppError('This order can no longer be cancelled', 400);
  }
}

export function assertAdminCanCancel(order) {
  if (order.orderStatus === 'cancelled') {
    throw new AppError('Order is already cancelled', 400);
  }
  if (!ADMIN_CANCELLABLE.has(order.orderStatus)) {
    throw new AppError('Delivered orders cannot be cancelled — use refund instead', 400);
  }
}

export async function processStripeRefund(order, amountEgp) {
  if (order.paymentMethod !== 'stripe' || order.paymentStatus !== 'paid') {
    return null;
  }

  try {
    const stripe = getStripe();
    let paymentIntentId = order.stripeSessionId;

    if (paymentIntentId?.startsWith('cs_')) {
      const session = await stripe.checkout.sessions.retrieve(paymentIntentId);
      paymentIntentId = session.payment_intent;
    }

    if (!paymentIntentId) return null;

    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount: Math.round(amountEgp * 100),
    });

    return refund.id;
  } catch (err) {
    console.error('Stripe refund failed:', err.message);
    throw new AppError(`Refund failed: ${err.message}`, 502);
  }
}

export function pushStatusHistory(order, status, { note = '', changedBy = null } = {}) {
  order.statusHistory = order.statusHistory || [];
  order.statusHistory.push({
    status,
    changedAt: new Date(),
    note,
    changedBy,
  });
}

export function visibleMessages(order, isStaff = false) {
  const messages = order.messages || [];
  if (isStaff) return messages;
  return messages.filter((m) => !m.isInternal);
}
