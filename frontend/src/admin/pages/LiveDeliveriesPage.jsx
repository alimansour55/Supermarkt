import {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import { Link } from '../../app/router';
import {
  AlertTriangle, MapPin, Phone, Radio, RefreshCw, Ruler, Search, Truck, X,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useStoreSettings } from '../../context/StoreSettingsContext';
import { isGpsDeliveryEnabled } from '../../utils/gpsDelivery';
import { adminApi } from '../adminApi';
import AdminLiveDeliveriesMap from '../components/AdminLiveDeliveriesMap';
import Button from '../../components/ui/Button';
import Loader from '../../components/ui/Loader';
import { EmptyState, useToast } from '../components';
import { formatDistanceKm, formatLocationAge, haversineKm } from '../../utils/orderTracking';

const POLL_MS = 30_000;

export default function LiveDeliveriesPage() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const { settings } = useStoreSettings();
  const gpsMapEnabled = isGpsDeliveryEnabled(settings);
  const toast = useToast();

  const [deliveries, setDeliveries] = useState([]);
  const [meta, setMeta] = useState({ count: 0, staleCount: 0 });
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [lastRefreshedAt, setLastRefreshedAt] = useState(null);
  const [query, setQuery] = useState('');

  const staleThresholdMs = meta.staleThresholdMs || 2 * 60 * 1000;
  const criticalThresholdMs = meta.mapHideMs || 5 * 60 * 1000;
  const staleThresholdMin = Math.round(staleThresholdMs / 60000);
  const criticalIdsRef = useRef(new Set());

  const isCritical = useCallback((delivery) => {
    const updatedAt = delivery.driver?.location?.updatedAt;
    if (!delivery.driver?.location?.stale || !updatedAt) return false;
    return Date.now() - new Date(updatedAt).getTime() > criticalThresholdMs;
  }, [criticalThresholdMs]);

  const distanceKm = useCallback((delivery) => {
    const driverLoc = delivery.driver?.location;
    const dest = delivery.destination;
    if (!driverLoc || !dest) return null;
    return haversineKm({ lat: driverLoc.lat, lng: driverLoc.lng }, { lat: dest.lat, lng: dest.lng });
  }, []);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError('');
    try {
      const { data } = await adminApi.getLiveDeliveries();
      const rows = [...(data.data || [])].sort((a, b) => {
        const aStale = a.driver?.location?.stale ? 1 : 0;
        const bStale = b.driver?.location?.stale ? 1 : 0;
        if (aStale !== bStale) return bStale - aStale;
        const aAge = a.driver?.location?.updatedAt ? new Date(a.driver.location.updatedAt).getTime() : 0;
        const bAge = b.driver?.location?.updatedAt ? new Date(b.driver.location.updatedAt).getTime() : 0;
        return aAge - bAge;
      });

      const newlyCritical = rows.filter((row) => isCritical(row) && !criticalIdsRef.current.has(row.orderId));
      criticalIdsRef.current = new Set(rows.filter(isCritical).map((row) => row.orderId));
      if (silent && newlyCritical.length > 0) {
        const names = newlyCritical.map((row) => `#${row.orderNumber}`).join(', ');
        toast.error(
          isAr
            ? `فقدان اتصال المندوب: ${names} — لا تحديث موقع منذ ${Math.round(criticalThresholdMs / 60000)} دقائق أو أكثر`
            : `Driver location lost: ${names} — no update for ${Math.round(criticalThresholdMs / 60000)}+ minutes`,
        );
      }

      setDeliveries(rows);
      setMeta(data.meta || { count: rows.length, staleCount: 0 });
      setSelectedId((prev) => {
        if (prev && rows.some((r) => r.orderId === prev)) return prev;
        return rows[0]?.orderId || null;
      });
      setLastRefreshedAt(new Date());
    } catch (err) {
      setError(err.response?.data?.message || (isAr ? 'تعذر تحميل التوصيلات' : 'Could not load deliveries'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAr, isCritical, criticalThresholdMs, toast]);

  useEffect(() => {
    load();
    const timer = setInterval(() => load(true), POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  const filteredDeliveries = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return deliveries;
    return deliveries.filter((d) => [String(d.orderNumber), d.driver?.name]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(needle)));
  }, [deliveries, query]);

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
        <div className="flex flex-col items-end gap-1">
          <Button type="button" variant="secondary" size="sm" onClick={() => load(true)} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            {isAr ? 'تحديث' : 'Refresh'}
          </Button>
          {lastRefreshedAt && (
            <p className="text-xs text-text-muted">
              {isAr ? 'آخر تحديث: ' : 'Last updated: '}
              {lastRefreshedAt.toLocaleTimeString(isAr ? 'ar-EG' : 'en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </p>
          )}
        </div>
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

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded-full bg-indigo-100 px-3 py-1 font-medium text-indigo-900">
          {isAr ? `${meta.count} نشط` : `${meta.count} active`}
        </span>
        {meta.staleCount > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 font-medium text-amber-900">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
            {isAr
              ? `${meta.staleCount} موقع قديم (+${staleThresholdMin} د)`
              : `${meta.staleCount} stale (+${staleThresholdMin} min)`}
          </span>
        )}
        {deliveries.length > 3 && (
          <div className="relative ms-auto w-full max-w-[220px]">
            <Search className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" aria-hidden />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={isAr ? 'ابحث برقم الطلب أو المندوب...' : 'Search order # or driver...'}
              className="w-full rounded-full border border-border bg-white py-1.5 ps-8 pe-7 text-xs focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute end-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text"
                aria-label={isAr ? 'مسح' : 'Clear'}
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            )}
          </div>
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
            {filteredDeliveries.length === 0 && (
              <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-text-muted">
                {isAr ? 'لا نتائج مطابقة' : 'No matching deliveries'}
              </p>
            )}
            {filteredDeliveries.map((delivery) => {
              const isSelected = delivery.orderId === selectedId;
              const stale = delivery.driver?.location?.stale;
              const critical = isCritical(delivery);
              const updatedAt = delivery.driver?.location?.updatedAt;
              const km = distanceKm(delivery);

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
                    {critical ? (
                      <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase text-red-900">
                        {isAr ? 'منقطع' : 'Lost'}
                      </span>
                    ) : stale ? (
                      <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-900">
                        {isAr ? 'قديم' : 'Stale'}
                      </span>
                    ) : (
                      <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-800">
                        {isAr ? 'مباشر' : 'Live'}
                      </span>
                    )}
                  </div>
                  {(updatedAt || km != null) && (
                    <p className="mt-1 flex items-center gap-2 text-xs text-text-muted">
                      {updatedAt && <span>{formatLocationAge(updatedAt, isAr)}</span>}
                      {km != null && (
                        <span className="inline-flex items-center gap-0.5 font-medium text-indigo-700">
                          <Ruler className="h-3 w-3" aria-hidden />
                          {formatDistanceKm(km, isAr)}
                        </span>
                      )}
                    </p>
                  )}
                </button>
              );
            })}
          </div>

          <div className="space-y-4">
            <AdminLiveDeliveriesMap
              deliveries={filteredDeliveries}
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
                    {distanceKm(selected) != null && (
                      <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-800">
                        <Ruler className="h-3.5 w-3.5" aria-hidden />
                        {formatDistanceKm(distanceKm(selected), isAr)} {isAr ? 'من العميل' : 'from customer'}
                      </p>
                    )}
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
                    className={[
                      'mt-3 flex items-start gap-2 rounded-xl border px-3 py-2 text-sm',
                      isCritical(selected)
                        ? 'border-red-300 bg-red-50 text-red-950'
                        : 'border-amber-300 bg-amber-50 text-amber-950',
                    ].join(' ')}
                  >
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    <p>
                      {isCritical(selected)
                        ? (isAr
                          ? `لا يوجد تحديث لموقع المندوب منذ ${Math.round(criticalThresholdMs / 60000)} دقائق أو أكثر — تواصل مع المندوب أو أعد تعيين الطلب.`
                          : `No location update for ${Math.round(criticalThresholdMs / 60000)}+ minutes — contact the driver or reassign this order.`)
                        : (isAr
                          ? `موقع المندوب لم يُحدَّث منذ أكثر من ${staleThresholdMin} دقائق — قد تكون هناك مشكلة GPS أو اتصال.`
                          : `Driver location not updated for over ${staleThresholdMin} minutes — possible GPS or connection issue.`)}
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
