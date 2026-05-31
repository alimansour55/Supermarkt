export const FREE_DELIVERY_THRESHOLD = 500;
export const SCHEDULED_DELIVERY_FEE = 29.99;
export const EXPRESS_DELIVERY_FEE = 49.99;

export const COUPONS = {
  FIRST20: { code: 'FIRST20', type: 'percent', value: 20, minSubtotal: 100, labelAr: 'خصم 20%', labelEn: '20% off' },
  SAVE50: { code: 'SAVE50', type: 'fixed', value: 50, minSubtotal: 300, labelAr: 'خصم 50 ج.م', labelEn: '50 EGP off' },
  FREESHIP: { code: 'FREESHIP', type: 'free_delivery', value: 0, minSubtotal: 0, labelAr: 'توصيل مجاني', labelEn: 'Free delivery' },
};

export function validateCoupon(code, subtotal) {
  if (!code) return { valid: false, message: 'No code provided' };
  const coupon = COUPONS[code.toUpperCase()];
  if (!coupon) return { valid: false, message: 'Invalid discount code' };
  if (subtotal < coupon.minSubtotal) {
    return { valid: false, message: `Minimum order ${coupon.minSubtotal} EGP required`, minSubtotal: coupon.minSubtotal };
  }
  return { valid: true, coupon };
}

export function calculateDiscount(subtotal, coupon) {
  if (!coupon) return 0;
  if (coupon.type === 'percent') return Math.round((subtotal * coupon.value) / 100 * 100) / 100;
  if (coupon.type === 'fixed') return Math.min(coupon.value, subtotal);
  return 0;
}

export function calculateCartTotals({ items = [], deliveryMethod = 'scheduled', discountCode = null }) {
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
    const validation = validateCoupon(discountCode, subtotal);
    if (validation.valid) {
      appliedCoupon = validation.coupon;
      if (appliedCoupon.type === 'free_delivery') {
        freeDeliveryFromCoupon = true;
      } else {
        discountAmount = calculateDiscount(subtotal, appliedCoupon);
      }
    }
  }

  if (freeDeliveryFromCoupon) deliveryFee = 0;

  const total = Math.max(0, subtotal + deliveryFee - discountAmount);
  const freeDeliveryRemaining = Math.max(0, FREE_DELIVERY_THRESHOLD - subtotal);

  return {
    subtotal,
    deliveryFee,
    discountAmount,
    total,
    appliedCoupon,
    freeDeliveryRemaining,
    qualifiesForFreeDelivery: subtotal >= FREE_DELIVERY_THRESHOLD || freeDeliveryFromCoupon,
  };
}
