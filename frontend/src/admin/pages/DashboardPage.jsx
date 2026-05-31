import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingCart, PackageOpen, TrendingUp } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { adminApi } from '../adminApi';
import { useAdminStats } from '../context/AdminStatsContext';
import StatusBadge from '../components/StatusBadge';
import KpiPeriodCard from '../components/dashboard/KpiPeriodCard';
import SalesLineChart from '../components/dashboard/SalesLineChart';
import OrdersStatusChart from '../components/dashboard/OrdersStatusChart';
import { formatPrice } from '../../utils/formatters';
import { EmptyState } from '../components';
import { Skeleton } from '../components/Skeleton';

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
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

export default function DashboardPage() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const { refreshStats } = useAdminStats();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-6">
      {(stats?.todayRevenue > 0 || stats?.todayOrders > 0) && (
        <p className="text-sm text-text-muted">
          {isAr ? 'اليوم' : 'Today'}:{' '}
          <span className="font-semibold text-text">
            {formatPrice(stats.todayRevenue)}
          </span>
          {' · '}
          <span className="font-semibold text-text">{stats.todayOrders}</span>
          {isAr ? ' طلب' : ' orders'}
          {stats.todayRevenueChange !== undefined && (
            <span className={stats.todayRevenueChange >= 0 ? 'text-green-600' : 'text-red-600'}>
              {' '}
              ({stats.todayRevenueChange >= 0 ? '↑' : '↓'}
              {Math.abs(stats.todayRevenueChange)}% {isAr ? 'عن أمس' : 'vs yesterday'})
            </span>
          )}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiPeriodCard
          title={isAr ? 'إيرادات (7 أيام)' : 'Revenue (7d)'}
          value={formatPrice(stats?.revenue7d || 0)}
          changePercent={stats?.revenue7dChange ?? 0}
          isAr={isAr}
        />
        <KpiPeriodCard
          title={isAr ? 'طلبات (7 أيام)' : 'Orders (7d)'}
          value={stats?.orders7d ?? 0}
          changePercent={stats?.orders7dChange ?? 0}
          isAr={isAr}
        />
        <KpiPeriodCard
          title={isAr ? 'متوسط الطلب' : 'Avg order'}
          value={formatPrice(stats?.avgOrder7d || 0)}
          changePercent={stats?.avgOrder7dChange ?? 0}
          isAr={isAr}
          subtitle={isAr ? 'آخر 7 أيام' : 'Last 7 days'}
        />
        <KpiPeriodCard
          title={isAr ? 'مستخدمون جدد' : 'New users'}
          value={stats?.newUsers7d ?? 0}
          changePercent={stats?.newUsers7dChange ?? 0}
          isAr={isAr}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary-600" />
            <h2 className="text-lg font-bold text-text">
              {isAr ? 'المبيعات (30 يوم)' : 'Sales (30 days)'}
            </h2>
          </div>
          <SalesLineChart data={stats?.salesByDay} isAr={isAr} />
        </section>

        <section className="rounded-2xl border border-border bg-white p-6 shadow-sm">
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
        <section className="rounded-2xl border border-border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-text">
            {isAr ? 'مخزون منخفض' : 'Low stock'}
          </h2>
          {stats?.lowStockProducts?.length ? (
            <ul className="divide-y divide-border">
              {stats.lowStockProducts.map((p) => (
                <li key={p._id}>
                  <Link
                    to={`/admin/products/${p._id}/edit`}
                    className="flex items-center justify-between py-3 transition-colors hover:bg-slate-50 -mx-2 px-2 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{p.emoji || '📦'}</span>
                      <div>
                        <p className="font-medium text-primary-700 hover:underline">
                          {isAr ? p.nameAr : p.nameEn}
                        </p>
                        <p className="text-xs text-text-muted">{formatPrice(p.price)}</p>
                      </div>
                    </div>
                    <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-700">
                      {p.stock}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={PackageOpen}
              title={isAr ? 'لا يوجد مخزون منخفض' : 'All stocked up'}
              description={isAr ? 'جميع المنتجات بمستوى مخزون كافٍ' : 'All products have sufficient stock'}
              className="py-8"
            />
          )}
        </section>

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
                    className="flex items-center justify-between py-3 transition-colors hover:bg-slate-50 -mx-2 px-2 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-primary-700">{order.orderNumber}</p>
                      <p className="text-xs text-text-muted">
                        {order.user?.name || order.user?.email} · {formatPrice(order.total)}
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
