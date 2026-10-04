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

/**
 * Coupons are validated server-side only (admin-created, with live expiry / usage /
 * per-customer checks). There are no client-side demo codes — this keeps the cart
 * total honest and prevents a stale local code from ever showing a phantom discount.
 */
export async function validateCouponAsync(code, subtotal) {
  if (!code) return { valid: false, message: 'No code provided' };

  const normalized = String(code).toUpperCase().trim();

  if (!useApi) {
    return { valid: false, message: 'Invalid discount code' };
  }

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

export function calculateDiscount(subtotal, coupon) {
  if (!coupon) return 0;
  const type = coupon.type || coupon.discountType;
  const rawValue = Number(coupon.value ?? coupon.discountValue ?? 0) || 0;
  const safeSubtotal = Math.max(0, Number(subtotal) || 0);
  if (type === 'percent') {
    const pct = Math.min(Math.max(rawValue, 0), 100);
    return Math.min(Math.round((safeSubtotal * pct) / 100 * 100) / 100, safeSubtotal);
  }
  if (type === 'fixed') return Math.min(Math.max(rawValue, 0), safeSubtotal);
  return 0;
}

function resolveDeliveryThreshold(deliveryZone) {
  const raw = deliveryZone?.freeDeliveryThreshold;
  return raw > 0 ? raw : FREE_DELIVERY_THRESHOLD;
}

function resolveActiveCoupon(discountCode, cachedCoupon, subtotal) {
  const normalizedCode = discountCode ? String(discountCode).toUpperCase().trim() : '';

  // Display-only: reuse the coupon the server already validated for this cart.
  // The authoritative discount is always recomputed by the backend at checkout.
  if (cachedCoupon?.code) {
    const cachedCode = String(cachedCoupon.code).toUpperCase();
    if (!normalizedCode || cachedCode === normalizedCode) {
      if (subtotal >= (cachedCoupon.minSubtotal || 0)) return cachedCoupon;
    }
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
  sellerShipmentFee = 0,
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

  // Marketplace (mirrors the server): the store fee and free-delivery threshold cover only lines
  // the store delivers; each seller-shipped shipment adds a flat fee.
  const isStoreLine = (item) => !item.soldBy || item.fulfilledBy === 'store';
  const storeItems = items.filter(isStoreLine);
  const hasSellerItems = items.some((item) => item.soldBy);
  const storeSubtotal = hasSellerItems ? calculateItemsSubtotal(storeItems) : subtotal;
  const sellerShipmentCount = new Set(
    items.filter((item) => item.soldBy && item.fulfilledBy !== 'store').map((item) => String(item.soldBy._id)),
  ).size;
  const storeDeliveryFee = storeItems.length || !items.length
    ? resolveDeliveryFee({
      deliveryMethod,
      subtotal: storeSubtotal,
      threshold: freeDeliveryThreshold,
      freeDeliveryMethods,
      freeDeliveryFromCoupon,
      scheduledFee: deliveryZone?.scheduledFee ?? SCHEDULED_DELIVERY_FEE,
      expressFee: deliveryZone?.expressFee ?? EXPRESS_DELIVERY_FEE,
    })
    : 0;
  const sellerShippingFee = Math.round(sellerShipmentCount * Number(sellerShipmentFee || 0) * 100) / 100;
  const deliveryFee = Math.round((storeDeliveryFee + sellerShippingFee) * 100) / 100;

  const total = Math.max(0, subtotal + deliveryFee - discountAmount);
  const freeDeliveryRemaining = Math.max(0, freeDeliveryThreshold - storeSubtotal);
  const thresholdMet = isThresholdMet(storeSubtotal, freeDeliveryThreshold, freeDeliveryFromCoupon);
  const freeDeliveryForCurrentMethod = isFreeDeliveryForMethod({
    deliveryMethod,
    subtotal: storeSubtotal,
    threshold: freeDeliveryThreshold,
    freeDeliveryMethods,
    freeDeliveryFromCoupon,
  });

  return {
    subtotal,
    listSubtotal: Math.round(listSubtotal * 100) / 100,
    promotionSavings,
    deliveryFee,
    storeDeliveryFee,
    sellerShippingFee,
    sellerShipmentCount,
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
