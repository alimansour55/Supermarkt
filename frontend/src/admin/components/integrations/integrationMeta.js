import { Cable, FileSpreadsheet, Monitor, Plug, Webhook } from 'lucide-react';

/** Plain-language labels for the integrations screens. */

export const DOORS = [
  {
    id: 'connector',
    Icon: Plug,
    labelAr: 'نظام جاهز',
    labelEn: 'Ready-made system',
    descAr: 'Loyverse أو Odoo أو Zoho أو Square… ادخل بيانات الدخول ونسحب المخزون والأسعار تلقائياً.',
    descEn: 'Loyverse, Odoo, Zoho, Square… enter its login and we pull stock and prices by ourselves.',
  },
  {
    id: 'api',
    Icon: Cable,
    labelAr: 'نظام يتصل بنا (API)',
    labelEn: 'System that calls us (API)',
    descAr: 'لنظام حديث أو مبرمج: نعطيك مفتاحاً، ونظامك يرسل المخزون والأسعار ويقرأ الطلبات.',
    descEn: 'For a modern system or a developer: you get a key, the system sends stock and prices and reads orders.',
  },
  {
    id: 'file',
    Icon: FileSpreadsheet,
    labelAr: 'ملف Excel أو CSV',
    labelEn: 'Excel or CSV file',
    descAr: 'لنظام يصدّر ملفاً فقط: ضع رابط الملف (Google Drive، Dropbox…) ونقرأه كل بضع دقائق، أو ارفعه بنفسك.',
    descEn: 'For a system that only exports a file: give a link (Google Drive, Dropbox…) and we read it every few minutes, or upload it.',
  },
  {
    id: 'agent',
    Icon: Monitor,
    labelAr: 'برنامج على كمبيوتر المحل',
    labelEn: 'Program on the shop PC',
    descAr: 'لبرامج الكاشير القديمة بدون إنترنت: برنامج صغير يقرأ بيانات الكاشير ويرسلها، ويعمل حتى لو انقطع النت.',
    descEn: 'For old desktop cashier programs: a small program reads the cashier data and sends it, even through internet cuts.',
  },
  {
    id: 'webhook',
    Icon: Webhook,
    labelAr: 'إشعارات الطلبات (Webhook)',
    labelEn: 'Order notifications (webhook)',
    descAr: 'نرسل لنظامك فوراً عند كل طلب جديد أو إلغاء أو تغيير حالة.',
    descEn: 'We notify your system at once on every new, cancelled or updated order.',
  },
];

export const doorMeta = (id) => DOORS.find((d) => d.id === id) || DOORS[1];

export const SCOPES = [
  { id: 'stock:write', labelAr: 'تحديث المخزون', labelEn: 'Update stock' },
  { id: 'prices:write', labelAr: 'تحديث الأسعار', labelEn: 'Update prices' },
  { id: 'products:read', labelAr: 'قراءة المنتجات', labelEn: 'Read products' },
  { id: 'orders:read', labelAr: 'قراءة الطلبات', labelEn: 'Read orders' },
  { id: 'orders:write', labelAr: 'تأكيد استلام الطلبات', labelEn: 'Acknowledge orders' },
  { id: 'locations:read', labelAr: 'قراءة الفروع', labelEn: 'Read branches' },
];

export const EVENTS = [
  { id: 'order.created', labelAr: 'طلب جديد', labelEn: 'New order' },
  { id: 'order.paid', labelAr: 'تم الدفع', labelEn: 'Order paid' },
  { id: 'order.status_changed', labelAr: 'تغيّرت حالة الطلب', labelEn: 'Status changed' },
  { id: 'order.cancelled', labelAr: 'طلب ملغي', labelEn: 'Order cancelled' },
  { id: 'order.return_approved', labelAr: 'تمت الموافقة على مرتجع', labelEn: 'Return approved' },
];

export const HEALTH = {
  ok: { labelAr: 'يعمل', labelEn: 'Working', className: 'bg-green-100 text-green-800' },
  attention: { labelAr: 'أكواد غير معروفة', labelEn: 'Unknown codes', className: 'bg-amber-100 text-amber-800' },
  failing: { labelAr: 'متوقف بسبب خطأ', labelEn: 'Failing', className: 'bg-red-100 text-red-700' },
  paused: { labelAr: 'موقوف', labelEn: 'Paused', className: 'bg-slate-200 text-slate-700' },
  waiting: { labelAr: 'بانتظار أول مزامنة', labelEn: 'Waiting for first sync', className: 'bg-sky-100 text-sky-800' },
};

export const LOG_STATUS = {
  ok: 'bg-green-100 text-green-800',
  partial: 'bg-amber-100 text-amber-800',
  error: 'bg-red-100 text-red-700',
  skipped: 'bg-slate-100 text-slate-600',
};

export const FILE_FIELDS = [
  { id: 'code', labelAr: 'الباركود أو الكود', labelEn: 'Barcode or SKU', required: true },
  { id: 'quantity', labelAr: 'الكمية', labelEn: 'Quantity' },
  { id: 'price', labelAr: 'سعر البيع', labelEn: 'Price' },
  { id: 'oldPrice', labelAr: 'السعر قبل الخصم', labelEn: 'Old price' },
  { id: 'costPrice', labelAr: 'سعر التكلفة', labelEn: 'Cost price' },
  { id: 'location', labelAr: 'الفرع', labelEn: 'Branch' },
];

export function errorText(err, isAr) {
  return err?.response?.data?.message || err?.message || (isAr ? 'حدث خطأ' : 'Something went wrong');
}

export function timeAgo(date, isAr) {
  if (!date) return isAr ? 'لم يحدث بعد' : 'never';
  const s = Math.round((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return isAr ? 'الآن' : 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return isAr ? `منذ ${m} دقيقة` : `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return isAr ? `منذ ${h} ساعة` : `${h} h ago`;
  return new Date(date).toLocaleString(isAr ? 'ar-EG' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

/** Absolute base URL of the Open API, for copy-paste into another system. */
export function openApiBase(apiBaseUrl) {
  try {
    const base = new URL(apiBaseUrl || '/api', window.location.origin).toString().replace(/\/+$/, '');
    return `${base}/integrations/v1`;
  } catch {
    return '/api/integrations/v1';
  }
}
