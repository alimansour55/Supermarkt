import Coupon from '../models/Coupon.js';
import Order from '../models/Order.js';
import { AppError } from '../utils/AppError.js';

/** Orders in these states no longer "hold" a coupon redemption for per-user limits. */
const RELEASED_ORDER_STATES = ['cancelled'];

function normalizeCode(code) {
  return String(code || '').toUpperCase().trim();
}

/**
 * Read-only preflight: confirm this customer may still redeem `code` against `subtotal`.
 * Throws AppError (400) with a customer-facing message when not. Returns the Coupon doc.
 * Does NOT mutate usedCount — call reserveCouponRedemption for that, atomically, at commit time.
 */
export async function assertCouponRedeemable({ code, userId, subtotal = 0, lang = 'en' }) {
  const normalized = normalizeCode(code);
  if (!normalized) {
    throw new AppError(lang === 'ar' ? 'كود الخصم مطلوب' : 'Discount code is required', 400);
  }

  const coupon = await Coupon.findOne({ code: normalized, isActive: true });
  if (!coupon) {
    throw new AppError(lang === 'ar' ? 'كود الخصم غير صالح' : 'Invalid discount code', 400);
  }

  const result = coupon.isValid(Number(subtotal) || 0);
  if (!result.valid) {
    throw new AppError(result.message, 400);
  }

  if (coupon.perUserLimit && userId) {
    const usedByUser = await Order.countDocuments({
      user: userId,
      couponCode: normalized,
      orderStatus: { $nin: RELEASED_ORDER_STATES },
    });
    if (usedByUser >= coupon.perUserLimit) {
      throw new AppError(
        lang === 'ar'
          ? 'لقد استخدمت هذا الكود بالفعل'
          : 'You have already used this discount code',
        400,
      );
    }
  }

  return coupon;
}

/**
 * Atomically claim one redemption slot. The `usedCount < usageLimit` guard lives in the
 * query itself, so concurrent checkouts can never push usedCount past usageLimit.
 * Returns the updated Coupon doc, or null when the code is gone / exhausted / inactive.
 */
export async function reserveCouponRedemption(code) {
  const normalized = normalizeCode(code);
  if (!normalized) return null;

  return Coupon.findOneAndUpdate(
    {
      code: normalized,
      isActive: true,
      $or: [
        { usageLimit: null },
        { usageLimit: { $exists: false } },
        { $expr: { $lt: ['$usedCount', '$usageLimit'] } },
      ],
    },
    { $inc: { usedCount: 1 } },
    { new: true },
  );
}

/** Give back a redemption slot (order failed after reserve, or was cancelled/refunded). */
export async function releaseCouponRedemption(code) {
  const normalized = normalizeCode(code);
  if (!normalized) return;

  await Coupon.findOneAndUpdate(
    { code: normalized, usedCount: { $gt: 0 } },
    { $inc: { usedCount: -1 } },
  );
}
