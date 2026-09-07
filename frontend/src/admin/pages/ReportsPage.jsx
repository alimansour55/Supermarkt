import { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useLanguage } from '../../context/LanguageContext';
import { adminApi } from '../adminApi';
import { useAdminPanel } from '../context/AdminPanelContext';
import { formatPrice } from '../../utils/formatters';
import { EmptyState } from '../components';
import { Skeleton } from '../components/Skeleton';

const PERIODS = [
  { value: '7', labelEn: '7 days', labelAr: '7 أيام' },
  { value: '30', labelEn: '30 days', labelAr: '30 يوماً' },
  { value: '90', labelEn: '90 days', labelAr: '90 يوماً' },
];

export default function ReportsPage() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const { showRevenue, loading: panelLoading } = useAdminPanel();
  const [period, setPeriod] = useState('30');
  const [reports, setReports] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!showRevenue) {
      setLoading(false);
      return;
    }
    setLoading(true);
    adminApi.getReports({ period: `${period}d` })
      .then(({ data }) => setReports(data.reports))
      .catch(() => setReports(null))
      .finally(() => setLoading(false));
  }, [period, showRevenue]);

  if (panelLoading || loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    );
  }

  if (!showRevenue) {
    return (
      <EmptyState
        title={isAr ? 'الإيرادات مخفية' : 'Revenue is hidden'}
        description={isAr
          ? 'فعّل «عرض الإيرادات في لوحة التحكم» من إعدادات المتجر.'
          : 'Enable “Show revenue in admin panel” in Store settings.'}
      />
    );
  }

  if (!reports) {
    return (
      <EmptyState
        title={isAr ? 'تعذر تحميل التقارير' : 'Could not load reports'}
        description={isAr ? 'تحقق من الاتصال بالخادم' : 'Check your server connection'}
      />
    );
  }

  const summary = reports?.summary || {};
  const categoryData = (reports?.salesByCategory || []).map((c) => ({
    name: isAr ? c.nameAr : c.nameEn,
    revenue: c.revenue,
    units: c.unitsSold,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-text-muted">
          {isAr ? 'تحليلات المبيعات والكوبونات' : 'Sales & coupon analytics'}
        </p>
        <div className="flex gap-2">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPeriod(p.value)}
              className={[
                'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                period === p.value
                  ? 'bg-primary-600 text-white'
                  : 'border border-border bg-white text-text-muted hover:bg-slate-50',
              ].join(' ')}
            >
              {isAr ? p.labelAr : p.labelEn}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
          <p className="text-sm text-text-muted">{isAr ? 'إجمالي المبيعات' : 'Total revenue'}</p>
          <p className="mt-1 text-2xl font-bold text-primary-700">{formatPrice(summary.revenue)}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5 shadow-sm">
          <p className="text-sm text-text-muted">{isAr ? 'إجمالي الربح (المنفعة)' : 'Gross profit'}</p>
          <p className="mt-1 text-2xl font-bold text-emerald-700">{formatPrice(summary.grossProfit ?? 0)}</p>
          {summary.grossMarginPercent != null && (
            <p className="mt-0.5 text-xs text-emerald-800">
              {summary.grossMarginPercent}% {isAr ? 'هامش على مبيعات المنتجات' : 'margin on product sales'}
            </p>
          )}
        </div>
        <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
          <p className="text-sm text-text-muted">{isAr ? 'تكلفة البضاعة (جملة)' : 'Cost of goods'}</p>
          <p className="mt-1 text-2xl font-bold text-text">{formatPrice(summary.costOfGoods ?? 0)}</p>
        </div>
        <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
          <p className="text-sm text-text-muted">{isAr ? 'مبيعات المنتجات' : 'Product sales'}</p>
          <p className="mt-1 text-2xl font-bold text-text">{formatPrice(summary.itemRevenue ?? 0)}</p>
        </div>
        <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
          <p className="text-sm text-text-muted">{isAr ? 'الطلبات' : 'Orders'}</p>
          <p className="mt-1 text-2xl font-bold text-text">{summary.orders || 0}</p>
        </div>
        <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
          <p className="text-sm text-text-muted">{isAr ? 'متوسط الطلب' : 'Avg order value'}</p>
          <p className="mt-1 text-2xl font-bold text-text">{formatPrice(summary.avgOrderValue)}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-text">
            {isAr ? 'المبيعات حسب القسم' : 'Sales by category'}
          </h2>
          {categoryData.length ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryData} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                  <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => formatPrice(v)} />
                  <Bar dataKey="revenue" fill="#16a34a" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState title={isAr ? 'لا توجد بيانات' : 'No data'} />
          )}
        </section>

        <section className="rounded-2xl border border-border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-text">
            {isAr ? 'أكثر المنتجات مبيعاً' : 'Top products'}
          </h2>
          {reports?.topProducts?.length ? (
            <ul className="divide-y divide-border">
              {reports.topProducts.map((p, i) => (
                <li key={p.productId || i} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700">
                      {i + 1}
                    </span>
                    <span className="text-sm font-medium">{isAr ? p.nameAr : p.nameEn}</span>
                  </div>
                  <div className="text-end text-sm">
                    <p className="font-semibold">{p.unitsSold} {isAr ? 'وحدة' : 'units'}</p>
                    <p className="text-xs text-text-muted">{formatPrice(p.revenue)} {isAr ? 'مبيعات' : 'sales'}</p>
                    <p className="text-xs font-semibold text-emerald-700">
                      {isAr ? 'ربح:' : 'Profit:'} {formatPrice(p.profit ?? 0)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title={isAr ? 'لا توجد بيانات' : 'No data'} />
          )}
        </section>
      </div>

      <section className="rounded-2xl border border-border bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-bold text-text">
          {isAr ? 'استخدام الكوبونات' : 'Coupon usage'}
        </h2>
        {reports?.couponUsage?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-text-muted">
                <tr>
                  <th className="px-4 py-3 text-start">{isAr ? 'الكود' : 'Code'}</th>
                  <th className="px-4 py-3 text-start">{isAr ? 'الاستخدام الكلي' : 'Total uses'}</th>
                  <th className="px-4 py-3 text-start">{isAr ? 'في الفترة' : 'In period'}</th>
                  <th className="px-4 py-3 text-start">{isAr ? 'خصم الفترة' : 'Period discount'}</th>
                  <th className="px-4 py-3 text-start">{isAr ? 'الحالة' : 'Status'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {reports.couponUsage.map((c) => (
                  <tr key={c.code} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono font-medium">{c.code}</td>
                    <td className="px-4 py-3">{c.usedCount}{c.usageLimit ? ` / ${c.usageLimit}` : ''}</td>
                    <td className="px-4 py-3">{c.orderUsesInPeriod}</td>
                    <td className="px-4 py-3">{formatPrice(c.totalDiscountInPeriod)}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${c.isActive ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}`}>
                        {c.isActive ? (isAr ? 'نشط' : 'Active') : (isAr ? 'غير نشط' : 'Inactive')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title={isAr ? 'لا توجد كوبونات' : 'No coupons'} />
        )}
      </section>
    </div>
  );
}
