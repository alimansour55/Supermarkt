import Coupon from '../models/Coupon.js';
import { formatCoupon } from './formatters.js';
import {
  calculatePointsRedemption,
  getLoyaltySettings,
} from '../services/loyalty.service.js';
import {
  calculateWalletRedemption,
  getWalletSettings,
} from '../services/wallet.service.js';
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
  const coupon = await Coupon.findOne({ code: normalized, isActive: true });

  if (!coupon) {
    return { valid: false, message: 'Invalid discount code' };
  }

  const result = coupon.isValid(subtotal);
  if (!result.valid) return result;
  return { valid: true, coupon: toCalcCoupon(coupon) };
}

export function calculateDiscount(subtotal, coupon) {
  if (!coupon) return 0;

  const type = coupon.type || coupon.discountType;
  const rawValue = Number(coupon.value ?? coupon.discountValue) || 0;
  const safeSubtotal = Math.max(0, Number(subtotal) || 0);

  if (type === 'percent') {
    const pct = Math.min(Math.max(rawValue, 0), 100);
    const discount = Math.round((safeSubtotal * pct) / 100 * 100) / 100;
    return Math.min(discount, safeSubtotal);
  }
  if (type === 'fixed') {
    return Math.min(Math.max(rawValue, 0), safeSubtotal);
  }
  return 0;
}

export async function calculateCartTotals({
  items = [],
  deliveryMethod = 'scheduled',
  discountCode = null,
  pointsToRedeem = 0,
  walletToSpend = 0,
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

  const totalBeforeWallet = Math.max(0, subtotal + deliveryFee - discountAmount - pointsDiscount);

  let walletApplied = 0;
  let walletBalance = Math.max(0, Number(user?.walletBalance || 0));
  let walletRules = null;
  if (walletToSpend > 0 && user) {
    walletRules = await getWalletSettings();
    const redemption = calculateWalletRedemption({
      requestedAmount: walletToSpend,
      user,
      payableTotal: totalBeforeWallet,
      settings: walletRules,
    });
    walletApplied = redemption.walletApplied;
  }

  const total = Math.max(0, roundMoney(totalBeforeWallet - walletApplied));
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
    totalBeforeWallet,
    walletApplied,
    walletBalance,
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
