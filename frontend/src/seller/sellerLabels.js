/** Labels + badge styles shared by the seller portal and the admin marketplace pages. */

export const SELLER_STATUS = {
  applied: { ar: 'طلب جديد', en: 'Applied', tone: 'bg-sky-100 text-sky-800' },
  under_review: { ar: 'قيد المراجعة', en: 'Under review', tone: 'bg-amber-100 text-amber-900' },
  active: { ar: 'نشط', en: 'Active', tone: 'bg-emerald-100 text-emerald-800' },
  suspended: { ar: 'موقوف', en: 'Suspended', tone: 'bg-red-100 text-red-800' },
  rejected: { ar: 'مرفوض', en: 'Rejected', tone: 'bg-slate-200 text-slate-700' },
};

export const LISTING_STATUS = {
  draft: { ar: 'مسودة', en: 'Draft', tone: 'bg-slate-100 text-slate-700' },
  pending_review: { ar: 'بانتظار المراجعة', en: 'Pending review', tone: 'bg-amber-100 text-amber-900' },
  approved: { ar: 'معروض', en: 'Live', tone: 'bg-emerald-100 text-emerald-800' },
  rejected: { ar: 'مرفوض', en: 'Rejected', tone: 'bg-red-100 text-red-800' },
  paused: { ar: 'متوقف مؤقتاً', en: 'Paused', tone: 'bg-slate-200 text-slate-700' },
};

export const SHIPMENT_STATUS = {
  pending: { ar: 'جديد — بانتظار التأكيد', en: 'New — to confirm', tone: 'bg-amber-100 text-amber-900' },
  confirmed: { ar: 'مؤكد', en: 'Confirmed', tone: 'bg-sky-100 text-sky-800' },
  packed: { ar: 'جاهز للشحن', en: 'Packed', tone: 'bg-sky-100 text-sky-800' },
  shipped: { ar: 'تم الشحن', en: 'Shipped', tone: 'bg-violet-100 text-violet-800' },
  delivered: { ar: 'تم التسليم', en: 'Delivered', tone: 'bg-emerald-100 text-emerald-800' },
  cancelled: { ar: 'ملغي', en: 'Cancelled', tone: 'bg-red-100 text-red-800' },
  returned: { ar: 'مرتجع', en: 'Returned', tone: 'bg-slate-200 text-slate-700' },
};

export const FULFILLMENT = {
  seller: { ar: 'يشحنه البائع', en: 'Shipped by seller' },
  store: { ar: 'يشحنه المتجر', en: 'Shipped by store' },
};

export const DOCUMENT_TYPES = {
  commercial_register: { ar: 'السجل التجاري', en: 'Commercial register' },
  tax_card: { ar: 'البطاقة الضريبية', en: 'Tax card' },
  national_id: { ar: 'بطاقة الرقم القومي', en: 'National ID' },
  bank_letter: { ar: 'خطاب البنك', en: 'Bank letter' },
  other: { ar: 'مستند آخر', en: 'Other document' },
};

export const DOCUMENT_STATUS = {
  pending: { ar: 'قيد المراجعة', en: 'Pending', tone: 'bg-amber-100 text-amber-900' },
  accepted: { ar: 'مقبول', en: 'Accepted', tone: 'bg-emerald-100 text-emerald-800' },
  rejected: { ar: 'مرفوض', en: 'Rejected', tone: 'bg-red-100 text-red-800' },
};

export function label(map, key, isAr) {
  const entry = map[key];
  if (!entry) return key || '';
  return isAr ? entry.ar : entry.en;
}

export function apiError(err, fallback) {
  return err?.response?.data?.message || fallback;
}
