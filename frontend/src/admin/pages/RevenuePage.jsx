import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  Banknote,
  Package,
  RefreshCw,
  ShoppingBag,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { adminApi } from '../adminApi';
import { useAdminPanel } from '../context/AdminPanelContext';
import { formatPrice } from '../../utils/formatters';
import RevenueTrendChart from '../components/dashboard/RevenueTrendChart';
import PaymentMixChart from '../components/dashboard/PaymentMixChart';
import { EmptyState } from '../components';
import { Skeleton } from '../components/Skeleton';

const PERIODS = [
  { value: 'today', labelEn: 'Today', labelAr: 'اليوم' },
  { value: '7d', labelEn: '7 days', labelAr: '7 أيام' },
  { value: '30d', labelEn: '30 days', labelAr: '30 يوماً' },
  { value: '90d', labelEn: '90 days', labelAr: '90 يوماً' },
  { value: 'mtd', labelEn: 'This month', labelAr: 'هذا الشهر' },
  { value: '1y', labelEn: '1 year', labelAr: 'سنة' },
  { value: '3y', labelEn: '3 years', labelAr: '3 سنوات' },
  { value: '5y', labelEn: '5 years', labelAr: '5 سنوات' },
  { value: '10y', labelEn: '10 years', labelAr: '10 سنوات' },
  { value: 'custom', labelEn: 'Custom', labelAr: 'مخصص' },
];

function formatRange(startKey, endKey, isAr) {
  if (!startKey || !endKey) return '';
  const start = new Date(`${startKey}T12:00:00`);
  const end = new Date(`${endKey}T12:00:00`);
  const opts = { day: 'numeric', month: 'short', year: 'numeric' };
  const locale = isAr ? 'ar-EG' : 'en-GB';
  if (startKey === endKey) {
    return start.toLocaleDateString(locale, opts);
  }
  return `${start.toLocaleDateString(locale, opts)} — ${end.toLocaleDateString(locale, opts)}`;
}

function toDateKey(date) {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function addDays(dateKey, days) {
  const [y, m, d] = String(dateKey).split('-').map(Number);
  const utc = Date.UTC(y, m - 1, d + days);
  return toDateKey(new Date(utc));
}

function addYears(dateKey, years) {
  const [y, m, d] = String(dateKey).split('-').map(Number);
  const utc = Date.UTC(y + years, m - 1, d);
  return toDateKey(new Date(utc));
}

const GROUP_BY_OPTIONS = [
  { value: 'none', labelEn: 'No breakdown', labelAr: 'بدون تقسيم' },
  { value: 'paymentMethod', labelEn: 'Payment method', labelAr: 'طريقة الدفع' },
  { value: 'orderStatus', labelEn: 'Order status', labelAr: 'حالة الطلب' },
  { value: 'category', labelEn: 'Category', labelAr: 'القسم' },
  { value: 'product', labelEn: 'Product', labelAr: 'المنتج' },
  { value: 'deliveryZone', labelEn: 'Delivery zone', labelAr: 'منطقة التوصيل' },
];

const SERIES_GROUP_OPTIONS = [
  { value: 'none', labelEn: 'Total only', labelAr: 'الإجمالي فقط' },
  { value: 'category', labelEn: 'By section (top 8)', labelAr: 'حسب القسم (أعلى 8)' },
  { value: 'product', labelEn: 'By product (top 8)', labelAr: 'حسب المنتج (أعلى 8)' },
];

function ChangePill({ value, isAr, compact = false }) {
  if (value == null || Number.isNaN(value)) return null;
  const positive = value >= 0;
  const Icon = positive ? TrendingUp : TrendingDown;

  return (
    <span
      className={[
        'inline-flex items-center gap-1 font-semibold',
        compact ? 'text-xs' : 'text-sm',
        positive ? 'text-emerald-700' : 'text-red-600',
      ].join(' ')}
    >
      <Icon className="h-3.5 w-3.5" />
      {positive ? '+' : ''}{value}%
      {!compact && (
        <span className="font-normal text-text-muted">
          {isAr ? 'مقارنة بالفترة السابقة' : 'vs previous period'}
        </span>
      )}
    </span>
  );
}

function MetricCard({
  label,
  value,
  hint,
  change,
  icon: Icon,
  accent = 'bg-slate-50 text-slate-700',
  isAr,
  highlight = false,
}) {
  return (
    <div
      className={[
        'rounded-2xl border p-5 shadow-sm',
        highlight ? 'border-primary-200 bg-gradient-to-br from-primary-50 to-white' : 'border-border bg-white',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-text-muted">{label}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-text">{value}</p>
          {hint && <p className="mt-1 text-xs text-text-muted">{hint}</p>}
          {change != null && (
            <div className="mt-2">
              <ChangePill value={change} isAr={isAr} compact />
            </div>
          )}
        </div>
        <div className={`shrink-0 rounded-2xl p-3 ${accent}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value, sub, isAr, change }) {
  return (
    <div className="rounded-xl border border-border bg-white px-4 py-3 shadow-sm">
      <p className="text-xs font-medium text-text-muted">{label}</p>
      <p className="mt-1 text-lg font-bold text-text">{value}</p>
      {sub && <p className="text-xs text-text-muted">{sub}</p>}
      {change != null && (
        <div className="mt-1">
          <ChangePill value={change} isAr={isAr} compact />
        </div>
      )}
    </div>
  );
}

function ProfitBreakdown({ summary, isAr }) {
  const itemRevenue = summary.itemRevenue || 0;
  const cost = summary.costOfGoods || 0;
  const profit = summary.grossProfit || 0;
  const max = Math.max(itemRevenue, 1);

  const rows = [
    {
      label: isAr ? 'مبيعات المنتجات' : 'Product sales',
      value: itemRevenue,
      color: 'bg-primary-600',
    },
    {
      label: isAr ? 'تكلفة البضاعة' : 'Cost of goods',
      value: cost,
      color: 'bg-amber-500',
    },
    {
      label: isAr ? 'الربح الإجمالي' : 'Gross profit',
      value: profit,
      color: 'bg-emerald-600',
    },
  ];

  return (
    <div className="space-y-4">
      {rows.map((row) => (
        <div key={row.label}>
          <div className="mb-1.5 flex items-center justify-between text-sm">
            <span className="font-medium text-text">{row.label}</span>
            <span className="font-bold">{formatPrice(row.value)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full ${row.color}`}
              style={{ width: `${Math.min((row.value / max) * 100, 100)}%` }}
            />
          </div>
        </div>
      ))}
      <p className="text-xs text-text-muted">
        {isAr
          ? `هامش الربح ${summary.grossMarginPercent ?? 0}% على مبيعات المنتجات (بدون رسوم التوصيل).`
          : `${summary.grossMarginPercent ?? 0}% gross margin on product sales (excludes delivery fees).`}
      </p>
    </div>
  );
}

export default function RevenuePage() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const { showRevenue, loading: panelLoading } = useAdminPanel();
  const [period, setPeriod] = useState('30d');
  const [rangeStart, setRangeStart] = useState(() => addDays(toDateKey(new Date()), -29));
  const [rangeEnd, setRangeEnd] = useState(() => toDateKey(new Date()));
  const [interval, setInterval] = useState('auto');
  const [groupBy, setGroupBy] = useState('none');
  const [seriesGroupBy, setSeriesGroupBy] = useState('category');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [sort, setSort] = useState('revenue');
  const [dir, setDir] = useState('desc');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedProductLabel, setSelectedProductLabel] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const resolvedQuery = useMemo(() => {
    const todayKey = toDateKey(new Date());

    // Always send explicit date range (professional analytics UX).
    if (period === 'today') return { start: todayKey, end: todayKey };
    if (period === '7d') return { start: addDays(todayKey, -6), end: todayKey };
    if (period === '30d') return { start: addDays(todayKey, -29), end: todayKey };
    if (period === '90d') return { start: addDays(todayKey, -89), end: todayKey };
    if (period === 'mtd') {
      const [y, m] = todayKey.split('-');
      return { start: `${y}-${m}-01`, end: todayKey };
    }

    if (period === '1y') {
      const start = addYears(todayKey, -1);
      return { start, end: todayKey };
    }
    if (period === '3y') {
      const start = addYears(todayKey, -3);
      return { start, end: todayKey };
    }
    if (period === '5y') {
      const start = addYears(todayKey, -5);
      return { start, end: todayKey };
    }
    if (period === '10y') {
      const start = addYears(todayKey, -10);
      return { start, end: todayKey };
    }

    // Manual date range (between any two dates).
    return {
      start: rangeStart || todayKey,
      end: rangeEnd || todayKey,
    };
  }, [period, rangeStart, rangeEnd]);

  const loadData = useCallback(async (showRefresh = false) => {
    if (!showRevenue) {
      setLoading(false);
      return;
    }
    if (showRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const { data: res } = await adminApi.getRevenueAnalytics({
        ...resolvedQuery,
        interval,
        groupBy,
        q,
        page,
        limit,
        sort,
        dir,
        seriesGroupBy,
        seriesLimit: 8,
        productId: selectedProductId || undefined,
      });
      setData(res.data);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [resolvedQuery, interval, groupBy, q, page, limit, sort, dir, seriesGroupBy, selectedProductId, showRevenue]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const summary = data?.summary || {};
  const hasSales = (summary.revenue || 0) > 0 || (summary.orders || 0) > 0;

  const breakdownRows = data?.breakdown?.rows || [];
  const pageInfo = data?.breakdown?.pageInfo || null;
  const productDetail = data?.productDetail || null;

  const periodLabel = PERIODS.find((p) => p.value === period);
  const rangeLabel = formatRange(data?.range?.startKey, data?.range?.endKey, isAr);

  if (panelLoading || loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-full max-w-xl rounded-2xl" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
        </div>
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }

  if (!showRevenue) {
    return (
      <EmptyState
        title={isAr ? 'الإيرادات مخفية' : 'Revenue is hidden'}
        description={isAr
          ? 'فعّل «عرض الإيرادات في لوحة التحكم» من إعدادات لوحة التحكم.'
          : 'Enable “Show revenue in admin panel” in Admin panel settings.'}
        action={(
          <Link to="/admin/settings/admin" className="font-semibold text-primary-600 hover:underline">
            {isAr ? 'إعدادات لوحة التحكم' : 'Admin panel settings'}
          </Link>
        )}
      />
    );
  }

  if (!data) {
    return (
      <EmptyState
        title={isAr ? 'تعذر تحميل الإيرادات' : 'Could not load revenue'}
        description={isAr ? 'تحقق من الاتصال بالخادم ثم أعد المحاولة.' : 'Check your server connection and try again.'}
        action={(
          <button
            type="button"
            onClick={() => loadData()}
            className="inline-flex items-center gap-2 font-semibold text-primary-600 hover:underline"
          >
            <RefreshCw className="h-4 w-4" />
            {isAr ? 'إعادة المحاولة' : 'Retry'}
          </button>
        )}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">{isAr ? 'الإيرادات' : 'Revenue'}</h1>
          <p className="mt-1 text-sm text-text-muted">
            {rangeLabel}
            {summary.orders > 0 && (
              <> · {summary.orders} {isAr ? 'طلب في الفترة' : 'orders in period'}</>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPeriod(p.value)}
              className={[
                'rounded-xl px-3.5 py-2 text-sm font-semibold transition-all',
                period === p.value
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'border border-border bg-white text-text-muted hover:bg-slate-50',
              ].join(' ')}
            >
              {isAr ? p.labelAr : p.labelEn}
            </button>
          ))}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2">
              <span className="text-xs font-semibold text-text-muted">{isAr ? 'من' : 'From'}</span>
              <input
                type="date"
                value={rangeStart}
                max={rangeEnd || undefined}
                onChange={(e) => {
                  setPeriod('custom');
                  setRangeStart(e.target.value);
                }}
                className="bg-transparent text-sm font-semibold text-text outline-none"
              />
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2">
              <span className="text-xs font-semibold text-text-muted">{isAr ? 'إلى' : 'To'}</span>
              <input
                type="date"
                value={rangeEnd}
                min={rangeStart || undefined}
                onChange={(e) => {
                  setPeriod('custom');
                  setRangeEnd(e.target.value);
                }}
                className="bg-transparent text-sm font-semibold text-text outline-none"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-border bg-white px-3.5 py-2">
            <span className="text-xs font-semibold text-text-muted">{isAr ? 'تقسيم' : 'Breakdown'}</span>
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value)}
              className="bg-transparent text-sm font-semibold text-text outline-none"
            >
              {GROUP_BY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {isAr ? opt.labelAr : opt.labelEn}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-border bg-white px-3.5 py-2">
            <span className="text-xs font-semibold text-text-muted">{isAr ? 'الاتجاه' : 'Trend'}</span>
            <select
              value={seriesGroupBy}
              onChange={(e) => setSeriesGroupBy(e.target.value)}
              className="bg-transparent text-sm font-semibold text-text outline-none"
            >
              {SERIES_GROUP_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {isAr ? opt.labelAr : opt.labelEn}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-border bg-white px-3.5 py-2">
            <span className="text-xs font-semibold text-text-muted">{isAr ? 'الفاصل' : 'Interval'}</span>
            <select
              value={interval}
              onChange={(e) => setInterval(e.target.value)}
              className="bg-transparent text-sm font-semibold text-text outline-none"
            >
              <option value="auto">{isAr ? 'تلقائي' : 'Auto'}</option>
              <option value="day">{isAr ? 'يومي' : 'Daily'}</option>
              <option value="week">{isAr ? 'أسبوعي' : 'Weekly'}</option>
              <option value="month">{isAr ? 'شهري' : 'Monthly'}</option>
              <option value="year">{isAr ? 'سنوي' : 'Yearly'}</option>
            </select>
          </div>
          <button
            type="button"
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-3.5 py-2 text-sm font-semibold text-text hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            {isAr ? 'تحديث' : 'Refresh'}
          </button>
          <Link
            to="/admin/reports"
            className="inline-flex items-center gap-1.5 rounded-xl border border-primary-200 bg-primary-50 px-3.5 py-2 text-sm font-semibold text-primary-700 hover:bg-primary-100"
          >
            {isAr ? 'تقرير مفصل' : 'Full report'}
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* Primary KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          isAr={isAr}
          highlight
          icon={Wallet}
          label={isAr ? `إيرادات ${periodLabel?.labelAr || ''}` : `${periodLabel?.labelEn || 'Period'} revenue`}
          value={formatPrice(summary.revenue)}
          hint={isAr ? 'إجمالي قيمة الطلبات (بدون الملغي والمرتجع)' : 'Order totals excluding cancelled & returned'}
          change={summary.revenueChangePercent}
          accent="bg-primary-100 text-primary-700"
        />
        <MetricCard
          isAr={isAr}
          icon={ShoppingBag}
          label={isAr ? 'عدد الطلبات' : 'Orders'}
          value={String(summary.orders || 0)}
          hint={`${formatPrice(summary.avgOrderValue)} ${isAr ? 'متوسط الطلب' : 'avg. order'}`}
          change={summary.ordersChangePercent}
          accent="bg-indigo-50 text-indigo-700"
        />
        <MetricCard
          isAr={isAr}
          icon={TrendingUp}
          label={isAr ? 'الربح الإجمالي' : 'Gross profit'}
          value={formatPrice(summary.grossProfit)}
          hint={`${summary.grossMarginPercent ?? 0}% ${isAr ? 'هامش ربح' : 'margin'}`}
          accent="bg-emerald-50 text-emerald-700"
        />
        <MetricCard
          isAr={isAr}
          icon={Banknote}
          label={isAr ? 'متوسط الطلب' : 'Avg order'}
          value={formatPrice(summary.avgOrderValue)}
          hint={isAr ? 'متوسط قيمة الطلب خلال الفترة' : 'Average order value in range'}
          accent="bg-green-50 text-green-700"
        />
      </div>

      {/* Charts */}
      <div className="grid gap-6 xl:grid-cols-5">
        <section className="rounded-2xl border border-border bg-white p-6 shadow-sm xl:col-span-3">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-text">
                {isAr ? 'اتجاه الإيرادات' : 'Revenue trend'}
              </h2>
              <p className="text-sm text-text-muted">
                {isAr ? 'المبيعات اليومية خلال الفترة المحددة' : 'Daily sales for the selected period'}
              </p>
            </div>
          </div>
          {hasSales ? (
            <RevenueTrendChart
              data={data.series}
              seriesByDimension={data.seriesByDimension}
              isAr={isAr}
              interval={data.interval}
            />
          ) : (
            <EmptyState
              title={isAr ? 'لا توجد مبيعات بعد' : 'No sales yet'}
              description={isAr
                ? 'ستظهر الإيرادات هنا بعد استلام أول طلب.'
                : 'Revenue will appear here after your first order.'}
            />
          )}
        </section>

        <section className="rounded-2xl border border-border bg-white p-6 shadow-sm xl:col-span-2">
          <h2 className="text-lg font-bold text-text">
            {isAr ? 'التقسيم' : 'Breakdown'}
          </h2>
          <p className="mb-4 text-sm text-text-muted">
            {isAr ? 'توزيع الإيرادات حسب الفلتر المحدد' : 'Revenue split by selected breakdown'}
          </p>
          {breakdownRows.length ? (
            <PaymentMixChart data={breakdownRows.map((r) => ({
              method: r.key,
              labelAr: r.labelAr,
              labelEn: r.labelEn,
              revenue: r.revenue,
              orders: r.orders,
              sharePercent: r.sharePercent,
            }))} isAr={isAr} />
          ) : (
            <EmptyState title={isAr ? 'لا توجد بيانات' : 'No data'} />
          )}
        </section>
      </div>

      {/* Profit + breakdown table */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-white p-6 shadow-sm">
          <h2 className="mb-1 text-lg font-bold text-text">
            {isAr ? 'تحليل الربح' : 'Profit breakdown'}
          </h2>
          <p className="mb-5 text-sm text-text-muted">
            {isAr ? 'مبيعات المنتجات مقابل تكلفة الجملة' : 'Product sales vs wholesale cost'}
          </p>
          <ProfitBreakdown summary={summary} isAr={isAr} />
        </section>

        <section className="rounded-2xl border border-border bg-white p-6 shadow-sm">
          <h2 className="mb-1 text-lg font-bold text-text">
            {isAr ? 'تفاصيل التقسيم' : 'Breakdown details'}
          </h2>
          <p className="mb-4 text-sm text-text-muted">
            {isAr ? 'أعلى النتائج حسب الفلتر' : 'Top results for selected breakdown'}
          </p>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2">
              <span className="text-xs font-semibold text-text-muted">{isAr ? 'بحث' : 'Search'}</span>
              <input
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
                placeholder={isAr ? 'اسم / SKU' : 'Name / SKU'}
                className="w-44 bg-transparent text-sm font-semibold text-text outline-none"
              />
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2">
              <span className="text-xs font-semibold text-text-muted">{isAr ? 'ترتيب' : 'Sort'}</span>
              <select
                value={sort}
                onChange={(e) => {
                  setSort(e.target.value);
                  setPage(1);
                }}
                className="bg-transparent text-sm font-semibold text-text outline-none"
              >
                <option value="revenue">{isAr ? 'الإيراد' : 'Revenue'}</option>
                <option value="orders">{isAr ? 'الطلبات' : 'Orders'}</option>
                <option value="unitsSold">{isAr ? 'الوحدات' : 'Units'}</option>
                <option value="profit">{isAr ? 'الربح' : 'Profit'}</option>
              </select>
              <select
                value={dir}
                onChange={(e) => {
                  setDir(e.target.value);
                  setPage(1);
                }}
                className="bg-transparent text-sm font-semibold text-text outline-none"
              >
                <option value="desc">{isAr ? 'تنازلي' : 'Desc'}</option>
                <option value="asc">{isAr ? 'تصاعدي' : 'Asc'}</option>
              </select>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2">
              <span className="text-xs font-semibold text-text-muted">{isAr ? 'عدد' : 'Rows'}</span>
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                className="bg-transparent text-sm font-semibold text-text outline-none"
              >
                {[10, 25, 50, 100, 200].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>
          {breakdownRows.length ? (
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-border text-text-muted">
                    <th className="px-2 py-2 text-start font-semibold">{isAr ? 'العنصر' : 'Item'}</th>
                    <th className="px-2 py-2 text-end font-semibold">{isAr ? 'الإيراد' : 'Revenue'}</th>
                    <th className="px-2 py-2 text-end font-semibold">{isAr ? 'الطلبات' : 'Orders'}</th>
                    <th className="px-2 py-2 text-end font-semibold">{isAr ? 'الحصة' : 'Share'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {breakdownRows.map((row) => (
                    <tr
                      key={row.key}
                      className={[
                        'hover:bg-slate-50',
                        groupBy === 'product' ? 'cursor-pointer' : '',
                        selectedProductId && row.key === selectedProductId ? 'bg-primary-50/70' : '',
                      ].join(' ')}
                      onClick={() => {
                        if (groupBy !== 'product') return;
                        setSelectedProductId(row.key);
                        setSelectedProductLabel(isAr ? row.labelAr : row.labelEn);
                      }}
                    >
                      <td className="px-2 py-2 font-semibold text-text">
                        {isAr ? row.labelAr : row.labelEn}
                      </td>
                      <td className="px-2 py-2 text-end font-bold">{formatPrice(row.revenue)}</td>
                      <td className="px-2 py-2 text-end text-text-muted">{row.orders || 0}</td>
                      <td className="px-2 py-2 text-end text-text-muted">{row.sharePercent || 0}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title={isAr ? 'اختر تقسيم لعرض التفاصيل' : 'Choose a breakdown to see details'} />
          )}
          {pageInfo && pageInfo.pages > 1 && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="text-text-muted">
                {isAr ? 'صفحة' : 'Page'} {pageInfo.page} {isAr ? 'من' : 'of'} {pageInfo.pages} — {pageInfo.total} {isAr ? 'صف' : 'rows'}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded-xl border border-border bg-white px-3 py-1.5 font-semibold disabled:opacity-50"
                >
                  {isAr ? 'السابق' : 'Prev'}
                </button>
                <button
                  type="button"
                  disabled={page >= pageInfo.pages}
                  onClick={() => setPage((p) => Math.min(pageInfo.pages, p + 1))}
                  className="rounded-xl border border-border bg-white px-3 py-1.5 font-semibold disabled:opacity-50"
                >
                  {isAr ? 'التالي' : 'Next'}
                </button>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Selected product detail */}
      {selectedProductId && (
        <section className="rounded-2xl border border-border bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <h2 className="truncate text-lg font-bold text-text">
                {isAr ? 'تفاصيل المنتج' : 'Product details'}: {selectedProductLabel || selectedProductId}
              </h2>
              <p className="mt-1 text-sm text-text-muted">
                {isAr ? 'انقر على أي منتج من الجدول لعرض الاتجاه بالتفصيل.' : 'Click any product row to see its detailed trend.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedProductId('');
                setSelectedProductLabel('');
              }}
              className="rounded-xl border border-border bg-white px-3.5 py-2 text-sm font-semibold text-text hover:bg-slate-50"
            >
              {isAr ? 'إغلاق' : 'Close'}
            </button>
          </div>

          {productDetail ? (
            <div className="mt-5 grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-1">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                  <MiniStat isAr={isAr} label={isAr ? 'إيراد المنتج' : 'Product revenue'} value={formatPrice(productDetail.totals.revenue)} />
                  <MiniStat isAr={isAr} label={isAr ? 'الوحدات' : 'Units sold'} value={String(productDetail.totals.unitsSold || 0)} />
                  <MiniStat isAr={isAr} label={isAr ? 'الطلبات' : 'Orders'} value={String(productDetail.totals.orders || 0)} />
                  <MiniStat isAr={isAr} label={isAr ? 'الربح' : 'Profit'} value={formatPrice(productDetail.totals.profit)} sub={`${productDetail.totals.marginPercent || 0}% ${isAr ? 'هامش' : 'margin'}`} />
                </div>
              </div>
              <div className="lg:col-span-2">
                <RevenueTrendChart
                  data={productDetail.series.map((p) => ({
                    bucket: p.bucket,
                    revenue: p.revenue,
                    orders: p.orders,
                  }))}
                  isAr={isAr}
                  interval={data.interval}
                />
              </div>
            </div>
          ) : (
            <div className="mt-5">
              <Skeleton className="h-80 rounded-2xl" />
            </div>
          )}
        </section>
      )}

      {/* Products + recent orders */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-text">
            {isAr ? 'أعلى المنتجات إيراداً' : 'Top products'}
          </h2>
          {data.breakdown?.dimension === 'product' && breakdownRows.length ? (
            <ul className="divide-y divide-border">
              {breakdownRows.slice(0, 8).map((product, index) => (
                <li key={product.key || index} className="flex items-center justify-between gap-3 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700">
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {isAr ? product.labelAr : product.labelEn}
                      </p>
                      <p className="text-xs text-text-muted">
                        {product.unitsSold || 0} {isAr ? 'وحدة' : 'units'}
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0 text-end">
                    <p className="text-sm font-bold text-text">{formatPrice(product.revenue)}</p>
                    <p className="text-xs font-semibold text-emerald-700">
                      {isAr ? 'ربح' : 'Profit'} {formatPrice(product.profit ?? 0)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title={isAr ? 'لا توجد بيانات' : 'No data'} icon={Package} />
          )}
        </section>

        <section className="rounded-2xl border border-border bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-text">
              {isAr ? 'أحدث الطلبات' : 'Recent orders'}
            </h2>
            <Link to="/admin/orders" className="text-sm font-semibold text-primary-600 hover:underline">
              {isAr ? 'كل الطلبات' : 'All orders'}
            </Link>
          </div>
          <EmptyState
            title={isAr ? 'انتقل إلى الطلبات' : 'Go to orders'}
            description={isAr ? 'تفاصيل أحدث الطلبات موجودة في صفحة الطلبات.' : 'Recent order details are available on the Orders page.'}
          />
        </section>
      </div>

    </div>
  );
}
