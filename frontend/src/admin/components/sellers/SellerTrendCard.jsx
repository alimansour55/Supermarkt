import { useEffect, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { adminApi } from '../../adminApi';
import { formatMoneyLatin } from '../../../utils/formatters';

const monthName = (key, isAr) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString(isAr ? 'ar-EG' : 'en-GB', { month: 'short', timeZone: 'UTC' });
};

/** Health thresholds (same as the account-health score): cancels > 5%, late > 10% are "at risk". */
const tone = (v, bad, fair) => (v > bad ? 'text-red-700 font-semibold' : v > fair ? 'text-amber-700' : 'text-text');

/** Six months of parcels, sales, seller cancels and late shipping — is this seller getting better? */
export default function SellerTrendCard({ sellerId, isAr }) {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    let alive = true;
    adminApi.getSellerTrend(sellerId, { months: 6 })
      .then(({ data }) => { if (alive) setRows(data.data); })
      .catch(() => { if (alive) setRows([]); });
    return () => { alive = false; };
  }, [sellerId]);

  if (!rows) return <section className="h-32 animate-pulse rounded-2xl border border-border bg-white" />;
  if (!rows.some((r) => r.parcels)) return null;
  const maxSales = Math.max(1, ...rows.map((r) => r.sales));

  return (
    <section className="rounded-2xl border border-border bg-white p-4">
      <h3 className="mb-3 flex items-center gap-1.5 font-bold"><TrendingUp className="h-4 w-4 text-primary-600" />{isAr ? 'الأداء شهرياً' : 'Monthly performance'}</h3>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] text-sm">
          <thead className="text-xs text-text-muted">
            <tr>
              <th className="py-1 text-start font-medium">{isAr ? 'الشهر' : 'Month'}</th>
              <th className="py-1 text-end font-medium">{isAr ? 'الشحنات' : 'Parcels'}</th>
              <th className="py-1 text-start font-medium ps-3">{isAr ? 'المبيعات' : 'Sales'}</th>
              <th className="py-1 text-end font-medium">{isAr ? 'إلغاء من البائع' : 'Seller cancels'}</th>
              <th className="py-1 text-end font-medium">{isAr ? 'شحن متأخر' : 'Late'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.month}>
                <td className="py-1.5">{monthName(r.month, isAr)}</td>
                <td className="py-1.5 text-end tabular-nums">{r.parcels}</td>
                <td className="py-1.5 ps-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2 rounded-full bg-primary-500" style={{ width: `${Math.max(2, (r.sales / maxSales) * 80)}px` }} />
                    <span className="tabular-nums text-xs">{formatMoneyLatin(r.sales, { maximumFractionDigits: 0 })}</span>
                  </div>
                </td>
                <td className={`py-1.5 text-end tabular-nums ${tone(r.cancelRate, 5, 2.5)}`}>{r.cancelRate}%</td>
                <td className={`py-1.5 text-end tabular-nums ${tone(r.lateShipRate, 10, 4)}`}>{r.lateShipRate}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
