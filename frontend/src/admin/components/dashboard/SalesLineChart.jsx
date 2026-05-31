import {
  CartesianGrid,
  Line,
  LineChart,
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
  return (
    <div className="rounded-lg border border-border bg-white px-3 py-2 text-sm shadow-lg">
      <p className="font-medium text-text">{formatDayLabel(label, isAr)}</p>
      <p className="text-primary-600">{formatPrice(payload[0]?.value)}</p>
      {payload[1] && (
        <p className="text-text-muted">
          {isAr ? 'طلبات' : 'Orders'}: {payload[1].value}
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
        <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
          <Line
            type="monotone"
            dataKey="revenue"
            stroke="#16a34a"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: '#16a34a' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
