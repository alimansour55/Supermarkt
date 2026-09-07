function latinizeDigits(text) {
  return String(text ?? '')
    .replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, '')
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .trim();
}

/** Format a numeric amount with Latin digits (en-US), no currency symbol. */
export function formatMoneyLatin(amount, options = {}) {
  const {
    minimumFractionDigits = 2,
    maximumFractionDigits = 2,
  } = options;

  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(Number(amount) || 0);

  return latinizeDigits(formatted);
}

/** Storefront price: Latin digits, number first — reads correctly when right-aligned in Arabic. */
export function formatPrice(amount, _locale = 'en-US', currency = 'EGP') {
  return `${formatMoneyLatin(amount)} ${currency}`;
}

export function formatDate(date, locale = 'ar-EG') {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(date));
}

export function formatRelativeTime(date, isAr = false) {
  const then = new Date(date).getTime();
  const diffSec = Math.floor((Date.now() - then) / 1000);
  if (diffSec < 60) return isAr ? 'الآن' : 'Just now';
  if (diffSec < 3600) {
    const m = Math.floor(diffSec / 60);
    return isAr ? `منذ ${m} د` : `${m}m ago`;
  }
  if (diffSec < 86400) {
    const h = Math.floor(diffSec / 3600);
    return isAr ? `منذ ${h} س` : `${h}h ago`;
  }
  const d = Math.floor(diffSec / 86400);
  return isAr ? `منذ ${d} ي` : `${d}d ago`;
}
