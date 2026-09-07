import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  MapPin,
  Package,
  Pause,
  Phone,
  Play,
  Save,
  ShoppingBag,
  User,
  XCircle,
} from 'lucide-react';
import Button from '../../components/ui/Button';
import Loader from '../../components/ui/Loader';
import ProductImage from '../../components/ui/ProductImage';
import { formatPrice } from '../../utils/formatters';
import { getRecurringFrequencyLabel } from '../../constants/deliveryOptions';

function formatAddress(address, isAr) {
  if (!address) return '—';
  return [
    address.street,
    address.building,
    address.floor,
    address.area || address.city,
    address.governorate,
  ].filter(Boolean).join(isAr ? '، ' : ', ');
}

function isOverdue(sub) {
  return sub.status === 'active'
    && sub.nextDeliveryDate
    && new Date(sub.nextDeliveryDate) < new Date(new Date().toDateString());
}

function isDueToday(sub) {
  if (!sub.nextDeliveryDate) return false;
  return new Date(sub.nextDeliveryDate).toDateString() === new Date().toDateString();
}

const STATUS_STYLES = {
  active: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
  paused: 'bg-amber-100 text-amber-800 ring-amber-200',
  cancelled: 'bg-slate-100 text-slate-600 ring-slate-200',
};

function StatCard({ icon: Icon, label, value, sub, tone = 'slate' }) {
  const tones = {
    slate: 'bg-slate-50 ring-slate-200/60',
    violet: 'bg-violet-50 ring-violet-200/60',
    emerald: 'bg-emerald-50 ring-emerald-200/60',
    amber: 'bg-amber-50 ring-amber-200/60',
  };

  return (
    <div className={`rounded-xl p-4 ring-1 ring-inset ${tones[tone] || tones.slate}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-wide text-text-muted">{label}</p>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/70 text-text-muted">
          <Icon className="h-3.5 w-3.5" aria-hidden />
        </span>
      </div>
      <p className="mt-2 text-lg font-bold leading-tight text-text">{value}</p>
      {sub && <p className="mt-1 text-xs text-text-muted">{sub}</p>}
    </div>
  );
}

export default function RecurringDetailPanel({
  subscription,
  loading,
  isAr,
  updating,
  onAction,
  onSaveNotes,
  embedded = false,
}) {
  const [adminNotes, setAdminNotes] = useState('');

  useEffect(() => {
    setAdminNotes(subscription?.adminNotes || '');
  }, [subscription?._id, subscription?.adminNotes]);

  if (loading) {
    return (
      <div className={[
        'flex min-h-[320px] items-center justify-center',
        embedded ? 'rounded-2xl border border-border bg-white p-6 shadow-sm' : 'rounded-2xl border border-border bg-white',
      ].join(' ')}
      >
        <Loader />
      </div>
    );
  }

  if (!subscription) {
    return null;
  }

  const status = subscription.status;
  const subtotal = subscription.subtotal ?? (subscription.items || [])
    .reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const overdue = isOverdue(subscription);
  const dueToday = isDueToday(subscription);
  const nextDate = subscription.nextDeliveryDate
    ? new Date(subscription.nextDeliveryDate).toLocaleDateString(isAr ? 'ar-EG' : 'en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
    : '—';
  const timeSlot = subscription.deliveryTimeSlot
    ? (isAr ? subscription.deliveryTimeSlot.labelAr : subscription.deliveryTimeSlot.labelEn)
    : null;

  return (
    <div className={[
      'flex flex-col',
      embedded ? 'rounded-2xl border border-border bg-white shadow-sm' : 'rounded-2xl border border-border bg-white',
    ].join(' ')}
    >
      {/* Header */}
      <div className="border-b border-border px-5 py-5 lg:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ring-inset ${STATUS_STYLES[status] || STATUS_STYLES.cancelled}`}>
                {status === 'active'
                  ? (isAr ? 'نشط' : 'Active')
                  : status === 'paused'
                    ? (isAr ? 'متوقف' : 'Paused')
                    : (isAr ? 'ملغي' : 'Cancelled')}
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-text-muted">
                {getRecurringFrequencyLabel(subscription.frequency, isAr)}
              </span>
              {overdue && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-900 ring-1 ring-inset ring-amber-200">
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                  {isAr ? 'متأخر' : 'Overdue'}
                </span>
              )}
              {!overdue && dueToday && (
                <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-bold text-violet-800 ring-1 ring-inset ring-violet-200">
                  <CalendarClock className="h-3.5 w-3.5" aria-hidden />
                  {isAr ? 'مستحق اليوم' : 'Due today'}
                </span>
              )}
            </div>
            <h3 className="mt-3 text-xl font-bold leading-snug text-text">
              {subscription.scheduleSummary || (isAr ? subscription.scheduleSummaryAr : subscription.scheduleSummaryEn)}
            </h3>
            {subscription.orderNumber && (
              <p className="mt-1.5 font-mono text-sm font-semibold text-primary-600">
                #{subscription.orderNumber}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-5 px-5 py-5 lg:px-6">
        {/* Summary stats */}
        <div className="grid gap-3 sm:grid-cols-2">
          <StatCard
            icon={CalendarClock}
            label={isAr ? 'التوصيل القادم' : 'Next delivery'}
            value={nextDate}
            sub={timeSlot}
            tone={overdue ? 'amber' : 'violet'}
          />
          <StatCard
            icon={ShoppingBag}
            label={isAr ? 'إجمالي الطلب' : 'Order value'}
            value={formatPrice(subtotal)}
            sub={`${subscription.deliveriesCount || 0} ${isAr ? 'توصيل سابق' : 'past deliveries'}`}
            tone="emerald"
          />
        </div>

        {/* Customer & address */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-slate-50/50 p-4">
            <p className="mb-2.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-text-muted">
              <User className="h-3.5 w-3.5" aria-hidden />
              {isAr ? 'العميل' : 'Customer'}
            </p>
            <p className="font-semibold text-text">{subscription.customerName || '—'}</p>
            <p className="mt-2 flex items-center gap-1.5 text-sm text-text-muted" dir="ltr">
              <Phone className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
              {subscription.customerPhone || subscription.phone}
            </p>
          </div>

          <div className="rounded-xl border border-border bg-slate-50/50 p-4">
            <p className="mb-2.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-text-muted">
              <MapPin className="h-3.5 w-3.5" aria-hidden />
              {isAr ? 'العنوان' : 'Address'}
            </p>
            <p className="text-sm leading-relaxed text-text">{formatAddress(subscription.shippingAddress, isAr)}</p>
            {(subscription.deliveryZoneNameAr || subscription.deliveryZoneNameEn) && (
              <p className="mt-2 text-xs font-medium text-text-muted">
                {isAr ? subscription.deliveryZoneNameAr : subscription.deliveryZoneNameEn}
              </p>
            )}
          </div>
        </div>

        {/* Products */}
        <div className="rounded-xl border border-border p-4">
          <p className="mb-3 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-text-muted">
            <Package className="h-3.5 w-3.5" aria-hidden />
            {isAr ? 'المنتجات' : 'Items'}
            <span className="ms-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-text-muted">
              {(subscription.items || []).length}
            </span>
          </p>
          <ul className="space-y-2">
            {(subscription.items || []).map((item, index) => (
              <li
                key={`${item.product}-${index}`}
                className="flex items-center gap-3 rounded-xl border border-border/60 bg-white px-3 py-2.5 transition-colors hover:bg-slate-50/50"
              >
                <ProductImage
                  src={item.image}
                  alt={isAr ? item.nameAr : item.nameEn}
                  className="h-11 w-11 shrink-0 rounded-lg object-cover ring-1 ring-border/50"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text">{isAr ? item.nameAr : item.nameEn}</p>
                  <p className="mt-0.5 text-xs text-text-muted">
                    {item.quantity} × {formatPrice(item.price)}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-bold tabular-nums text-text">
                  {formatPrice(item.price * item.quantity)}
                </p>
              </li>
            ))}
          </ul>
        </div>

        {(subscription.notes || subscription.lastFulfilledAt) && (
          <div className="rounded-xl border border-violet-200/60 bg-violet-50/60 p-4 text-sm">
            {subscription.notes && (
              <p>
                <span className="font-semibold text-violet-900">
                  {isAr ? 'ملاحظات العميل: ' : 'Customer notes: '}
                </span>
                <span className="text-violet-800">{subscription.notes}</span>
              </p>
            )}
            {subscription.lastFulfilledAt && (
              <p className="mt-2 flex items-center gap-1.5 text-violet-800">
                <CalendarClock className="h-4 w-4 shrink-0" aria-hidden />
                {isAr ? 'آخر توصيل:' : 'Last fulfilled:'}{' '}
                {new Date(subscription.lastFulfilledAt).toLocaleDateString(isAr ? 'ar-EG' : 'en-GB')}
              </p>
            )}
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-text-muted">
            {isAr ? 'ملاحظات الإدارة' : 'Admin notes'}
          </label>
          <textarea
            value={adminNotes}
            onChange={(e) => setAdminNotes(e.target.value)}
            rows={3}
            className="w-full rounded-xl border border-border bg-slate-50/30 px-3 py-2.5 text-sm outline-none transition-colors focus:border-primary-400 focus:bg-white focus:ring-2 focus:ring-primary-500/10"
            placeholder={isAr ? 'ملاحظات داخلية للفريق...' : 'Internal team notes...'}
          />
          <Button
            type="button"
            size="sm"
            className="mt-2"
            disabled={updating || adminNotes === (subscription.adminNotes || '')}
            onClick={() => onSaveNotes(adminNotes)}
          >
            <Save className="h-4 w-4" aria-hidden />
            {isAr ? 'حفظ الملاحظات' : 'Save notes'}
          </Button>
        </div>
      </div>

      {status !== 'cancelled' && (
        <div className="sticky bottom-0 flex flex-wrap gap-2 border-t border-border bg-white/95 px-5 py-4 backdrop-blur lg:px-6">
          {status === 'active' && (
            <>
              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={updating}
                onClick={() => onAction('advance')}
              >
                <CheckCircle2 className="h-4 w-4" aria-hidden />
                {isAr ? 'تم التوصيل — التالي' : 'Mark delivered'}
              </Button>
              <Button type="button" variant="secondary" size="sm" disabled={updating} onClick={() => onAction('pause')}>
                <Pause className="h-4 w-4" aria-hidden />
                {isAr ? 'إيقاف' : 'Pause'}
              </Button>
            </>
          )}
          {status === 'paused' && (
            <Button type="button" variant="secondary" size="sm" disabled={updating} onClick={() => onAction('resume')}>
              <Play className="h-4 w-4" aria-hidden />
              {isAr ? 'استئناف' : 'Resume'}
            </Button>
          )}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="border-red-200 text-red-700 hover:bg-red-50"
            disabled={updating}
            onClick={() => onAction('cancel')}
          >
            <XCircle className="h-4 w-4" aria-hidden />
            {isAr ? 'إلغاء الاشتراك' : 'Cancel subscription'}
          </Button>
        </div>
      )}
    </div>
  );
}
