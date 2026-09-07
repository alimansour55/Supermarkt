import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, MapPin, Phone, Radio, RefreshCw, Truck,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useStoreSettings } from '../../context/StoreSettingsContext';
import { isGpsDeliveryEnabled } from '../../utils/gpsDelivery';
import { adminApi } from '../adminApi';
import AdminLiveDeliveriesMap from '../components/AdminLiveDeliveriesMap';
import Button from '../../components/ui/Button';
import Loader from '../../components/ui/Loader';
import EmptyState from '../components/EmptyState';
import { formatLocationAge } from '../../utils/orderTracking';

const POLL_MS = 30_000;

export default function LiveDeliveriesPage() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const { settings } = useStoreSettings();
  const gpsMapEnabled = isGpsDeliveryEnabled(settings);

  const [deliveries, setDeliveries] = useState([]);
  const [meta, setMeta] = useState({ count: 0, staleCount: 0 });
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError('');
    try {
      const { data } = await adminApi.getLiveDeliveries();
      const rows = data.data || [];
      setDeliveries(rows);
      setMeta(data.meta || { count: rows.length, staleCount: 0 });
      setSelectedId((prev) => {
        if (prev && rows.some((r) => r.orderId === prev)) return prev;
        return rows[0]?.orderId || null;
      });
    } catch (err) {
      setError(err.response?.data?.message || (isAr ? 'تعذر تحميل التوصيلات' : 'Could not load deliveries'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAr]);

  useEffect(() => {
    load();
    const timer = setInterval(() => load(true), POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  const selected = useMemo(
    () => deliveries.find((d) => d.orderId === selectedId) || null,
    [deliveries, selectedId],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-text">
            <Radio className="h-5 w-5 text-indigo-600" aria-hidden />
            {isAr ? 'التوصيل المباشر' : 'Live deliveries'}
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            {isAr
              ? 'كل الطلبات «في الطريق» مع موقع المندوب وعنوان العميل.'
              : 'All out-for-delivery orders with driver GPS and customer address.'}
          </p>
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={() => load(true)} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          {isAr ? 'تحديث' : 'Refresh'}
        </Button>
      </div>

      {!gpsMapEnabled && (
        <p className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-950">
          {isAr
            ? 'التتبع المباشر بالخريطة معطّل. '
            : 'Live map tracking is disabled. '}
          <Link to="/admin/settings/delivery" className="font-semibold underline">
            {isAr ? 'فعّله من إعدادات التوصيل' : 'Enable it in Delivery settings'}
          </Link>
        </p>
      )}

      <div className="flex flex-wrap gap-2 text-sm">
        <span className="rounded-full bg-indigo-100 px-3 py-1 font-medium text-indigo-900">
          {isAr ? `${meta.count} نشط` : `${meta.count} active`}
        </span>
        {meta.staleCount > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 font-medium text-amber-900">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
            {isAr
              ? `${meta.staleCount} موقع قديم (+2 د)`
              : `${meta.staleCount} stale (+2 min)`}
          </span>
        )}
      </div>

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
      )}

      {loading && !deliveries.length ? (
        <div className="flex justify-center py-24">
          <Loader size="lg" />
        </div>
      ) : deliveries.length === 0 ? (
        <EmptyState
          icon={Truck}
          title={isAr ? 'لا توجد توصيلات نشطة' : 'No active deliveries'}
          description={
            isAr
              ? 'عيّن مندوباً وغيّر حالة الطلب إلى «في الطريق».'
              : 'Assign a driver and set order status to out for delivery.'
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(280px,360px)_1fr]">
          <div className="space-y-2 lg:max-h-[min(70vh,640px)] lg:overflow-y-auto">
            {deliveries.map((delivery) => {
              const isSelected = delivery.orderId === selectedId;
              const stale = delivery.driver?.location?.stale;
              const updatedAt = delivery.driver?.location?.updatedAt;

              return (
                <button
                  key={delivery.orderId}
                  type="button"
                  onClick={() => setSelectedId(delivery.orderId)}
                  className={[
                    'w-full rounded-2xl border p-3 text-start transition',
                    isSelected
                      ? 'border-indigo-400 bg-indigo-50 shadow-sm'
                      : 'border-border bg-white hover:border-indigo-200',
                  ].join(' ')}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-text">#{delivery.orderNumber}</p>
                      <p className="mt-0.5 truncate text-sm text-text-muted">
                        {delivery.driver?.name || (isAr ? 'بدون مندوب' : 'No driver')}
                      </p>
                    </div>
                    {stale ? (
                      <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-900">
                        {isAr ? 'قديم' : 'Stale'}
                      </span>
                    ) : (
                      <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-800">
                        {isAr ? 'مباشر' : 'Live'}
                      </span>
                    )}
                  </div>
                  {updatedAt && (
                    <p className="mt-1 text-xs text-text-muted">
                      {formatLocationAge(updatedAt, isAr)}
                    </p>
                  )}
                </button>
              );
            })}
          </div>

          <div className="space-y-4">
            <AdminLiveDeliveriesMap
              deliveries={deliveries}
              selectedId={selectedId}
              onSelect={setSelectedId}
              isAr={isAr}
            />

            {selected && (
              <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-text-muted">{isAr ? 'الطلب' : 'Order'}</p>
                    <p className="text-lg font-bold">#{selected.orderNumber}</p>
                  </div>
                  <Link
                    to={`/admin/orders?order=${selected.orderId}`}
                    className="text-sm font-medium text-primary-600 hover:underline"
                  >
                    {isAr ? 'فتح في الطلبات' : 'Open in orders'}
                  </Link>
                </div>

                {selected.driver?.location?.stale && (
                  <div
                    role="alert"
                    className="mt-3 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950"
                  >
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    <p>
                      {isAr
                        ? 'موقع المندوب لم يُحدَّث منذ أكثر من دقيقتين — قد تكون هناك مشكلة GPS أو اتصال.'
                        : 'Driver location not updated for over 2 minutes — possible GPS or connection issue.'}
                    </p>
                  </div>
                )}

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-indigo-50 p-3 text-sm">
                    <p className="mb-1 flex items-center gap-1.5 font-semibold text-indigo-950">
                      <Truck className="h-4 w-4" aria-hidden />
                      {isAr ? 'المندوب' : 'Driver'}
                    </p>
                    <p>{selected.driver?.name || '—'}</p>
                    {selected.driver?.phone && (
                      <a
                        href={`tel:${selected.driver.phone}`}
                        className="mt-1 inline-flex items-center gap-1 text-primary-700"
                        dir="ltr"
                      >
                        <Phone className="h-3.5 w-3.5" aria-hidden />
                        {selected.driver.phone}
                      </a>
                    )}
                    {selected.driver?.location?.updatedAt && (
                      <p className="mt-2 text-xs text-indigo-900/75">
                        {isAr ? 'آخر تحديث GPS:' : 'Last GPS:'}{' '}
                        {new Date(selected.driver.location.updatedAt).toLocaleTimeString(
                          isAr ? 'ar-EG' : 'en-GB',
                          { hour: '2-digit', minute: '2-digit' },
                        )}
                        {' · '}
                        {formatLocationAge(selected.driver.location.updatedAt, isAr)}
                      </p>
                    )}
                  </div>

                  <div className="rounded-xl bg-emerald-50 p-3 text-sm">
                    <p className="mb-1 flex items-center gap-1.5 font-semibold text-emerald-950">
                      <MapPin className="h-4 w-4" aria-hidden />
                      {isAr ? 'عنوان العميل' : 'Customer address'}
                    </p>
                    <p className="text-emerald-900/90">
                      {selected.destination?.formattedAddress
                        || selected.phone
                        || (isAr ? 'لا يوجد موقع على الخريطة' : 'No map location')}
                    </p>
                    {selected.customerName && (
                      <p className="mt-1 text-xs text-emerald-900/75">{selected.customerName}</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
