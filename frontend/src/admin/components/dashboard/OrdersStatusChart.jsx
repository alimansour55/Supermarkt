import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { getOrderStatus, ORDER_STATUS_CHART_COLORS } from '../../adminConstants';

function StatusTooltip({ active, payload, language }) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  const info = getOrderStatus(item.status);
  return (
    <div className="rounded-lg border border-border bg-white px-3 py-2 text-sm shadow-lg">
      <p className="font-medium">{language === 'ar' ? info.labelAr : info.labelEn}</p>
      <p className="text-text-muted">{item.count}</p>
    </div>
  );
}

export default function OrdersStatusChart({ data, language, isAr }) {
  const chartData = (data || [])
    .filter((d) => d.count > 0)
    .map((d) => {
      const info = getOrderStatus(d.status);
      return {
        ...d,
        name: isAr ? info.labelAr : info.labelEn,
        fill: ORDER_STATUS_CHART_COLORS[d.status] || '#94a3b8',
      };
    });

  if (!chartData.length) {
    return (
      <p className="flex h-72 items-center justify-center text-sm text-text-muted">
        {isAr ? 'لا توجد طلبات بعد' : 'No orders yet'}
      </p>
    );
  }

  return (
    <div className="h-72 w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            dataKey="count"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={56}
            outerRadius={88}
            paddingAngle={2}
          >
            {chartData.map((entry) => (
              <Cell key={entry.status} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip content={<StatusTooltip language={language} />} />
          <Legend
            layout="vertical"
            align="right"
            verticalAlign="middle"
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 12, lineHeight: '18px' }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
