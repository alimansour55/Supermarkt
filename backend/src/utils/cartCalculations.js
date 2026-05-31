import Coupon from '../models/Coupon.js';
import { formatCoupon } from './formatters.js';

export const FREE_DELIVERY_THRESHOLD = 500;
export const SCHEDULED_DELIVERY_FEE = 29.99;
export const EXPRESS_DELIVERY_FEE = 49.99;

const FALLBACK_COUPONS = {
  FIRST20: {
    code: 'FIRST20',
    discountType: 'percent',
    discountValue: 20,
    minSubtotal: 100,
    labelAr: 'خصم 20%',
    labelEn: '20% off',
  },
  SAVE50: {
    code: 'SAVE50',
    discountType: 'fixed',
    discountValue: 50,
    minSubtotal: 300,
    labelAr: 'خصم 50 ج.م',
    labelEn: '50 EGP off',
  },
  FREESHIP: {
    code: 'FREESHIP',
    discountType: 'free_delivery',
    discountValue: 0,
    minSubtotal: 0,
    labelAr: 'توصيل مجاني',
    labelEn: 'Free delivery',
  },
};

const toCalcCoupon = (coupon) => ({
  code: coupon.code,
  type: coupon.discountType || coupon.type,
  value: coupon.discountValue ?? coupon.value,
  minSubtotal: coupon.minSubtotal || 0,
  labelAr: coupon.labelAr,
  labelEn: coupon.labelEn,
});

export async function validateCoupon(code, subtotal) {
  if (!code) return { valid: false, message: 'No code provided' };

  const normalized = code.toUpperCase().trim();
  let coupon = await Coupon.findOne({ code: normalized, isActive: true });

  if (coupon) {
    const result = coupon.isValid(subtotal);
    if (!result.valid) return result;
    return { valid: true, coupon: toCalcCoupon(coupon) };
  }

  const fallback = FALLBACK_COUPONS[normalized];
  if (!fallback) {
    return { valid: false, message: 'Invalid discount code' };
  }

  if (subtotal < fallback.minSubtotal) {
    return {
      valid: false,
      message: `Minimum order ${fallback.minSubtotal} EGP required`,
      minSubtotal: fallback.minSubtotal,
    };
  }

  return { valid: true, coupon: toCalcCoupon(fallback) };
}

export function calculateDiscount(subtotal, coupon) {
  if (!coupon) return 0;

  const type = coupon.type || coupon.discountType;
  const value = coupon.value ?? coupon.discountValue;

  if (type === 'percent') {
    return Math.round((subtotal * value) / 100 * 100) / 100;
  }
  if (type === 'fixed') {
    return Math.min(value, subtotal);
  }
  return 0;
}

export async function calculateCartTotals({
  items = [],
  deliveryMethod = 'scheduled',
  discountCode = null,
}) {
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  let deliveryFee = 0;
  if (deliveryMethod === 'express') {
    deliveryFee = EXPRESS_DELIVERY_FEE;
  } else if (subtotal < FREE_DELIVERY_THRESHOLD) {
    deliveryFee = SCHEDULED_DELIVERY_FEE;
  }

  let discountAmount = 0;
  let appliedCoupon = null;
  let freeDeliveryFromCoupon = false;

  if (discountCode) {
    const validation = await validateCoupon(discountCode, subtotal);
    if (validation.valid) {
      appliedCoupon = validation.coupon;
      if (appliedCoupon.type === 'free_delivery') {
        freeDeliveryFromCoupon = true;
      } else {
        discountAmount = calculateDiscount(subtotal, appliedCoupon);
      }
    }
  }

  if (freeDeliveryFromCoupon) {
    deliveryFee = 0;
  }

  const total = Math.max(0, subtotal + deliveryFee - discountAmount);
  const freeDeliveryRemaining = Math.max(0, FREE_DELIVERY_THRESHOLD - subtotal);

  return {
    subtotal,
    deliveryFee,
    discountAmount,
    discount: discountAmount,
    total,
    appliedCoupon,
    freeDeliveryRemaining,
    qualifiesForFreeDelivery: subtotal >= FREE_DELIVERY_THRESHOLD || freeDeliveryFromCoupon,
  };
}

export { formatCoupon };
