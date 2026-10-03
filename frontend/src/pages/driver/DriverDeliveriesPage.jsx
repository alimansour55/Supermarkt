import { useMemo, useState } from 'react';
import { useOutletContext } from '../../app/router';
import {
  Banknote, History, ListChecks, LocateFixed, Loader2, Package, RefreshCw, Search, Truck, X,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { orderService } from '../../services/apiServices';
import { useAsyncData } from '../../hooks/useAsyncData';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';
import Loader from '../../components/ui/Loader';
import DriverDeliveryCard from './components/DriverDeliveryCard';
import DriverStatCard from './components/DriverStatCard';
import DriverHistoryList, { groupHistoryByDay } from './components/DriverHistoryList';
import { formatDriverAddress, haversineKm } from './driverUtils';

async function fetchDeliveries() {
  const { data } = await orderService.getDriverDeliveries();
  return data.data || [];
}

async function fetchHistory() {
  const { data } = await orderService.getDriverHistory();
  return data.data || [];
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
  const { isOffline } = useOutletContext() || {};
  const [tab, setTab] = useState('active');
  const [query, setQuery] = useState('');
  const [nearestOn, setNearestOn] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState('');
  const [myPos, setMyPos] = useState(null);

  const {
    data: deliveries, loading, error, refetch,
  } = useAsyncData(fetchDeliveries, []);
  const { refreshing } = usePullToRefresh(refetch, { disabled: loading });

  const {
    data: history, loading: historyLoading, error: historyError, refetch: refetchHistory,
  } = useAsyncData(tab === 'history' ? fetchHistory : () => Promise.resolve([]), [tab]);

  const list = useMemo(() => (deliveries || []).filter((o) => matchesQuery(o, query)), [deliveries, query]);
  const historyList = history || [];

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

  const codTotal = list
    .filter((o) => o.paymentMethod === 'cod' && o.paymentStatus !== 'paid')
    .reduce((sum, o) => sum + (o.total || 0), 0);
  const itemTotal = list.reduce((sum, o) => sum + (o.itemCount || 0), 0);

  const todayHistory = historyList.filter((o) => groupHistoryByDay([o], isAr)[0]?.[0] === (isAr ? 'اليوم' : 'Today'));
  const deliveredToday = todayHistory.filter((o) => o.orderStatus === 'delivered').length;
  const failedToday = todayHistory.filter((o) => o.orderStatus === 'delivery_failed').length;

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
          onClick={() => (tab === 'active' ? refetch() : refetchHistory())}
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
          {!loading && deliveries?.length > 0 && (
            <div className="grid grid-cols-3 gap-2.5">
              <DriverStatCard icon={Truck} label={isAr ? 'نشطة' : 'Active'} value={deliveries.length} accent="teal" />
              <DriverStatCard icon={Package} label={isAr ? 'قطع' : 'Items'} value={itemTotal} accent="violet" />
              <DriverStatCard
                icon={Banknote}
                label={isAr ? 'تحصيل (ج.م)' : 'COD (EGP)'}
                value={codTotal > 0 ? Math.round(codTotal) : '—'}
                accent="amber"
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

          {!loading && list.length === 0 && !error && (
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

          {sortedList.length > 0 && (
            <ul className="space-y-3">
              {sortedList.map((order) => (
                <li key={order._id}>
                  <DriverDeliveryCard order={order} isAr={isAr} />
                </li>
              ))}
            </ul>
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
        </>
      )}
    </div>
  );
}
