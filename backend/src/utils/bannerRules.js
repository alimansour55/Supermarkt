/**
 * Banner business rules shared by the banner API and the homepage builder —
 * one place for "is this banner live?", who may see it, and how admin-entered
 * schedule times are read (store wall clock, DST-aware).
 */
import { STAFF_ROLES } from '../constants/roles.js';
import { getStoreOffset } from './storeDate.js';

export const BANNER_PLACEMENTS = ['hero', 'promo', 'sidebar'];

/** Audiences a public (storefront) response may contain. Staff-only banners never leave the admin. */
export const PUBLIC_BANNER_AUDIENCES = ['all', 'guests', 'customers'];

export function bannerIsLiveNow(banner, now = new Date()) {
  if (!banner?.isActive) return false;
  if (banner.startsAt && new Date(banner.startsAt) > now) return false;
  if (banner.endsAt && new Date(banner.endsAt) < now) return false;
  return true;
}

/** Mongo filter for banners that are switched on and inside their schedule window. */
export function liveBannerFilter(now = new Date()) {
  return {
    isActive: true,
    $and: [
      { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
      { $or: [{ endsAt: null }, { endsAt: { $gte: now } }] },
    ],
  };
}

export const BANNER_SORT = { priority: -1, sortOrder: 1, createdAt: -1 };

/** Which audience bucket the current visitor falls into. */
export function viewerAudience(user) {
  if (!user) return 'guests';
  if (STAFF_ROLES.includes(user.role)) return 'staff';
  return 'customers';
}

/** Audiences a viewer may see. Staff preview what logged-in customers see, plus staff-only banners. */
export function audiencesForViewer(viewer) {
  if (viewer === 'staff') return ['all', 'customers', 'staff'];
  if (viewer === 'customers') return ['all', 'customers'];
  return ['all', 'guests'];
}

/**
 * Trim a sorted banner list so that BOTH a guest and a logged-in customer still
 * get up to `limit` banners after the client filters by audience. Used by cached
 * public responses (homepage) that can't vary per user.
 */
export function pickForAllViewers(banners, limit) {
  if (!limit) return banners;
  let guests = 0;
  let customers = 0;
  const out = [];
  for (const banner of banners) {
    const audience = banner.targetAudience || 'all';
    const forGuests = audience === 'all' || audience === 'guests';
    const forCustomers = audience === 'all' || audience === 'customers';
    const needed = (forGuests && guests < limit) || (forCustomers && customers < limit);
    if (!needed) continue;
    out.push(banner);
    if (forGuests) guests += 1;
    if (forCustomers) customers += 1;
    if (guests >= limit && customers >= limit) break;
  }
  return out;
}

/**
 * Parse a schedule value from the admin form. A bare "YYYY-MM-DDTHH:mm" is the
 * store's wall clock (Africa/Cairo, which has DST — so the offset is looked up
 * per day, never hardcoded). Values that already carry a zone are taken as-is.
 * Returns null for empty input and undefined for garbage.
 */
export function parseBannerScheduleInstant(value) {
  if (value === undefined || value === null || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : value;
  const raw = String(value).trim();
  if (!raw) return null;

  const wallClock = raw.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (wallClock) {
    const [, day, hh, mm, ss = '00'] = wallClock;
    const date = new Date(`${day}T${hh}:${mm}:${ss}${getStoreOffset(day)}`);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/** Fill a missing title/CTA from the other language so admins only have to type one. */
export function fillBilingual(ar, en) {
  const a = typeof ar === 'string' ? ar.trim() : '';
  const e = typeof en === 'string' ? en.trim() : '';
  return { ar: a || e, en: e || a };
}
