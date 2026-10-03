import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatPrice } from '../../../utils/formatters';

function formatBucketLabel(bucket, interval, isAr) {
  const locale = isAr ? 'ar-EG' : 'en-GB';
  if (interval === 'year') return bucket;
  if (interval === 'month') {
    const d = new Date(`${bucket}-01T12:00:00`);
    return d.toLocaleDateString(locale, { month: 'short', year: '2-digit' });
  }
  if (interval === 'week') return bucket;
  const d = new Date(`${bucket}T12:00:00`);
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
}

function formatTooltipLabel(bucket, interval, isAr) {
  const locale = isAr ? 'ar-EG' : 'en-GB';
  if (interval === 'year') return bucket;
  if (interval === 'month') {
    const d = new Date(`${bucket}-01T12:00:00`);
    return d.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  }
  if (interval === 'week') return bucket;
  const d = new Date(`${bucket}T12:00:00`);
  return d.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function ChartTooltip({ active, payload, isAr, interval, hasComparison }) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;

  return (
    <div className="rounded-xl border border-border bg-white px-4 py-3 text-sm shadow-lg">
      <p className="font-semibold text-text">{formatTooltipLabel(point.bucket, interval, isAr)}</p>
      <p className="mt-1 text-base font-bold text-primary-700">{formatPrice(point.revenue)}</p>
      <p className="mt-0.5 text-text-muted">
        {point.orders || 0} {isAr ? 'طلب' : 'orders'}
      </p>
      {hasComparison && point.previousRevenue != null && (
        <div className="mt-2 border-t border-border pt-2 text-xs">
          <span className="text-text-muted">{isAr ? 'الفترة السابقة: ' : 'Previous period: '}</span>
          <span className="font-semibold text-slate-600">{formatPrice(point.previousRevenue)}</span>
        </div>
      )}
    </div>
  );
}

function MultiSeriesTooltip({ active, payload, isAr, interval }) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;
  const items = payload
    .filter((p) => p && p.dataKey && typeof p.value === 'number')
    .sort((a, b) => (b.value || 0) - (a.value || 0))
    .slice(0, 8);

  const total = items.reduce((s, it) => s + (it.value || 0), 0);

  return (
    <div className="rounded-xl border border-border bg-white px-4 py-3 text-sm shadow-lg">
      <p className="font-semibold text-text">{formatTooltipLabel(point.bucket, interval, isAr)}</p>
      <p className="mt-1 text-base font-bold text-primary-700">{formatPrice(total)}</p>
      <div className="mt-2 space-y-1">
        {items.map((it) => (
          <div key={String(it.dataKey)} className="flex items-center justify-between gap-3 text-xs">
            <span className="truncate text-text-muted">{it.name}</span>
            <span className="font-semibold text-text">{formatPrice(it.value || 0)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function RevenueTrendChart({ data, seriesByDimension, previousData, isAr, interval = 'day' }) {
  const hasMulti = Boolean(seriesByDimension?.series?.length);
  const hasComparison = !hasMulti && Array.isArray(previousData) && previousData.length > 0;

  const chartData = hasMulti
    ? (seriesByDimension?.buckets || []).map((bucket) => {
      const row = { bucket, label: formatBucketLabel(bucket, interval, isAr) };
      (seriesByDimension.series || []).forEach((s) => {
        const point = (s.points || []).find((p) => p.bucket === bucket);
        row[s.key] = point?.revenue || 0;
      });
      return row;
    })
    : (data?.map((row, i) => ({
      ...row,
      label: formatBucketLabel(row.bucket, interval, isAr),
      previousRevenue: hasComparison ? (previousData[i]?.revenue ?? null) : undefined,
    })) || []);

  const seriesDefs = (seriesByDimension?.series || []).map((s, i) => ({
    key: s.key,
    name: isAr ? s.labelAr : s.labelEn,
    color: ['#2563eb', '#16a34a', '#7c3aed', '#ea580c', '#0891b2', '#db2777', '#0f766e', '#f59e0b'][i % 8],
  }));

  return (
    <div>
      <div className="h-80 w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="revenueArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#16a34a" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#16a34a" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: '#64748b' }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
              minTickGap={32}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#64748b' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v)}
              width={44}
            />
            <Tooltip
              content={hasMulti
                ? <MultiSeriesTooltip isAr={isAr} interval={interval} />
                : <ChartTooltip isAr={isAr} interval={interval} hasComparison={hasComparison} />}
            />
            {hasMulti ? (
              seriesDefs.map((s) => (
                <Area
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.name}
                  stroke={s.color}
                  strokeWidth={2}
                  fillOpacity={0.08}
                  fill={s.color}
                  stackId="1"
                  isAnimationActive={false}
                />
              ))
            ) : (
              <>
                <Area
                  type="monotone"
                  dataKey="revenue"
                  name={isAr ? 'الإيراد' : 'Revenue'}
                  stroke="#16a34a"
                  strokeWidth={2.5}
                  fill="url(#revenueArea)"
                  activeDot={{ r: 5, fill: '#15803d', stroke: '#fff', strokeWidth: 2 }}
                />
                {hasComparison && (
                  <Line
                    type="monotone"
                    dataKey="previousRevenue"
                    name={isAr ? 'الفترة السابقة' : 'Previous period'}
                    stroke="#94a3b8"
                    strokeWidth={2}
                    strokeDasharray="5 4"
                    dot={false}
                    activeDot={{ r: 4, fill: '#64748b', stroke: '#fff', strokeWidth: 1.5 }}
                    isAnimationActive={false}
                  />
                )}
              </>
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {hasMulti && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border pt-3">
          {seriesDefs.map((s) => (
            <span key={s.key} className="inline-flex items-center gap-1.5 text-xs font-medium text-text-muted">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
              {s.name}
            </span>
          ))}
        </div>
      )}

      {hasComparison && (
        <div className="mt-3 flex flex-wrap items-center gap-4 border-t border-border pt-3 text-xs font-medium text-text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-600" />
            {isAr ? 'الفترة الحالية' : 'This period'}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-3 shrink-0 rounded-full bg-slate-400" style={{ borderTop: '2px dashed #94a3b8', height: 0 }} />
            {isAr ? 'الفترة السابقة' : 'Previous period'}
          </span>
        </div>
      )}
    </div>
  );
}
