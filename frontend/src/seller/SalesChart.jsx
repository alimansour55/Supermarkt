import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatPrice } from '../utils/formatters';

const dayLabel = (date, isAr, opts) => new Date(`${date}T12:00:00`).toLocaleDateString(isAr ? 'ar-EG' : 'en-GB', opts);

function ChartTooltip({ active, payload, isAr }) {
  const point = active && payload?.[0]?.payload;
  if (!point) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-lg">
      <p className="font-semibold">{dayLabel(point.date, isAr, { weekday: 'short', day: 'numeric', month: 'short' })}</p>
      <p className="mt-0.5 font-bold text-indigo-700">{formatPrice(point.gross)}</p>
      <p className="text-xs text-slate-500">{isAr ? `${point.orders} طلب · ${point.units} قطعة` : `${point.orders} orders · ${point.units} units`}</p>
    </div>
  );
}

/** Daily ordered sales (area) for the seller dashboard and reports. */
export default function SalesChart({ series, isAr, height = 260 }) {
  const data = isAr ? [...series].reverse() : series;
  return (
    <div style={{ height }} dir="ltr">
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 1, height: height }}>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="sellerSales" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={(d) => dayLabel(d, isAr, { day: 'numeric', month: 'short' })}
            tick={{ fontSize: 11, fill: '#64748b' }}
            tickLine={false}
            axisLine={false}
            minTickGap={24}
          />
          <YAxis
            orientation={isAr ? 'right' : 'left'}
            tick={{ fontSize: 11, fill: '#64748b' }}
            tickLine={false}
            axisLine={false}
            width={56}
            tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 100) / 10}k` : v)}
          />
          <Tooltip content={<ChartTooltip isAr={isAr} />} cursor={{ stroke: '#a5b4fc' }} />
          <Area type="monotone" dataKey="gross" stroke="#6366f1" strokeWidth={2.5} fill="url(#sellerSales)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
