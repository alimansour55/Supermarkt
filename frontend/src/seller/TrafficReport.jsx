import { useEffect, useState } from 'react';
import { Link } from '../app/router';
import { Eye, MousePointerClick, ShoppingCart, TrendingUp } from 'lucide-react';
import Loader from '../components/ui/Loader';
import { sellerApi } from '../services/sellerApi';
import { Card, KpiCard, Segmented } from './ui';
import { fmtNumber } from './sellerUtils';

const pctText = (v) => (v == null ? '—' : `${v}%`);

/** Views → add-to-cart → orders per product, like Seller Central's "Detail page sales and traffic". */
export default function TrafficReport({ isAr }) {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);

  useEffect(() => {
    let cancelled = false;
    sellerApi.getTrafficReport({ days }).then(({ data: d }) => { if (!cancelled) setData(d.data); }).catch(() => { if (!cancelled) setData({ totals: {}, products: [] }); });
    return () => { cancelled = true; };
  }, [days]);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">{isAr ? 'الزيارات والتحويل' : 'Traffic & conversion'}</h2>
        <Segmented options={[7, 30, 90].map((d) => ({ value: d, label: isAr ? `${d} يوم` : `${d} days` }))} value={days} onChange={setDays} />
      </div>
      {!data ? <div className="flex min-h-[120px] items-center justify-center"><Loader /></div> : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label={isAr ? 'مشاهدات صفحات المنتجات' : 'Product page views'} value={fmtNumber(data.totals.views)} icon={Eye} tone="text-sky-600 bg-sky-50" isAr={isAr} />
            <KpiCard label={isAr ? 'إضافات للسلة' : 'Add-to-carts'} value={fmtNumber(data.totals.carts)} icon={ShoppingCart} tone="text-violet-600 bg-violet-50" hint={isAr ? `${pctText(data.totals.cartRate)} من المشاهدات` : `${pctText(data.totals.cartRate)} of views`} isAr={isAr} />
            <KpiCard label={isAr ? 'طلبات' : 'Orders'} value={fmtNumber(data.totals.orders)} icon={MousePointerClick} tone="text-emerald-600 bg-emerald-50" isAr={isAr} />
            <KpiCard label={isAr ? 'معدل التحويل' : 'Conversion rate'} value={pctText(data.totals.conversion)} icon={TrendingUp} hint={isAr ? 'طلبات ÷ مشاهدات' : 'orders ÷ views'} isAr={isAr} />
          </div>
          <Card title={isAr ? 'حسب المنتج' : 'By product'} bodyClassName="p-0">
            {data.products.length === 0 ? (
              <p className="p-6 text-sm text-slate-500">{isAr ? 'لا توجد زيارات مسجلة بعد. تُحتسب الزيارات من اليوم.' : 'No visits recorded yet. Visits are counted from today on.'}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500">
                    <tr>
                      <th className="px-5 py-2.5 text-start">{isAr ? 'المنتج' : 'Product'}</th>
                      <th className="px-3 py-2.5 text-end">{isAr ? 'مشاهدات' : 'Views'}</th>
                      <th className="px-3 py-2.5 text-end">{isAr ? 'للسلة' : 'Carts'}</th>
                      <th className="px-3 py-2.5 text-end">{isAr ? 'طلبات' : 'Orders'}</th>
                      <th className="px-3 py-2.5 text-end">{isAr ? 'قطع' : 'Units'}</th>
                      <th className="px-5 py-2.5 text-end">{isAr ? 'التحويل' : 'Conversion'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.products.map((p) => (
                      <tr key={p.product}>
                        <td className="px-5 py-2.5">
                          <Link to={`/seller-center/products/${p.product}`} className="flex items-center gap-3 hover:text-indigo-700">
                            {p.image ? <img src={p.image} alt="" className="h-9 w-9 rounded-lg object-cover" /> : <span className="h-9 w-9 rounded-lg bg-slate-100" />}
                            <span className="max-w-[240px] truncate font-medium">{isAr ? p.nameAr : p.nameEn}</span>
                          </Link>
                        </td>
                        <td className="px-3 py-2.5 text-end tabular-nums">{fmtNumber(p.views)}</td>
                        <td className="px-3 py-2.5 text-end tabular-nums">{fmtNumber(p.carts)} <span className="text-xs text-slate-400">{pctText(p.cartRate)}</span></td>
                        <td className="px-3 py-2.5 text-end tabular-nums">{fmtNumber(p.orders)}</td>
                        <td className="px-3 py-2.5 text-end tabular-nums">{fmtNumber(p.units)}</td>
                        <td className={`px-5 py-2.5 text-end font-semibold tabular-nums ${p.views >= 20 && (p.conversion ?? 0) < 1 ? 'text-red-600' : ''}`}>{pctText(p.conversion)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
          <p className="text-xs text-slate-500">{isAr ? 'نصيحة: منتج بمشاهدات كثيرة وتحويل ضعيف يحتاج صوراً أفضل أو سعراً أنسب أو وصفاً أوضح.' : 'Tip: a product with many views but low conversion usually needs better photos, a sharper price or a clearer description.'}</p>
        </>
      )}
    </section>
  );
}
