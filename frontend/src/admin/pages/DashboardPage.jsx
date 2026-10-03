import { useEffect, useMemo, useState } from 'react';
import { Link } from '../../app/router';
import {
  MessageCircle,
  Receipt,
  RotateCcw,
  ShoppingCart,
  Star,
  TrendingUp,
  UserPlus,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { adminApi } from '../adminApi';
import { useAdminStats } from '../context/AdminStatsContext';
import { useAdminPanel } from '../context/AdminPanelContext';
import StatusBadge from '../components/StatusBadge';
import KpiPeriodCard from '../components/dashboard/KpiPeriodCard';
import SalesTrendCard from '../components/dashboard/SalesTrendCard';
import OrdersStatusChart from '../components/dashboard/OrdersStatusChart';
import QuickActions from '../components/dashboard/QuickActions';
import NeedsAttentionGrid from '../components/dashboard/NeedsAttentionGrid';
import StockAlertsCard from '../components/dashboard/StockAlertsCard';
import { formatDate, formatPrice } from '../../utils/formatters';
import { EmptyState, OrderNumberChip } from '../components';
import { Skeleton } from '../components/Skeleton';

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Skeleton className="mb-2 h-6 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-9 w-64" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-2xl border border-border bg-white p-5 shadow-sm">
            <Skeleton className="mb-3 h-4 w-24" />
            <Skeleton className="h-8 w-32" />
          </div>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
          <Skeleton className="mb-4 h-6 w-40" />
          <Skeleton className="h-72 w-full" />
        </div>
        <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
          <Skeleton className="mb-4 h-6 w-40" />
          <Skeleton className="h-72 w-full rounded-full" />
        </div>
      </div>
    </div>
  );
}

function greetingFor(hour, isAr) {
  if (hour < 12) return isAr ? 'صباح الخير' : 'Good morning';
  if (hour < 18) return isAr ? 'مساء الخير' : 'Good afternoon';
  return isAr ? 'مساء الخير' : 'Good evening';
}

export default function DashboardPage() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const { user } = useAuth();
  const { refreshStats } = useAdminStats();
  const { showRevenue } = useAdminPanel();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => new Date());

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

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const attentionItems = useMemo(() => ([
    {
      key: 'pending-orders',
      count: stats?.pendingOrdersCount ?? 0,
      labelAr: 'طلبات قيد الانتظار',
      labelEn: 'Pending orders',
      to: '/admin/orders',
      icon: ShoppingCart,
      tone: 'blue',
    },
    {
      key: 'unread-messages',
      count: stats?.ordersUnreadMessagesCount ?? 0,
      labelAr: 'رسائل عملاء غير مقروءة',
      labelEn: 'Unread customer messages',
      to: '/admin/order-chats',
      icon: MessageCircle,
      tone: 'violet',
    },
    {
      key: 'pending-returns',
      count: stats?.pendingReturnsCount ?? 0,
      labelAr: 'طلبات استرجاع بانتظار المراجعة',
      labelEn: 'Returns awaiting review',
      to: '/admin/returns',
      icon: RotateCcw,
      tone: 'amber',
    },
    {
      key: 'pending-reviews',
      count: stats?.pendingReviewsCount ?? 0,
      labelAr: 'تقييمات بانتظار المراجعة',
      labelEn: 'Reviews awaiting moderation',
      to: '/admin/reviews',
      icon: Star,
      tone: 'rose',
    },
  ]), [stats]);

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-text">
            {greetingFor(now.getHours(), isAr)}{user?.name ? `، ${user.name}` : ''}
          </h1>
          <p className="mt-0.5 text-sm text-text-muted">{formatDate(now, isAr ? 'ar-EG' : 'en-GB')}</p>
        </div>
        <QuickActions isAr={isAr} />
      </div>

      {showRevenue && (stats?.todayRevenue > 0 || stats?.todayOrders > 0) && (
        <p className="text-sm text-text-muted">
          {isAr ? 'اليوم' : 'Today'}:{' '}
          <span className="font-semibold text-text">
            {formatPrice(stats.todayRevenue)}
          </span>
          {' · '}
          <span className="font-semibold text-text">{stats.todayOrders}</span>
          {isAr ? ' طلب' : ' orders'}
          {stats.todayRevenueChange !== undefined && stats.todayRevenueChange !== null && (
            <span className={stats.todayRevenueChange >= 0 ? 'text-green-600' : 'text-red-600'}>
              {' '}
              ({stats.todayRevenueChange >= 0 ? '↑' : '↓'}
              {Math.abs(stats.todayRevenueChange)}% {isAr ? 'عن أمس' : 'vs yesterday'})
            </span>
          )}
        </p>
      )}

      {!showRevenue && (stats?.todayOrders > 0) && (
        <p className="text-sm text-text-muted">
          {isAr ? 'اليوم' : 'Today'}:{' '}
          <span className="font-semibold text-text">{stats.todayOrders}</span>
          {isAr ? ' طلب' : ' orders'}
        </p>
      )}

      <NeedsAttentionGrid items={attentionItems} isAr={isAr} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {showRevenue && (
          <KpiPeriodCard
            title={isAr ? 'إيرادات (7 أيام)' : 'Revenue (7d)'}
            value={formatPrice(stats?.revenue7d || 0)}
            changePercent={stats?.revenue7dChange}
            isAr={isAr}
            icon={TrendingUp}
            accent="emerald"
          />
        )}
        <KpiPeriodCard
          title={isAr ? 'طلبات (7 أيام)' : 'Orders (7d)'}
          value={stats?.orders7d ?? 0}
          changePercent={stats?.orders7dChange}
          isAr={isAr}
          icon={ShoppingCart}
          accent="primary"
        />
        {showRevenue ? (
          <KpiPeriodCard
            title={isAr ? 'متوسط الطلب' : 'Avg order'}
            value={formatPrice(stats?.avgOrder7d || 0)}
            changePercent={stats?.avgOrder7dChange}
            isAr={isAr}
            subtitle={isAr ? 'آخر 7 أيام' : 'Last 7 days'}
            icon={Receipt}
            accent="blue"
          />
        ) : (
          <KpiPeriodCard
            title={isAr ? 'مستخدمون جدد' : 'New users'}
            value={stats?.newUsers7d ?? 0}
            changePercent={stats?.newUsers7dChange}
            isAr={isAr}
            icon={UserPlus}
            accent="violet"
          />
        )}
        {showRevenue ? (
          <KpiPeriodCard
            title={isAr ? 'مستخدمون جدد' : 'New users'}
            value={stats?.newUsers7d ?? 0}
            changePercent={stats?.newUsers7dChange}
            isAr={isAr}
            icon={UserPlus}
            accent="violet"
          />
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {showRevenue && (
          <SalesTrendCard initialData={stats?.salesByDay} isAr={isAr} />
        )}

        <section className={`rounded-2xl border border-border bg-white p-6 shadow-sm ${showRevenue ? '' : 'lg:col-span-2'}`}>
          <div className="mb-4 flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary-600" />
            <h2 className="text-lg font-bold text-text">
              {isAr ? 'الطلبات حسب الحالة' : 'Orders by status'}
            </h2>
          </div>
          <OrdersStatusChart
            data={stats?.ordersByStatus}
            language={language}
            isAr={isAr}
          />
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <StockAlertsCard
          outOfStockProducts={stats?.outOfStockProducts}
          outOfStockCount={stats?.outOfStockCount}
          lowStockProducts={stats?.lowStockProducts}
          isAr={isAr}
        />

        <section className="rounded-2xl border border-border bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-text">
              {isAr ? 'أحدث الطلبات' : 'Recent orders'}
            </h2>
            <Link to="/admin/orders" className="text-sm font-medium text-primary-600 hover:underline">
              {isAr ? 'عرض الكل' : 'View all'}
            </Link>
          </div>
          {stats?.latestOrders?.length ? (
            <ul className="divide-y divide-border">
              {stats.latestOrders.map((order) => (
                <li key={order._id}>
                  <Link
                    to={`/admin/orders?order=${order._id}`}
                    className="-mx-2 flex items-center justify-between rounded-lg px-2 py-3 transition-colors hover:bg-slate-50"
                  >
                    <div>
                      <OrderNumberChip orderNumber={order.orderNumber} size="sm" short />
                      <p className="mt-1 text-xs text-text-muted">
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
            <EmptyState
              icon={ShoppingCart}
              title={isAr ? 'لا توجد طلبات' : 'No orders yet'}
              description={isAr ? 'ستظهر الطلبات الجديدة هنا' : 'New orders will show up here'}
              className="py-8"
            />
          )}
        </section>
      </div>
    </div>
  );
}
