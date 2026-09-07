import { couponService } from '../services/apiServices';
import {
  isFreeDeliveryForMethod,
  isThresholdMet,
  resolveDeliveryFee,
  resolveFreeDeliveryMethods,
} from './freeDelivery.js';
import { calculateItemsSubtotal, calculatePromotionSavings } from './cartLinePricing.js';

export const FREE_DELIVERY_THRESHOLD = 500;
export const SCHEDULED_DELIVERY_FEE = 29.99;
export const EXPRESS_DELIVERY_FEE = 49.99;

const useApi = import.meta.env.VITE_USE_API !== 'false';

export const COUPONS = {
  FIRST20: { code: 'FIRST20', type: 'percent', value: 20, minSubtotal: 100, labelAr: 'خصم 20%', labelEn: '20% off' },
  SAVE50: { code: 'SAVE50', type: 'fixed', value: 50, minSubtotal: 300, labelAr: 'خصم 50 ج.م', labelEn: '50 EGP off' },
  FREESHIP: { code: 'FREESHIP', type: 'free_delivery', value: 0, minSubtotal: 0, labelAr: 'توصيل مجاني', labelEn: 'Free delivery' },
};

export function normalizeCoupon(coupon) {
  if (!coupon) return null;
  return {
    code: String(coupon.code || '').toUpperCase(),
    type: coupon.type || coupon.discountType,
    value: Number(coupon.value ?? coupon.discountValue ?? 0),
    minSubtotal: Number(coupon.minSubtotal || 0),
    labelAr: coupon.labelAr || coupon.code,
    labelEn: coupon.labelEn || coupon.code,
  };
}

function validateCouponLocal(code, subtotal) {
  if (!code) return { valid: false, message: 'No code provided' };
  const normalized = String(code).toUpperCase().trim();
  const coupon = COUPONS[normalized];
  if (!coupon) return { valid: false, message: 'Invalid discount code' };
  if (subtotal < coupon.minSubtotal) {
    return {
      valid: false,
      message: `Minimum order ${coupon.minSubtotal} EGP required`,
      minSubtotal: coupon.minSubtotal,
    };
  }
  return { valid: true, coupon: normalizeCoupon(coupon) };
}

/** Sync validation — local demo codes only */
export function validateCoupon(code, subtotal) {
  return validateCouponLocal(code, subtotal);
}

/** Validate against API (admin-created coupons) or local fallback */
export async function validateCouponAsync(code, subtotal) {
  if (!code) return { valid: false, message: 'No code provided' };

  const normalized = String(code).toUpperCase().trim();

  if (useApi) {
    try {
      const { data } = await couponService.validate(normalized, subtotal);
      const coupon = normalizeCoupon(data.coupon);
      if (!coupon?.code) {
        return { valid: false, message: 'Invalid discount code' };
      }
      return { valid: true, coupon };
    } catch (err) {
      return {
        valid: false,
        message: err.response?.data?.message || 'Invalid discount code',
      };
    }
  }

  return validateCouponLocal(normalized, subtotal);
}

export function calculateDiscount(subtotal, coupon) {
  if (!coupon) return 0;
  const type = coupon.type || coupon.discountType;
  const value = Number(coupon.value ?? coupon.discountValue ?? 0);
  if (type === 'percent') return Math.round((subtotal * value) / 100 * 100) / 100;
  if (type === 'fixed') return Math.min(value, subtotal);
  return 0;
}

function resolveDeliveryThreshold(deliveryZone) {
  const raw = deliveryZone?.freeDeliveryThreshold;
  return raw > 0 ? raw : FREE_DELIVERY_THRESHOLD;
}

function resolveActiveCoupon(discountCode, cachedCoupon, subtotal) {
  const normalizedCode = discountCode ? String(discountCode).toUpperCase().trim() : '';

  if (cachedCoupon?.code) {
    const cachedCode = String(cachedCoupon.code).toUpperCase();
    if (!normalizedCode || cachedCode === normalizedCode) {
      if (subtotal >= (cachedCoupon.minSubtotal || 0)) return cachedCoupon;
    }
  }

  if (normalizedCode) {
    const local = validateCouponLocal(normalizedCode, subtotal);
    if (local.valid) return local.coupon;
  }

  return null;
}

export function calculateCartTotals({
  items = [],
  deliveryMethod = 'scheduled',
  discountCode = null,
  deliveryZone = null,
  appliedCoupon: cachedCoupon = null,
  storeFreeDeliverySettings = null,
}) {
  const listSubtotal = items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0);
  const subtotal = calculateItemsSubtotal(items);
  const promotionSavings = calculatePromotionSavings(items);
  const freeDeliveryThreshold = resolveDeliveryThreshold(deliveryZone);
  const freeDeliveryMethods = resolveFreeDeliveryMethods(deliveryZone, storeFreeDeliverySettings);

  const coupon = resolveActiveCoupon(discountCode, cachedCoupon, subtotal);

  let discountAmount = 0;
  let freeDeliveryFromCoupon = false;

  if (coupon) {
    const type = coupon.type || coupon.discountType;
    if (type === 'free_delivery') {
      freeDeliveryFromCoupon = true;
    } else {
      discountAmount = calculateDiscount(subtotal, coupon);
    }
  }

  const deliveryFee = resolveDeliveryFee({
    deliveryMethod,
    subtotal,
    threshold: freeDeliveryThreshold,
    freeDeliveryMethods,
    freeDeliveryFromCoupon,
    scheduledFee: deliveryZone?.scheduledFee ?? SCHEDULED_DELIVERY_FEE,
    expressFee: deliveryZone?.expressFee ?? EXPRESS_DELIVERY_FEE,
  });

  const total = Math.max(0, subtotal + deliveryFee - discountAmount);
  const freeDeliveryRemaining = Math.max(0, freeDeliveryThreshold - subtotal);
  const thresholdMet = isThresholdMet(subtotal, freeDeliveryThreshold, freeDeliveryFromCoupon);
  const freeDeliveryForCurrentMethod = isFreeDeliveryForMethod({
    deliveryMethod,
    subtotal,
    threshold: freeDeliveryThreshold,
    freeDeliveryMethods,
    freeDeliveryFromCoupon,
  });

  return {
    subtotal,
    listSubtotal: Math.round(listSubtotal * 100) / 100,
    promotionSavings,
    deliveryFee,
    discountAmount,
    total,
    appliedCoupon: coupon,
    freeDeliveryRemaining,
    freeDeliveryMethods,
    thresholdMet,
    freeDeliveryForCurrentMethod,
    qualifiesForFreeDelivery: thresholdMet,
  };
}
