export function formatPrice(amount, locale = 'ar-EG', currency = 'EGP') {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount ?? 0);
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
