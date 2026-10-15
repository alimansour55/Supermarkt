/**
 * Homepage section visibility + appearance on the storefront.
 *
 * Mirrors backend/src/utils/homepageVisibility.js (keep the two in sync). The
 * homepage response is cached and server-rendered for everyone, so the server
 * applies the time rules and the browser applies audience, device and zone.
 * Pure functions only — shared by the storefront, the admin preview and tests.
 */

export const STORE_TIME_ZONE = 'Africa/Cairo';

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const WEEKDAYS = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function minutesOf(hm) {
  const match = TIME_RE.exec(hm || '');
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

/** Weekday (0 = Sunday) and minutes past midnight on the store's wall clock. */
export function storeClock(now = new Date(), timeZone = STORE_TIME_ZONE) {
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
export function inDailyWindow(visibility, now = new Date(), timeZone = STORE_TIME_ZONE) {
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
  if (minutes >= start) return dayOk(weekday);
  if (minutes < end) return dayOk((weekday + 6) % 7);
  return false;
}

/** 'live' | 'scheduled' (not started) | 'ended' | 'off_hours' (outside its days/hours). */
export function sectionScheduleStatus(visibility, now = new Date(), timeZone = STORE_TIME_ZONE) {
  const startsAt = visibility?.startsAt ? new Date(visibility.startsAt) : null;
  const endsAt = visibility?.endsAt ? new Date(visibility.endsAt) : null;
  if (startsAt && !Number.isNaN(startsAt.getTime()) && now < startsAt) return 'scheduled';
  if (endsAt && !Number.isNaN(endsAt.getTime()) && now > endsAt) return 'ended';
  if (!inDailyWindow(visibility, now, timeZone)) return 'off_hours';
  return 'live';
}

/**
 * The device rule. Sections saved before device rules existed only have the
 * old `showOnMobile` flag.
 */
export function sectionDevices(section) {
  const devices = section?.visibility?.devices;
  if (devices === 'mobile' || devices === 'desktop') return devices;
  return section?.showOnMobile === false ? 'desktop' : 'all';
}

/**
 * The visitor, as the audience rules see them:
 *  'guest' | 'customer' (signed in, order history unknown) | 'new' | 'returning'.
 * Staff are treated as customers.
 */
export function viewerKind(user) {
  if (!user) return 'guest';
  if (user.hasOrdered === true) return 'returning';
  if (user.hasOrdered === false) return 'new';
  return 'customer';
}

export function audienceMatches(audience, viewer) {
  switch (audience || 'all') {
    case 'all': return true;
    case 'guests': return viewer === 'guest';
    case 'customers': return viewer !== 'guest';
    case 'new_customers': return viewer === 'new';
    case 'returning_customers': return viewer === 'returning';
    default: return true;
  }
}

export function zoneMatches(zones, zoneId) {
  if (!Array.isArray(zones) || !zones.length) return true;
  return Boolean(zoneId) && zones.map(String).includes(String(zoneId));
}

/**
 * Should this visitor see the section? Device is not checked here — it is done
 * with CSS (see sectionShellProps) so server-rendered HTML is right on phones too.
 *
 * Before hydration the visitor is unknown: render as a guest with no zone and
 * without re-checking the clock, so the browser's first render matches the server's.
 */
export function sectionVisibleTo(section, { viewer = 'guest', zoneId = null, now = null } = {}) {
  const visibility = section?.visibility || {};
  if (!audienceMatches(visibility.audience, viewer)) return false;
  if (!zoneMatches(visibility.zones, zoneId)) return false;
  if (now && sectionScheduleStatus(visibility, now) !== 'live') return false;
  return true;
}

/** "Ramadan Offers!" → "ramadan-offers" — same rule as the server. */
export function normalizeAnchor(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

const SPACE_ABOVE = { sm: 'mt-2', md: 'mt-6', lg: 'mt-12' };
const SPACE_BELOW = { sm: 'mb-2', md: 'mb-6', lg: 'mb-12' };
const BACKGROUND_CLASS = {
  soft: 'bg-slate-50',
  brand: 'bg-primary-50',
  warm: 'bg-amber-50',
  cool: 'bg-sky-50',
};
const OVERLAY_CLASS = { light: 'bg-white/60', strong: 'bg-white/85' };

/**
 * How to wrap a section on the page. Returns null when no wrapper is needed —
 * a wrapper would trap a sticky announcement bar inside it.
 *  - outer: { id, className } — spacing, device, anchor
 *  - box: { className, style } — background (inside the page container when "contained")
 *  - overlay: className of the image readability layer
 *  - contained: wrap the box in .container-app
 */
export function sectionShellProps(section) {
  const appearance = section?.appearance || {};
  const devices = sectionDevices(section);
  const background = appearance.background || 'none';
  const hasBackground = background !== 'none'
    && !(background === 'custom' && !appearance.backgroundColor)
    && !(background === 'image' && !appearance.backgroundImage);
  const spaceAbove = SPACE_ABOVE[appearance.spaceAbove] || '';
  const spaceBelow = SPACE_BELOW[appearance.spaceBelow] || '';
  const anchor = normalizeAnchor(appearance.anchor);
  const needsBox = hasBackground || spaceAbove || spaceBelow || anchor;

  const deviceClass = devices === 'mobile'
    ? (needsBox ? 'md:hidden' : 'contents md:hidden')
    : devices === 'desktop'
      ? (needsBox ? 'hidden md:block' : 'hidden md:contents')
      : '';

  if (!needsBox && !deviceClass) return null;

  const outerClass = [deviceClass, spaceAbove, spaceBelow, anchor ? 'scroll-mt-28' : '']
    .filter(Boolean).join(' ');
  if (!hasBackground) {
    return { outer: { id: anchor || undefined, className: outerClass }, box: null, overlay: null, contained: false };
  }

  const style = {};
  if (background === 'custom') style.backgroundColor = appearance.backgroundColor;
  if (background === 'image') {
    style.backgroundImage = `url("${appearance.backgroundImage}")`;
    style.backgroundSize = 'cover';
    style.backgroundPosition = 'center';
  }
  const contained = appearance.width === 'contained';
  return {
    outer: { id: anchor || undefined, className: outerClass },
    box: {
      className: [
        'relative py-2',
        BACKGROUND_CLASS[background] || '',
        contained ? 'overflow-hidden rounded-3xl' : '',
      ].filter(Boolean).join(' '),
      style,
    },
    overlay: background === 'image' ? (OVERLAY_CLASS[appearance.overlay] || null) : null,
    contained,
  };
}

/** "#rrggbb" → true when the colour is too dark for the storefront's dark text. */
export function isDarkColor(hex) {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex || '');
  if (!match) return false;
  let value = match[1];
  if (value.length === 3) value = value.split('').map((c) => c + c).join('');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16) / 255);
  const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return luminance < 0.45;
}
