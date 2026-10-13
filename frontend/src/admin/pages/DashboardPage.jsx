import { useEffect, useMemo, useState } from 'react';
import { Link } from '../../app/router';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { adminApi } from '../adminApi';
import { useAdminStats } from '../context/AdminStatsContext';
import { useAdminPanel } from '../context/AdminPanelContext';
import { hasPermission } from '../adminPermissions';
import { itemScreens } from '../adminNavGroups';
import useAdminNav from '../hooks/useAdminNav';
import StatusBadge from '../components/StatusBadge';
import SalesTrendCard from '../components/dashboard/SalesTrendCard';
import StockAlertsCard from '../components/dashboard/StockAlertsCard';
import { formatDate, formatPrice } from '../../utils/formatters';
import { OrderNumberChip } from '../components';
import { Skeleton } from '../components/Skeleton';

function DashboardSkeleton() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Skeleton className="h-7 w-56" />
      <Skeleton className="h-40 w-full rounded-xl" />
      <Skeleton className="h-28 w-full rounded-xl" />
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-80 rounded-xl lg:col-span-2" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    </div>
  );
}

function greetingFor(hour, isAr) {
  if (hour < 12) return isAr ? 'صباح الخير' : 'Good morning';
  return isAr ? 'مساء الخير' : (hour < 18 ? 'Good afternoon' : 'Good evening');
}

function Card({ title, action, children, className = '' }) {
  return (
    <section className={`rounded-xl border border-border bg-white ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 px-5 pt-4">
          <h2 className="text-sm font-semibold text-text">{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/** "+12% vs last week" in plain words. */
function Change({ value, isAr }) {
  if (value === null || value === undefined) return null;
  if (value === 0) {
    return <span className="text-text-muted">{isAr ? 'نفس الأسبوع الماضي' : 'same as last week'}</span>;
  }
  const up = value > 0;
  return (
    <span className={up ? 'text-emerald-600' : 'text-red-600'}>
      {up ? '↑' : '↓'} {Math.abs(value)}%{' '}
      <span className="text-text-muted">{isAr ? 'عن الأسبوع الماضي' : 'vs last week'}</span>
    </span>
  );
}

/**
 * What's waiting for someone. Each row only shows when there is something
 * to do AND the user can open the screen it points to.
 */
const TODO = [
  { key: 'pendingOrdersCount', to: '/admin/orders', ar: (n) => `${n} طلب جديد لم يُجهّز بعد`, en: (n) => `${n} new ${n === 1 ? 'order' : 'orders'} to prepare` },
  { key: 'ordersUnreadMessagesCount', to: '/admin/order-chats', ar: (n) => `${n} رسالة من عملاء لم تُقرأ`, en: (n) => `${n} unread customer ${n === 1 ? 'message' : 'messages'}` },
  { key: 'pendingLiveChatsCount', to: '/admin/live-chat', ar: (n) => `${n} عميل ينتظر في المحادثة المباشرة`, en: (n) => `${n} waiting in live chat` },
  { key: 'pendingCallbackRequestsCount', to: '/admin/callback-requests', ar: (n) => `${n} عميل طلب أن تتصل به`, en: (n) => `${n} asked you to call back` },
  { key: 'pendingReturnsCount', to: '/admin/returns', ar: (n) => `${n} طلب إرجاع ينتظر قرارك`, en: (n) => `${n} ${n === 1 ? 'return' : 'returns'} waiting for a decision` },
  { key: 'outOfStockCount', to: '/admin/stock-alerts', ar: (n) => `${n} منتج خلص من المخزون`, en: (n) => `${n} ${n === 1 ? 'product' : 'products'} out of stock` },
  { key: 'pendingReviewsCount', to: '/admin/reviews', ar: (n) => `${n} تقييم ينتظر الموافقة`, en: (n) => `${n} ${n === 1 ? 'review' : 'reviews'} to approve` },
  { key: 'pendingListingsCount', to: '/admin/listing-review', ar: (n) => `${n} منتج من بائع ينتظر الموافقة`, en: (n) => `${n} seller ${n === 1 ? 'product' : 'products'} to approve` },
  { key: 'pendingSellersCount', to: '/admin/sellers', ar: (n) => `${n} بائع جديد ينتظر الموافقة`, en: (n) => `${n} new ${n === 1 ? 'seller' : 'sellers'} to approve` },
];

export default function DashboardPage() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const { user } = useAuth();
  const { refreshStats } = useAdminStats();
  const { showRevenue } = useAdminPanel();
  const { nav } = useAdminNav();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const now = new Date();
  const Chevron = isAr ? ChevronLeft : ChevronRight;

  useEffect(() => {
    setLoading(true);
    adminApi.getStats()
      .then(({ data }) => {
        setStats(data.stats);
        refreshStats();
      })
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, [refreshStats]);

  const reachable = useMemo(() => new Set(
    nav.flatMap((group) => group.items.flatMap((item) => itemScreens(item).map((s) => s.path))),
  ), [nav]);

  const todo = useMemo(() => TODO
    .map((row) => ({ ...row, count: Number(stats?.[row.key]) || 0 }))
    .filter((row) => row.count > 0 && reachable.has(row.to)), [stats, reachable]);

  if (loading) return <DashboardSkeleton />;

  const canAddProduct = hasPermission(user, 'products:write');
  const firstName = (user?.name || '').split(' ')[0];

  const week = [
    { label: isAr ? 'الطلبات' : 'Orders', value: stats?.orders7d ?? 0, change: stats?.orders7dChange },
    showRevenue && { label: isAr ? 'المبيعات' : 'Sales', value: formatPrice(stats?.revenue7d || 0), change: stats?.revenue7dChange },
    showRevenue && { label: isAr ? 'متوسط الطلب' : 'Average order', value: formatPrice(stats?.avgOrder7d || 0), change: stats?.avgOrder7dChange },
    { label: isAr ? 'عملاء جدد' : 'New customers', value: stats?.newUsers7d ?? 0, change: stats?.newUsers7dChange },
  ].filter(Boolean);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-text">
            {greetingFor(now.getHours(), isAr)}{firstName ? (isAr ? `، ${firstName}` : `, ${firstName}`) : ''}
          </h2>
          <p className="mt-1 text-sm text-text-muted">
            {formatDate(now, isAr ? 'ar-EG' : 'en-GB')}
            {stats?.todayOrders > 0 && (
              <>
                {' · '}
                {isAr ? `${stats.todayOrders} طلب اليوم` : `${stats.todayOrders} ${stats.todayOrders === 1 ? 'order' : 'orders'} today`}
                {showRevenue && stats?.todayRevenue > 0 && ` · ${formatPrice(stats.todayRevenue)}`}
              </>
            )}
          </p>
        </div>
        {canAddProduct && (
          <Link
            to="/admin/products/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-primary-700"
          >
            <Plus className="h-4 w-4" />
            {isAr ? 'منتج جديد' : 'New product'}
          </Link>
        )}
      </div>

      <Card title={isAr ? 'محتاج منك الآن' : 'Needs you now'}>
        {todo.length ? (
          <ul className="mt-2 divide-y divide-border">
            {todo.map((row) => (
              <li key={row.key}>
                <Link
                  to={row.to}
                  className="flex items-center gap-3 px-5 py-3 text-sm text-text transition-colors hover:bg-slate-50"
                >
                  <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" aria-hidden />
                  <span className="flex-1">{isAr ? row.ar(row.count) : row.en(row.count)}</span>
                  <Chevron className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 pb-5 pt-2 text-sm text-text-muted">
            {isAr ? 'لا يوجد شيء ينتظرك. كل شيء تمام.' : 'Nothing is waiting on you. All caught up.'}
          </p>
        )}
        {todo.length > 0 && <div className="h-1" />}
      </Card>

      <Card title={isAr ? 'آخر 7 أيام' : 'Last 7 days'}>
        <dl className={`grid grid-cols-2 gap-px px-5 pb-5 pt-3 ${week.length === 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-2'}`}>
          {week.map((item) => (
            <div key={item.label} className="py-2">
              <dt className="text-sm text-text-muted">{item.label}</dt>
              <dd className="mt-1 text-2xl font-semibold tracking-tight text-text">{item.value}</dd>
              <dd className="mt-1 text-xs"><Change value={item.change} isAr={isAr} /></dd>
            </div>
          ))}
        </dl>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {showRevenue && (
          <div className="lg:col-span-2">
            <SalesTrendCard initialData={stats?.salesByDay} isAr={isAr} />
          </div>
        )}

        <Card
          className={showRevenue ? '' : 'lg:col-span-3'}
          title={isAr ? 'آخر الطلبات' : 'Latest orders'}
          action={(
            <Link to="/admin/orders" className="text-sm text-primary-600 hover:underline">
              {isAr ? 'كل الطلبات' : 'All orders'}
            </Link>
          )}
        >
          {stats?.latestOrders?.length ? (
            <ul className="mt-2 divide-y divide-border">
              {stats.latestOrders.map((order) => (
                <li key={order._id}>
                  <Link
                    to={`/admin/orders?order=${order._id}`}
                    className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <OrderNumberChip orderNumber={order.orderNumber} size="sm" short />
                      <p className="mt-1 truncate text-xs text-text-muted">
                        {order.user?.name || order.user?.email}
                        {showRevenue ? ` · ${formatPrice(order.total)}` : ''}
                      </p>
                    </div>
                    <StatusBadge status={order.orderStatus || order.status} language={language} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 pb-5 pt-2 text-sm text-text-muted">
              {isAr ? 'لا توجد طلبات بعد.' : 'No orders yet.'}
            </p>
          )}
        </Card>
      </div>

      {(stats?.outOfStockCount > 0 || stats?.lowStockProducts?.length > 0) && reachable.has('/admin/stock-alerts') && (
        <StockAlertsCard
          outOfStockProducts={stats?.outOfStockProducts}
          outOfStockCount={stats?.outOfStockCount}
          lowStockProducts={stats?.lowStockProducts}
          isAr={isAr}
        />
      )}
    </div>
  );
}
