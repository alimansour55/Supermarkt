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
import { Search, TrendingUp, AlertCircle, ShoppingCart } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { fetchSearchAnalytics } from '../../services/searchApi';
import { Link } from 'react-router-dom';
import TrendingSearchesAdmin from '../components/TrendingSearchesAdmin';
import { Skeleton } from '../components/Skeleton';
import { EmptyState } from '../components';

const PERIODS = [
  { value: '7', labelEn: '7 days', labelAr: '7 أيام' },
  { value: '30', labelEn: '30 days', labelAr: '30 يوماً' },
  { value: '90', labelEn: '90 days', labelAr: '90 يوماً' },
];

function StatCard({ icon: Icon, label, value, sub, color = 'text-primary-600' }) {
  return (
    <div className="rounded-2xl border border-border bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-text-muted">{label}</p>
          <p className="mt-1 text-2xl font-bold text-text">{value}</p>
          {sub && <p className="mt-1 text-xs text-text-muted">{sub}</p>}
        </div>
        <div className={`rounded-xl bg-slate-50 p-2.5 ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

export default function SearchAnalyticsPage() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const [period, setPeriod] = useState('30');
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchSearchAnalytics({ days: period, limit: 15 })
      .then(setAnalytics)
      .catch(() => setAnalytics(null))
      .finally(() => setLoading(false));
  }, [period]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    );
  }

  if (!analytics) {
    return (
      <EmptyState
        title={isAr ? 'تعذر تحميل تحليلات البحث' : 'Could not load search analytics'}
        description={isAr ? 'تحقق من الاتصال بالخادم' : 'Check your server connection'}
      />
    );
  }

  const { summary, topSearches, noResultSearches } = analytics;
  const chartData = topSearches.slice(0, 10).map((s) => ({
    name: s.query.length > 14 ? `${s.query.slice(0, 14)}…` : s.query,
    searches: s.count,
    conversions: s.conversions,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-white px-5 py-4">
        <p className="text-sm text-text-muted">
          {isAr
            ? 'لإدارة «الأكثر بحثاً» التي يراها العملاء في شريط البحث، استخدم صفحة الإعدادات المخصصة.'
            : 'Manage customer-facing “Trending” chips in the dedicated settings page.'}
        </p>
        <Link
          to="/admin/trending-searches"
          className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
        >
          {isAr ? 'إدارة الأكثر بحثاً' : 'Manage trending searches'}
        </Link>
      </div>

      <TrendingSearchesAdmin topSearches={topSearches} compact />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-text-muted">
          {isAr ? 'تحليلات البحث والتحويل' : 'Search & conversion analytics'}
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Search}
          label={isAr ? 'إجمالي عمليات البحث' : 'Total searches'}
          value={summary.totalSearches.toLocaleString()}
        />
        <StatCard
          icon={AlertCircle}
          label={isAr ? 'بحث بدون نتائج' : 'No-result searches'}
          value={summary.noResultCount.toLocaleString()}
          sub={`${summary.noResultRate}% ${isAr ? 'من الإجمالي' : 'of total'}`}
          color="text-amber-600"
        />
        <StatCard
          icon={ShoppingCart}
          label={isAr ? 'تحويلات' : 'Conversions'}
          value={summary.conversions.toLocaleString()}
          sub={`${summary.conversionRate}% ${isAr ? 'معدل التحويل' : 'conversion rate'}`}
          color="text-green-600"
        />
        <StatCard
          icon={TrendingUp}
          label={isAr ? 'استعلامات فريدة' : 'Unique queries'}
          value={topSearches.length}
          sub={isAr ? 'في أفضل النتائج' : 'in top list'}
          color="text-indigo-600"
        />
      </div>

      {chartData.length > 0 && (
        <div className="rounded-2xl border border-border bg-white p-5">
          <h2 className="mb-4 font-bold text-text">
            {isAr ? 'أكثر عمليات البحث' : 'Top searches'}
          </h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="searches" fill="#2563eb" name={isAr ? 'عمليات البحث' : 'Searches'} radius={[4, 4, 0, 0]} />
                <Bar dataKey="conversions" fill="#16a34a" name={isAr ? 'تحويلات' : 'Conversions'} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-white p-5">
          <h2 className="mb-4 font-bold text-text">
            {isAr ? 'أكثر عمليات البحث' : 'Top searches'}
          </h2>
          {topSearches.length === 0 ? (
            <p className="text-sm text-text-muted">{isAr ? 'لا توجد بيانات بعد' : 'No data yet'}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-start text-text-muted">
                    <th className="pb-2 font-medium">{isAr ? 'الاستعلام' : 'Query'}</th>
                    <th className="pb-2 font-medium">{isAr ? 'العدد' : 'Count'}</th>
                    <th className="pb-2 font-medium">{isAr ? 'تحويل' : 'Conv.'}</th>
                    <th className="pb-2 font-medium">{isAr ? 'معدل' : 'Rate'}</th>
                  </tr>
                </thead>
                <tbody>
                  {topSearches.map((s) => (
                    <tr key={s.query} className="border-b border-border/60 last:border-0">
                      <td className="py-2.5 font-medium">{s.query}</td>
                      <td className="py-2.5">{s.count}</td>
                      <td className="py-2.5">{s.conversions}</td>
                      <td className="py-2.5 text-text-muted">{s.conversionRate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-white p-5">
          <h2 className="mb-4 font-bold text-text">
            {isAr ? 'بحث بدون نتائج' : 'No-result searches'}
          </h2>
          {noResultSearches.length === 0 ? (
            <p className="text-sm text-text-muted">
              {isAr ? 'لا توجد استعلامات بدون نتائج' : 'No zero-result queries'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-start text-text-muted">
                    <th className="pb-2 font-medium">{isAr ? 'الاستعلام' : 'Query'}</th>
                    <th className="pb-2 font-medium">{isAr ? 'مرات' : 'Times'}</th>
                  </tr>
                </thead>
                <tbody>
                  {noResultSearches.map((s) => (
                    <tr key={s.query} className="border-b border-border/60 last:border-0">
                      <td className="py-2.5 font-medium text-amber-800">{s.query}</td>
                      <td className="py-2.5">{s.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
