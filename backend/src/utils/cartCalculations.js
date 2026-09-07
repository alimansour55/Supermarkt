import Coupon from '../models/Coupon.js';
import { formatCoupon } from './formatters.js';
import {
  calculatePointsRedemption,
  getLoyaltySettings,
} from '../services/loyalty.service.js';
import {
  isFreeDeliveryForMethod,
  isThresholdMet,
  resolveDeliveryFee,
  resolveFreeDeliveryMethods,
} from './freeDelivery.js';
import StoreSettings from '../models/StoreSettings.js';
import { findDeliveryZone } from '../services/deliveryZone.service.js';
import { calculateItemsSubtotal, calculatePromotionSavings } from './cartLinePricing.js';

function roundMoney(n) {
  return Math.round(Number(n) * 100) / 100;
}

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
  pointsToRedeem = 0,
  user = null,
  deliveryZoneId = null,
}) {
  const listSubtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const subtotal = calculateItemsSubtotal(items);
  const promotionSavings = calculatePromotionSavings(items);
  const deliveryZone = await findDeliveryZone(deliveryZoneId);
  const freeDeliveryThreshold = deliveryZone?.freeDeliveryThreshold ?? FREE_DELIVERY_THRESHOLD;

  const storeSettings = await StoreSettings.findOne({ key: 'main' }).lean();
  const freeDeliveryMethods = resolveFreeDeliveryMethods(deliveryZone, storeSettings);

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

  const deliveryFee = resolveDeliveryFee({
    deliveryMethod,
    subtotal,
    threshold: freeDeliveryThreshold,
    freeDeliveryMethods,
    freeDeliveryFromCoupon,
    scheduledFee: deliveryZone?.scheduledFee ?? SCHEDULED_DELIVERY_FEE,
    expressFee: deliveryZone?.expressFee ?? EXPRESS_DELIVERY_FEE,
  });

  let pointsRedeemed = 0;
  let pointsDiscount = 0;
  let loyalty = null;

  if (pointsToRedeem > 0) {
    loyalty = await getLoyaltySettings();
    const redemption = calculatePointsRedemption({
      requestedPoints: pointsToRedeem,
      user,
      subtotal,
      couponDiscount: discountAmount,
      loyalty,
    });
    pointsRedeemed = redemption.pointsRedeemed;
    pointsDiscount = redemption.pointsDiscount;
    loyalty = redemption.rules;
  }

  const total = Math.max(0, subtotal + deliveryFee - discountAmount - pointsDiscount);
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
    listSubtotal: roundMoney(listSubtotal),
    promotionSavings,
    deliveryFee,
    discountAmount,
    discount: discountAmount,
    pointsRedeemed,
    pointsDiscount,
    total,
    appliedCoupon,
    loyalty,
    deliveryZone,
    freeDeliveryRemaining,
    freeDeliveryMethods,
    thresholdMet,
    freeDeliveryForCurrentMethod,
    qualifiesForFreeDelivery: thresholdMet,
  };
}

export { formatCoupon };
