import {
  Area,
  CartesianGrid,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatPrice } from '../../../utils/formatters';

function formatDayLabel(dateStr, isAr) {
  const d = new Date(`${dateStr}T12:00:00`);
  return d.toLocaleDateString(isAr ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'short' });
}

function ChartTooltip({ active, payload, label, isAr }) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  return (
    <div className="rounded-xl border border-border bg-white px-4 py-3 text-sm shadow-lg">
      <p className="font-semibold text-text">{formatDayLabel(label, isAr)}</p>
      <p className="mt-1 text-base font-bold text-primary-700">{formatPrice(payload[0]?.value)}</p>
      {point?.orders != null && (
        <p className="mt-0.5 text-text-muted">
          {point.orders} {isAr ? 'طلب' : 'orders'}
        </p>
      )}
    </div>
  );
}

export default function SalesLineChart({ data, isAr }) {
  const chartData = data?.map((d) => ({
    ...d,
    label: formatDayLabel(d.date, isAr),
  })) || [];

  return (
    <div className="h-72 w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="dashboardRevenueArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#16a34a" stopOpacity={0.32} />
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
            minTickGap={28}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#64748b' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)}
            width={40}
          />
          <Tooltip content={<ChartTooltip isAr={isAr} />} />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke="#16a34a"
            strokeWidth={2.5}
            fill="url(#dashboardRevenueArea)"
            activeDot={{ r: 5, fill: '#15803d', stroke: '#fff', strokeWidth: 2 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
