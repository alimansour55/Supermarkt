import { DELIVERY_METHODS } from '../constants/deliveryOptions';
import { formatPrice } from './formatters';

export const DEFAULT_FREE_DELIVERY_BANNER = {
  progressTitleAr: 'أضف {{remaining}} للمجاني',
  progressTitleEn: 'Add {{remaining}} for free',
  progressSubtitleAr: '{{methodsOnly}} · {{subtotal}}',
  progressSubtitleEn: '{{methodsOnly}} · {{subtotal}}',
  successTitleAr: '🎉 توصيل مجاني',
  successTitleEn: '🎉 Free delivery',
  successSubtitleAr: '',
  successSubtitleEn: '',
  switchTitleAr: '🎉 توصيل مجاني',
  switchTitleEn: '🎉 Free delivery',
  switchSubtitleAr: '{{methodsOnly}}',
  switchSubtitleEn: '{{methodsOnly}}',
  couponTitleAr: '🎁 توصيل مجاني',
  couponTitleEn: '🎁 Free delivery',
  couponSubtitleAr: 'من الكوبون',
  couponSubtitleEn: 'Coupon applied',
  methodNoteAr: '{{methodsOnly}}',
  methodNoteEn: '{{methodsOnly}}',
};

export const FREE_DELIVERY_BANNER_PLACEHOLDERS = [
  '{{remaining}}',
  '{{subtotal}}',
  '{{methods}}',
  '{{methodsOnly}}',
];

export const DELIVERY_METHOD_IDS = ['scheduled', 'express', 'recurring'];

export const DEFAULT_FREE_DELIVERY_METHODS = ['scheduled', 'recurring'];

export function filterFreeDeliveryMethods(methods) {
  if (!Array.isArray(methods)) return [];
  return methods
    .map((m) => (typeof m === 'string' ? m : m?.value || m?.method || ''))
    .filter((m) => DELIVERY_METHOD_IDS.includes(m));
}

export function parseFreeDeliveryMethodsFromApi(methods, fallback = DEFAULT_FREE_DELIVERY_METHODS) {
  const filtered = filterFreeDeliveryMethods(methods);
  return filtered.length ? filtered : [...fallback];
}

export function normalizeFreeDeliveryMethods(methods) {
  return parseFreeDeliveryMethodsFromApi(methods);
}

export function resolveFreeDeliveryMethods(zone = null, store = null) {
  const zoneOverride = zone?.freeDeliveryOverride === true;
  const globalEnabled = store?.freeDeliveryEnabled !== false;

  if (zoneOverride) {
    return filterFreeDeliveryMethods(zone?.freeDeliveryMethods);
  }
  if (globalEnabled) {
    return filterFreeDeliveryMethods(store?.freeDeliveryMethods);
  }
  return [];
}

export function isThresholdMet(subtotal, threshold, freeDeliveryFromCoupon = false) {
  return freeDeliveryFromCoupon || Number(subtotal || 0) >= Number(threshold || 0);
}

export function isFreeDeliveryForMethod({
  deliveryMethod,
  subtotal,
  threshold,
  freeDeliveryMethods,
  freeDeliveryFromCoupon = false,
}) {
  if (freeDeliveryFromCoupon) return true;
  if (!isThresholdMet(subtotal, threshold)) return false;
  const methods = Array.isArray(freeDeliveryMethods) ? freeDeliveryMethods : [];
  return methods.includes(deliveryMethod);
}

export function resolveDeliveryFee({
  deliveryMethod,
  subtotal,
  threshold,
  freeDeliveryMethods,
  freeDeliveryFromCoupon = false,
  scheduledFee = 29.99,
  expressFee = 49.99,
}) {
  if (isFreeDeliveryForMethod({
    deliveryMethod,
    subtotal,
    threshold,
    freeDeliveryMethods,
    freeDeliveryFromCoupon,
  })) {
    return 0;
  }

  if (deliveryMethod === 'express') return expressFee;
  if (deliveryMethod === 'scheduled' || deliveryMethod === 'recurring') return scheduledFee;
  return 0;
}

export function formatFreeDeliveryMethodsList(methods, isAr) {
  const list = filterFreeDeliveryMethods(methods);
  if (!list.length) return isAr ? 'لا طرق' : 'No methods';
  const labels = list.map((id) => (
    isAr ? DELIVERY_METHODS[id]?.labelAr : DELIVERY_METHODS[id]?.labelEn
  ) || id);
  return isAr ? labels.join(' و') : labels.join(' & ');
}

const SHORT_METHOD_AR = {
  scheduled: 'العادي',
  express: 'السريع',
  recurring: 'الدوري',
};

const SHORT_METHOD_EN = {
  scheduled: 'Standard',
  express: 'Express',
  recurring: 'Recurring',
};

export function formatShortMethodsList(methods, isAr) {
  const map = isAr ? SHORT_METHOD_AR : SHORT_METHOD_EN;
  const list = filterFreeDeliveryMethods(methods);
  if (!list.length) return isAr ? '—' : '—';
  return list.map((id) => map[id] || id).join(isAr ? ' و' : ' & ');
}

export function formatMethodsOnlyPhrase(methods, isAr) {
  const list = formatShortMethodsList(methods, isAr);
  if (list === '—') return isAr ? 'لا توصيل مجاني.' : 'No free delivery.';
  if (!isAr) return `${list} only.`;
  // Arabic: the lām preposition elides with a following definite article — لـ + العادي ⇒ للعادي.
  return `${list.startsWith('ال') ? `لل${list.slice(2)}` : `لـ${list}`} فقط.`;
}

export function mergeFreeDeliveryBanner(settings = {}) {
  return { ...DEFAULT_FREE_DELIVERY_BANNER, ...(settings || {}) };
}

export function interpolateBannerTemplate(template, vars = {}) {
  if (!template) return '';
  return String(template).replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const value = vars[key];
    return value === undefined || value === null ? '' : String(value);
  }).trim();
}

function pickBannerLine(bannerSettings, key, isAr) {
  const merged = mergeFreeDeliveryBanner(bannerSettings);
  return merged[`${key}${isAr ? 'Ar' : 'En'}`] || '';
}

function buildBannerVars({ isAr, subtotal, freeDeliveryRemaining, methods }) {
  const methodsList = formatShortMethodsList(methods, isAr);
  const methodsOnly = formatMethodsOnlyPhrase(methods, isAr);
  return {
    remaining: formatPrice(freeDeliveryRemaining),
    subtotal: formatPrice(subtotal),
    methods: methodsList,
    methodsOnly: isAr ? methodsOnly.replace(/\.$/, '') : methodsOnly,
  };
}

export function getFreeDeliveryBannerContent({
  isAr,
  subtotal,
  threshold,
  freeDeliveryRemaining,
  freeDeliveryMethods,
  deliveryMethod,
  freeDeliveryFromCoupon = false,
  bannerSettings = null,
}) {
  const methods = Array.isArray(freeDeliveryMethods) ? freeDeliveryMethods : [];
  const vars = buildBannerVars({ isAr, subtotal, freeDeliveryRemaining, methods });
  const thresholdMet = isThresholdMet(subtotal, threshold, freeDeliveryFromCoupon);
  const currentFree = isFreeDeliveryForMethod({
    deliveryMethod,
    subtotal,
    threshold,
    freeDeliveryMethods: methods,
    freeDeliveryFromCoupon,
  });
  const progress = threshold > 0 ? Math.min(100, (Number(subtotal || 0) / threshold) * 100) : 0;

  if (freeDeliveryFromCoupon && currentFree) {
    return {
      variant: 'coupon',
      title: interpolateBannerTemplate(pickBannerLine(bannerSettings, 'couponTitle', isAr), vars),
      subtitle: interpolateBannerTemplate(pickBannerLine(bannerSettings, 'couponSubtitle', isAr), vars),
      progress: 100,
      currentFree: true,
      suggestMethods: [],
    };
  }

  if (!thresholdMet) {
    return {
      variant: 'progress',
      title: interpolateBannerTemplate(pickBannerLine(bannerSettings, 'progressTitle', isAr), vars),
      subtitle: interpolateBannerTemplate(pickBannerLine(bannerSettings, 'progressSubtitle', isAr), vars),
      progress,
      currentFree: false,
      suggestMethods: [],
    };
  }

  if (currentFree) {
    return {
      variant: 'success',
      title: interpolateBannerTemplate(pickBannerLine(bannerSettings, 'successTitle', isAr), vars),
      subtitle: interpolateBannerTemplate(pickBannerLine(bannerSettings, 'successSubtitle', isAr), vars),
      progress: 100,
      currentFree: true,
      suggestMethods: [],
    };
  }

  const suggestMethods = methods.filter((m) => m !== deliveryMethod);
  const shortSwitch = formatShortMethodsList(suggestMethods, isAr);

  return {
    variant: 'switch',
    title: interpolateBannerTemplate(pickBannerLine(bannerSettings, 'switchTitle', isAr), vars),
    subtitle: interpolateBannerTemplate(pickBannerLine(bannerSettings, 'switchSubtitle', isAr), vars),
    progress: 100,
    currentFree: false,
    suggestMethods,
    switchLabel: shortSwitch,
  };
}

export function getFreeDeliveryBannerText(props) {
  return getFreeDeliveryBannerContent(props).title;
}

export function getMethodFreeDeliveryNote({
  isAr,
  method,
  thresholdMet,
  freeDeliveryMethods,
  bannerSettings = null,
}) {
  if (!thresholdMet) return null;
  const methods = Array.isArray(freeDeliveryMethods) ? freeDeliveryMethods : [];
  if (methods.includes(method)) return null;
  const vars = buildBannerVars({
    isAr,
    subtotal: 0,
    freeDeliveryRemaining: 0,
    methods,
  });
  const template = pickBannerLine(bannerSettings, 'methodNote', isAr);
  const note = interpolateBannerTemplate(template, vars);
  return note || formatMethodsOnlyPhrase(methods, isAr);
}
