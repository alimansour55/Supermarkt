import { formatMoneyLatin, formatPrice } from '../../utils/formatters';

export const COUPON_TYPE_META = {
  percent: {
    ar: 'نسبة مئوية',
    en: 'Percentage',
    chip: 'border-violet-200 bg-violet-50 text-violet-900',
    icon: '%',
  },
  fixed: {
    ar: 'مبلغ ثابت',
    en: 'Fixed amount',
    chip: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    icon: 'EGP',
  },
  free_delivery: {
    ar: 'توصيل مجاني',
    en: 'Free delivery',
    chip: 'border-sky-200 bg-sky-50 text-sky-900',
    icon: '🚚',
  },
};

export const COUPON_STATUS_META = {
  active: {
    ar: 'نشط',
    en: 'Active',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  },
  inactive: {
    ar: 'معطّل',
    en: 'Inactive',
    className: 'border-slate-200 bg-slate-100 text-slate-600',
  },
  expired: {
    ar: 'منتهي',
    en: 'Expired',
    className: 'border-amber-200 bg-amber-50 text-amber-900',
  },
  exhausted: {
    ar: 'مستنفد',
    en: 'Exhausted',
    className: 'border-orange-200 bg-orange-50 text-orange-900',
  },
};

export function getCouponType(coupon) {
  return coupon?.discountType || coupon?.type || 'percent';
}

export function getCouponValue(coupon) {
  return coupon?.discountValue ?? coupon?.value ?? 0;
}

export function getCouponLifecycle(coupon) {
  if (coupon?.isActive === false) return 'inactive';
  if (coupon?.expiryDate) {
    const expiry = new Date(coupon.expiryDate);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (expiry < today) return 'expired';
  }
  const used = coupon?.usedCount || 0;
  const limit = coupon?.usageLimit;
  if (limit && used >= limit) return 'exhausted';
  return 'active';
}

export function formatCouponDiscount(coupon, isAr) {
  const type = getCouponType(coupon);
  const value = getCouponValue(coupon);
  const meta = COUPON_TYPE_META[type] || COUPON_TYPE_META.percent;

  if (type === 'free_delivery') {
    return isAr ? meta.ar : meta.en;
  }
  if (type === 'percent') {
    return `${formatMoneyLatin(value, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}%`;
  }
  return formatPrice(value, 'en-US', isAr ? 'ج.م' : 'EGP');
}

export function formatCouponTypeLabel(type, isAr) {
  const meta = COUPON_TYPE_META[type] || COUPON_TYPE_META.percent;
  return isAr ? meta.ar : meta.en;
}

export function formatCouponUsage(coupon, isAr) {
  const used = coupon?.usedCount || 0;
  const limit = coupon?.usageLimit;
  if (!limit) {
    return {
      label: isAr ? `${used} استخدام` : `${used} uses`,
      percent: null,
      unlimited: true,
    };
  }
  const percent = Math.min(100, Math.round((used / limit) * 100));
  return {
    label: `${used} / ${limit}`,
    percent,
    unlimited: false,
  };
}

export function formatCouponExpiry(date, isAr) {
  if (!date) return '—';
  return new Intl.DateTimeFormat(isAr ? 'ar-EG' : 'en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date));
}

export function formatMinSubtotal(amount, isAr) {
  if (!amount) return isAr ? 'بدون حد أدنى' : 'No minimum';
  return isAr
    ? `حد أدنى ${formatMoneyLatin(amount)} ج.م`
    : `Min ${formatMoneyLatin(amount)} EGP`;
}

export function getCouponLabel(coupon, isAr) {
  return isAr
    ? (coupon?.labelAr || coupon?.labelEn || '')
    : (coupon?.labelEn || coupon?.labelAr || '');
}

export function buildCouponLabelAr(discountType, discountValue) {
  const value = Number(discountValue) || 0;
  if (discountType === 'free_delivery') return 'توصيل مجاني';
  if (discountType === 'fixed') return `خصم ${value} ج.م`;
  return `خصم ${value}%`;
}

export function buildCouponLabelEn(discountType, discountValue) {
  const value = Number(discountValue) || 0;
  if (discountType === 'free_delivery') return 'Free delivery';
  if (discountType === 'fixed') return `${value} EGP off`;
  return `${value}% off`;
}

/** True when labels still match what we'd auto-generate from the discount fields. */
export function labelsMatchSuggestion(labelAr, labelEn, discountType, discountValue) {
  const expectedAr = buildCouponLabelAr(discountType, discountValue);
  const expectedEn = buildCouponLabelEn(discountType, discountValue);
  const ar = (labelAr || '').trim();
  const en = (labelEn || '').trim();
  return (!ar && !en) || (ar === expectedAr && en === expectedEn);
}

/** Extract trailing digits from codes like SAVE20 → 20 */
export function parseDiscountFromCode(code) {
  const match = String(code || '').trim().match(/(\d+)\s*$/);
  return match ? Number(match[1]) : null;
}

/** Detect when customer-facing copy disagrees with the configured discount. */
export function labelsMismatchDiscount(labelAr, labelEn, discountType, discountValue) {
  if (discountType !== 'percent') return false;
  const value = Number(discountValue) || 0;
  const texts = [labelAr, labelEn].filter(Boolean).join(' ');
  const matches = texts.match(/(\d+)\s*%/g);
  if (!matches?.length) return false;
  return matches.some((m) => {
    const n = Number(m.replace(/\s*%/, ''));
    return Number.isFinite(n) && n !== value;
  });
}
