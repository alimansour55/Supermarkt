import { useOutletContext } from 'react-router-dom';
import { Banknote, Package, RefreshCw, Truck } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { orderService } from '../../services/apiServices';
import { useAsyncData } from '../../hooks/useAsyncData';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';
import Loader from '../../components/ui/Loader';
import DriverDeliveryCard from './components/DriverDeliveryCard';

async function fetchDeliveries() {
  const { data } = await orderService.getDriverDeliveries();
  return data.data || [];
}

function StatCard({ icon: Icon, label, value, accent }) {
  const accents = {
    teal: 'text-teal-700 bg-teal-50',
    violet: 'text-violet-700 bg-violet-50',
    amber: 'text-amber-800 bg-amber-50',
  };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${accents[accent]}`}>
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">{value}</p>
      <p className="text-xs font-medium text-slate-500">{label}</p>
    </div>
  );
}

export default function DriverDeliveriesPage() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const { isOffline } = useOutletContext() || {};
  const { data: deliveries, loading, error, refetch } = useAsyncData(fetchDeliveries, []);
  const { refreshing } = usePullToRefresh(refetch, { disabled: loading });

  const list = deliveries || [];
  const codTotal = list
    .filter((o) => o.paymentMethod === 'cod' && o.paymentStatus !== 'paid')
    .reduce((sum, o) => sum + (o.total || 0), 0);
  const itemTotal = list.reduce((sum, o) => sum + (o.itemCount || 0), 0);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            {isAr ? 'طلبات اليوم' : "Today's deliveries"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {isAr
              ? 'الطلبات المعيّنة لك — اضغط لفتح التفاصيل'
              : 'Assigned to you — tap to open details'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={loading || refreshing}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-teal-700 shadow-sm disabled:opacity-50"
          aria-label={isAr ? 'تحديث' : 'Refresh'}
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} aria-hidden />
        </button>
      </div>

      {isOffline && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {isAr
            ? 'أنت غير متصل حالياً. فعّل حالة «متصل» من الأعلى لاستلام طلبات جديدة.'
            : "You're offline. Switch to Online at the top to receive new orders."}
        </div>
      )}

      {!loading && list.length > 0 && (
        <div className="grid grid-cols-3 gap-2.5">
          <StatCard icon={Truck} label={isAr ? 'نشطة' : 'Active'} value={list.length} accent="teal" />
          <StatCard icon={Package} label={isAr ? 'قطع' : 'Items'} value={itemTotal} accent="violet" />
          <StatCard
            icon={Banknote}
            label={isAr ? 'تحصيل (ج.م)' : 'COD (EGP)'}
            value={codTotal > 0 ? Math.round(codTotal) : '—'}
            accent="amber"
          />
        </div>
      )}

      {loading && !refreshing && (
        <div className="flex justify-center py-20">
          <Loader size="lg" />
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {!loading && list.length === 0 && (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-50 text-teal-600">
            <Truck className="h-8 w-8" aria-hidden />
          </div>
          <p className="text-lg font-semibold text-slate-900">
            {isAr ? 'لا توجد طلبات نشطة' : 'No active deliveries'}
          </p>
          <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-slate-500">
            {isAr
              ? 'عند تعيينك لطلب سيظهر هنا فوراً — اسحب لأسفل للتحديث'
              : 'When you get an order it shows up here instantly — pull down to refresh'}
          </p>
        </div>
      )}

      {list.length > 0 && (
        <ul className="space-y-3">
          {list.map((order) => (
            <li key={order._id}>
              <DriverDeliveryCard order={order} isAr={isAr} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
