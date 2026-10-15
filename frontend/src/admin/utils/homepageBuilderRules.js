/**
 * Pure helpers for the homepage builder: section status, plain-language rule
 * chips, page health checks, insert positions and the visibility/appearance
 * form fields. No React and no extensionless imports, so node tests can load it.
 */
import {
  isDarkColor,
  sectionDevices,
  sectionScheduleStatus,
  sectionVisibleTo,
} from '../../utils/homepageVisibility.js';
import { relativeTime, storeInputToDate, toStoreInput } from './bannerAdmin.js';

export const AUDIENCE_OPTIONS = [
  { value: 'all', labelAr: 'الجميع', labelEn: 'Everyone' },
  { value: 'guests', labelAr: 'الزوار غير المسجلين', labelEn: 'Guests (not signed in)' },
  { value: 'customers', labelAr: 'العملاء المسجلون', labelEn: 'Signed-in customers' },
  { value: 'new_customers', labelAr: 'عملاء لم يطلبوا بعد', labelEn: 'Customers with no orders yet' },
  { value: 'returning_customers', labelAr: 'عملاء طلبوا من قبل', labelEn: 'Customers who ordered before' },
];

export const DEVICE_OPTIONS = [
  { value: 'all', labelAr: 'كل الأجهزة', labelEn: 'All devices' },
  { value: 'mobile', labelAr: 'الموبايل فقط', labelEn: 'Phones only' },
  { value: 'desktop', labelAr: 'الكمبيوتر فقط', labelEn: 'Computers only' },
];

/** Store weekdays, Saturday first as Egyptian shoppers read a week. */
export const WEEKDAY_OPTIONS = [
  { value: 6, labelAr: 'سبت', labelEn: 'Sat' },
  { value: 0, labelAr: 'أحد', labelEn: 'Sun' },
  { value: 1, labelAr: 'اثنين', labelEn: 'Mon' },
  { value: 2, labelAr: 'ثلاثاء', labelEn: 'Tue' },
  { value: 3, labelAr: 'أربعاء', labelEn: 'Wed' },
  { value: 4, labelAr: 'خميس', labelEn: 'Thu' },
  { value: 5, labelAr: 'جمعة', labelEn: 'Fri' },
];

export const BACKGROUND_OPTIONS = [
  { value: 'none', labelAr: 'بدون', labelEn: 'None', swatch: '#ffffff' },
  { value: 'soft', labelAr: 'رمادي فاتح', labelEn: 'Light grey', swatch: '#f8fafc' },
  { value: 'brand', labelAr: 'لون المتجر', labelEn: 'Store colour', swatch: 'var(--color-primary-50)' },
  { value: 'warm', labelAr: 'دافئ', labelEn: 'Warm', swatch: '#fffbeb' },
  { value: 'cool', labelAr: 'بارد', labelEn: 'Cool', swatch: '#f0f9ff' },
  { value: 'custom', labelAr: 'لون آخر', labelEn: 'Other colour', swatch: null },
  { value: 'image', labelAr: 'صورة', labelEn: 'Image', swatch: null },
];

export const SPACE_OPTIONS = [
  { value: 'none', labelAr: 'بدون', labelEn: 'None' },
  { value: 'sm', labelAr: 'قليل', labelEn: 'Small' },
  { value: 'md', labelAr: 'متوسط', labelEn: 'Medium' },
  { value: 'lg', labelAr: 'كبير', labelEn: 'Large' },
];

export const PREVIEW_AUDIENCES = [
  { value: 'any', labelAr: 'كل الأقسام', labelEn: 'All sections' },
  { value: 'guest', labelAr: 'زائر', labelEn: 'A guest' },
  { value: 'new', labelAr: 'عميل جديد', labelEn: 'A new customer' },
  { value: 'returning', labelAr: 'عميل طلب من قبل', labelEn: 'A returning customer' },
];

export const EMPTY_VISIBILITY_FORM = {
  startsAt: '',
  endsAt: '',
  days: [],
  timeFrom: '',
  timeTo: '',
  audience: 'all',
  devices: 'all',
  zones: [],
};

export const EMPTY_APPEARANCE_FORM = {
  background: 'none',
  backgroundColor: '',
  backgroundImage: '',
  overlay: 'light',
  width: 'full',
  spaceAbove: 'none',
  spaceBelow: 'none',
  anchor: '',
};

const label = (option, isAr) => (option ? (isAr ? option.labelAr : option.labelEn) : '');

/** The section's visibility as the form edits it (dates as Cairo wall-clock inputs). */
export function visibilityToForm(section = {}) {
  const v = section.visibility || {};
  return {
    ...EMPTY_VISIBILITY_FORM,
    startsAt: toStoreInput(v.startsAt),
    endsAt: toStoreInput(v.endsAt),
    days: Array.isArray(v.days) ? v.days.map(Number) : [],
    timeFrom: v.timeFrom || '',
    timeTo: v.timeTo || '',
    audience: v.audience || 'all',
    devices: sectionDevices(section),
    zones: Array.isArray(v.zones) ? v.zones.map(String) : [],
  };
}

/** Form → API. Dates stay wall clock; the server resolves the Cairo offset. */
export function visibilityFromForm(form = EMPTY_VISIBILITY_FORM) {
  return {
    startsAt: form.startsAt || '',
    endsAt: form.endsAt || '',
    days: Array.isArray(form.days) ? form.days : [],
    timeFrom: form.timeFrom || '',
    timeTo: form.timeTo || '',
    audience: form.audience || 'all',
    devices: form.devices || 'all',
    zones: Array.isArray(form.zones) ? form.zones : [],
  };
}

export function appearanceToForm(section = {}) {
  return { ...EMPTY_APPEARANCE_FORM, ...(section.appearance || {}) };
}

/** A live-preview copy of the form's visibility: wall-clock inputs become instants. */
export function visibilityForPreview(form = EMPTY_VISIBILITY_FORM) {
  return {
    ...visibilityFromForm(form),
    startsAt: storeInputToDate(form.startsAt)?.toISOString() || null,
    endsAt: storeInputToDate(form.endsAt)?.toISOString() || null,
  };
}

/** Form-level checks before saving. Returns { field: message } in the admin's language. */
export function validateVisibilityForm(form, isAr) {
  const errors = {};
  const start = storeInputToDate(form.startsAt);
  const end = storeInputToDate(form.endsAt);
  if (start && end && end <= start) {
    errors.endsAt = isAr ? 'يجب أن يكون الانتهاء بعد البداية' : 'The end must be after the start';
  }
  if ((form.timeFrom && !form.timeTo) || (!form.timeFrom && form.timeTo)) {
    errors.time = isAr ? 'اختر وقت البداية والنهاية معاً' : 'Pick both a start and an end time';
  }
  if (form.timeFrom && form.timeFrom === form.timeTo) {
    errors.time = isAr ? 'وقت البداية والنهاية متساويان' : 'Start and end time are the same';
  }
  return errors;
}

/**
 * 'hidden' (switched off) | 'scheduled' | 'ended' | 'off_hours' | 'live'.
 * "live" means the time rules pass — audience/device/zone can still narrow it.
 */
export function sectionStatus(section, now = new Date()) {
  if (!section?.isActive) return 'hidden';
  return sectionScheduleStatus(section.visibility, now);
}

export const STATUS_META = {
  live: { tone: 'green', labelAr: 'ظاهر', labelEn: 'Live' },
  hidden: { tone: 'slate', labelAr: 'مخفي', labelEn: 'Hidden' },
  scheduled: { tone: 'blue', labelAr: 'مجدول', labelEn: 'Scheduled' },
  ended: { tone: 'slate', labelAr: 'انتهى', labelEn: 'Ended' },
  off_hours: { tone: 'amber', labelAr: 'خارج مواعيده الآن', labelEn: 'Outside its hours now' },
};

function formatHm(hm, isAr) {
  if (!hm) return '';
  const [h, m] = hm.split(':').map(Number);
  const date = new Date(Date.UTC(2026, 0, 1, h, m));
  return new Intl.DateTimeFormat(isAr ? 'ar-EG' : 'en-GB', {
    hour: 'numeric', minute: '2-digit', timeZone: 'UTC', hour12: isAr,
  }).format(date);
}

/** "Sat, Mon, Thu" / "Weekdays" etc. */
export function daysLabel(days, isAr) {
  const list = Array.isArray(days) ? days.map(Number) : [];
  if (!list.length || list.length === 7) return isAr ? 'كل يوم' : 'Every day';
  const key = [...list].sort().join(',');
  if (key === '0,1,2,3,4') return isAr ? 'الأحد–الخميس' : 'Sun–Thu';
  if (key === '5,6') return isAr ? 'الجمعة والسبت' : 'Fri & Sat';
  return WEEKDAY_OPTIONS.filter((d) => list.includes(d.value)).map((d) => label(d, isAr)).join(isAr ? '، ' : ', ');
}

/** One sentence for the schedule, e.g. "Starts in 2 days · Fri & Sat · 7:00–11:00". */
export function scheduleSummary(section, isAr, now = new Date()) {
  const v = section?.visibility || {};
  const parts = [];
  const at = (value) => (value ? new Date(value).getTime() : null);
  const status = sectionScheduleStatus(v, now);
  if (status === 'scheduled') parts.push(`${isAr ? 'يبدأ' : 'Starts'} ${relativeTime(at(v.startsAt), isAr, now.getTime())}`);
  else if (status === 'ended') parts.push(`${isAr ? 'انتهى' : 'Ended'} ${relativeTime(at(v.endsAt), isAr, now.getTime())}`);
  else if (v.endsAt) parts.push(`${isAr ? 'ينتهي' : 'Ends'} ${relativeTime(at(v.endsAt), isAr, now.getTime())}`);
  if (Array.isArray(v.days) && v.days.length && v.days.length < 7) parts.push(daysLabel(v.days, isAr));
  if (v.timeFrom || v.timeTo) parts.push(`${formatHm(v.timeFrom || '00:00', isAr)}–${formatHm(v.timeTo || '23:59', isAr)}`);
  return parts.join(' · ');
}

/**
 * Small chips describing the section's rules, in plain words.
 * zones: the delivery zone list ({ id, nameAr, nameEn }) for names.
 */
export function ruleChips(section, isAr, { now = new Date(), zones = [] } = {}) {
  const chips = [];
  const v = section?.visibility || {};
  const status = sectionStatus(section, now);
  const meta = STATUS_META[status];
  chips.push({ key: 'status', tone: meta.tone, label: label(meta, isAr) });

  const schedule = scheduleSummary(section, isAr, now);
  if (schedule) chips.push({ key: 'schedule', tone: 'slate', label: schedule });

  if (v.audience && v.audience !== 'all') {
    chips.push({ key: 'audience', tone: 'violet', label: label(AUDIENCE_OPTIONS.find((o) => o.value === v.audience), isAr) });
  }
  const devices = sectionDevices(section);
  if (devices !== 'all') {
    chips.push({ key: 'devices', tone: 'violet', label: label(DEVICE_OPTIONS.find((o) => o.value === devices), isAr) });
  }
  if (Array.isArray(v.zones) && v.zones.length) {
    const names = v.zones
      .map((id) => zones.find((z) => String(z.id || z._id) === String(id)))
      .filter(Boolean)
      .map((z) => (isAr ? z.nameAr || z.nameEn : z.nameEn || z.nameAr));
    chips.push({
      key: 'zones',
      tone: 'violet',
      label: names.length === 1 && v.zones.length === 1
        ? names[0]
        : (isAr ? `${v.zones.length} مناطق توصيل` : `${v.zones.length} delivery zones`),
    });
  }
  return chips;
}

/**
 * Page-wide problems the admin should fix, most serious first.
 * contentIssue(section) → { level, text } | null comes from the per-type summary.
 */
export function pageIssues(sections, isAr, { now = new Date(), zones = [], contentIssue = () => null } = {}) {
  const issues = [];
  const add = (section, level, text) => issues.push({ sectionId: section?._id || null, level, text });
  const zoneIds = new Set(zones.map((z) => String(z.id || z._id)));
  const anchors = new Map();
  const live = sections.filter((s) => sectionStatus(s, now) === 'live');

  sections.forEach((section) => {
    const status = sectionStatus(section, now);
    const content = contentIssue(section);
    if (content && section.isActive) add(section, content.level, content.text);

    if (section.isActive && status === 'ended') {
      add(section, 'warn', isAr ? 'انتهى موعده — احذفه أو حدّد موعداً جديداً' : 'Its schedule has ended — remove it or set new dates');
    }
    const v = section.visibility || {};
    if (zones.length && Array.isArray(v.zones) && v.zones.some((id) => !zoneIds.has(String(id)))) {
      add(section, 'warn', isAr ? 'مرتبط بمنطقة توصيل لم تعد موجودة' : 'Linked to a delivery zone that no longer exists');
    }
    const appearance = section.appearance || {};
    if (appearance.background === 'custom' && isDarkColor(appearance.backgroundColor)) {
      add(section, 'warn', isAr ? 'لون الخلفية غامق — قد يصعب قراءة النص' : 'Dark background — the text may be hard to read');
    }
    if (appearance.anchor) {
      anchors.set(appearance.anchor, [...(anchors.get(appearance.anchor) || []), section]);
    }
  });

  anchors.forEach((list, anchor) => {
    if (list.length > 1) {
      list.slice(1).forEach((section) => add(
        section,
        'warn',
        isAr ? `اسم الرابط «${anchor}» مستخدم في أكثر من قسم` : `Link name "${anchor}" is used by more than one section`,
      ));
    }
  });

  const firstLive = live[0];
  const heroIndex = live.findIndex((s) => s.type === 'hero_slider');
  if (heroIndex > 1 && firstLive) {
    add(live[heroIndex], 'info', isAr ? 'السلايدر الرئيسي يظهر عادة في أعلى الصفحة' : 'The main slider usually goes at the top of the page');
  }
  if (sections.length && !live.length) {
    issues.push({ sectionId: null, level: 'error', text: isAr ? 'لا يوجد أي قسم ظاهر الآن — الزوار سيرون صفحة افتراضية' : 'No section is live right now — visitors get a default page' });
  }

  const order = { error: 0, warn: 1, info: 2 };
  return issues.sort((a, b) => order[a.level] - order[b.level]);
}

/**
 * Sections for the admin preview. "any" shows every switched-on section whatever
 * its rules (plus hidden ones when asked); a visitor type shows exactly what that
 * visitor would see at `at` (default now).
 */
export function sectionsForPreview(sections, { audience = 'any', zoneId = '', at = null, showHidden = false } = {}) {
  const now = at || new Date();
  return sections.filter((section) => {
    if (!section.isActive) return showHidden && audience === 'any';
    if (audience === 'any') return true;
    // No zone picked = don't judge zone rules.
    const judged = zoneId ? section : { ...section, visibility: { ...(section.visibility || {}), zones: [] } };
    return sectionStatus(section, now) === 'live'
      && sectionVisibleTo(judged, { viewer: audience, zoneId: zoneId || null });
  });
}

/** A sortOrder between two neighbours (index = insert after; -1 = at the top). */
export function sortOrderForInsert(sections, afterIndex) {
  if (!sections.length) return 10;
  if (afterIndex < 0) return Math.max(1, (sections[0].sortOrder ?? 10) - 10);
  if (afterIndex >= sections.length - 1) return (sections[sections.length - 1].sortOrder ?? 0) + 10;
  const before = sections[afterIndex].sortOrder ?? 0;
  const after = sections[afterIndex + 1].sortOrder ?? before + 20;
  const mid = Math.floor((before + after) / 2);
  return mid > before ? mid : before + 1;
}

/** Move one item and renumber 10, 20, 30… (what the server stores on reorder). */
export function moveSection(sections, from, to) {
  if (from === to || from < 0 || to < 0 || from >= sections.length || to >= sections.length) return sections;
  const next = [...sections];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next.map((section, index) => ({ ...section, sortOrder: (index + 1) * 10 }));
}

/** Stable comparison for "has the form changed?" — key order does not matter. */
export function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

const TEXT_PAIRS = [
  ['titleAr', 'titleEn'],
  ['subtitleAr', 'subtitleEn'],
  ['ctaLabelAr', 'ctaLabelEn'],
];

/**
 * Fill the empty fields of one language from the other ("ar" → copies Arabic into
 * empty English fields). Only fills blanks — never overwrites what was typed.
 * Returns { form, count }.
 */
export function copyLanguage(form, from = 'ar') {
  const src = from === 'ar' ? 0 : 1;
  const dst = 1 - src;
  let count = 0;
  const fill = (obj, pairs) => {
    const next = { ...obj };
    pairs.forEach((pair) => {
      const a = pair[src];
      const b = pair[dst];
      if (String(next[a] || '').trim() && !String(next[b] || '').trim()) {
        next[b] = next[a];
        count += 1;
      }
    });
    return next;
  };

  let next = fill(form, TEXT_PAIRS);
  if (next.seoContent) next = { ...next, seoContent: fill(next.seoContent, [['bodyAr', 'bodyEn']]) };
  const itemPairs = [['titleAr', 'titleEn'], ['subtitleAr', 'subtitleEn'], ['ctaAr', 'ctaEn']];
  if (Array.isArray(next.items)) next = { ...next, items: next.items.map((item) => fill(item, itemPairs)) };
  if (Array.isArray(next.heroSlides)) next = { ...next, heroSlides: next.heroSlides.map((slide) => fill(slide, itemPairs)) };
  return { form: next, count };
}
