import { useEffect, useRef, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { adminApi } from '../../adminApi';
import SalesLineChart from './SalesLineChart';

const PERIODS = [
  { key: '7d', labelAr: '7 أيام', labelEn: '7D' },
  { key: '30d', labelAr: '30 يوم', labelEn: '30D' },
  { key: '90d', labelAr: '90 يوم', labelEn: '90D' },
];

export default function SalesTrendCard({ initialData, isAr }) {
  const [period, setPeriod] = useState('30d');
  const [data, setData] = useState(initialData || []);
  const [loading, setLoading] = useState(false);
  const requestId = useRef(0);

  useEffect(() => {
    if (period === '30d' && initialData) {
      setData(initialData);
      return;
    }
    const id = (requestId.current += 1);
    setLoading(true);
    adminApi.getDashboardSalesTrend(period)
      .then(({ data: res }) => {
        if (id !== requestId.current) return;
        setData(res.data?.salesByDay || []);
      })
      .catch(() => {
        if (id === requestId.current) setData([]);
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  return (
    <section className="rounded-2xl border border-border bg-white p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary-600" />
          <h2 className="text-lg font-bold text-text">
            {isAr ? 'المبيعات' : 'Sales'}
          </h2>
        </div>
        <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setPeriod(p.key)}
              className={[
                'rounded-md px-2.5 py-1 text-xs font-semibold transition-colors',
                period === p.key ? 'bg-white text-text shadow-sm' : 'text-text-muted hover:text-text',
              ].join(' ')}
            >
              {isAr ? p.labelAr : p.labelEn}
            </button>
          ))}
        </div>
      </div>
      <div className={loading ? 'opacity-50 transition-opacity' : 'transition-opacity'}>
        <SalesLineChart data={data} isAr={isAr} />
      </div>
    </section>
  );
}
