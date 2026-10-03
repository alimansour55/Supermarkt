import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Sector, Tooltip } from 'recharts';
import { formatCount } from '../../../utils/formatters';
import { getOrderStatus, ORDER_STATUS_CHART_COLORS } from '../../adminConstants';

function StatusTooltip({ active, payload, language, total }) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  const info = getOrderStatus(item.status);
  const pct = total ? Math.round((item.count / total) * 1000) / 10 : 0;
  return (
    <div className="rounded-lg border border-border bg-white px-3 py-2 text-sm shadow-lg">
      <p className="font-medium">{language === 'ar' ? info.labelAr : info.labelEn}</p>
      <p className="text-text-muted">{formatCount(item.count)} · {pct}%</p>
    </div>
  );
}

function ActiveSlice(props) {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, onClick, onMouseEnter, onMouseLeave } = props;
  return (
    <Sector
      cx={cx}
      cy={cy}
      innerRadius={innerRadius}
      outerRadius={outerRadius + 6}
      startAngle={startAngle}
      endAngle={endAngle}
      fill={fill}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{ cursor: 'pointer' }}
    />
  );
}

export default function OrdersStatusChart({ data, language, isAr }) {
  const navigate = useNavigate();
  const [activeIndex, setActiveIndex] = useState(null);

  const chartData = (data || [])
    .filter((d) => d.count > 0)
    .map((d) => {
      const info = getOrderStatus(d.status);
      return {
        ...d,
        name: isAr ? info.labelAr : info.labelEn,
        fill: ORDER_STATUS_CHART_COLORS[d.status] || '#94a3b8',
      };
    })
    .sort((a, b) => b.count - a.count);

  if (!chartData.length) {
    return (
      <p className="flex h-72 items-center justify-center text-sm text-text-muted">
        {isAr ? 'لا توجد طلبات بعد' : 'No orders yet'}
      </p>
    );
  }

  const total = chartData.reduce((sum, d) => sum + d.count, 0);
  const hovered = activeIndex != null ? chartData[activeIndex] : null;

  const goToStatus = (status) => navigate(`/admin/orders?status=${status}`);

  return (
    <div className="space-y-2">
      <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="relative h-64 w-64 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="count"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={62}
              outerRadius={92}
              paddingAngle={2}
              cursor="pointer"
              activeIndex={activeIndex ?? undefined}
              activeShape={ActiveSlice}
              onMouseEnter={(_, index) => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(null)}
              onClick={(entry) => goToStatus(entry.status)}
            >
              {chartData.map((entry) => (
                <Cell key={entry.status} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip content={<StatusTooltip language={language} total={total} />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold tabular-nums text-text">
            {formatCount(hovered ? hovered.count : total)}
          </span>
          <span className="max-w-[7rem] truncate text-center text-xs text-text-muted">
            {hovered ? hovered.name : (isAr ? 'إجمالي الطلبات' : 'Total orders')}
          </span>
        </div>
      </div>

      <ul className="w-full min-w-0 flex-1 space-y-1">
        {chartData.map((entry, index) => {
          const pct = total ? Math.round((entry.count / total) * 1000) / 10 : 0;
          return (
            <li key={entry.status}>
              <Link
                to={`/admin/orders?status=${entry.status}`}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(null)}
                title={isAr ? `عرض طلبات «${entry.name}»` : `View ${entry.name} orders`}
                className={[
                  'flex w-full items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-start transition-colors',
                  activeIndex === index ? 'bg-slate-50' : 'hover:bg-slate-50',
                ].join(' ')}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: entry.fill }} />
                  <span className="truncate text-sm text-text">{entry.name}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="text-sm font-bold tabular-nums text-text">{formatCount(entry.count)}</span>
                  <span className="w-11 shrink-0 text-end text-xs tabular-nums text-text-muted">{pct}%</span>
                  <ChevronLeft
                    className={[
                      'h-3.5 w-3.5 shrink-0 text-text-muted transition-opacity rtl:rotate-180',
                      activeIndex === index ? 'opacity-100' : 'opacity-0',
                    ].join(' ')}
                    aria-hidden
                  />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      </div>
      <p className="text-center text-[11px] text-text-muted">
        {isAr ? 'انقر على أي حالة لعرض طلباتها' : 'Click any status to view its orders'}
      </p>
    </div>
  );
}
