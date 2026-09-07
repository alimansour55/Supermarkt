import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { formatPrice } from '../../../utils/formatters';

const COLORS = ['#2563eb', '#16a34a', '#7c3aed', '#ea580c', '#0891b2'];

function ChartTooltip({ active, payload, isAr }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;

  return (
    <div className="rounded-xl border border-border bg-white px-3 py-2 text-sm shadow-lg">
      <p className="font-semibold">{isAr ? row.labelAr : row.labelEn}</p>
      <p className="text-primary-700">{formatPrice(row.revenue)}</p>
      <p className="text-text-muted">
        {row.orders} {isAr ? 'طلب' : 'orders'} · {row.sharePercent}%
      </p>
    </div>
  );
}

export default function PaymentMixChart({ data, isAr }) {
  const rows = data || [];
  const total = rows.reduce((sum, row) => sum + (row.revenue || 0), 0);

  if (!total) {
    return null;
  }

  return (
    <div className="flex flex-col items-center gap-5 lg:flex-row">
      <div className="h-44 w-44 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={rows}
              dataKey="revenue"
              nameKey={isAr ? 'labelAr' : 'labelEn'}
              innerRadius={52}
              outerRadius={72}
              paddingAngle={2}
              stroke="none"
            >
              {rows.map((_, index) => (
                <Cell key={index} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip isAr={isAr} />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <ul className="min-w-0 flex-1 space-y-3">
        {rows.map((row, index) => (
          <li key={row.method}>
            <div className="mb-1 flex items-center justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-2 font-medium">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                />
                <span className="truncate">{isAr ? row.labelAr : row.labelEn}</span>
              </span>
              <span className="shrink-0 font-bold text-text">{formatPrice(row.revenue)}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(row.sharePercent || 0, 100)}%`,
                  backgroundColor: COLORS[index % COLORS.length],
                }}
              />
            </div>
            <p className="mt-1 text-xs text-text-muted">
              {row.orders} {isAr ? 'طلب' : 'orders'} · {row.sharePercent}%
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
