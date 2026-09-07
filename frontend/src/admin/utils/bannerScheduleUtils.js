const MS_HOUR = 60 * 60 * 1000;
const MS_DAY = 24 * MS_HOUR;
const MS_WEEK = 7 * MS_DAY;
const MS_MONTH = 30 * MS_DAY;

export const SCHEDULE_UNITS = [
  {
    value: 'hour',
    labelAr: 'كل ساعة',
    labelEn: 'Hourly',
    periodLabelAr: 'ساعة',
    periodLabelEn: 'Hour',
    periodLabelPluralAr: 'ساعات',
    periodLabelPluralEn: 'Hours',
    maxCycle: 168,
    descAr: 'تبديل كل ساعة — مناسب للعروض السريعة',
    descEn: 'Rotates every hour — great for flash promos',
  },
  {
    value: 'day',
    labelAr: 'يومي',
    labelEn: 'Daily',
    periodLabelAr: 'يوم',
    periodLabelEn: 'Day',
    periodLabelPluralAr: 'أيام',
    periodLabelPluralEn: 'Days',
    maxCycle: 31,
    descAr: 'بانر(ات) مختلفة كل يوم',
    descEn: 'Different banner(s) each day',
  },
  {
    value: 'week',
    labelAr: 'أسبوعي',
    labelEn: 'Weekly',
    periodLabelAr: 'أسبوع',
    periodLabelEn: 'Week',
    periodLabelPluralAr: 'أسابيع',
    periodLabelPluralEn: 'Weeks',
    maxCycle: 52,
    descAr: 'حملة كل أسبوع — يتكرر تلقائياً',
    descEn: 'Campaign per week — repeats automatically',
  },
  {
    value: 'month',
    labelAr: 'شهري',
    labelEn: 'Monthly',
    periodLabelAr: 'شهر',
    periodLabelEn: 'Month',
    periodLabelPluralAr: 'أشهر',
    periodLabelPluralEn: 'Months',
    maxCycle: 12,
    descAr: 'بانر(ات) لكل شهر في السنة',
    descEn: 'Banner(s) per month in the year',
  },
];

const UNIT_MS = {
  hour: MS_HOUR,
  day: MS_DAY,
  week: MS_WEEK,
  month: MS_MONTH,
};

export function scheduleUnitMeta(unit) {
  return SCHEDULE_UNITS.find((u) => u.value === unit) || SCHEDULE_UNITS[2];
}

export function periodPluralLabel(unit, isAr) {
  const meta = scheduleUnitMeta(unit);
  return isAr ? meta.periodLabelPluralAr : meta.periodLabelPluralEn;
}

export function bannerScheduleStatus(banner, now = new Date()) {
  if (!banner?.isActive) {
    return { key: 'draft', labelAr: 'متوقف', labelEn: 'Paused', className: 'bg-slate-100 text-slate-700' };
  }
  const start = banner.startsAt ? new Date(banner.startsAt) : null;
  const end = banner.endsAt ? new Date(banner.endsAt) : null;
  if (start && start > now) {
    return { key: 'scheduled', labelAr: 'مجدول', labelEn: 'Scheduled', className: 'bg-blue-100 text-blue-800' };
  }
  if (end && end < now) {
    return { key: 'expired', labelAr: 'منتهي', labelEn: 'Expired', className: 'bg-amber-100 text-amber-800' };
  }
  return { key: 'live', labelAr: 'نشط الآن', labelEn: 'Live now', className: 'bg-green-100 text-green-800' };
}

export function bannerIsLiveNow(banner, now = new Date()) {
  return bannerScheduleStatus(banner, now).key === 'live';
}

/** @deprecated use getHeroSchedulePeriodIndex */
export function getHeroRotationWeekIndex(startDate, cycleWeeks, now = new Date()) {
  return getHeroSchedulePeriodIndex(startDate, 'week', cycleWeeks, now);
}

export function getHeroSchedulePeriodIndex(startDate, unit = 'week', cycleLength = 4, now = new Date()) {
  if (!startDate || !cycleLength) return 1;
  const start = new Date(startDate);
  if (Number.isNaN(start.getTime())) return 1;
  const ms = UNIT_MS[unit] || MS_WEEK;
  const elapsed = Math.floor((now.getTime() - start.getTime()) / ms);
  if (elapsed < 0) return 0;
  return (elapsed % cycleLength) + 1;
}

/** before | active | after | disabled */
export function getHeroSchedulePhase(rotation, now = new Date()) {
  if (rotation?.isEnabled === false) return 'disabled';

  const start = rotation?.startDate ? new Date(rotation.startDate) : null;
  const runsForever = rotation?.runsForever !== false && !rotation?.endDate;
  const end = !runsForever && rotation?.endDate ? new Date(rotation.endDate) : null;

  if (start && !Number.isNaN(start.getTime()) && now < start) return 'before';
  if (end && !Number.isNaN(end.getTime()) && now > end) return 'after';
  return 'active';
}

export function formatSchedulePhaseLabel(phase, isAr) {
  const map = {
    disabled: { ar: '⏸ متوقف يدوياً — يُعرض الاحتياطي', en: '⏸ Paused manually — fallback showing' },
    before: { ar: 'قبل البداية — يُعرض الاحتياطي', en: 'Before start — fallback showing' },
    active: { ar: 'الجدولة نشطة — دورة البانرات', en: 'Schedule active — rotation running' },
    after: { ar: 'بعد النهاية — يُعرض الاحتياطي', en: 'After end — fallback showing' },
  };
  const row = map[phase] || map.active;
  return isAr ? row.ar : row.en;
}

export function dateInputValue(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 16);
}

export const EMPTY_HERO_ROTATION = {
  isEnabled: true,
  startDate: '',
  endDate: '',
  runsForever: true,
  unit: 'week',
  cycleLength: 4,
  cycleWeeks: 4,
  periods: [],
  slots: [],
  sameFallback: true,
  fallbackAfterSlides: [],
};

export function emptySchedulePeriod(periodIndex) {
  return { periodIndex, slides: [] };
}

/** Normalize legacy flat slots → periods with slides arrays */
export function normalizeHeroRotation(rotation = {}) {
  const unit = rotation.unit || 'week';
  const meta = scheduleUnitMeta(unit);
  const periods = Array.isArray(rotation.periods) ? rotation.periods : [];
  const legacySlots = Array.isArray(rotation.slots) ? rotation.slots : [];

  let normalizedPeriods = periods;
  if (!normalizedPeriods.length && legacySlots.length) {
    normalizedPeriods = legacySlots.map((slot, index) => ({
      periodIndex: slot.weekIndex || slot.periodIndex || index + 1,
      slides: [slot],
    }));
  }

  normalizedPeriods = normalizedPeriods
    .map((period, index) => ({
      periodIndex: period.periodIndex || index + 1,
      slides: Array.isArray(period.slides) ? period.slides : [],
    }))
    .sort((a, b) => a.periodIndex - b.periodIndex);

  const cycleLength = Math.min(
    meta.maxCycle,
    Math.max(1, Number(rotation.cycleLength) || Number(rotation.cycleWeeks) || normalizedPeriods.length || 4),
  );

  const runsForever = rotation.runsForever !== false;
  let endDate = null;
  if (!runsForever && rotation.endDate) {
    const parsedEnd = new Date(rotation.endDate);
    if (!Number.isNaN(parsedEnd.getTime())) endDate = rotation.endDate;
  }

  return {
    isEnabled: rotation.isEnabled !== false,
    startDate: rotation.startDate || null,
    endDate,
    runsForever: runsForever && !endDate,
    unit,
    cycleLength,
    cycleWeeks: cycleLength,
    periods: normalizedPeriods,
    slots: legacySlots,
    sameFallback: rotation.sameFallback !== false,
    fallbackAfterSlides: Array.isArray(rotation.fallbackAfterSlides) ? rotation.fallbackAfterSlides : [],
  };
}

export function formatPeriodLabel(periodIndex, unit, isAr) {
  const meta = scheduleUnitMeta(unit);
  return isAr
    ? `${meta.periodLabelAr} ${periodIndex}`
    : `${meta.periodLabelEn} ${periodIndex}`;
}

export function formatScheduleNowLabel(rotation, isAr) {
  const normalized = normalizeHeroRotation(rotation);
  const phase = getHeroSchedulePhase(normalized);
  if (phase === 'disabled') {
    return isAr ? '⏸ الجدولة متوقفة — الشرائح الاحتياطية' : '⏸ Schedule paused — fallback slides';
  }
  if (phase === 'before') {
    return isAr ? '⏳ قبل البداية — الشرائح الاحتياطية' : '⏳ Before start — fallback slides';
  }
  if (phase === 'after') {
    return isAr ? '⏹ بعد النهاية — الشرائح الاحتياطية' : '⏹ After end — fallback slides';
  }
  const periodIndex = getHeroSchedulePeriodIndex(
    normalized.startDate,
    normalized.unit,
    normalized.cycleLength,
  );
  const meta = scheduleUnitMeta(normalized.unit);
  const repeatNote = isAr ? ' — الدورة تتكرر' : ' — cycle repeats';
  return isAr
    ? `📍 الفترة الحالية: ${meta.periodLabelAr} ${periodIndex} من ${normalized.cycleLength}${repeatNote}`
    : `📍 Current slot: ${meta.periodLabelEn} ${periodIndex} of ${normalized.cycleLength}${repeatNote}`;
}
