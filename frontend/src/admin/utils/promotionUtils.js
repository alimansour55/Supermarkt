import { buildQtyPromoSubtitle, badgesForQtyPromoRules } from '../../utils/promotionDisplay';
import {
  STORE_TIMEZONE,
  combineScheduleField,
  nowStoreSchedule,
  parseStoreSchedule,
  splitStoreScheduleField,
  storeScheduleTimestamp,
} from '../../utils/storeSchedule';

export { STORE_TIMEZONE };

export { badgesForQtyPromoRules };

export const PROMOTION_TYPES = [
  {
    value: 'percent_off',
    labelAr: 'خصم نسبة',
    labelEn: 'Percentage off',
    icon: '%',
    priceEffect: true,
    descAr: 'خصم % من السعر — يظهر السعر الجديد على البطاقة',
    descEn: '% off list price — new price shown on the card',
    exampleAr: '20% → 100 EGP يصبح 80',
    exampleEn: '20% → 100 EGP becomes 80',
    accent: 'rose',
  },
  {
    value: 'amount_off',
    labelAr: 'خصم مبلغ',
    labelEn: 'Fixed amount off',
    icon: '−',
    priceEffect: true,
    descAr: 'خصم مبلغ ثابت بالجنيه من السعر',
    descEn: 'Fixed EGP amount deducted from price',
    exampleAr: '−15 EGP → 100 يصبح 85',
    exampleEn: '−15 EGP → 100 becomes 85',
    accent: 'blue',
  },
  {
    value: 'bogo',
    labelAr: 'عرض كمية',
    labelEn: 'Quantity deal',
    icon: '🎁',
    priceEffect: false,
    descAr: '1+1، 3+1… — هدية في السلة عند الشراء',
    descEn: 'BOGO, 3+1… — free qty applied in cart',
    exampleAr: '1+1 ل → اشتري لتر واحصل على واحد',
    exampleEn: '1+1 L → buy one get one free',
    accent: 'violet',
  },
  {
    value: 'second_percent_off',
    labelAr: 'الثاني أرخص',
    labelEn: '2nd item off',
    icon: '2️⃣',
    priceEffect: false,
    descAr: 'خصم على كل قطعة ثانية (2، 4، 6…)',
    descEn: 'Discount on every 2nd unit (2nd, 4th…)',
    exampleAr: '50% على 2، 4، 6…',
    exampleEn: '50% off 2nd, 4th, 6th…',
    accent: 'amber',
  },
];

/** Legacy types — hidden from picker, still supported when editing existing rows. */
const LEGACY_PROMOTION_TYPE_META = {
  fixed_price: { value: 'fixed_price', labelAr: 'سعر ثابت', labelEn: 'Fixed sale price', icon: 'EGP', priceEffect: true },
  buy_x_get_y: { value: 'buy_x_get_y', labelAr: 'X+Y متقدم', labelEn: 'Custom X+Y', icon: '🎁', priceEffect: false },
  bundle: { value: 'bundle', labelAr: 'باقة', labelEn: 'Bundle deal', icon: '📦', priceEffect: false },
};

export function isPromotionPickerSelected(formType, optionValue) {
  if (optionValue === 'bogo') return formType === 'bogo' || formType === 'buy_x_get_y';
  return formType === optionValue;
}

export function allPromotionTypeFilterOptions() {
  return [
    ...PROMOTION_TYPES,
    { value: 'fixed_price', labelAr: 'سعر ثابت (قديم)', labelEn: 'Fixed price (legacy)' },
    { value: 'buy_x_get_y', labelAr: 'X+Y (قديم)', labelEn: 'X+Y (legacy)' },
    { value: 'bundle', labelAr: 'باقة (قديم)', labelEn: 'Bundle (legacy)' },
  ];
}

/** Current offer types only — for admin list filters. */
export function promotionTypeFilterOptions() {
  return PROMOTION_TYPES.map(({ value, labelAr, labelEn }) => ({ value, labelAr, labelEn }));
}

export const PROMOTION_STATUS_FILTER_OPTIONS = [
  { value: 'active', labelAr: 'نشط', labelEn: 'Active' },
  { value: 'scheduled', labelAr: 'مجدول', labelEn: 'Scheduled' },
  { value: 'paused', labelAr: 'متوقف', labelEn: 'Paused' },
  { value: 'ended', labelAr: 'منتهي', labelEn: 'Ended' },
];

export const PROMOTION_SCHEDULE_FILTER_OPTIONS = [
  { value: 'limited', labelAr: 'عرض محدود', labelEn: 'Limited time' },
  { value: 'open', labelAr: 'مفتوح', labelEn: 'Open-ended' },
];

const TYPE_CHIP_STYLES = {
  percent_off: 'border-rose-200 bg-rose-50 text-rose-900',
  amount_off: 'border-blue-200 bg-blue-50 text-blue-900',
  bogo: 'border-violet-200 bg-violet-50 text-violet-900',
  buy_x_get_y: 'border-violet-200 bg-violet-50 text-violet-900',
  second_percent_off: 'border-amber-200 bg-amber-50 text-amber-900',
  fixed_price: 'border-slate-200 bg-slate-50 text-slate-700',
  bundle: 'border-slate-200 bg-slate-50 text-slate-700',
};

export function getPromotionTypeChipClass(type) {
  return TYPE_CHIP_STYLES[type] || TYPE_CHIP_STYLES.percent_off;
}

export function getPromotionTargetLabel(targetMode, isAr = true) {
  const mode = PROMOTION_TARGET_MODES.find((m) => m.value === targetMode);
  if (!mode) return '';
  return isAr ? mode.labelAr : mode.labelEn;
}

export function isLimitedSchedule(row) {
  return !!row?.endsAt;
}

export function hasHourPrecision(iso) {
  if (!iso) return false;
  const { time } = splitScheduleField(iso);
  return time !== '00:00' && time !== '23:59';
}

export function formatSchedulePoint(iso) {
  if (!iso) return null;
  const { date, time } = splitScheduleField(iso);
  if (!date) return null;
  const showTime = hasHourPrecision(iso);
  return {
    date,
    time: showTime ? time : null,
    label: showTime ? `${date} · ${time}` : date,
  };
}

export const PROMOTION_TARGET_MODES = [
  { value: 'all', labelAr: 'كل المنتجات', labelEn: 'All products' },
  { value: 'products', labelAr: 'منتجات محددة', labelEn: 'Selected products' },
  { value: 'categories', labelAr: 'أقسام', labelEn: 'Categories' },
  { value: 'brands', labelAr: 'ماركات', labelEn: 'Brands' },
];

export const PROMOTION_STATUS_LABELS = {
  active: { ar: 'نشط', en: 'Active', className: 'bg-emerald-100 text-emerald-800' },
  scheduled: { ar: 'مجدول', en: 'Scheduled', className: 'bg-blue-100 text-blue-800' },
  paused: { ar: 'متوقف', en: 'Paused', className: 'bg-slate-100 text-slate-700' },
  ended: { ar: 'منتهي', en: 'Ended', className: 'bg-red-100 text-red-800' },
};

export function getPromotionTypeMeta(type) {
  return PROMOTION_TYPES.find((t) => t.value === type)
    || LEGACY_PROMOTION_TYPE_META[type]
    || PROMOTION_TYPES[0];
}

export function defaultPromotionForm() {
  const now = nowLocalSchedule();
  const end = addDaysIso(now.date, 7);
  return {
    nameAr: '',
    nameEn: '',
    slug: '',
    type: 'percent_off',
    targetMode: 'products',
    productIds: [],
    categoryIds: [],
    brandSlugs: [],
    rules: {
      percent: 15,
      amountOff: 20,
      fixedPrice: 0,
      buyQty: 1,
      getQty: 1,
      sameProduct: true,
      secondPercentOff: 50,
      bundlePrice: 0,
      minPurchaseQty: 1,
      promotionUnit: 'pieces',
    },
    badgeAr: 'عرض',
    badgeEn: 'Offer',
    cartLineAr: '',
    cartLineEn: '',
    cartProgressAr: '',
    cartProgressEn: '',
    cartSubtextAr: '',
    cartSubtextEn: '',
    scheduleMode: 'limited',
    startsAt: now.date,
    startsAtTime: now.time,
    endsAt: end,
    endsAtTime: '23:59',
    isActive: true,
    priority: 0,
    usageLimit: '',
    notes: '',
  };
}

export function todayIso() {
  return nowLocalSchedule().date;
}

export function addDaysIso(isoDate, days) {
  const base = isoDate ? parseLocalSchedule(isoDate, '12:00') : parseStoreSchedule(nowLocalSchedule().date, '12:00');
  const ms = base.getTime() + days * 24 * 60 * 60 * 1000;
  return splitStoreScheduleField(new Date(ms).toISOString()).date;
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

/** Current date/time in store timezone (Africa/Cairo). */
export function nowLocalSchedule() {
  return nowStoreSchedule();
}

export function scheduleTimestamp(date, time = '00:00') {
  return storeScheduleTimestamp(date, time);
}

export function isScheduleInPast(date, time = '00:00') {
  if (!date) return false;
  return scheduleTimestamp(date, time) < Date.now();
}

export function addMinutesToScheduleTime(date, time, minutes) {
  const d = parseLocalSchedule(date, time || '00:00');
  if (!d) return { date: '', time: '00:00' };
  const next = new Date(d.getTime() + minutes * 60 * 1000);
  return splitStoreScheduleField(next.toISOString());
}

export function clampScheduleToFuture(date, time = '00:00') {
  const now = nowLocalSchedule();
  if (!date || isScheduleInPast(date, time)) {
    return { date: now.date, time: now.time };
  }
  return { date, time: time || '00:00' };
}

/** Enforce start/end are not in the past; end is always after start. */
export function normalizeLimitedScheduleFields(fields, { lockedStart = null } = {}) {
  const now = nowLocalSchedule();
  let startsAt = fields.startsAt || now.date;
  let startsAtTime = fields.startsAtTime || '00:00';
  let endsAt = fields.endsAt || startsAt;
  let endsAtTime = fields.endsAtTime || '23:59';

  const startLocked = lockedStart
    && startsAt === lockedStart.date
    && (startsAtTime || '00:00') === (lockedStart.time || '00:00')
    && isScheduleInPast(startsAt, startsAtTime);

  if (!startLocked) {
    const clampedStart = clampScheduleToFuture(startsAt, startsAtTime);
    startsAt = clampedStart.date;
    startsAtTime = clampedStart.time;
  }

  const minEndTs = scheduleTimestamp(startsAt, startsAtTime) + 60 * 1000;
  let endTs = scheduleTimestamp(endsAt, endsAtTime);
  if (!endsAt || endTs < minEndTs) {
    const bumped = addMinutesToScheduleTime(startsAt, startsAtTime, 1);
    endsAt = bumped.date;
    endsAtTime = bumped.time;
    endTs = scheduleTimestamp(endsAt, endsAtTime);
  }

  if (endTs < Date.now()) {
    const bumped = addMinutesToScheduleTime(now.date, now.time, 1);
    if (scheduleTimestamp(bumped.date, bumped.time) < minEndTs) {
      const afterStart = addMinutesToScheduleTime(startsAt, startsAtTime, 1);
      endsAt = afterStart.date;
      endsAtTime = afterStart.time;
    } else {
      endsAt = bumped.date;
      endsAtTime = bumped.time;
    }
  }

  return {
    ...fields,
    scheduleMode: 'limited',
    startsAt,
    startsAtTime,
    endsAt,
    endsAtTime,
  };
}

export function formatTimeFromTimestamp(ts) {
  return splitStoreScheduleField(new Date(ts).toISOString()).time;
}

export function minEndTimeForSchedule(form, now = nowLocalSchedule()) {
  if (!form.endsAt) return now.time;
  const minEndTs = Math.max(
    scheduleTimestamp(form.startsAt, form.startsAtTime || '00:00') + 60 * 1000,
    form.endsAt === now.date ? Date.now() : 0,
  );
  return formatTimeFromTimestamp(minEndTs);
}

export function splitScheduleField(iso) {
  return splitStoreScheduleField(iso);
}

export { combineScheduleField };

export function parseLocalSchedule(dateStr, timeStr = '00:00') {
  return parseStoreSchedule(dateStr, timeStr);
}

export function addHoursToSchedule(startDate, startTime, hours) {
  const start = parseLocalSchedule(startDate, startTime || '00:00');
  if (!start) return { date: startDate, time: startTime || '00:00' };
  const end = new Date(start.getTime() + hours * 60 * 60 * 1000);
  return splitStoreScheduleField(end.toISOString());
}

export function addDurationToSchedule(startDate, startTime, minutes) {
  return addMinutesToScheduleTime(startDate, startTime, minutes);
}

export function formatScheduleClock(time = '00:00') {
  const [h = 0, m = 0] = String(time || '00:00').split(':');
  return `${pad2(Number(h) || 0)}:${pad2(Number(m) || 0)}`;
}

export function getScheduleDurationMinutes(form) {
  if (!form?.startsAt || !form?.endsAt) return null;
  const start = parseLocalSchedule(form.startsAt, form.startsAtTime || '00:00');
  const end = parseLocalSchedule(form.endsAt, form.endsAtTime || '23:59');
  if (!start || !end) return null;
  return Math.round((end.getTime() - start.getTime()) / 60000);
}

export function formatDurationShort(totalMinutes, isAr = true) {
  if (totalMinutes == null || totalMinutes < 0) return '—';
  if (totalMinutes < 60) {
    return isAr ? `${totalMinutes} دقيقة` : `${totalMinutes} min`;
  }
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (mins === 0) {
    if (isAr) {
      if (hours === 1) return 'ساعة واحدة';
      if (hours === 2) return 'ساعتان';
      return `${hours} ساعات`;
    }
    return hours === 1 ? '1 hour' : `${hours} hours`;
  }
  return isAr ? `${hours} س ${mins} د` : `${hours}h ${mins}m`;
}

export function formatScheduleDateShort(dateStr, isAr = true) {
  if (!dateStr) return '—';
  try {
    return new Intl.DateTimeFormat(isAr ? 'ar-EG' : 'en-GB', {
      timeZone: STORE_TIMEZONE,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }).format(parseLocalSchedule(dateStr, '12:00'));
  } catch {
    return dateStr;
  }
}

export function formatScheduleInstant(iso, isAr = true) {
  if (!iso) return '—';
  const { date, time } = splitScheduleField(iso);
  if (!date) return '—';
  if (time === '00:00' || time === '23:59') return date;
  return isAr ? `${date} ${time}` : `${date} ${time}`;
}

export function formatScheduleRange(startIso, endIso, isAr = true) {
  if (!startIso && !endIso) return isAr ? 'مفتوح' : 'Open';
  const start = formatScheduleInstant(startIso, isAr);
  const end = endIso ? formatScheduleInstant(endIso, isAr) : (isAr ? '∞' : '∞');
  return `${start} → ${end}`;
}

export function inferScheduleMode(form) {
  if (form?.scheduleMode) return form.scheduleMode;
  return form?.endsAt ? 'limited' : 'open';
}

export function formatScheduleSummary(form, isAr = true) {
  const mode = inferScheduleMode(form);
  if (mode === 'open') {
    return isAr ? 'مفتوح — حتى إيقاف الحملة يدوياً' : 'Open — until you pause the campaign';
  }
  const start = form.startsAt || todayIso();
  const end = form.endsAt || start;
  const startTime = form.startsAtTime || '00:00';
  const endTime = form.endsAtTime || '23:59';
  const hasTime = (startTime !== '00:00' || endTime !== '23:59');

  if (start === end && hasTime) {
    return isAr
      ? `عرض محدود — ${start} من ${startTime} إلى ${endTime}`
      : `Limited — ${start} ${startTime} → ${endTime}`;
  }
  if (start === end) {
    return isAr ? `عرض ليوم واحد — ${start}` : `One day — ${start}`;
  }
  if (hasTime) {
    return isAr
      ? `عرض محدود — ${start} ${startTime} → ${end} ${endTime}`
      : `Limited — ${start} ${startTime} → ${end} ${endTime}`;
  }
  return isAr ? `عرض محدود — ${start} → ${end}` : `Limited — ${start} → ${end}`;
}

export function defaultBadgesForType(type) {
  const map = {
    percent_off: { badgeAr: 'خصم', badgeEn: 'Sale' },
    amount_off: { badgeAr: 'خصم', badgeEn: 'Save' },
    fixed_price: { badgeAr: 'سعر خاص', badgeEn: 'Special' },
    bogo: { badgeAr: '1+1', badgeEn: 'BOGO' },
    buy_x_get_y: { badgeAr: 'عرض', badgeEn: 'Deal' },
    second_percent_off: { badgeAr: 'الثاني -50%', badgeEn: '2nd -50%' },
    bundle: { badgeAr: 'باقة', badgeEn: 'Bundle' },
  };
  return map[type] || { badgeAr: 'عرض', badgeEn: 'Offer' };
}

export function defaultSingleProductOfferForm(product = null) {
  const base = defaultPromotionForm();
  base.targetMode = 'products';
  base.productIds = product?._id ? [String(product._id)] : [];
  if (product) {
    const nameAr = product.nameAr || product.name || product.nameEn || '';
    const nameEn = product.nameEn || product.nameAr || product.name || '';
    base.nameAr = nameAr ? `عرض ${nameAr}` : '';
    base.nameEn = nameEn ? `${nameEn} offer` : '';
  }
  return base;
}

export function promotionToForm(row) {
  const start = splitScheduleField(row.startsAt);
  const end = splitScheduleField(row.endsAt);
  return {
    nameAr: row.nameAr || '',
    nameEn: row.nameEn || '',
    slug: row.slug || '',
    type: row.type || 'percent_off',
    targetMode: row.targetMode || 'products',
    productIds: row.productIds || [],
    categoryIds: row.categoryIds || [],
    brandSlugs: row.brandSlugs || [],
    rules: { ...defaultPromotionForm().rules, ...(row.rules || {}) },
    badgeAr: row.badgeAr || 'عرض',
    badgeEn: row.badgeEn || 'Offer',
    cartLineAr: row.cartLineAr || '',
    cartLineEn: row.cartLineEn || '',
    cartProgressAr: row.cartProgressAr || '',
    cartProgressEn: row.cartProgressEn || '',
    cartSubtextAr: row.cartSubtextAr ?? '',
    cartSubtextEn: row.cartSubtextEn ?? '',
    scheduleMode: row.endsAt ? 'limited' : 'open',
    startsAt: start.date,
    startsAtTime: start.time || '00:00',
    endsAt: end.date,
    endsAtTime: end.time || '23:59',
    isActive: row.isActive !== false,
    priority: row.priority || 0,
    usageLimit: row.usageLimit || '',
    notes: row.notes || '',
  };
}

export function formToPromotionPayload(form) {
  const scheduleMode = inferScheduleMode(form);
  return {
    ...form,
    productIds: form.productIds || [],
    categoryIds: form.categoryIds || [],
    brandSlugs: (form.brandSlugs || []).filter(Boolean),
    priority: Number(form.priority) || 0,
    usageLimit: form.usageLimit ? Number(form.usageLimit) : null,
    startsAt: combineScheduleField(form.startsAt, form.startsAtTime),
    endsAt: scheduleMode === 'limited'
      ? combineScheduleField(form.endsAt || form.startsAt, form.endsAtTime)
      : null,
  };
}

export function describePromotionRules(row, isAr) {
  const rules = row.rules || {};
  switch (row.type) {
    case 'percent_off':
      return isAr ? `خصم ${rules.percent}%` : `${rules.percent}% off`;
    case 'amount_off':
      return isAr ? `خصم ${rules.amountOff} جنيه` : `${rules.amountOff} EGP off`;
    case 'fixed_price':
      return isAr ? `سعر ${rules.fixedPrice} جنيه` : `Price ${rules.fixedPrice} EGP`;
    case 'bogo':
    case 'buy_x_get_y':
      return buildQtyPromoSubtitle(rules.buyQty, rules.getQty, rules.promotionUnit || 'pieces', isAr);
    case 'second_percent_off':
      return isAr ? `الثاني -${rules.secondPercentOff}%` : `2nd item -${rules.secondPercentOff}%`;
    case 'bundle':
      return isAr ? `باقة ${rules.bundlePrice} جنيه` : `Bundle ${rules.bundlePrice} EGP`;
    default:
      return row.type;
  }
}
