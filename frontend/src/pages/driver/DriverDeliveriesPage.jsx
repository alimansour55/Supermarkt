import { Package, RefreshCw, Truck } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { orderService } from '../../services/apiServices';
import { useAsyncData } from '../../hooks/useAsyncData';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';
import Loader from '../../components/ui/Loader';
import Button from '../../components/ui/Button';
import DriverDeliveryCard from './components/DriverDeliveryCard';

async function fetchDeliveries() {
  const { data } = await orderService.getDriverDeliveries();
  return data.data || [];
}

function SummaryPill({ label, value, accent }) {
  const accents = {
    teal: 'bg-teal-50 text-teal-800 ring-teal-200',
    violet: 'bg-violet-50 text-violet-800 ring-violet-200',
    amber: 'bg-amber-50 text-amber-900 ring-amber-200',
  };
  return (
    <div className={`rounded-2xl px-4 py-3 ring-1 ${accents[accent]}`}>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      <p className="mt-0.5 text-xs font-medium opacity-80">{label}</p>
    </div>
  );
}

export default function DriverDeliveriesPage() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
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
          <p className="mt-1 text-sm text-slate-600">
            {isAr
              ? 'الطلبات المعيّنة لك — اضغط لفتح التفاصيل وبدء التوصيل'
              : 'Assigned to you — tap to view details and start delivery'}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => refetch()}
          disabled={loading || refreshing}
          className="shrink-0 text-teal-700 hover:bg-teal-50"
          aria-label={isAr ? 'تحديث' : 'Refresh'}
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {!loading && list.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          <SummaryPill
            label={isAr ? 'نشطة' : 'Active'}
            value={list.length}
            accent="teal"
          />
          <SummaryPill
            label={isAr ? 'قطع' : 'Items'}
            value={itemTotal}
            accent="violet"
          />
          <SummaryPill
            label={isAr ? 'تحصيل COD (ج.م)' : 'COD due (EGP)'}
            value={codTotal > 0 ? `${Math.round(codTotal)}` : '—'}
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
              ? 'عند تعيينك لطلب من الإدارة ستظهر هنا فوراً'
              : 'When admin assigns you an order, it will appear here instantly'}
          </p>
          <Package className="mx-auto mt-6 h-8 w-8 text-slate-300" aria-hidden />
        </div>
      )}

      <ul className="space-y-3">
        {list.map((order) => (
          <li key={order._id}>
            <DriverDeliveryCard order={order} isAr={isAr} />
          </li>
        ))}
      </ul>
    </div>
  );
}
