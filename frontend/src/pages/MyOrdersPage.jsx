import { useMemo, useState } from 'react';
import { Link } from '../app/router';
import { Package, RefreshCw, ShoppingBag } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { orderService } from '../services/apiServices';
import { useAsyncData } from '../hooks/useAsyncData';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import { OrderListSkeleton } from '../components/ui/Skeleton';
import OrderCard from '../components/order/OrderCard';
import {
  ORDER_LIST_FILTERS,
  filterOrdersByTab,
  isOrderActive,
} from '../utils/orderNumber';

async function fetchOrders() {
  const { data: res } = await orderService.getMyOrders();
  return res.orders;
}

export default function MyOrdersPage() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const [filter, setFilter] = useState('all');
  const { data, loading, error, refetch } = useAsyncData(fetchOrders, []);
  const { pulling, refreshing } = usePullToRefresh(refetch, { disabled: loading });

  const orders = data || [];
  const filtered = useMemo(() => filterOrdersByTab(orders, filter), [orders, filter]);
  const activeCount = useMemo(
    () => orders.filter((o) => isOrderActive(o.orderStatus || o.status)).length,
    [orders],
  );
  const showLoader = loading && !refreshing;

  const counts = useMemo(() => ({
    all: orders.length,
    active: filterOrdersByTab(orders, 'active').length,
    completed: filterOrdersByTab(orders, 'completed').length,
    issues: filterOrdersByTab(orders, 'issues').length,
  }), [orders]);

  return (
    <div className="min-w-0 pb-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-primary-700">
              {isAr ? 'حسابي' : 'My account'}
            </p>
            <h1 className="mt-1 text-2xl font-bold text-text md:text-3xl">
              {isAr ? 'طلباتي' : 'My Orders'}
            </h1>
            {!showLoader && orders.length > 0 && (
              <p className="mt-2 text-sm text-text-muted">
                {isAr
                  ? `${orders.length} طلب${orders.length === 1 ? '' : 'ات'}`
                  : `${orders.length} order${orders.length === 1 ? '' : 's'}`}
                {activeCount > 0 && (
                  <span className="text-primary-700">
                    {isAr ? ` · ${activeCount} قيد التنفيذ` : ` · ${activeCount} in progress`}
                  </span>
                )}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={refetch}
            disabled={loading || refreshing}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-white shadow-sm hover:bg-slate-50 disabled:opacity-50"
            aria-label={isAr ? 'تحديث' : 'Refresh'}
          >
            <RefreshCw className={`h-5 w-5 text-slate-600 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {(pulling || refreshing) && (
          <p className="mb-4 text-center text-sm text-primary-600">
            {refreshing
              ? (isAr ? 'جاري التحديث...' : 'Refreshing...')
              : (isAr ? 'اسحب للتحديث' : 'Pull to refresh')}
          </p>
        )}

        {!showLoader && orders.length > 0 && (
          <div
            className="mb-5 flex gap-2 overflow-x-auto pb-1 scrollbar-none"
            role="tablist"
            aria-label={isAr ? 'تصفية الطلبات' : 'Filter orders'}
          >
            {ORDER_LIST_FILTERS.map((tab) => {
              const count = counts[tab.id];
              const active = filter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setFilter(tab.id)}
                  className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                    active
                      ? 'bg-primary-700 text-white shadow-sm'
                      : 'border border-border bg-white text-text-muted hover:border-primary-200 hover:text-text'
                  }`}
                >
                  {isAr ? tab.labelAr : tab.labelEn}
                  {count > 0 && (
                    <span
                      className={`ms-1.5 inline-flex min-w-[1.25rem] justify-center rounded-full px-1.5 py-0.5 text-xs ${
                        active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {showLoader && <OrderListSkeleton count={4} />}

        {error && !showLoader && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-8 text-center">
            <p className="font-medium text-red-900">
              {isAr ? 'تعذّر تحميل الطلبات' : 'Could not load orders'}
            </p>
            <button
              type="button"
              onClick={refetch}
              className="mt-4 text-sm font-semibold text-primary-700 hover:underline"
            >
              {isAr ? 'إعادة المحاولة' : 'Try again'}
            </button>
          </div>
        )}

        {!showLoader && orders.length === 0 && !error && (
          <div className="rounded-3xl border border-dashed border-border bg-white px-6 py-16 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
              <Package className="h-8 w-8" strokeWidth={1.5} />
            </div>
            <h2 className="mt-5 text-lg font-bold text-text">
              {isAr ? 'لا توجد طلبات بعد' : 'No orders yet'}
            </h2>
            <p className="mx-auto mt-2 max-w-sm text-sm text-text-muted">
              {isAr
                ? 'عند إتمام أول عملية شراء ستظهر طلباتك هنا مع رقم طلب قصير وسهل.'
                : 'After your first purchase, your orders will appear here with a short, easy order number.'}
            </p>
            <Link
              to="/products"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary-700 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-primary-800"
            >
              <ShoppingBag className="h-4 w-4" />
              {isAr ? 'ابدأ التسوق' : 'Start shopping'}
            </Link>
          </div>
        )}

        {!showLoader && orders.length > 0 && filtered.length === 0 && (
          <p className="rounded-2xl border border-border bg-white py-12 text-center text-sm text-text-muted">
            {isAr ? 'لا توجد طلبات في هذا التصنيف' : 'No orders in this category'}
          </p>
        )}

        <div className="space-y-4">
          {filtered.map((order) => (
            <OrderCard key={order._id} order={order} isAr={isAr} />
          ))}
        </div>
      </div>
    </div>
  );
}
