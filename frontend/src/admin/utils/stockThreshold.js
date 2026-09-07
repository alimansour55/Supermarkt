const STORAGE_KEY = 'adminStockThreshold';

export const DEFAULT_STOCK_THRESHOLD = 10;

/** Default list view: all products at or below the alert threshold (includes out of stock). */
export const DEFAULT_ALERT_STOCK_VIEW = 'below';

export function readStockThreshold() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0) return Math.floor(n);
  } catch {
    /* ignore */
  }
  return DEFAULT_STOCK_THRESHOLD;
}

export function writeStockThreshold(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return DEFAULT_STOCK_THRESHOLD;
  const normalized = Math.floor(n);
  try {
    localStorage.setItem(STORAGE_KEY, String(normalized));
  } catch {
    /* ignore */
  }
  return normalized;
}

export function stockStatusLabel(stock, threshold, isAr) {
  if (stock <= 0) {
    return isAr ? 'نفد' : 'Out of stock';
  }
  if (stock <= threshold) {
    return isAr ? 'منخفض' : 'Low stock';
  }
  return isAr ? 'متوفر' : 'In stock';
}

export function stockStatusTone(stock, threshold) {
  if (stock <= 0) return 'danger';
  if (stock <= threshold) return 'warning';
  return 'success';
}
