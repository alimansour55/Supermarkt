import { useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext } from '../../app/router';
import { BarChart3, Boxes, Download, Receipt, ShoppingBag, Tags, XCircle } from 'lucide-react';
import Loader from '../../components/ui/Loader';
import { useToast } from '../../components/ui/Toast';
import { sellerApi } from '../../services/sellerApi';
import { formatPrice } from '../../utils/formatters';
import { apiError } from '../sellerLabels';
import SalesChart from '../SalesChart';
import { Card, KpiCard, PageHeader, Segmented } from '../ui';
import { fmtNumber, saveBlob } from '../sellerUtils';

const todayKey = () => new Date().toISOString().slice(0, 10);
const daysAgoKey = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

/** Business reports — ordered sales over a date range, by day, product and store section. */
export default function SellerReportsPage() {
  const { isAr } = useOutletContext();
  const toast = useToast();
  const [preset, setPreset] = useState('30');
  const [from, setFrom] = useState(daysAgoKey(30));
  const [to, setTo] = useState(todayKey());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('products');
  const [sort, setSort] = useState('gross');

  const params = useMemo(() => ({ from, to }), [from, to]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    sellerApi.getSalesReport(params)
      .then(({ data: res }) => { if (!cancelled) setData(res.data); })
      .catch((err) => { if (!cancelled) toast.error(apiError(err, isAr ? 'تعذّر تحميل التقرير' : 'Could not load the report')); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [params, isAr, toast]);

  const choosePreset = (value) => {
    setPreset(value);
    if (value !== 'custom') { setFrom(daysAgoKey(Number(value))); setTo(todayKey()); }
  };

  const download = async (csvView) => {
    try {
      const res = await sellerApi.downloadSalesReport({ ...params, view: csvView });
      saveBlob(res, `sales-${csvView}.csv`);
    } catch (err) {
      toast.error(apiError(err, isAr ? 'تعذّر التحميل' : 'Download failed'));
    }
  };

  const products = useMemo(() => [...(data?.products || [])].sort((a, b) => (b[sort] || 0) - (a[sort] || 0)), [data, sort]);
  const totalGross = data?.totals.gross || 0;

  const presets = [
    { value: '7', label: isAr ? '7 أيام' : '7 days' },
    { value: '30', label: isAr ? '30 يوم' : '30 days' },
    { value: '90', label: isAr ? '90 يوم' : '90 days' },
    { value: '365', label: isAr ? 'سنة' : '1 year' },
    { value: 'custom', label: isAr ? 'مخصص' : 'Custom' },
  ];

  return (
    <div>
      <PageHeader
        icon={BarChart3}
        title={isAr ? 'تقارير المبيعات' : 'Business reports'}
        description={isAr ? 'المبيعات حسب تاريخ الطلب (بدون الملغاة). صدّر أي جدول كملف CSV لفتحه في Excel.' : 'Sales by order date (cancelled excluded). Export any table as CSV for Excel.'}
        actions={(
          <button type="button" onClick={() => download('days')} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold ring-1 ring-slate-300 hover:bg-white">
            <Download className="h-4 w-4" />{isAr ? 'تصدير يومي' : 'Export daily'}
          </button>
        )}
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Segmented options={presets} value={preset} onChange={choosePreset} />
        {preset === 'custom' && (
          <div className="flex items-center gap-2 text-sm">
            <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-1.5" />
            <span className="text-slate-400">—</span>
            <input type="date" value={to} min={from} max={todayKey()} onChange={(e) => setTo(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-1.5" />
          </div>
        )}
        {loading && data && <Loader size="sm" />}
      </div>

      {!data ? (
        <div className="flex min-h-[40vh] items-center justify-center"><Loader size="lg" /></div>
      ) : (
        <div className="space-y-6">
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <KpiCard label={isAr ? 'إجمالي المبيعات' : 'Ordered sales'} value={formatPrice(data.totals.gross)} icon={Receipt} isAr={isAr} />
            <KpiCard label={isAr ? 'صافي لك (تقديري)' : 'Your net (est.)'} value={formatPrice(data.totals.net)} icon={Receipt} tone="text-emerald-600 bg-emerald-50" isAr={isAr} />
            <KpiCard label={isAr ? 'الطلبات' : 'Orders'} value={fmtNumber(data.totals.orders, isAr)} icon={ShoppingBag} tone="text-violet-600 bg-violet-50" isAr={isAr} />
            <KpiCard label={isAr ? 'القطع' : 'Units'} value={fmtNumber(data.totals.units, isAr)} icon={Boxes} tone="text-sky-600 bg-sky-50" hint={isAr ? `متوسط الطلب ${formatPrice(data.totals.avgOrder)}` : `avg order ${formatPrice(data.totals.avgOrder)}`} isAr={isAr} />
            <KpiCard label={isAr ? 'طلبات ملغاة' : 'Cancelled'} value={fmtNumber(data.totals.cancelled, isAr)} icon={XCircle} tone="text-red-600 bg-red-50" isAr={isAr} />
          </section>

          <Card title={isAr ? 'المبيعات اليومية' : 'Sales by day'}>
            <SalesChart series={data.series} isAr={isAr} height={300} />
          </Card>

          <Card
            title={(
              <Segmented
                options={[
                  { value: 'products', label: isAr ? 'حسب المنتج' : 'By product' },
                  { value: 'sections', label: isAr ? 'حسب قسم المتجر' : 'By store section' },
                  { value: 'days', label: isAr ? 'حسب اليوم' : 'By day' },
                ]}
                value={view}
                onChange={setView}
              />
            )}
            action={view === 'products' && (
              <button type="button" onClick={() => download('products')} className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700 hover:underline">
                <Download className="h-3.5 w-3.5" />CSV
              </button>
            )}
            bodyClassName="p-0"
          >
            <div className="overflow-x-auto">
              {view === 'products' && (
                products.length === 0 ? <p className="p-6 text-sm text-slate-500">{isAr ? 'لا توجد مبيعات في هذه الفترة.' : 'No sales in this period.'}</p> : (
                  <table className="w-full min-w-[640px] text-sm">
                    <thead className="bg-slate-50 text-xs text-slate-500">
                      <tr>
                        <th className="px-5 py-2.5 text-start">{isAr ? 'المنتج' : 'Product'}</th>
                        {[['orders', isAr ? 'طلبات' : 'Orders'], ['units', isAr ? 'قطع' : 'Units'], ['gross', isAr ? 'المبيعات' : 'Sales'], ['commission', isAr ? 'العمولة' : 'Fees']].map(([key, text]) => (
                          <th key={key} className="px-3 py-2.5 text-end">
                            <button type="button" onClick={() => setSort(key)} className={`font-semibold ${sort === key ? 'text-indigo-700' : ''}`}>{text}{sort === key ? ' ↓' : ''}</button>
                          </th>
                        ))}
                        <th className="px-5 py-2.5 text-end">{isAr ? 'الحصة' : 'Share'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {products.map((p, i) => {
                        const share = totalGross ? Math.round((p.gross / totalGross) * 100) : 0;
                        return (
                          <tr key={p.product || i}>
                            <td className="px-5 py-2.5">
                              <Link to={p.product ? `/seller-center/products/${p.product}` : '/seller-center/products'} className="flex items-center gap-3 hover:text-indigo-700">
                                {p.image ? <img src={p.image} alt="" className="h-9 w-9 rounded-lg object-cover" /> : <span className="h-9 w-9 rounded-lg bg-slate-100" />}
                                <span className="min-w-0">
                                  <span className="block max-w-[260px] truncate font-medium">{isAr ? p.nameAr : p.nameEn}</span>
                                  <span className="block text-xs text-slate-500" dir="ltr">{p.sku}</span>
                                </span>
                              </Link>
                            </td>
                            <td className="px-3 py-2.5 text-end tabular-nums">{fmtNumber(p.orders, isAr)}</td>
                            <td className="px-3 py-2.5 text-end tabular-nums">{fmtNumber(p.units, isAr)}</td>
                            <td className="px-3 py-2.5 text-end font-semibold tabular-nums">{formatPrice(p.gross)}</td>
                            <td className="px-3 py-2.5 text-end tabular-nums text-slate-500">{formatPrice(p.commission)}</td>
                            <td className="px-5 py-2.5">
                              <div className="flex items-center justify-end gap-2">
                                <div className="h-1.5 w-16 rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${share}%` }} /></div>
                                <span className="w-9 text-end text-xs tabular-nums text-slate-500">{share}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )
              )}

              {view === 'sections' && (
                data.bySection.length === 0 ? <p className="p-6 text-sm text-slate-500">{isAr ? 'لا توجد مبيعات في هذه الفترة.' : 'No sales in this period.'}</p> : (
                  <ul className="divide-y divide-slate-100">
                    {data.bySection.map((s) => {
                      const share = totalGross ? Math.round((s.gross / totalGross) * 100) : 0;
                      return (
                        <li key={s.section || 'none'} className="flex flex-wrap items-center gap-4 px-5 py-3 text-sm">
                          <Tags className="h-4 w-4 text-slate-400" aria-hidden />
                          <span className="min-w-[8rem] flex-1 font-medium">{isAr ? s.nameAr : s.nameEn}</span>
                          <span className="tabular-nums text-slate-500">{isAr ? `${s.units} قطعة` : `${s.units} units`}</span>
                          <div className="h-2 w-40 rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.min(100, share)}%` }} /></div>
                          <span className="w-28 text-end font-semibold tabular-nums">{formatPrice(s.gross)}</span>
                        </li>
                      );
                    })}
                  </ul>
                )
              )}

              {view === 'days' && (
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500">
                    <tr>
                      <th className="px-5 py-2.5 text-start">{isAr ? 'اليوم' : 'Day'}</th>
                      <th className="px-3 py-2.5 text-end">{isAr ? 'طلبات' : 'Orders'}</th>
                      <th className="px-3 py-2.5 text-end">{isAr ? 'قطع' : 'Units'}</th>
                      <th className="px-5 py-2.5 text-end">{isAr ? 'المبيعات' : 'Sales'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {[...data.series].reverse().map((d) => (
                      <tr key={d.date} className={d.orders ? '' : 'text-slate-400'}>
                        <td className="px-5 py-2">{new Date(`${d.date}T12:00:00`).toLocaleDateString(isAr ? 'ar-EG' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</td>
                        <td className="px-3 py-2 text-end tabular-nums">{d.orders}</td>
                        <td className="px-3 py-2 text-end tabular-nums">{d.units}</td>
                        <td className="px-5 py-2 text-end font-semibold tabular-nums">{formatPrice(d.gross)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
