import { useCallback, useEffect, useState } from 'react';
import { Link } from '../../app/router';
import {
  CalendarClock,
  Edit3,
  MapPin,
  Package,
  Pause,
  Play,
  RefreshCw,
  ShoppingBag,
  Trash2,
} from 'lucide-react';
import { orderService } from '../../services/apiServices';
import Button from '../ui/Button';
import Loader from '../ui/Loader';
import ProductImage from '../ui/ProductImage';
import EditRecurringModal from './EditRecurringModal';
import { formatPrice } from '../../utils/formatters';
import { getRecurringFrequencyLabel } from '../../constants/deliveryOptions';

const STATUS_STYLES = {
  active: 'bg-emerald-100 text-emerald-800',
  paused: 'bg-amber-100 text-amber-800',
  cancelled: 'bg-slate-100 text-slate-600',
};

function formatAddress(address, isAr) {
  if (!address) return '';
  return [
    address.street,
    address.building,
    address.floor,
    address.area || address.city,
    address.governorate,
  ].filter(Boolean).join(isAr ? '، ' : ', ');
}

export default function RecurringSubscriptionManager({
  isAr,
  compact = false,
}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionId, setActionId] = useState(null);
  const [editing, setEditing] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    orderService.getRecurringDeliveries()
      .then(({ data }) => setItems(data.data || []))
      .catch((err) => {
        setError(err.response?.data?.message || (isAr ? 'تعذر تحميل التوصيل الدوري' : 'Could not load recurring deliveries'));
      })
      .finally(() => setLoading(false));
  }, [isAr]);

  useEffect(() => {
    load();
  }, [load]);

  const runAction = async (id, action) => {
    setActionId(id);
    setError('');
    try {
      if (action === 'pause') await orderService.pauseRecurringDelivery(id);
      if (action === 'resume') await orderService.resumeRecurringDelivery(id);
      if (action === 'cancel') await orderService.cancelRecurringDelivery(id);
      setConfirmCancel(null);
      load();
    } catch (err) {
      setError(err.response?.data?.message || (isAr ? 'تعذر تنفيذ العملية' : 'Action failed'));
    } finally {
      setActionId(null);
    }
  };

  const handleSaveEdit = async (payload) => {
    if (!editing) return;
    setSavingEdit(true);
    setError('');
    try {
      await orderService.updateRecurringDelivery(editing._id, payload);
      setEditing(null);
      load();
    } catch (err) {
      setError(err.response?.data?.message || (isAr ? 'تعذر حفظ التعديلات' : 'Could not save changes'));
    } finally {
      setSavingEdit(false);
    }
  };

  const activeCount = items.filter((sub) => sub.status === 'active').length;

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader />
      </div>
    );
  }

  return (
    <>
      <section className={compact ? '' : 'rounded-2xl border border-border bg-white p-6 md:p-8'}>
        {!compact && (
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-violet-100 p-3 text-violet-700">
                <RefreshCw className="h-6 w-6" aria-hidden />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-text">
                  {isAr ? 'التوصيل الدوري' : 'Recurring delivery'}
                </h1>
                <p className="mt-1 max-w-2xl text-sm text-text-muted">
                  {isAr
                    ? 'إدارة جداول التوصيل المتكررة — عدّل الموعد أو أوقف مؤقتاً أو احذف الاشتراك في أي وقت.'
                    : 'Manage repeat delivery schedules — edit, pause, or cancel anytime.'}
                </p>
              </div>
            </div>
            <Link
              to="/products"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700"
            >
              <ShoppingBag className="h-4 w-4" aria-hidden />
              {isAr ? 'طلب جديد' : 'New order'}
            </Link>
          </div>
        )}

        {!compact && (
          <div className="mb-6 grid gap-3 sm:grid-cols-3">
            {[
              { label: isAr ? 'نشط' : 'Active', value: activeCount, tone: 'text-emerald-700 bg-emerald-50' },
              { label: isAr ? 'متوقف' : 'Paused', value: items.filter((s) => s.status === 'paused').length, tone: 'text-amber-700 bg-amber-50' },
              { label: isAr ? 'إجمالي' : 'Total', value: items.length, tone: 'text-violet-700 bg-violet-50' },
            ].map((stat) => (
              <div key={stat.label} className={`rounded-2xl px-4 py-3 ${stat.tone}`}>
                <p className="text-xs font-semibold uppercase tracking-wide opacity-80">{stat.label}</p>
                <p className="mt-1 text-2xl font-bold">{stat.value}</p>
              </div>
            ))}
          </div>
        )}

        {error && (
          <p className="mb-4 rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>
        )}

        {!items.length ? (
          <div className="rounded-2xl border border-dashed border-border bg-slate-50 px-6 py-12 text-center">
            <RefreshCw className="mx-auto h-10 w-10 text-violet-400" aria-hidden />
            <p className="mt-4 text-lg font-semibold text-text">
              {isAr ? 'لا توجد اشتراكات توصيل دوري' : 'No recurring subscriptions yet'}
            </p>
            <p className="mt-2 text-sm text-text-muted">
              {isAr
                ? 'اختر «توصيل دوري» عند الدفع لتكرار طلبك تلقائياً.'
                : 'Choose recurring delivery at checkout to repeat your order automatically.'}
            </p>
            <Link
              to="/checkout"
              className="mt-5 inline-flex rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
            >
              {isAr ? 'الذهاب للدفع' : 'Go to checkout'}
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((sub) => {
              const status = sub.status || (sub.isActive ? (sub.paused ? 'paused' : 'active') : 'cancelled');
              const statusLabel = {
                active: isAr ? 'نشط' : 'Active',
                paused: isAr ? 'متوقف مؤقتاً' : 'Paused',
                cancelled: isAr ? 'ملغي' : 'Cancelled',
              }[status];
              const subtotal = sub.subtotal ?? (sub.items || []).reduce((sum, item) => sum + (item.price * item.quantity), 0);
              const busy = actionId === sub._id;
              const expanded = expandedId === sub._id;

              return (
                <article key={sub._id} className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
                  <div className="p-4 md:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[status] || STATUS_STYLES.active}`}>
                            {statusLabel}
                          </span>
                          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                            {getRecurringFrequencyLabel(sub.frequency, isAr)}
                          </span>
                        </div>
                        <p className="mt-2 text-lg font-bold text-text">
                          {sub.scheduleSummary || (isAr ? sub.scheduleSummaryAr : sub.scheduleSummaryEn)}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-text-muted">
                          <span className="inline-flex items-center gap-1.5">
                            <CalendarClock className="h-4 w-4 shrink-0" aria-hidden />
                            {isAr ? 'التوصيل القادم:' : 'Next:'}{' '}
                            <strong className="text-text">
                              {sub.nextDeliveryDate
                                ? new Date(sub.nextDeliveryDate).toLocaleDateString(isAr ? 'ar-EG' : 'en-GB')
                                : '—'}
                            </strong>
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <Package className="h-4 w-4 shrink-0" aria-hidden />
                            {(sub.items || []).length} {isAr ? 'منتج' : 'items'} · {formatPrice(subtotal)}
                          </span>
                        </div>
                      </div>

                      {status !== 'cancelled' && (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            disabled={busy}
                            onClick={() => setEditing(sub)}
                          >
                            <Edit3 className="h-4 w-4" aria-hidden />
                            {isAr ? 'تعديل' : 'Edit'}
                          </Button>
                          {status === 'active' && (
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              disabled={busy}
                              onClick={() => runAction(sub._id, 'pause')}
                            >
                              <Pause className="h-4 w-4" aria-hidden />
                              {isAr ? 'إيقاف' : 'Pause'}
                            </Button>
                          )}
                          {status === 'paused' && (
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              disabled={busy}
                              onClick={() => runAction(sub._id, 'resume')}
                            >
                              <Play className="h-4 w-4" aria-hidden />
                              {isAr ? 'استئناف' : 'Resume'}
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="border-red-200 text-red-700 hover:bg-red-50"
                            disabled={busy}
                            onClick={() => setConfirmCancel(sub)}
                          >
                            <Trash2 className="h-4 w-4" aria-hidden />
                            {isAr ? 'حذف' : 'Delete'}
                          </Button>
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => setExpandedId(expanded ? null : sub._id)}
                      className="mt-4 text-sm font-semibold text-primary-600 hover:text-primary-700"
                    >
                      {expanded
                        ? (isAr ? 'إخفاء التفاصيل' : 'Hide details')
                        : (isAr ? 'عرض التفاصيل' : 'Show details')}
                    </button>
                  </div>

                  {expanded && (
                    <div className="border-t border-border bg-slate-50/80 px-4 py-4 md:px-5">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-text-muted">
                            <MapPin className="h-4 w-4" aria-hidden />
                            {isAr ? 'عنوان التوصيل' : 'Delivery address'}
                          </p>
                          <p className="text-sm text-text">{formatAddress(sub.shippingAddress, isAr)}</p>
                          <p className="mt-1 text-sm text-text-muted">
                            {isAr ? sub.deliveryZoneNameAr : sub.deliveryZoneNameEn}
                          </p>
                        </div>
                        <div>
                          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-text-muted">
                            {isAr ? 'المنتجات' : 'Products'}
                          </p>
                          <ul className="space-y-2">
                            {(sub.items || []).map((item, index) => (
                              <li key={`${item.product}-${index}`} className="flex items-center gap-3 rounded-xl bg-white px-3 py-2">
                                <ProductImage
                                  src={item.image}
                                  alt={isAr ? item.nameAr : item.nameEn}
                                  className="h-10 w-10 shrink-0 rounded-lg object-cover"
                                />
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-medium">{isAr ? item.nameAr : item.nameEn}</p>
                                  <p className="text-xs text-text-muted">
                                    {item.quantity} × {formatPrice(item.price)}
                                  </p>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                      {sub.notes && (
                        <p className="mt-4 rounded-xl bg-white px-3 py-2 text-sm text-text-muted">
                          <span className="font-semibold text-text">{isAr ? 'ملاحظات: ' : 'Notes: '}</span>
                          {sub.notes}
                        </p>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <EditRecurringModal
        open={Boolean(editing)}
        subscription={editing}
        isAr={isAr}
        saving={savingEdit}
        onClose={() => setEditing(null)}
        onSave={handleSaveEdit}
      />

      {confirmCancel && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-text">
              {isAr ? 'حذف التوصيل الدوري؟' : 'Delete recurring delivery?'}
            </h3>
            <p className="mt-2 text-sm text-text-muted">
              {isAr
                ? 'سيتم إلغاء هذا الاشتراك ولن تتلقى توصيلات متكررة بعد الآن. يمكنك إنشاء اشتراك جديد من الدفع.'
                : 'This subscription will be cancelled and you will no longer receive repeat deliveries.'}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setConfirmCancel(null)}>
                {isAr ? 'تراجع' : 'Keep it'}
              </Button>
              <Button
                type="button"
                variant="danger"
                disabled={actionId === confirmCancel._id}
                onClick={() => runAction(confirmCancel._id, 'cancel')}
              >
                {isAr ? 'نعم، احذف' : 'Yes, delete'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
