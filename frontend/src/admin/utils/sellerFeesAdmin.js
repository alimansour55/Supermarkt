/**
 * Pure helpers for the seller fees & profit screens (node-tested in test/sellerFeesAdmin.test.js).
 */

const DAY = 86400000;

/** YYYY-MM-DD of a date in Cairo. */
export function cairoDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(date);
}

export const RANGE_PRESETS = [
  { key: '7d', ar: 'آخر ٧ أيام', en: 'Last 7 days' },
  { key: '30d', ar: 'آخر ٣٠ يوماً', en: 'Last 30 days' },
  { key: 'month', ar: 'هذا الشهر', en: 'This month' },
  { key: 'lastMonth', ar: 'الشهر الماضي', en: 'Last month' },
  { key: '90d', ar: 'آخر ٩٠ يوماً', en: 'Last 90 days' },
  { key: 'year', ar: 'هذا العام', en: 'This year' },
];

/** { from, to } (Cairo calendar dates, both inclusive) for a preset key. */
export function rangeFromPreset(key, now = new Date()) {
  const today = cairoDate(now);
  const [y, m] = today.split('-').map(Number);
  const pad = (n) => String(n).padStart(2, '0');
  switch (key) {
    case '7d': return { from: cairoDate(new Date(now.getTime() - 6 * DAY)), to: today };
    case '90d': return { from: cairoDate(new Date(now.getTime() - 89 * DAY)), to: today };
    case 'month': return { from: `${y}-${pad(m)}-01`, to: today };
    case 'lastMonth': {
      const py = m === 1 ? y - 1 : y;
      const pm = m === 1 ? 12 : m - 1;
      const last = new Date(Date.UTC(py, pm, 0)).getUTCDate();
      return { from: `${py}-${pad(pm)}-01`, to: `${py}-${pad(pm)}-${pad(last)}` };
    }
    case 'year': return { from: `${y}-01-01`, to: today };
    case '30d':
    default: return { from: cairoDate(new Date(now.getTime() - 29 * DAY)), to: today };
  }
}

/** Numbers in forms are strings; '' means "inherit" (null) for optional fields. */
export const toNum = (v) => (v === '' || v === null || v === undefined ? null : Number(v));
export const toField = (v) => (v === null || v === undefined ? '' : String(v));

export const PLAN_FIELDS = [
  'commissionRate', 'minCommissionPerItem', 'maxCommissionPerItem', 'fixedFeePerItem',
  'fixedFeePerShipment', 'storeFulfillmentFeePerItem', 'monthlyFee', 'payoutHoldDays',
];

const dateField = (v) => (v ? cairoDate(new Date(v)) : '');

/** Marketplace settings (API) → editable form state for the fees page. */
export function feeFormFromSettings(s = {}) {
  const fees = s.fees || {};
  return {
    defaultCommissionRate: toField(s.defaultCommissionRate ?? 10),
    storeFulfillmentFeePerItem: toField(s.storeFulfillmentFeePerItem ?? 0),
    sellerShipmentDeliveryFee: toField(s.sellerShipmentDeliveryFee ?? 0),
    payoutHoldDays: toField(s.payoutHoldDays ?? 14),
    minPayoutAmount: toField(s.minPayoutAmount ?? 0),
    fees: {
      minCommissionPerItem: toField(fees.minCommissionPerItem ?? 0),
      maxCommissionPerItem: toField(fees.maxCommissionPerItem ?? 0),
      fixedFeePerItem: toField(fees.fixedFeePerItem ?? 0),
      fixedFeePerShipment: toField(fees.fixedFeePerShipment ?? 0),
      monthlyFee: toField(fees.monthlyFee ?? 0),
      commissionOnDeliveryFee: fees.commissionOnDeliveryFee === true,
      vatPercent: toField(fees.vatPercent ?? 0),
      returnAdminFeePercent: toField(fees.returnAdminFeePercent ?? 0),
      paymentFees: (fees.paymentFees || []).map((f) => ({ method: f.method, percent: toField(f.percent), fixed: toField(f.fixed) })),
    },
    categoryCommissions: (s.categoryCommissions || []).map((r) => ({ category: String(r.category?._id || r.category), rate: toField(r.rate) })),
    plans: (s.plans || []).map((p) => ({
      key: p.key,
      nameAr: p.nameAr || '',
      nameEn: p.nameEn || '',
      descriptionAr: p.descriptionAr || '',
      descriptionEn: p.descriptionEn || '',
      isDefault: p.isDefault === true,
      ...Object.fromEntries(PLAN_FIELDS.map((f) => [f, toField(p[f])])),
    })),
    commissionRules: (s.commissionRules || []).map((r) => ({
      _id: r._id,
      name: r.name || '',
      active: r.active !== false,
      rate: toField(r.rate),
      fixedFeePerItem: toField(r.fixedFeePerItem),
      overrideSellerDeals: r.overrideSellerDeals === true,
      categories: (r.categories || []).map(String),
      sellers: (r.sellers || []).map(String),
      plans: r.plans || [],
      fulfillment: r.fulfillment || 'any',
      minPrice: toField(r.minPrice),
      maxPrice: toField(r.maxPrice),
      startsAt: dateField(r.startsAt),
      endsAt: ruleEndForDisplay(r.endsAt),
      newSellerDays: toField(r.newSellerDays),
    })),
    payoutSchedule: {
      frequency: s.payoutSchedule?.frequency || 'manual',
      weekday: toField(s.payoutSchedule?.weekday ?? 0),
      monthDay: toField(s.payoutSchedule?.monthDay ?? 1),
    },
  };
}

/** A Cairo calendar date → the instant that day starts in Cairo (handles DST). */
export function cairoDayStart(ymd) {
  if (!ymd) return null;
  const [y, m, d] = ymd.split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d);
  const offsetAt = (t) => {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
      timeZone: 'Africa/Cairo', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    }).formatToParts(new Date(t)).map((x) => [x.type, x.value]));
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - t;
  };
  return new Date(guess - offsetAt(guess - offsetAt(guess))).toISOString();
}

/** Form state → the settings payload the API expects. */
export function feePayloadFromForm(form) {
  return {
    defaultCommissionRate: Number(form.defaultCommissionRate) || 0,
    storeFulfillmentFeePerItem: Number(form.storeFulfillmentFeePerItem) || 0,
    sellerShipmentDeliveryFee: Number(form.sellerShipmentDeliveryFee) || 0,
    payoutHoldDays: Number(form.payoutHoldDays) || 0,
    minPayoutAmount: Number(form.minPayoutAmount) || 0,
    fees: {
      ...Object.fromEntries(['minCommissionPerItem', 'maxCommissionPerItem', 'fixedFeePerItem', 'fixedFeePerShipment', 'monthlyFee', 'vatPercent', 'returnAdminFeePercent']
        .map((f) => [f, Number(form.fees[f]) || 0])),
      commissionOnDeliveryFee: form.fees.commissionOnDeliveryFee === true,
      paymentFees: form.fees.paymentFees
        .filter((f) => f.method)
        .map((f) => ({ method: f.method, percent: Number(f.percent) || 0, fixed: Number(f.fixed) || 0 })),
    },
    categoryCommissions: form.categoryCommissions
      .filter((r) => r.category && r.rate !== '')
      .map((r) => ({ category: r.category, rate: Number(r.rate) })),
    plans: form.plans.map((p) => ({
      key: p.key,
      nameAr: p.nameAr,
      nameEn: p.nameEn,
      descriptionAr: p.descriptionAr,
      descriptionEn: p.descriptionEn,
      isDefault: p.isDefault,
      ...Object.fromEntries(PLAN_FIELDS.map((f) => [f, toNum(p[f])])),
    })),
    commissionRules: form.commissionRules
      .filter((r) => r.rate !== '')
      .map((r) => ({
        ...(r._id ? { _id: r._id } : {}),
        name: r.name,
        active: r.active,
        rate: Number(r.rate),
        fixedFeePerItem: toNum(r.fixedFeePerItem),
        overrideSellerDeals: r.overrideSellerDeals,
        categories: r.categories,
        sellers: r.sellers,
        plans: r.plans,
        fulfillment: r.fulfillment,
        minPrice: toNum(r.minPrice),
        maxPrice: toNum(r.maxPrice),
        startsAt: cairoDayStart(r.startsAt),
        // An end date includes that whole day.
        endsAt: r.endsAt ? new Date(new Date(cairoDayStart(r.endsAt)).getTime() + DAY).toISOString() : null,
        newSellerDays: toNum(r.newSellerDays),
      })),
    payoutSchedule: {
      frequency: form.payoutSchedule.frequency,
      weekday: Number(form.payoutSchedule.weekday) || 0,
      monthDay: Number(form.payoutSchedule.monthDay) || 1,
    },
  };
}

/** Undo feePayloadFromForm's "end date includes the whole day" for display. */
export function ruleEndForDisplay(endsAt) {
  return endsAt ? cairoDate(new Date(new Date(endsAt).getTime() - 1)) : '';
}

export function newRule() {
  return {
    name: '', active: true, rate: '', fixedFeePerItem: '', overrideSellerDeals: false,
    categories: [], sellers: [], plans: [], fulfillment: 'any',
    minPrice: '', maxPrice: '', startsAt: '', endsAt: '', newSellerDays: '',
  };
}

export function newPlan(existing = []) {
  let n = existing.length + 1;
  while (existing.some((p) => p.key === `plan-${n}`)) n += 1;
  return {
    key: `plan-${n}`, nameAr: '', nameEn: '', descriptionAr: '', descriptionEn: '', isDefault: existing.length === 0,
    ...Object.fromEntries(PLAN_FIELDS.map((f) => [f, ''])),
  };
}

/** Short plain-language summary of a rule's conditions. */
export function describeRule(rule, { categoryName = () => '', sellerName = () => '', planName = (k) => k } = {}, isAr = false) {
  const parts = [];
  if (rule.categories?.length) parts.push(rule.categories.map(categoryName).filter(Boolean).join(isAr ? '، ' : ', '));
  if (rule.sellers?.length) parts.push(rule.sellers.map(sellerName).filter(Boolean).join(isAr ? '، ' : ', '));
  if (rule.plans?.length) parts.push(`${isAr ? 'باقة' : 'plan'} ${rule.plans.map(planName).join('/')}`);
  if (rule.fulfillment === 'store') parts.push(isAr ? 'يشحنها المتجر' : 'store-shipped');
  if (rule.fulfillment === 'seller') parts.push(isAr ? 'يشحنها البائع' : 'seller-shipped');
  const min = toNum(rule.minPrice);
  const max = toNum(rule.maxPrice);
  if (min !== null && max !== null) parts.push(`${min}–${max} EGP`);
  else if (min !== null) parts.push(isAr ? `من ${min} ج.م` : `${min}+ EGP`);
  else if (max !== null) parts.push(isAr ? `حتى ${max} ج.م` : `up to ${max} EGP`);
  if (toNum(rule.newSellerDays)) parts.push(isAr ? `بائع جديد (${rule.newSellerDays} يوم)` : `new sellers (${rule.newSellerDays} days)`);
  if (rule.startsAt || rule.endsAt) {
    parts.push([rule.startsAt && (isAr ? `من ${rule.startsAt}` : `from ${rule.startsAt}`), rule.endsAt && (isAr ? `حتى ${rule.endsAt}` : `until ${rule.endsAt}`)].filter(Boolean).join(' '));
  }
  return parts.length ? parts.join(' · ') : (isAr ? 'كل المبيعات' : 'All sales');
}

/** Is a rule running now, scheduled, ended or switched off? (dates are Cairo calendar dates) */
export function ruleState(rule, now = new Date()) {
  if (!rule.active) return 'off';
  const today = cairoDate(now);
  if (rule.startsAt && rule.startsAt > today) return 'scheduled';
  if (rule.endsAt && rule.endsAt < today) return 'ended';
  return 'live';
}

/** Report rows → sorted copy. */
export function sortRows(rows, key, dir = 'desc') {
  const get = (r) => (key === 'name' ? (r.seller?.nameEn || '').toLowerCase() : Number(r[key]) || 0);
  return [...rows].sort((a, b) => {
    const x = get(a);
    const y = get(b);
    if (x === y) return 0;
    return (x < y ? -1 : 1) * (dir === 'asc' ? 1 : -1);
  });
}

/** Percent change between two numbers, or null when there's no base. */
export function pctChange(current, previous) {
  if (!previous) return null;
  return Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10;
}

/** The same-length window right before { from, to } (for "vs previous period"). */
export function previousRange({ from, to }) {
  const start = new Date(`${from}T00:00:00Z`).getTime();
  const end = new Date(`${to}T00:00:00Z`).getTime();
  const days = Math.round((end - start) / DAY) + 1;
  const iso = (t) => new Date(t).toISOString().slice(0, 10);
  return { from: iso(start - days * DAY), to: iso(start - DAY) };
}

export const PAYMENT_METHOD_OPTIONS = [
  { value: '*', ar: 'أي طريقة أخرى', en: 'Any other method' },
  { value: 'cod', ar: 'الدفع عند الاستلام', en: 'Cash on delivery' },
  { value: 'paymob_card', ar: 'بطاقة بنكية', en: 'Card' },
  { value: 'paymob_wallet', ar: 'محفظة إلكترونية', en: 'Mobile wallet' },
  { value: 'paymob_valu', ar: 'valU تقسيط', en: 'valU instalments' },
  { value: 'fawry', ar: 'فوري', en: 'Fawry' },
  { value: 'instapay', ar: 'إنستاباي', en: 'InstaPay' },
  { value: 'vodafone_cash', ar: 'فودافون كاش', en: 'Vodafone Cash' },
];

export const WEEKDAYS = [
  { ar: 'الأحد', en: 'Sunday' }, { ar: 'الإثنين', en: 'Monday' }, { ar: 'الثلاثاء', en: 'Tuesday' },
  { ar: 'الأربعاء', en: 'Wednesday' }, { ar: 'الخميس', en: 'Thursday' }, { ar: 'الجمعة', en: 'Friday' }, { ar: 'السبت', en: 'Saturday' },
];

/** Category tree → flat select options with indentation. */
export function categoryOptions(categories, isAr) {
  const byParent = new Map();
  for (const c of categories) {
    const p = String(c.parentCategory?._id || c.parentCategory || '');
    if (!byParent.has(p)) byParent.set(p, []);
    byParent.get(p).push(c);
  }
  const out = [];
  const walk = (parent, depth) => {
    for (const c of byParent.get(parent) || []) {
      out.push({ value: String(c._id), label: `${'— '.repeat(depth)}${isAr ? c.nameAr : c.nameEn}` });
      if (depth < 4) walk(String(c._id), depth + 1);
    }
  };
  walk('', 0);
  return out;
}
