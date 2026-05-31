import { Link } from 'react-router-dom';
import { Package, RefreshCw } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { orderService } from '../services/apiServices';
import { useAsyncData } from '../hooks/useAsyncData';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import { formatPrice, formatDate } from '../utils/formatters';
import { getOrderStatusLabel, getOrderStatusColor } from '../utils/orderStatus';
import Loader from '../components/ui/Loader';

async function fetchOrders() {
  const { data: res } = await orderService.getMyOrders();
  return res.orders;
}

export default function MyOrdersPage() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const { data, loading, error, refetch } = useAsyncData(fetchOrders, []);
  const { pulling, refreshing } = usePullToRefresh(refetch, { disabled: loading });

  const orders = data || [];
  const showLoader = loading && !refreshing;

  return (
    <div className="container-app py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold md:text-3xl">{isAr ? 'طلباتي' : 'My Orders'}</h1>
        <button
          type="button"
          onClick={refetch}
          disabled={loading || refreshing}
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-border hover:bg-white md:hidden"
          aria-label={isAr ? 'تحديث' : 'Refresh'}
        >
          <RefreshCw className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {(pulling || refreshing) && (
        <p className="mb-4 text-center text-sm text-primary-600">
          {refreshing ? (isAr ? 'جاري التحديث...' : 'Refreshing...') : (isAr ? 'اسحب للتحديث' : 'Pull to refresh')}
        </p>
      )}

      {showLoader && <div className="flex justify-center py-20"><Loader size="lg" /></div>}

      {error && !showLoader && (
        <p className="py-10 text-center text-text-muted">
          {isAr ? 'لا توجد طلبات بعد' : 'No orders yet'}
        </p>
      )}

      {!showLoader && orders.length === 0 && !error && (
        <div className="py-20 text-center text-text-muted">
          <Package className="mx-auto h-12 w-12 text-slate-300" strokeWidth={1.5} />
          <p className="mt-4">{isAr ? 'لا توجد طلبات بعد' : 'No orders yet'}</p>
          <Link to="/products" className="mt-4 inline-block text-primary-600">{isAr ? 'ابدأ التسوق' : 'Start Shopping'}</Link>
        </div>
      )}

      <div className="space-y-4">
        {orders.map((order) => {
          const status = order.orderStatus || order.status;
          return (
            <Link
              key={order._id}
              to={`/orders/${order._id}`}
              className="block rounded-2xl border border-border bg-white p-5 transition-shadow hover:shadow-md active:scale-[0.99]"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-bold">{order.orderNumber}</p>
                  <p className="text-sm text-text-muted">{formatDate(order.createdAt, isAr ? 'ar-EG' : 'en-US')}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getOrderStatusColor(status)}`}>
                  {getOrderStatusLabel(status, isAr)}
                </span>
              </div>
              <div className="mt-3 space-y-1 text-sm text-text-muted">
                {order.items?.slice(0, 3).map((item, i) => (
                  <p key={i}>{isAr ? item.nameAr : (item.nameEn || item.nameAr)} × {item.quantity}</p>
                ))}
                {order.items?.length > 3 && (
                  <p className="text-xs">+{order.items.length - 3} {isAr ? 'أخرى' : 'more'}</p>
                )}
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                <span className="font-bold text-primary-700">{formatPrice(order.total)}</span>
                <span className="text-sm text-primary-600">{isAr ? 'عرض التفاصيل ←' : 'View details →'}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
