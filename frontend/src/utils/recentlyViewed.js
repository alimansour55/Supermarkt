/**
 * Product ids the shopper opened on this device, newest first — powers the
 * homepage "Recently viewed" and "Picked for you" rows. Browser only; every
 * call is safe on the server and when storage is blocked.
 */
const KEY = 'mp:recently-viewed';
const MAX = 24;
const ID_RE = /^[a-f0-9]{24}$/i;

export const RECENTLY_VIEWED_EVENT = 'mp:recently-viewed-changed';

export function getRecentlyViewedIds() {
  if (typeof window === 'undefined') return [];
  try {
    const list = JSON.parse(window.localStorage.getItem(KEY) || '[]');
    return Array.isArray(list) ? list.filter((id) => ID_RE.test(String(id))).slice(0, MAX) : [];
  } catch {
    return [];
  }
}

export function rememberViewedProduct(productId) {
  const id = String(productId || '');
  if (typeof window === 'undefined' || !ID_RE.test(id)) return;
  try {
    const next = [id, ...getRecentlyViewedIds().filter((x) => x !== id)].slice(0, MAX);
    window.localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(RECENTLY_VIEWED_EVENT));
  } catch {
    /* storage full or blocked — the row just stays empty */
  }
}

export function clearRecentlyViewed() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(KEY);
    window.dispatchEvent(new Event(RECENTLY_VIEWED_EVENT));
  } catch {
    /* ignore */
  }
}
