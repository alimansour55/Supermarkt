/**
 * Pure helpers for the storefront homepage blocks (price tiles, branches,
 * WhatsApp, video). Shared with the admin builder; node tests load this file,
 * so imports keep their .js extension.
 */
import { formatMoneyLatin } from './formatters.js';
import { inDailyWindow } from './homepageVisibility.js';

const amount = (n) => formatMoneyLatin(n, { maximumFractionDigits: 2, minimumFractionDigits: 0 });
const numberOrNull = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

/** The admin's tile label, else "Under 50 EGP" / "أقل من 50 EGP" from the bounds. */
export function priceRangeLabel(range = {}, isAr = false) {
  const own = isAr ? range.labelAr || range.labelEn : range.labelEn || range.labelAr;
  if (own) return own;
  const lo = numberOrNull(range.min);
  const hi = numberOrNull(range.max);
  if (lo && hi !== null) return `${amount(lo)} – ${amount(hi)} EGP`;
  if (hi !== null) return isAr ? `أقل من ${amount(hi)} EGP` : `Under ${amount(hi)} EGP`;
  if (lo !== null) return isAr ? `أكثر من ${amount(lo)} EGP` : `Over ${amount(lo)} EGP`;
  return '';
}

/** Product listing link for a tile (mirrors priceRangeLink on the server). */
export function priceRangeHref(range = {}) {
  if (range.link) return range.link;
  const params = new URLSearchParams();
  const lo = numberOrNull(range.min);
  const hi = numberOrNull(range.max);
  if (lo !== null && lo > 0) params.set('minPrice', String(lo));
  if (hi !== null) params.set('maxPrice', String(hi));
  const query = params.toString();
  return query ? `/products?${query}` : '/products';
}

/**
 * true / false when the branch has opening hours, null when it does not.
 * Hours are the store wall clock (Cairo); a window like 10:00–02:00 runs past midnight.
 */
export function branchOpenNow(branch, now = new Date()) {
  if (!branch?.opensAt || !branch?.closesAt) return null;
  return inDailyWindow({ days: branch.days || [], timeFrom: branch.opensAt, timeTo: branch.closesAt }, now);
}

/** wa.me chat link with an optional first message. '' without a number. */
export function whatsappHref(number, message = '') {
  const digits = String(number || '').replace(/\D/g, '');
  if (!digits) return '';
  const text = String(message || '').trim();
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

/** Privacy-friendly YouTube embed. Muted autoplay + loop when asked. */
export function youtubeEmbedSrc(id, { autoplay = false } = {}) {
  if (!/^[A-Za-z0-9_-]{11}$/.test(id || '')) return '';
  const params = new URLSearchParams({ rel: '0', modestbranding: '1', playsinline: '1' });
  if (autoplay) {
    params.set('autoplay', '1');
    params.set('mute', '1');
    params.set('loop', '1');
    params.set('playlist', id);
    params.set('controls', '0');
  }
  return `https://www.youtube-nocookie.com/embed/${id}?${params.toString()}`;
}

export function youtubePoster(id) {
  return /^[A-Za-z0-9_-]{11}$/.test(id || '') ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : '';
}

export const VIDEO_ASPECT_CLASS = {
  '16:9': 'aspect-video',
  '21:9': 'aspect-[21/9]',
  '4:3': 'aspect-[4/3]',
};
