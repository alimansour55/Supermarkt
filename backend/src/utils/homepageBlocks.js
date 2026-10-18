/**
 * Settings for the homepage block types that keep their options in
 * `section.blockConfig` — countdown, video, reviews, sign-up, price tiles,
 * tabbed products, branches, the three per-shopper product rows, coupon card,
 * occasion tiles, next delivery time and spacer.
 *
 * Pure functions only (no DB), so node tests can load them directly.
 */
import mongoose from 'mongoose';
import { AppError } from './AppError.js';
import { parseBannerScheduleInstant } from './bannerRules.js';

export const BLOCK_SECTION_TYPES = [
  'countdown_banner',
  'recently_viewed',
  'picked_for_you',
  'buy_again',
  'video_banner',
  'reviews_carousel',
  'signup_block',
  'price_ranges',
  'tabbed_products',
  'store_branches',
  'coupon_card',
  'occasion_tiles',
  'delivery_slot_bar',
  'spacer',
];

/**
 * Rows that differ per shopper. The public homepage is cached and
 * server-rendered for everyone, so these carry no products in that response —
 * the browser fetches them after hydration.
 */
export const PERSONAL_SECTION_TYPES = ['recently_viewed', 'picked_for_you', 'buy_again'];

export const COUNTDOWN_STYLES = ['brand', 'dark', 'sale', 'light'];
export const VIDEO_ASPECTS = ['16:9', '21:9', '4:3'];
export const SIGNUP_MODES = ['newsletter', 'whatsapp', 'both'];
export const TAB_SORTS = ['best-selling', 'newest', 'discount', 'top', 'price-asc', 'price-desc'];
export const TAB_SECTIONS = ['', 'best-sellers', 'new-arrivals', 'top'];
export const PICKED_FALLBACKS = ['best_sellers', 'hide'];
export const COUPON_STYLES = ['ticket', 'bold'];
export const SPACER_SIZES = ['sm', 'md', 'lg', 'xl'];
export const TILE_ACCENTS = ['primary', 'emerald', 'sky', 'amber', 'rose', 'violet', 'slate'];

export const MAX_PRICE_RANGES = 8;
export const MAX_TABS = 6;
export const MAX_BRANCHES = 20;
export const MAX_OCCASION_TILES = 8;

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const YOUTUBE_ID_RE = /^[A-Za-z0-9_-]{11}$/;

const pick = (value, allowed, fallback) => (allowed.includes(value) ? value : fallback);
const text = (value, max = 200) => (typeof value === 'string' ? value.trim().slice(0, max) : '');
const bool = (value, fallback) => {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  return value === 'true' || value === '1' || value === 1;
};
const int = (value, min, max, fallback) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
};
const price = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
};
const isObjectId = (value) => mongoose.Types.ObjectId.isValid(value)
  && String(new mongoose.Types.ObjectId(value)) === String(value);

/** A YouTube id from a bare id or any watch / share / embed / shorts link. '' if none. */
export function parseYoutubeId(value) {
  const raw = text(value, 300);
  if (!raw) return '';
  if (YOUTUBE_ID_RE.test(raw)) return raw;
  let url;
  try {
    url = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
  } catch {
    return '';
  }
  const host = url.hostname.replace(/^www\.|^m\./, '');
  let id = '';
  if (host === 'youtu.be') id = url.pathname.slice(1).split('/')[0];
  else if (host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
    id = url.searchParams.get('v')
      || url.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/?#]+)/)?.[1]
      || '';
  }
  return YOUTUBE_ID_RE.test(id) ? id : '';
}

/** Only http(s) links or site paths — never javascript: or data: URLs. */
export function safeUrl(value, { allowPath = true } = {}) {
  const raw = text(value, 500);
  if (!raw) return '';
  if (allowPath && raw.startsWith('/') && !raw.startsWith('//')) return raw;
  return /^https?:\/\/[^\s]+$/i.test(raw) ? raw : '';
}

/** Digits only, Egyptian local numbers turned international ("010…" → "2010…"). */
export function normalizeWhatsappNumber(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  if (/^01\d{9}$/.test(digits)) return `2${digits}`;
  if (digits.startsWith('00')) return digits.slice(2);
  return digits.slice(0, 15);
}

/** "/products?minPrice=50&maxPrice=100" for one price tile. */
export function priceRangeLink({ min, max } = {}) {
  const params = new URLSearchParams();
  if (min !== null && min !== undefined && min > 0) params.set('minPrice', String(min));
  if (max !== null && max !== undefined) params.set('maxPrice', String(max));
  const query = params.toString();
  return query ? `/products?${query}` : '/products';
}

function normalizePriceRanges(list) {
  return (Array.isArray(list) ? list : [])
    .map((row) => {
      let min = price(row?.min);
      let max = price(row?.max);
      if (min !== null && max !== null && max < min) [min, max] = [max, min];
      return {
        min,
        max,
        labelAr: text(row?.labelAr, 60),
        labelEn: text(row?.labelEn, 60),
        emoji: text(row?.emoji, 24),
      };
    })
    .filter((row) => row.min !== null || row.max !== null)
    .slice(0, MAX_PRICE_RANGES);
}

function normalizeTabs(list) {
  return (Array.isArray(list) ? list : [])
    .map((tab) => ({
      labelAr: text(tab?.labelAr, 40),
      labelEn: text(tab?.labelEn, 40),
      sort: pick(tab?.sort, TAB_SORTS, 'best-selling'),
      offers: bool(tab?.offers, false),
      section: pick(tab?.section, TAB_SECTIONS, ''),
      category: isObjectId(tab?.category?._id || tab?.category) ? String(tab.category._id || tab.category) : null,
      link: safeUrl(tab?.link),
    }))
    .filter((tab) => tab.labelAr || tab.labelEn)
    .slice(0, MAX_TABS);
}

function normalizeBranches(list) {
  return (Array.isArray(list) ? list : [])
    .map((row) => {
      const opensAt = TIME_RE.test(row?.opensAt || '') ? row.opensAt : '';
      const closesAt = TIME_RE.test(row?.closesAt || '') ? row.closesAt : '';
      const days = [...new Set((Array.isArray(row?.days) ? row.days : [])
        .map(Number)
        .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort((a, b) => a - b);
      return {
        nameAr: text(row?.nameAr, 80),
        nameEn: text(row?.nameEn, 80),
        addressAr: text(row?.addressAr, 200),
        addressEn: text(row?.addressEn, 200),
        phone: text(row?.phone, 30).replace(/[^\d+\s-]/g, ''),
        mapUrl: safeUrl(row?.mapUrl, { allowPath: false }),
        image: safeUrl(row?.image),
        hoursAr: text(row?.hoursAr, 120),
        hoursEn: text(row?.hoursEn, 120),
        // Both times or neither — "open now" needs a full window.
        opensAt: opensAt && closesAt ? opensAt : '',
        closesAt: opensAt && closesAt ? closesAt : '',
        days: days.length === 7 ? [] : days,
      };
    })
    .filter((row) => row.nameAr || row.nameEn)
    .slice(0, MAX_BRANCHES);
}

function normalizeOccasionTiles(list) {
  return (Array.isArray(list) ? list : [])
    .map((row) => ({
      titleAr: text(row?.titleAr, 60),
      titleEn: text(row?.titleEn, 60),
      subtitleAr: text(row?.subtitleAr, 80),
      subtitleEn: text(row?.subtitleEn, 80),
      icon: text(row?.icon, 24),
      image: safeUrl(row?.image),
      link: safeUrl(row?.link) || '/products',
      accent: pick(row?.accent, TILE_ACCENTS, 'primary'),
    }))
    .filter((row) => row.titleAr || row.titleEn)
    .slice(0, MAX_OCCASION_TILES);
}

/** Coupon codes are stored upper-case without spaces. */
export function normalizeCouponCode(value) {
  return text(value, 40).toUpperCase().replace(/\s+/g, '');
}

export const DEFAULT_BLOCK_CONFIG = Object.freeze({
  limit: 12,
  layout: 'scroll',
  columns: 4,
  endsAt: null,
  countdownStyle: 'brand',
  image: '',
  hideWhenEnded: true,
  endedTextAr: '',
  endedTextEn: '',
  videoUrl: '',
  youtubeId: '',
  posterImage: '',
  autoplayDesktop: true,
  aspect: '16:9',
  minRating: 4,
  verifiedOnly: false,
  signupMode: 'newsletter',
  whatsappNumber: '',
  whatsappMessageAr: '',
  whatsappMessageEn: '',
  privacyNoteAr: '',
  privacyNoteEn: '',
  priceRanges: [],
  tabs: [],
  branches: [],
  pickedFallback: 'best_sellers',
  couponCode: '',
  couponStyle: 'ticket',
  tiles: [],
  spacerSize: 'md',
  showLine: false,
});

/**
 * Clean `blockConfig` for a section type. Fields the type does not use keep
 * their defaults, so switching types never leaves stale data behind.
 * Throws a 400 when a countdown has no usable end time or a video has no source.
 */
export function normalizeBlockConfig(type, input) {
  const raw = input && typeof input === 'object' ? input : {};
  const out = {
    ...DEFAULT_BLOCK_CONFIG,
    priceRanges: [],
    tabs: [],
    branches: [],
    tiles: [],
  };
  if (!BLOCK_SECTION_TYPES.includes(type)) return out;

  out.limit = int(raw.limit, 1, 24, type === 'reviews_carousel' ? 8 : 12);
  out.layout = raw.layout === 'grid' ? 'grid' : 'scroll';
  out.columns = int(raw.columns, 2, 4, 4);

  if (type === 'countdown_banner') {
    const endsAt = parseBannerScheduleInstant(raw.endsAt);
    if (endsAt === undefined) throw new AppError('Countdown has an invalid end date', 400);
    out.endsAt = endsAt;
    out.countdownStyle = pick(raw.countdownStyle, COUNTDOWN_STYLES, 'brand');
    out.image = safeUrl(raw.image);
    out.hideWhenEnded = bool(raw.hideWhenEnded, true);
    out.endedTextAr = text(raw.endedTextAr, 120);
    out.endedTextEn = text(raw.endedTextEn, 120);
  }

  if (type === 'video_banner') {
    // A YouTube link pasted in the video box counts as the YouTube source.
    out.youtubeId = parseYoutubeId(raw.youtubeId) || parseYoutubeId(raw.videoUrl);
    out.videoUrl = out.youtubeId ? '' : safeUrl(raw.videoUrl);
    out.posterImage = safeUrl(raw.posterImage);
    out.autoplayDesktop = bool(raw.autoplayDesktop, true);
    out.aspect = pick(raw.aspect, VIDEO_ASPECTS, '16:9');
  }

  if (type === 'reviews_carousel') {
    out.minRating = int(raw.minRating, 1, 5, 4);
    out.verifiedOnly = bool(raw.verifiedOnly, false);
  }

  if (type === 'signup_block') {
    out.signupMode = pick(raw.signupMode, SIGNUP_MODES, 'newsletter');
    out.whatsappNumber = normalizeWhatsappNumber(raw.whatsappNumber);
    out.whatsappMessageAr = text(raw.whatsappMessageAr, 300);
    out.whatsappMessageEn = text(raw.whatsappMessageEn, 300);
    out.privacyNoteAr = text(raw.privacyNoteAr, 200);
    out.privacyNoteEn = text(raw.privacyNoteEn, 200);
  }

  if (type === 'price_ranges') out.priceRanges = normalizePriceRanges(raw.priceRanges);
  if (type === 'tabbed_products') out.tabs = normalizeTabs(raw.tabs);
  if (type === 'store_branches') out.branches = normalizeBranches(raw.branches);
  if (type === 'picked_for_you') out.pickedFallback = pick(raw.pickedFallback, PICKED_FALLBACKS, 'best_sellers');

  if (type === 'coupon_card') {
    out.couponCode = normalizeCouponCode(raw.couponCode);
    out.couponStyle = pick(raw.couponStyle, COUPON_STYLES, 'ticket');
  }

  if (type === 'occasion_tiles') out.tiles = normalizeOccasionTiles(raw.tiles);

  if (type === 'spacer') {
    out.spacerSize = pick(raw.spacerSize, SPACER_SIZES, 'md');
    out.showLine = bool(raw.showLine, false);
  }

  return out;
}

/** "Ahmed Hassan" → "Ahmed H." — reviews never show a shopper's full name. */
export function reviewerDisplayName(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

/** Product ids from the browser — valid ObjectIds, de-duplicated, capped. */
export function cleanProductIds(list, max = 20) {
  return [...new Set((Array.isArray(list) ? list : [])
    .map((id) => String(id || '').trim())
    .filter(isObjectId))].slice(0, max);
}
