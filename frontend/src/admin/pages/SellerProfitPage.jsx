import { useEffect, useMemo, useState } from 'react';
import { Link } from '../../app/router';
import {
  ArrowDownRight, ArrowUpRight, Download, ExternalLink, Info, Search, Settings2,
} from 'lucide-react';
import {
  Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { useLanguage } from '../../context/LanguageContext';
import { adminApi } from '../adminApi';
import Button from '../../components/ui/Button';
import AdminSlidePanel from '../components/AdminSlidePanel';
import { EmptyState, PageHeader, StatCardsSkeleton, useToast } from '../components';
import { downloadBlob } from '../utils/downloadBlob';
import { formatPrice } from '../../utils/formatters';
import { apiError } from '../../seller/sellerLabels';
import {
  RANGE_PRESETS, pctChange, previousRange, rangeFromPreset, sortRows,
} from '../utils/sellerFeesAdmin';

const inputCls = 'rounded-xl border border-border bg-white px-3 py-2 text-sm';

const BREAKDOWN = [
  ['commission', 'العمولة', 'Commission'],
  ['fixedFees', 'الرسوم الثابتة', 'Fixed fees'],
  ['fulfillmentFees', 'رسوم الشحن من المخزن', 'Fulfillment fees'],
  ['paymentFees', 'رسوم الدفع', 'Payment fees'],
  ['planFees', 'اشتراكات الباقات', 'Plan fees'],
  ['penalties', 'الغرامات', 'Penalties'],
];

const COLUMNS = [
  ['name', 'البائع', 'Seller'],
  ['netSales', 'صافي المبيعات', 'Net sales'],
  ['commission', 'العمولة', 'Commission'],
  ['feeIncome', 'كل الرسوم', 'Fee income'],
  ['takeRate', 'نسبتك', 'Take rate'],
  ['discountCost', 'خصومات دفعتها', 'Discounts paid'],
  ['netProfit', 'صافي ربحك', 'Net profit'],
];

function Delta({ value, isAr }) {
  if (value === null || value === undefined) return null;
  const up = value >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${up ? 'text-emerald-700' : 'text-red-700'}`} title={isAr ? 'مقارنة بالفترة السابقة' : 'vs the previous period'}>
      <Icon className="h-3.5 w-3.5" />{Math.abs(value)}%
    </span>
  );
}

function Tile({ label, value, hint, delta, tone = '', isAr }) {
  return (
    <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-text-muted">{label}</p>
      <div className="mt-1 flex items-baseline gap-2">
        <p className={`text-xl font-bold tabular-nums ${tone}`} dir="ltr">{value}</p>
        <Delta value={delta} isAr={isAr} />
      </div>
      {hint && <p className="mt-1 text-xs text-text-muted">{hint}</p>}
    </div>
  );
}

/** Where the money comes from: each fee, minus what the store pays out of it. */
function Breakdown({ t, isAr }) {
  const rows = BREAKDOWN.filter(([k]) => t[k]);
  return (
    <ul className="divide-y divide-border text-sm">
      {rows.map(([k, ar, en]) => (
        <li key={k} className="flex justify-between py-2"><span>{isAr ? ar : en}</span><span className="tabular-nums" dir="ltr">{formatPrice(t[k])}</span></li>
      ))}
      {!rows.length && <li className="py-2 text-text-muted">{isAr ? 'لا رسوم في هذه الفترة.' : 'No fees in this period.'}</li>}
      <li className="flex justify-between py-2 font-semibold"><span>{isAr ? 'إجمالي الرسوم' : 'Fee income'}</span><span className="tabular-nums" dir="ltr">{formatPrice(t.feeIncome)}</span></li>
      {t.adjustments !== 0 && (
        <li className="flex justify-between py-2 text-text-muted">
          <span>{isAr ? 'تسويات يدوية لصالح البائعين' : 'Manual credits to sellers'}</span>
          <span className="tabular-nums" dir="ltr">{formatPrice(-t.adjustments)}</span>
        </li>
      )}
      {t.discountCost > 0 && (
        <li className="flex justify-between py-2 text-text-muted">
          <span>{isAr ? 'كوبونات ونقاط دفعتها على منتجات البائعين' : 'Coupons & points you paid on seller items'}</span>
          <span className="tabular-nums" dir="ltr">{formatPrice(-t.discountCost)}</span>
        </li>
      )}
      <li className="flex justify-between py-2 text-base font-bold"><span>{isAr ? 'صافي ربحك' : 'Your net profit'}</span><span className={`tabular-nums ${t.netProfit < 0 ? 'text-red-700' : 'text-emerald-700'}`} dir="ltr">{formatPrice(t.netProfit)}</span></li>
      {t.vat > 0 && (
        <li className="flex justify-between pt-2 text-xs text-text-muted">
          <span>{isAr ? 'ضريبة القيمة المضافة المحصّلة على الرسوم (ليست ربحاً)' : 'VAT collected on fees (not profit)'}</span>
          <span className="tabular-nums" dir="ltr">{formatPrice(t.vat)}</span>
        </li>
      )}
    </ul>
  );
}

function fmtTick(value, unit, isAr) {
  const d = new Date(value);
  const opts = unit === 'month' ? { month: 'short', year: '2-digit' } : { day: 'numeric', month: 'short' };
  return d.toLocaleDateString(isAr ? 'ar-EG' : 'en-GB', { ...opts, timeZone: 'Africa/Cairo' });
}

export default function SellerProfitPage() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const toast = useToast();
  const [preset, setPreset] = useState('30d');
  const [range, setRange] = useState(() => rangeFromPreset('30d'));
  const [report, setReport] = useState(null);
  const [previous, setPrevious] = useState(null);
  const [sort, setSort] = useState({ key: 'netProfit', dir: 'desc' });
  const [q, setQ] = useState('');
  const [openRow, setOpenRow] = useState(null);

  useEffect(() => {
    let stale = false;
    Promise.all([
      adminApi.getSellerProfit(range),
      adminApi.getSellerProfit(previousRange(range)).catch(() => null),
    ])
      .then(([cur, prev]) => {
        if (stale) return;
        setReport(cur.data.data);
        setPrevious(prev?.data?.data?.totals || null);
      })
      .catch((err) => toast.error(apiError(err, isAr ? 'تعذّر تحميل التقرير' : 'Could not load the report')));
    return () => { stale = true; };
  }, [range, isAr, toast]);

  const choosePreset = (key) => {
    setPreset(key);
    setRange(rangeFromPreset(key));
  };

  const exportCsv = async () => {
    try {
      const res = await adminApi.exportSellerProfit(range);
      downloadBlob(res.data, `seller-profit-${range.from}-${range.to}.csv`);
    } catch (err) {
      toast.error(apiError(err, isAr ? 'تعذّر التصدير' : 'Export failed'));
    }
  };

  const rows = useMemo(() => {
    if (!report) return [];
    const needle = q.trim().toLowerCase();
    const filtered = needle
      ? report.sellers.filter((r) => `${r.seller.nameAr} ${r.seller.nameEn}`.toLowerCase().includes(needle))
      : report.sellers;
    return sortRows(filtered, sort.key, sort.dir);
  }, [report, q, sort]);

  const t = report?.totals;
  const d = (k) => (previous ? pctChange(t?.[k] || 0, previous[k] || 0) : null);
  const name = (s) => (isAr ? s.nameAr || s.nameEn : s.nameEn || s.nameAr);
  const toggleSort = (key) => setSort((s) => ({ key, dir: s.key === key && s.dir === 'desc' ? 'asc' : 'desc' }));

  return (
    <div className="space-y-6">
      <PageHeader
        description={isAr
          ? 'كم تربح من كل بائع: العمولة وكل الرسوم، ناقص ما دفعته من خصومات. تُحسب الأرباح عند تسليم الطلب.'
          : 'What you earn from each seller: commission and every fee, minus the discounts you paid. Profit counts when an order is delivered.'}
        action={(
          <div className="flex flex-wrap gap-2">
            <Link to="/admin/seller-fees"><Button variant="outline"><Settings2 className="h-4 w-4" />{isAr ? 'تعديل العمولات والرسوم' : 'Edit fees & commission'}</Button></Link>
            <Button variant="outline" onClick={exportCsv} disabled={!report?.sellers?.length}><Download className="h-4 w-4" />{isAr ? 'تصدير CSV' : 'Export CSV'}</Button>
          </div>
        )}
      />

      <div className="flex flex-wrap items-center gap-2">
        {RANGE_PRESETS.map((p) => (
          <button key={p.key} type="button" onClick={() => choosePreset(p.key)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${preset === p.key ? 'bg-primary-600 text-white' : 'bg-white ring-1 ring-border hover:bg-slate-50'}`}>
            {isAr ? p.ar : p.en}
          </button>
        ))}
        <span className="flex items-center gap-1.5 text-xs text-text-muted">
          <input type="date" className={inputCls} value={range.from} max={range.to} onChange={(e) => { setPreset(''); setRange((r) => ({ ...r, from: e.target.value })); }} aria-label={isAr ? 'من' : 'From'} />
          –
          <input type="date" className={inputCls} value={range.to} min={range.from} onChange={(e) => { setPreset(''); setRange((r) => ({ ...r, to: e.target.value })); }} aria-label={isAr ? 'إلى' : 'To'} />
        </span>
      </div>

      {!report ? <StatCardsSkeleton count={4} /> : t && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile isAr={isAr} label={isAr ? 'صافي ربحك' : 'Your net profit'} value={formatPrice(t.netProfit)} delta={d('netProfit')} tone={t.netProfit < 0 ? 'text-red-700' : 'text-emerald-700'} hint={isAr ? `هامش ${t.margin}% من المبيعات` : `${t.margin}% margin on sales`} />
            <Tile isAr={isAr} label={isAr ? 'العمولة والرسوم' : 'Fee income'} value={formatPrice(t.feeIncome)} delta={d('feeIncome')} hint={isAr ? `نسبتك الفعلية ${t.takeRate}%` : `Effective take rate ${t.takeRate}%`} />
            <Tile isAr={isAr} label={isAr ? 'صافي مبيعات البائعين' : 'Seller net sales'} value={formatPrice(t.netSales)} delta={d('netSales')} hint={isAr ? `${t.orders} طلب · ${t.sellers} بائع` : `${t.orders} orders · ${t.sellers} sellers`} />
            <Tile isAr={isAr} label={isAr ? 'في الطريق (لم يُسلَّم بعد)' : 'In the pipeline'} value={formatPrice(report.pipeline.fees)} hint={isAr ? `رسوم متوقعة من ${report.pipeline.shipments} شحنة مفتوحة` : `Expected fees on ${report.pipeline.shipments} open shipments`} />
          </div>

          <div className="grid gap-6 lg:grid-cols-5">
            <section className="rounded-2xl border border-border bg-white p-5 shadow-sm lg:col-span-3">
              <h2 className="mb-3 font-bold">{isAr ? 'الرسوم والمبيعات عبر الوقت' : 'Fees and sales over time'}</h2>
              {report.trend.length ? (
                <div className="h-64" dir="ltr">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={report.trend} margin={{ left: 0, right: 8, top: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="date" tickFormatter={(v) => fmtTick(v, report.range.unit, isAr)} tick={{ fontSize: 11 }} />
                      <YAxis yAxisId="fees" tick={{ fontSize: 11 }} width={48} />
                      <YAxis yAxisId="sales" orientation="right" tick={{ fontSize: 11 }} width={56} />
                      <Tooltip formatter={(v, n) => [formatPrice(v), n === 'fees' ? (isAr ? 'رسومك' : 'Your fees') : (isAr ? 'المبيعات' : 'Sales')]} labelFormatter={(v) => fmtTick(v, report.range.unit, isAr)} />
                      <Bar yAxisId="fees" dataKey="fees" fill="#059669" radius={[4, 4, 0, 0]} />
                      <Line yAxisId="sales" dataKey="sales" stroke="#64748b" strokeWidth={2} dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              ) : <p className="py-10 text-center text-sm text-text-muted">{isAr ? 'لا توجد مبيعات مسلّمة في هذه الفترة.' : 'No delivered sales in this period.'}</p>}
            </section>
            <section className="rounded-2xl border border-border bg-white p-5 shadow-sm lg:col-span-2">
              <h2 className="mb-1 font-bold">{isAr ? 'من أين يأتي ربحك' : 'Where your profit comes from'}</h2>
              <Breakdown t={t} isAr={isAr} />
            </section>
          </div>

          <section className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
              <h2 className="font-bold">{isAr ? 'الربح من كل بائع' : 'Profit by seller'}</h2>
              <label className="relative">
                <Search className="pointer-events-none absolute start-2.5 top-2.5 h-4 w-4 text-text-muted" />
                <input className={`${inputCls} ps-8`} placeholder={isAr ? 'ابحث عن بائع' : 'Find a seller'} value={q} onChange={(e) => setQ(e.target.value)} />
              </label>
            </div>
            {!rows.length ? (
              <EmptyState title={isAr ? 'لا أرباح من البائعين في هذه الفترة' : 'No seller profit in this period'} description={isAr ? 'تظهر الأرقام بعد تسليم طلبات البائعين.' : 'Numbers appear once seller orders are delivered.'} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-sm">
                  <thead className="bg-slate-50 text-xs text-text-muted">
                    <tr>
                      {COLUMNS.map(([key, ar, en]) => (
                        <th key={key} className={`px-4 py-2 ${key === 'name' ? 'text-start' : 'text-end'}`}>
                          <button type="button" onClick={() => toggleSort(key)} className="font-semibold hover:text-text">
                            {isAr ? ar : en}{sort.key === key ? (sort.dir === 'desc' ? ' ↓' : ' ↑') : ''}
                          </button>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {rows.map((r) => (
                      <tr key={r.seller._id} className="cursor-pointer hover:bg-slate-50" onClick={() => setOpenRow(r)}>
                        <td className="px-4 py-2.5">
                          <span className="font-semibold text-primary-700">{name(r.seller)}</span>
                          <span className="block text-xs text-text-muted">{r.orders} {isAr ? 'طلب' : 'orders'}{r.seller.feePlan ? ` · ${r.seller.feePlan}` : ''}{r.seller.commissionRate != null ? ` · ${isAr ? 'عمولة خاصة' : 'custom rate'} ${r.seller.commissionRate}%` : ''}</span>
                        </td>
                        <td className="px-4 py-2.5 text-end tabular-nums">{formatPrice(r.netSales)}</td>
                        <td className="px-4 py-2.5 text-end tabular-nums">{formatPrice(r.commission)}</td>
                        <td className="px-4 py-2.5 text-end tabular-nums">{formatPrice(r.feeIncome)}</td>
                        <td className="px-4 py-2.5 text-end tabular-nums">{r.takeRate}%</td>
                        <td className="px-4 py-2.5 text-end tabular-nums text-text-muted">{r.discountCost ? formatPrice(-r.discountCost) : '—'}</td>
                        <td className={`px-4 py-2.5 text-end font-bold tabular-nums ${r.netProfit < 0 ? 'text-red-700' : 'text-emerald-700'}`}>{formatPrice(r.netProfit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {report.categories.length > 0 && (
            <section className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
              <h2 className="border-b border-border px-5 py-3 font-bold">{isAr ? 'العمولة حسب القسم' : 'Commission by category'}</h2>
              <ul className="divide-y divide-border text-sm">
                {report.categories.map((c) => {
                  const max = report.categories[0].commission || 1;
                  return (
                    <li key={c._id || 'none'} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-5 py-2.5 sm:grid-cols-[12rem_1fr_auto_auto]">
                      <span className="font-medium">{isAr ? c.nameAr : c.nameEn}</span>
                      <span className="hidden h-2 overflow-hidden rounded-full bg-slate-100 sm:block"><span className="block h-full rounded-full bg-emerald-500" style={{ width: `${Math.max(2, (c.commission / max) * 100)}%` }} /></span>
                      <span className="text-xs text-text-muted">{formatPrice(c.sales)} · {c.rate}%</span>
                      <span className="text-end font-semibold tabular-nums">{formatPrice(c.commission)}</span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <p className="flex items-start gap-2 text-xs text-text-muted">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {isAr
              ? 'العمولة تُحسب على سعر البيع قبل الكوبونات. المرتجعات تُعيد العمولة للبائع (ناقص رسوم الإرجاع إن وُجدت). اشتراكات الباقات تُخصم أول كل شهر.'
              : 'Commission is on the selling price before coupons. Returns give the commission back (minus any refund admin fee). Plan fees are charged at the start of each month.'}
          </p>
        </>
      )}

      <AdminSlidePanel open={Boolean(openRow)} onClose={() => setOpenRow(null)} title={openRow ? name(openRow.seller) : ''} subtitle={`${range.from} → ${range.to}`} isAr={isAr}>
        {openRow && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                [isAr ? 'المبيعات' : 'Sales', openRow.sales],
                [isAr ? 'المرتجعات' : 'Returns', -openRow.returns],
                [isAr ? 'مستحق للبائع' : 'Seller earned', openRow.sellerEarnings],
                [isAr ? 'حُوّل له' : 'Paid out', openRow.paidOut],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl border border-border p-3"><p className="text-text-muted">{k}</p><p className="font-bold tabular-nums" dir="ltr">{formatPrice(v)}</p></div>
              ))}
            </div>
            <section className="rounded-2xl border border-border p-4"><Breakdown t={openRow} isAr={isAr} /></section>
            <div className="flex flex-wrap gap-2">
              <Link to={`/admin/sellers?open=${openRow.seller._id}&tab=rules`}><Button variant="outline" size="sm"><Settings2 className="h-4 w-4" />{isAr ? 'عمولة هذا البائع' : 'This seller’s fees'}</Button></Link>
              <Link to={`/admin/sellers?open=${openRow.seller._id}&tab=payouts`}><Button variant="outline" size="sm"><ExternalLink className="h-4 w-4" />{isAr ? 'الرصيد والغرامات' : 'Balance & penalties'}</Button></Link>
            </div>
          </div>
        )}
      </AdminSlidePanel>
    </div>
  );
}
