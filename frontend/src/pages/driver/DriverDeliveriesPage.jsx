import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import {
  Banknote, History, ListChecks, LocateFixed, Loader2, Package, RefreshCw, RotateCcw, Route, Search, Truck, Wallet, X,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { orderService } from '../../services/apiServices';
import { useAsyncData } from '../../hooks/useAsyncData';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';
import Loader from '../../components/ui/Loader';
import DriverDeliveryCard from './components/DriverDeliveryCard';
import DriverStatCard from './components/DriverStatCard';
import DriverHistoryList from './components/DriverHistoryList';
import DriverPushToggle from '../../components/driver/DriverPushToggle';
import {
  formatDriverAddress, haversineKm, multiStopDirectionsUrl, orderStopsByNearest,
} from './driverUtils';

async function fetchDeliveries() {
  const { data } = await orderService.getDriverDeliveries();
  return data.data || [];
}

async function fetchPickups() {
  const { data } = await orderService.getDriverPickups();
  return data.data || [];
}

async function fetchCashBalance() {
  const { data } = await orderService.getDriverCash();
  return data.data?.balance ?? 0;
}

const HISTORY_PAGE_SIZE = 30;

async function fetchHistoryPage(page = 1) {
  const { data } = await orderService.getDriverHistory({ page, limit: HISTORY_PAGE_SIZE });
  return { items: data.data || [], hasMore: Boolean(data.meta?.hasMore) };
}

async function fetchTodayStats() {
  const { data } = await orderService.getDriverStats(1);
  return data.data || null;
}

function matchesQuery(order, q) {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return [order.orderNumber, order.customerName, formatDriverAddress(order.shippingAddress, false)]
    .filter(Boolean)
    .some((v) => String(v).toLowerCase().includes(needle));
}

export default function DriverDeliveriesPage() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const { isOffline, assignmentsVersion = 0, geo } = useOutletContext() || {};
  const [tab, setTab] = useState('active');
  const [query, setQuery] = useState('');
  const [nearestOn, setNearestOn] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState('');
  const [myPos, setMyPos] = useState(null);

  const {
    data: deliveries, loading, error, refetch,
  } = useAsyncData(fetchDeliveries, []);
  const { data: cashBalance, refetch: refetchCash } = useAsyncData(fetchCashBalance, []);
  const { data: pickups, refetch: refetchPickups } = useAsyncData(fetchPickups, []);
  const refreshAll = useCallback(async () => {
    await Promise.all([refetch(), refetchCash(), refetchPickups()]);
  }, [refetch, refetchCash, refetchPickups]);
  const { refreshing } = usePullToRefresh(refreshAll, { disabled: loading });

  // A new assignment notice arrived (see DriverLayout) — refresh silently.
  const seenVersionRef = useRef(assignmentsVersion);
  useEffect(() => {
    if (assignmentsVersion === seenVersionRef.current) return;
    seenVersionRef.current = assignmentsVersion;
    refreshAll();
  }, [assignmentsVersion, refreshAll]);

  const {
    data: firstHistoryPage, loading: historyLoading, error: historyError, refetch: refetchHistoryFirst,
  } = useAsyncData(tab === 'history' ? () => fetchHistoryPage(1) : () => Promise.resolve(null), [tab]);
  const { data: todayStats, refetch: refetchTodayStats } = useAsyncData(
    tab === 'history' ? fetchTodayStats : () => Promise.resolve(null),
    [tab],
  );
  // Later pages appended by "Load more"; reset whenever the first page reloads.
  const [olderHistory, setOlderHistory] = useState({ forPage: null, items: [], page: 1, hasMore: null });
  const [loadingMore, setLoadingMore] = useState(false);
  const older = olderHistory.forPage === firstHistoryPage ? olderHistory : { items: [], page: 1, hasMore: null };
  const historyHasMore = older.hasMore ?? Boolean(firstHistoryPage?.hasMore);
  const refetchHistory = useCallback(() => {
    refetchHistoryFirst();
    refetchTodayStats();
  }, [refetchHistoryFirst, refetchTodayStats]);
  const loadMoreHistory = async () => {
    setLoadingMore(true);
    try {
      const next = await fetchHistoryPage(older.page + 1);
      setOlderHistory({
        forPage: firstHistoryPage, items: [...older.items, ...next.items], page: older.page + 1, hasMore: next.hasMore,
      });
    } finally {
      setLoadingMore(false);
    }
  };

  // The API returns on-the-road orders plus ones assigned ahead of dispatch ("upcoming").
  const activeDeliveries = useMemo(
    () => (deliveries || []).filter((o) => o.orderStatus === 'out_for_delivery'),
    [deliveries],
  );
  const upcomingList = useMemo(
    () => (deliveries || []).filter((o) => o.orderStatus !== 'out_for_delivery' && matchesQuery(o, query)),
    [deliveries, query],
  );
  const list = useMemo(() => activeDeliveries.filter((o) => matchesQuery(o, query)), [activeDeliveries, query]);
  const historyList = useMemo(
    () => [...(firstHistoryPage?.items || []), ...older.items],
    [firstHistoryPage, older.items],
  );

  const sortedList = useMemo(() => {
    if (!nearestOn || !myPos) return list;
    return [...list].sort((a, b) => {
      const da = haversineKm(myPos, { lat: Number(a.shippingAddress?.lat), lng: Number(a.shippingAddress?.lng) });
      const db = haversineKm(myPos, { lat: Number(b.shippingAddress?.lat), lng: Number(b.shippingAddress?.lng) });
      if (da == null) return 1;
      if (db == null) return -1;
      return da - db;
    });
  }, [list, nearestOn, myPos]);

  const codTotal = activeDeliveries.reduce((sum, o) => sum + (o.cashDue || 0), 0);

  const deliveredToday = todayStats?.delivered ?? 0;
  const failedToday = todayStats?.failed ?? 0;

  // Several stops on the road → one Google Maps route, nearest stop first.
  const routeStops = useMemo(() => activeDeliveries
    .map((o) => ({ id: o._id, lat: o.shippingAddress?.lat != null ? Number(o.shippingAddress.lat) : null, lng: o.shippingAddress?.lng != null ? Number(o.shippingAddress.lng) : null }))
    .filter((s) => s.lat != null && s.lng != null), [activeDeliveries]);
  // Opened synchronously inside the tap — browsers block windows opened after an async GPS read.
  // Without an origin, Google Maps starts from the phone's current location by itself.
  const openRoute = () => {
    const here = myPos || geo?.lastPosition || null;
    const url = multiStopDirectionsUrl(here, orderStopsByNearest(here, routeStops));
    if (url) window.open(url, '_blank', 'noopener');
  };

  const toggleNearest = () => {
    if (nearestOn) {
      setNearestOn(false);
      return;
    }
    if (myPos) {
      setNearestOn(true);
      return;
    }
    if (!navigator.geolocation) {
      setLocateError(isAr ? 'الموقع غير مدعوم على هذا الجهاز' : 'Geolocation not supported on this device');
      return;
    }
    setLocating(true);
    setLocateError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setMyPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setNearestOn(true);
        setLocating(false);
      },
      (err) => {
        setLocateError(err.message || (isAr ? 'تعذّر تحديد موقعك' : 'Could not get your location'));
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            {isAr ? 'طلباتي' : 'My deliveries'}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {tab === 'active'
              ? (isAr ? 'الطلبات المعيّنة لك — اضغط لفتح التفاصيل' : 'Assigned to you — tap to open details')
              : (isAr ? 'سجل التوصيلات المكتملة' : 'Your completed delivery history')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => (tab === 'active' ? refreshAll() : refetchHistory())}
          disabled={loading || refreshing || historyLoading}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-teal-700 shadow-sm disabled:opacity-50"
          aria-label={isAr ? 'تحديث' : 'Refresh'}
        >
          <RefreshCw className={`h-4 w-4 ${refreshing || historyLoading ? 'animate-spin' : ''}`} aria-hidden />
        </button>
      </div>

      <div className="flex gap-1.5 rounded-2xl bg-slate-200/60 p-1">
        <button
          type="button"
          onClick={() => setTab('active')}
          className={[
            'flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-semibold transition',
            tab === 'active' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500',
          ].join(' ')}
        >
          <ListChecks className="h-4 w-4" aria-hidden />
          {isAr ? 'نشطة' : 'Active'}
          {list.length > 0 && (
            <span className="rounded-full bg-teal-100 px-1.5 py-0.5 text-[10px] font-bold text-teal-800">
              {list.length}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setTab('history')}
          className={[
            'flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-semibold transition',
            tab === 'history' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500',
          ].join(' ')}
        >
          <History className="h-4 w-4" aria-hidden />
          {isAr ? 'السجل' : 'History'}
        </button>
      </div>

      {isOffline && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {isAr
            ? 'أنت غير متصل حالياً. فعّل حالة «متصل» من الأعلى لاستلام طلبات جديدة.'
            : "You're offline. Switch to Online at the top to receive new orders."}
        </div>
      )}

      {tab === 'active' && (
        <>
          <DriverPushToggle isAr={isAr} variant="banner" />
          {!loading && (activeDeliveries.length > 0 || cashBalance > 0) && (
            <div className="grid grid-cols-3 gap-2.5">
              <DriverStatCard icon={Truck} label={isAr ? 'نشطة' : 'Active'} value={activeDeliveries.length} accent="teal" />
              <DriverStatCard
                icon={Banknote}
                label={isAr ? 'للتحصيل (ج.م)' : 'To collect (EGP)'}
                value={codTotal > 0 ? Math.round(codTotal) : '—'}
                accent="amber"
              />
              <DriverStatCard
                icon={Wallet}
                label={isAr ? 'نقدية معك (ج.م)' : 'Cash held (EGP)'}
                value={cashBalance > 0 ? Math.round(cashBalance) : '0'}
                accent="violet"
              />
            </div>
          )}

          {!loading && deliveries?.length > 1 && (
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={isAr ? 'ابحث برقم الطلب أو العنوان...' : 'Search order # or address...'}
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 ps-9 pe-8 text-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-100"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="absolute end-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    aria-label={isAr ? 'مسح' : 'Clear'}
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={toggleNearest}
                disabled={locating}
                className={[
                  'inline-flex h-[42px] shrink-0 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition disabled:opacity-60',
                  nearestOn
                    ? 'border-teal-300 bg-teal-50 text-teal-800'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-teal-200',
                ].join(' ')}
                title={isAr ? 'ترتيب حسب الأقرب' : 'Sort by nearest'}
              >
                {locating ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <LocateFixed className="h-4 w-4" aria-hidden />
                )}
                {isAr ? 'الأقرب' : 'Nearest'}
              </button>
            </div>
          )}
          {locateError && (
            <p className="text-xs text-red-600">{locateError}</p>
          )}

          {loading && !refreshing && (
            <div className="flex justify-center py-20">
              <Loader size="lg" />
            </div>
          )}

          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error.response?.data?.message || error.message}
            </div>
          )}

          {!loading && list.length === 0 && upcomingList.length === 0 && !(pickups?.length) && !error && (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center shadow-sm">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-50 text-teal-600">
                <Truck className="h-8 w-8" aria-hidden />
              </div>
              <p className="text-lg font-semibold text-slate-900">
                {query
                  ? (isAr ? 'لا نتائج مطابقة' : 'No matching deliveries')
                  : (isAr ? 'لا توجد طلبات نشطة' : 'No active deliveries')}
              </p>
              <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-slate-500">
                {query
                  ? (isAr ? 'جرّب كلمة بحث مختلفة' : 'Try a different search term')
                  : (isAr
                    ? 'عند تعيينك لطلب سيظهر هنا فوراً — اسحب لأسفل للتحديث'
                    : 'When you get an order it shows up here instantly — pull down to refresh')}
              </p>
            </div>
          )}

          {routeStops.length >= 2 && (
            <button
              type="button"
              onClick={openRoute}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 py-3 text-sm font-semibold text-white shadow-sm hover:bg-teal-700"
            >
              <Route className="h-4 w-4" aria-hidden />
              {isAr
                ? `ابدأ المسار — ${routeStops.length} محطات (الأقرب أولاً)`
                : `Start route — ${routeStops.length} stops (nearest first)`}
            </button>
          )}

          {sortedList.length > 0 && (
            <ul className="space-y-3">
              {sortedList.map((order) => (
                <li key={order._id}>
                  <DriverDeliveryCard order={order} isAr={isAr} />
                </li>
              ))}
            </ul>
          )}

          {pickups?.length > 0 && (
            <section className="space-y-3">
              <h2 className="flex items-center gap-1.5 text-sm font-bold text-slate-700">
                <RotateCcw className="h-4 w-4 text-amber-600" aria-hidden />
                {isAr ? 'استلام مرتجعات' : 'Return pickups'}
                <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">{pickups.length}</span>
              </h2>
              <ul className="space-y-3">
                {pickups.map((p) => (
                  <li key={p.returnId}>
                    <Link
                      to={`/driver/pickups/${p.orderId}/${p.returnId}`}
                      className="block rounded-2xl border border-amber-200 bg-white px-4 py-3.5 shadow-sm transition hover:border-amber-300"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-mono text-lg font-bold tabular-nums text-slate-900">#{p.orderNumber}</p>
                          <p className="truncate text-sm text-slate-600">{isAr ? p.item.nameAr || p.item.nameEn : p.item.nameEn || p.item.nameAr} × {p.item.quantity}</p>
                        </div>
                        <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                          {p.fulfillmentStatus === 'pickup_en_route' ? (isAr ? 'في الطريق' : 'On the way') : (isAr ? 'مرتجع' : 'Return')}
                        </span>
                      </div>
                      <p className="mt-2 line-clamp-1 text-xs text-slate-500">{formatDriverAddress(p.shippingAddress, isAr)}</p>
                      {(p.pickupSlotLabelAr || p.pickupSlotLabelEn) && (
                        <p className="mt-1 text-xs font-medium text-indigo-700">{isAr ? p.pickupSlotLabelAr : p.pickupSlotLabelEn}</p>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {upcomingList.length > 0 && (
            <section className="space-y-3">
              <div>
                <h2 className="text-sm font-bold text-slate-700">
                  {isAr ? 'طلبات قادمة' : 'Upcoming'}
                  <span className="ms-1.5 rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-700">
                    {upcomingList.length}
                  </span>
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  {isAr
                    ? 'معيّنة لك وما زالت قيد التجهيز — ستنتقل إلى النشطة عند خروجها للتوصيل'
                    : 'Assigned to you and still being prepared — they move to Active once dispatched'}
                </p>
              </div>
              <ul className="space-y-3 opacity-90">
                {upcomingList.map((order) => (
                  <li key={order._id}>
                    <DriverDeliveryCard order={order} isAr={isAr} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {tab === 'history' && (
        <>
          {!historyLoading && historyList.length > 0 && (
            <div className="grid grid-cols-2 gap-2.5">
              <DriverStatCard icon={Package} label={isAr ? 'تم التسليم اليوم' : 'Delivered today'} value={deliveredToday} accent="emerald" />
              <DriverStatCard icon={Package} label={isAr ? 'فشل اليوم' : 'Failed today'} value={failedToday} accent="red" />
            </div>
          )}

          {historyLoading && (
            <div className="flex justify-center py-20">
              <Loader size="lg" />
            </div>
          )}

          {historyError && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {historyError.response?.data?.message || historyError.message}
            </div>
          )}

          {!historyLoading && historyList.length === 0 && !historyError && (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center shadow-sm">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                <History className="h-8 w-8" aria-hidden />
              </div>
              <p className="text-lg font-semibold text-slate-900">
                {isAr ? 'لا يوجد سجل بعد' : 'No history yet'}
              </p>
              <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-slate-500">
                {isAr ? 'ستظهر هنا الطلبات بعد تسليمها' : 'Completed deliveries will show up here'}
              </p>
            </div>
          )}

          {historyList.length > 0 && <DriverHistoryList history={historyList} isAr={isAr} />}
          {historyList.length > 0 && historyHasMore && (
            <button
              type="button"
              onClick={loadMoreHistory}
              disabled={loadingMore}
              className="w-full rounded-xl border border-slate-200 bg-white py-3 text-sm font-semibold text-teal-700 shadow-sm disabled:opacity-60"
            >
              {loadingMore ? (isAr ? 'جاري التحميل…' : 'Loading…') : (isAr ? 'عرض المزيد' : 'Load more')}
            </button>
          )}
        </>
      )}
    </div>
  );
}
