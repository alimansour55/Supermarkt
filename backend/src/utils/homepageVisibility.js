/**
 * Homepage section visibility + appearance rules.
 *
 * Every section can carry:
 *  - visibility: a date window, weekly days, a daily time window (store wall clock,
 *    Africa/Cairo — DST-aware), an audience, a device and delivery zones;
 *  - appearance: background, extra spacing and an anchor id.
 *
 * The public homepage response is cached and server-rendered for everyone, so the
 * server only applies the time rules here. Audience, device and zone are applied
 * in the browser (frontend/src/utils/homepageVisibility.js mirrors this file —
 * keep the two in sync).
 */
import { AppError } from './AppError.js';
import { parseBannerScheduleInstant } from './bannerRules.js';
import { STORE_TIMEZONE } from './storeDate.js';

export const SECTION_AUDIENCES = ['all', 'guests', 'customers', 'new_customers', 'returning_customers'];
export const SECTION_DEVICES = ['all', 'mobile', 'desktop'];
export const SECTION_BACKGROUNDS = ['none', 'soft', 'brand', 'warm', 'cool', 'custom', 'image'];
export const SECTION_OVERLAYS = ['none', 'light', 'strong'];
export const SECTION_WIDTHS = ['full', 'contained'];
export const SECTION_SPACES = ['none', 'sm', 'md', 'lg'];

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const WEEKDAYS = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const MAX_ZONES = 100;

export const DEFAULT_VISIBILITY = Object.freeze({
  startsAt: null,
  endsAt: null,
  days: [],
  timeFrom: '',
  timeTo: '',
  audience: 'all',
  devices: 'all',
  zones: [],
});

export const DEFAULT_APPEARANCE = Object.freeze({
  background: 'none',
  backgroundColor: '',
  backgroundImage: '',
  overlay: 'light',
  width: 'full',
  spaceAbove: 'none',
  spaceBelow: 'none',
  anchor: '',
});

const pick = (value, allowed, fallback) => (allowed.includes(value) ? value : fallback);

function parseTime(value) {
  const raw = typeof value === 'string' ? value.trim() : '';
  return TIME_RE.test(raw) ? raw : '';
}

function minutesOf(hm) {
  const match = TIME_RE.exec(hm || '');
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

/** "Ramadan Offers!" → "ramadan-offers". Letters (incl. Arabic), digits and dashes only. */
export function normalizeAnchor(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/**
 * Clean the visibility object from the admin form. Dates are store wall clock
 * ("YYYY-MM-DDTHH:mm"); an empty value clears them. Throws a 400 for an
 * unreadable date or an end before the start.
 */
export function normalizeVisibility(input) {
  const raw = input && typeof input === 'object' ? input : {};

  const startsAt = parseBannerScheduleInstant(raw.startsAt);
  const endsAt = parseBannerScheduleInstant(raw.endsAt);
  if (startsAt === undefined || endsAt === undefined) {
    throw new AppError('Section schedule has an invalid date', 400);
  }
  if (startsAt && endsAt && endsAt <= startsAt) {
    throw new AppError('Section schedule must end after it starts', 400);
  }

  const days = [...new Set(
    (Array.isArray(raw.days) ? raw.days : [])
      .map(Number)
      .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6),
  )].sort((a, b) => a - b);

  const zones = [...new Set(
    (Array.isArray(raw.zones) ? raw.zones : [])
      .map((zone) => String(zone || '').trim())
      .filter(Boolean),
  )].slice(0, MAX_ZONES);

  return {
    startsAt,
    endsAt,
    // Every day ticked is the same as no day rule.
    days: days.length === 7 ? [] : days,
    timeFrom: parseTime(raw.timeFrom),
    timeTo: parseTime(raw.timeTo),
    audience: pick(raw.audience, SECTION_AUDIENCES, 'all'),
    devices: pick(raw.devices, SECTION_DEVICES, 'all'),
    zones,
  };
}

export function normalizeAppearance(input) {
  const raw = input && typeof input === 'object' ? input : {};
  const background = pick(raw.background, SECTION_BACKGROUNDS, 'none');
  const color = typeof raw.backgroundColor === 'string' ? raw.backgroundColor.trim() : '';
  const image = typeof raw.backgroundImage === 'string' ? raw.backgroundImage.trim() : '';
  const safeImage = /^(https?:\/\/|\/)/i.test(image) && !/["'()\\<>]/.test(image) ? image : '';

  return {
    background: (background === 'custom' && !HEX_RE.test(color)) || (background === 'image' && !safeImage)
      ? 'none'
      : background,
    backgroundColor: HEX_RE.test(color) ? color.toLowerCase() : '',
    backgroundImage: safeImage,
    overlay: pick(raw.overlay, SECTION_OVERLAYS, 'light'),
    width: pick(raw.width, SECTION_WIDTHS, 'full'),
    spaceAbove: pick(raw.spaceAbove, SECTION_SPACES, 'none'),
    spaceBelow: pick(raw.spaceBelow, SECTION_SPACES, 'none'),
    anchor: normalizeAnchor(raw.anchor),
  };
}

/**
 * The legacy `showOnMobile` flag and `visibility.devices` describe the same thing.
 * A request that sends a device rule wins; otherwise the device rule follows
 * `showOnMobile` (the old quick toggle, and sections saved before device rules existed).
 */
export function reconcileDevices(payload, incoming = {}) {
  const sentVisibility = incoming.visibility && typeof incoming.visibility === 'object'
    && incoming.visibility.devices !== undefined;
  const visibility = payload.visibility || { ...DEFAULT_VISIBILITY };

  if (!sentVisibility) {
    const showOnMobile = payload.showOnMobile !== false;
    if (!showOnMobile) visibility.devices = 'desktop';
    else if (visibility.devices === 'desktop') visibility.devices = 'all';
  }
  payload.visibility = visibility;
  payload.showOnMobile = visibility.devices !== 'desktop';
  return payload;
}

/** Weekday (0 = Sunday) and minutes past midnight on the store's wall clock. */
export function storeClock(now = new Date(), timeZone = STORE_TIMEZONE) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type) => parts.find((p) => p.type === type)?.value;
  return {
    weekday: WEEKDAYS[get('weekday')] ?? 0,
    minutes: Number(get('hour')) * 60 + Number(get('minute')),
  };
}

/** Inside the weekly day / daily time window? A window like 22:00–02:00 runs past midnight. */
export function inDailyWindow(visibility, now = new Date(), timeZone = STORE_TIMEZONE) {
  const days = Array.isArray(visibility?.days) ? visibility.days.map(Number) : [];
  const from = minutesOf(visibility?.timeFrom);
  const to = minutesOf(visibility?.timeTo);
  if (!days.length && from === null && to === null) return true;

  const { weekday, minutes } = storeClock(now, timeZone);
  const dayOk = (day) => !days.length || days.includes(day);
  const start = from ?? 0;
  const end = to ?? 24 * 60;

  if (start === end) return dayOk(weekday);
  if (start < end) return dayOk(weekday) && minutes >= start && minutes < end;
  // Overnight: the part after midnight belongs to the day the window opened.
  if (minutes >= start) return dayOk(weekday);
  if (minutes < end) return dayOk((weekday + 6) % 7);
  return false;
}

/** 'live' | 'scheduled' (not started) | 'ended' | 'off_hours' (outside its days/hours). */
export function sectionScheduleStatus(visibility, now = new Date(), timeZone = STORE_TIMEZONE) {
  const startsAt = visibility?.startsAt ? new Date(visibility.startsAt) : null;
  const endsAt = visibility?.endsAt ? new Date(visibility.endsAt) : null;
  if (startsAt && !Number.isNaN(startsAt.getTime()) && now < startsAt) return 'scheduled';
  if (endsAt && !Number.isNaN(endsAt.getTime()) && now > endsAt) return 'ended';
  if (!inDailyWindow(visibility, now, timeZone)) return 'off_hours';
  return 'live';
}

export function sectionIsLiveNow(section, now = new Date()) {
  if (!section?.isActive) return false;
  return sectionScheduleStatus(section.visibility, now) === 'live';
}

/** Admin-only fields never leave the admin API. */
export function stripAdminFields(data) {
  if (!data || typeof data !== 'object') return data;
  const { adminLabel, adminNotes, ...rest } = data;
  return rest;
}
