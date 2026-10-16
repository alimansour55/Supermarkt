/**
 * Seller deal helpers for the admin panel: where a commission rate comes from, readable labels
 * for history rows, and which deal fields a form actually changed. Pure — tested in
 * frontend/test/sellerDeal.test.js.
 */
import { cairoDayStart } from './sellerFeesAdmin.js';

/** Why a seller pays this rate (mirror of backend resolveCommission sources). */
export const RATE_SOURCES = {
  seller_free: { ar: 'فترة بدون عمولة', en: 'Commission-free period', tone: 'bg-emerald-50 text-emerald-800' },
  rule: { ar: 'قاعدة / حملة', en: 'Rule / campaign', tone: 'bg-violet-50 text-violet-800' },
  seller_category: { ar: 'اتفاق خاص للقسم', en: 'Seller deal for this category', tone: 'bg-primary-50 text-primary-800' },
  seller: { ar: 'نسبة خاصة بالبائع', en: 'Seller’s own rate', tone: 'bg-primary-50 text-primary-800' },
  category: { ar: 'نسبة القسم العامة', en: 'Category standard rate', tone: 'bg-slate-100 text-slate-700' },
  plan: { ar: 'نسبة الباقة', en: 'Plan rate', tone: 'bg-sky-50 text-sky-800' },
  default: { ar: 'النسبة العامة', en: 'Standard rate', tone: 'bg-slate-100 text-slate-700' },
};

/** History field → label. Unknown keys fall back to the raw key. */
export const HISTORY_FIELDS = {
  nameAr: ['اسم المتجر (ع)', 'Store name (AR)'],
  nameEn: ['اسم المتجر (EN)', 'Store name (EN)'],
  descriptionAr: ['الوصف (ع)', 'Description (AR)'],
  descriptionEn: ['الوصف (EN)', 'Description (EN)'],
  legalName: ['الاسم القانوني', 'Legal name'],
  commercialRegisterNo: ['السجل التجاري', 'Commercial register'],
  taxId: ['الرقم الضريبي', 'Tax ID'],
  contactName: ['المسؤول', 'Contact'],
  email: ['بريد المتجر', 'Store email'],
  phone: ['الهاتف', 'Phone'],
  'address.street': ['الشارع', 'Street'],
  'address.city': ['المدينة', 'City'],
  'address.governorate': ['المحافظة', 'Governorate'],
  commissionRate: ['نسبة العمولة الخاصة', 'Negotiated commission'],
  categoryCommissions: ['عمولة الأقسام', 'Category commissions'],
  feePlan: ['الباقة', 'Plan'],
  'feeOverrides.minCommissionPerItem': ['أقل عمولة للقطعة', 'Min commission / item'],
  'feeOverrides.maxCommissionPerItem': ['أقصى عمولة للقطعة', 'Max commission / item'],
  'feeOverrides.fixedFeePerItem': ['رسوم لكل قطعة', 'Fee per item'],
  'feeOverrides.fixedFeePerShipment': ['رسوم لكل شحنة', 'Fee per shipment'],
  'feeOverrides.storeFulfillmentFeePerItem': ['رسوم الشحن من المخزن', 'Fulfillment fee / item'],
  'feeOverrides.monthlyFee': ['اشتراك شهري', 'Monthly fee'],
  'feeOverrides.payoutHoldDays': ['أيام الانتظار قبل التحويل', 'Payout hold (days)'],
  'feeOverrides.commissionFreeUntil': ['بدون عمولة حتى', 'Commission-free until'],
  'feeOverrides.vatExempt': ['معفى من الضريبة', 'VAT exempt'],
  'feeOverrides.payoutFrequency': ['التحويل التلقائي', 'Automatic payouts'],
  allowedFulfillment: ['من يشحن', 'Who ships'],
  defaultFulfillment: ['الشحن الافتراضي', 'Default shipping'],
  deliveryZones: ['مناطق الشحن', 'Delivery zones'],
  handlingDays: ['مدة التجهيز', 'Handling days'],
  autoApproveListings: ['بائع موثوق', 'Trusted seller'],
  'vacation.enabled': ['الإجازة', 'Vacation'],
  logoUrl: ['الشعار', 'Logo'],
  bannerUrl: ['الغلاف', 'Banner'],
  internalNote: ['ملاحظات داخلية', 'Internal note'],
  'bank.bankName': ['البنك', 'Bank'],
  'bank.accountName': ['صاحب الحساب', 'Account holder'],
  'bank.accountNumber': ['رقم الحساب', 'Account number'],
  'bank.iban': ['IBAN', 'IBAN'],
  'bank.walletPhone': ['رقم المحفظة', 'Wallet number'],
  status: ['الحالة', 'Status'],
  reason: ['السبب', 'Reason'],
  scheduledDeal: ['تغيير مجدول', 'Scheduled change'],
  scheduledDealCancelled: ['إلغاء تغيير مجدول', 'Cancelled scheduled change'],
};

const LOGIN_ACTIONS = {
  'login.login_added': ['أضاف حساب دخول', 'Added a login'],
  'login.login_updated': ['عدّل حساب دخول', 'Changed a login'],
  'login.password_set': ['وضع كلمة مرور مؤقتة', 'Set a temporary password'],
  'login.signed_out': ['سجّل خروج حساب', 'Signed a login out'],
  'login.login_removed': ['حذف حساب دخول', 'Removed a login'],
  'login.owner_changed': ['غيّر المالك', 'Changed the owner'],
};

const PAYOUT_FREQ = { '': ['حسب الإعداد العام', 'Marketplace schedule'], manual: ['يدوياً', 'Manual'], weekly: ['أسبوعياً', 'Weekly'], biweekly: ['كل أسبوعين', 'Every 2 weeks'], monthly: ['شهرياً', 'Monthly'] };
const HIDDEN_KEYS = new Set(['note', 'via', 'accessLinkSent']);

export const historyFieldLabel = (key, isAr) => {
  const l = HISTORY_FIELDS[key] || LOGIN_ACTIONS[key];
  return l ? l[isAr ? 0 : 1] : key;
};

const fmtDay = (v, isAr) => {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString(isAr ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Cairo' });
};

/**
 * One value in a history row as text. `lookup` resolves names:
 * { category(id) → name, plan(key) → name }.
 */
export function formatHistoryValue(key, value, { isAr = false, lookup = {} } = {}) {
  if (value === null || value === undefined || value === '') return '—';
  if (key === 'commissionRate' || key === 'feeOverrides.payoutHoldDays') return key === 'commissionRate' ? `${value}%` : String(value);
  if (key === 'categoryCommissions' && Array.isArray(value)) {
    return value.map((r) => `${lookup.category?.(r.category) || '…'} ${r.rate}%`).join('، ');
  }
  if (key === 'feePlan') return lookup.plan?.(value) || value;
  if (key === 'feeOverrides.commissionFreeUntil') return fmtDay(new Date(new Date(value).getTime() - 1), isAr);
  if (key === 'feeOverrides.payoutFrequency') return (PAYOUT_FREQ[value] || [value, value])[isAr ? 0 : 1];
  if (typeof value === 'boolean') return value ? (isAr ? 'نعم' : 'Yes') : (isAr ? 'لا' : 'No');
  if (key === 'scheduledDeal' && typeof value === 'object') {
    return `${fmtDay(value.applyAt, isAr)} — ${(value.fields || []).map((f) => historyFieldLabel(f, isAr)).join('، ')}`;
  }
  if (key === 'scheduledDealCancelled' && typeof value === 'object') return fmtDay(value.applyAt, isAr);
  if (key.startsWith('login.') && typeof value === 'object') return value.user || '';
  if (key.endsWith('Url')) return isAr ? 'صورة' : 'image';
  if (Array.isArray(value)) return value.length ? value.join('، ') : '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/** History row → [{ key, label, from, to, single }] ready to render (hidden keys dropped). */
export function historyLines(row, opts = {}) {
  const { isAr = false } = opts;
  return Object.entries(row?.changes || {})
    .filter(([k]) => !HIDDEN_KEYS.has(k))
    .map(([key, ch]) => {
      const single = key.startsWith('login.') || key === 'scheduledDeal' || key === 'scheduledDealCancelled';
      return {
        key,
        label: historyFieldLabel(key, isAr),
        from: single ? '' : formatHistoryValue(key, ch?.from, opts),
        to: formatHistoryValue(key, single ? (ch?.to ?? ch?.from) : ch?.to, opts),
        single,
      };
    });
}

const DEAL_KEYS = ['commissionRate', 'categoryCommissions', 'feePlan', 'feeOverrides'];

/**
 * The deal part of a payload that differs from what was loaded — what a "schedule for later"
 * save should queue. Non-deal fields are returned separately for an immediate save.
 */
export function splitDealPayload(payload, initialPayload) {
  const deal = {};
  const rest = {};
  for (const [k, v] of Object.entries(payload)) {
    if (DEAL_KEYS.includes(k)) {
      if (JSON.stringify(v) !== JSON.stringify(initialPayload?.[k])) deal[k] = v;
    } else if (JSON.stringify(v) !== JSON.stringify(initialPayload?.[k])) {
      rest[k] = v;
    }
  }
  return { deal, rest };
}

/** Readable list of what a scheduled change will set. */
export function describeScheduledChanges(changes = {}, opts = {}) {
  const { isAr = false } = opts;
  const out = [];
  for (const [k, v] of Object.entries(changes)) {
    if (k === 'feeOverrides' && v && typeof v === 'object') {
      for (const [ok, ov] of Object.entries(v)) {
        if (ov === null || ov === '' || ov === false) continue;
        out.push(`${historyFieldLabel(`feeOverrides.${ok}`, isAr)}: ${formatHistoryValue(`feeOverrides.${ok}`, ov, opts)}`);
      }
    } else {
      out.push(`${historyFieldLabel(k, isAr)}: ${formatHistoryValue(k, v, opts)}`);
    }
  }
  return out;
}

/** "No change" marker for bulk deal selects. */
export const KEEP = '__keep__';

/** Bulk form state → the `changes` payload (only what staff chose to change). */
export function bulkDealChanges(form) {
  const changes = {};
  if (form.feePlan !== KEEP) changes.feePlan = form.feePlan;
  if (form.rateMode === 'set') changes.commissionRate = Number(form.rate);
  if (form.rateMode === 'clear') changes.commissionRate = null;
  const overrides = {};
  if (form.freeMode === 'set' && form.freeUntil) {
    // "Free until" a date includes that whole Cairo day: store the instant the next day starts.
    overrides.commissionFreeUntil = new Date(new Date(cairoDayStart(form.freeUntil)).getTime() + 86400000).toISOString();
  }
  if (form.freeMode === 'clear') overrides.commissionFreeUntil = null;
  if (form.payoutFrequency !== KEEP) overrides.payoutFrequency = form.payoutFrequency;
  if (Object.keys(overrides).length) changes.feeOverrides = overrides;
  return changes;
}
