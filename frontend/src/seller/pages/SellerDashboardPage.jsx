import { useEffect, useState } from 'react';
import { Link, useOutletContext } from '../../app/router';
import {
  ArrowLeft, ArrowRight, Bell, Boxes, CheckCircle2, ClipboardCheck, Clock, FileWarning, Landmark,
  PackageX, Plus, Receipt, ShoppingBag, Sparkles, Tags, Truck, Wallet,
} from 'lucide-react';
import Loader from '../../components/ui/Loader';
import { sellerApi } from '../../services/sellerApi';
import { formatPrice } from '../../utils/formatters';
import SalesChart from '../SalesChart';
import { Card, KpiCard, Segmented } from '../ui';
import { fmtNumber } from '../sellerUtils';
import { ACCOUNT_HEALTH as HEALTH } from '../sellerLabels';

const CHECKLIST = {
  profile: { ar: 'أضف شعار ووصف متجرك', en: 'Add your logo and store description' },
  documents: { ar: 'ارفع السجل التجاري والبطاقة الضريبية', en: 'Upload your commercial register and tax card' },
  payout: { ar: 'أضف بيانات استلام الأرباح', en: 'Add your payout details' },
  sections: { ar: 'أنشئ أقسام متجرك', en: 'Create your store sections' },
  product: { ar: 'أضف أول منتج وأرسله للمراجعة', en: 'Add your first product and submit it' },
};


function Onboarding({ checklist, isAr }) {
  const done = checklist.filter((c) => c.done).length;
  if (done === checklist.length) return null;
  const pct = Math.round((done / checklist.length) * 100);
  return (
    <section className="overflow-hidden rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-600 to-violet-700 p-5 text-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 font-bold"><Sparkles className="h-5 w-5" />{isAr ? 'جهّز متجرك للبيع' : 'Get your store ready to sell'}</p>
          <p className="text-sm text-indigo-100">{isAr ? `${done} من ${checklist.length} خطوات مكتملة` : `${done} of ${checklist.length} steps done`}</p>
        </div>
        <span className="text-2xl font-extrabold">{pct}%</span>
      </div>
      <div className="mt-3 h-2 rounded-full bg-white/20"><div className="h-full rounded-full bg-white transition-all" style={{ width: `${pct}%` }} /></div>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {checklist.map((c) => (
          <li key={c.id}>
            <Link to={c.to} className={`flex h-full items-start gap-2 rounded-xl p-3 text-sm ${c.done ? 'bg-white/10 text-indigo-100' : 'bg-white text-slate-800 hover:bg-indigo-50'}`}>
              {c.done ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <span className="mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 border-indigo-300" />}
              <span className={c.done ? 'line-through' : 'font-medium'}>{isAr ? CHECKLIST[c.id]?.ar : CHECKLIST[c.id]?.en}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** "Needs your attention" — like Seller Central's action centre; only rows with work show. */
function ActionCenter({ data, summary, seller, isAr }) {
  const Arrow = isAr ? ArrowLeft : ArrowRight;
  const rows = [
    { n: summary?.toConfirm, Icon: ClipboardCheck, tone: 'text-red-600 bg-red-50', ar: 'طلبات بانتظار تأكيدك', en: 'Orders waiting for your confirmation', to: '/seller-center/orders?status=pending' },
    { n: summary?.toShip, Icon: Truck, tone: 'text-indigo-600 bg-indigo-50', ar: 'طلبات جاهزة للشحن', en: 'Orders ready to ship', to: '/seller-center/orders?status=confirmed' },
    { n: data.listings.rejected, Icon: FileWarning, tone: 'text-red-600 bg-red-50', ar: 'منتجات مرفوضة تحتاج تعديل', en: 'Rejected products to fix', to: '/seller-center/products?listingStatus=rejected' },
    { n: data.outOfStock, Icon: PackageX, tone: 'text-amber-600 bg-amber-50', ar: 'منتجات نفد مخزونها', en: 'Products out of stock', to: '/seller-center/inventory?stock=out' },
    { n: data.lowStock, Icon: Boxes, tone: 'text-amber-600 bg-amber-50', ar: 'منتجات مخزونها منخفض', en: 'Products running low', to: '/seller-center/inventory?stock=low' },
    { n: data.listings.draft, Icon: Clock, tone: 'text-slate-600 bg-slate-100', ar: 'مسودات لم تُرسل بعد', en: 'Drafts not submitted yet', to: '/seller-center/products?listingStatus=draft' },
    { n: !(seller.bank?.accountNumber || seller.bank?.iban || seller.bank?.walletPhone) && data.balance.pending + data.balance.available > 0 ? 1 : 0, Icon: Landmark, tone: 'text-amber-600 bg-amber-50', ar: 'أضف بيانات البنك لاستلام أرباحك', en: 'Add bank details to receive your money', to: '/seller-center/store/payout', hideCount: true },
  ].filter((r) => r.n > 0);

  return (
    <Card title={isAr ? 'يحتاج انتباهك' : 'Needs your attention'} bodyClassName="p-2">
      {rows.length === 0 ? (
        <div className="flex items-center gap-3 p-4 text-sm text-emerald-700">
          <CheckCircle2 className="h-6 w-6" />{isAr ? 'كل شيء على ما يرام — لا توجد مهام معلقة.' : "You're all caught up — nothing waiting."}
        </div>
      ) : (
        <ul>
          {rows.map((r) => (
            <li key={r.to}>
              <Link to={r.to} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-slate-50">
                <span className={`rounded-lg p-2 ${r.tone}`}><r.Icon className="h-4 w-4" aria-hidden /></span>
                <span className="flex-1 text-sm font-medium">{isAr ? r.ar : r.en}</span>
                {!r.hideCount && <span className="text-lg font-extrabold tabular-nums">{r.n}</span>}
                <Arrow className="h-4 w-4 text-slate-400" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function LatestNotifications({ isAr }) {
  const [items, setItems] = useState(null);
  useEffect(() => {
    sellerApi.getNotifications({ limit: 5 }).then(({ data }) => setItems(data.data || [])).catch(() => setItems([]));
  }, []);
  return (
    <Card title={isAr ? 'آخر الإشعارات' : 'Latest notifications'} action={<Link to="/seller-center/notifications" className="text-xs font-semibold text-indigo-700 hover:underline">{isAr ? 'الكل' : 'See all'}</Link>} bodyClassName="p-0">
      {!items ? <div className="p-6"><Loader size="sm" /></div> : items.length === 0 ? (
        <p className="flex items-center gap-2 p-5 text-sm text-slate-500"><Bell className="h-4 w-4" />{isAr ? 'لا توجد إشعارات بعد' : 'No notifications yet'}</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map((n) => (
            <li key={n._id}>
              <Link to={n.link?.startsWith('/seller-center') ? n.link : '/seller-center/notifications'} className={`block px-5 py-3 text-sm hover:bg-slate-50 ${n.readAt ? '' : 'bg-indigo-50/40'}`}>
                <p className="font-semibold">{isAr ? n.titleAr : n.titleEn}</p>
                <p className="line-clamp-1 text-slate-600">{isAr ? n.messageAr : n.messageEn}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default function SellerDashboardPage() {
  const { seller, me, isAr, summary } = useOutletContext();
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    sellerApi.getHome({ days })
      .then(({ data: res }) => { if (!cancelled) { setData(res.data); setError(false); } })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [days]);

  if (error && !data) return <p className="rounded-2xl bg-red-50 p-4 text-sm text-red-800">{isAr ? 'تعذّر تحميل لوحة التحكم' : 'Could not load the dashboard'}</p>;
  if (!data) return <div className="flex min-h-[40vh] items-center justify-center"><Loader size="lg" /></div>;

  const { sales, balance, performance, listings } = data;
  const health = HEALTH[performance?.health] || HEALTH.good;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? (isAr ? 'صباح الخير' : 'Good morning') : (isAr ? 'مساء الخير' : 'Good evening');
  const periods = [7, 30, 90].map((d) => ({ value: d, label: isAr ? `${d} يوم` : `${d} days` }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{greeting}{isAr ? '، ' : ', '}{me.user.name.split(' ')[0]} 👋</h1>
          <p className="text-sm text-slate-500">{isAr ? 'هذا ملخص متجرك اليوم.' : "Here's how your store is doing."}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented options={periods} value={days} onChange={setDays} />
          <Link to="/seller-center/products/new" className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 sm:hidden">
            <Plus className="h-4 w-4" />{isAr ? 'إضافة منتج' : 'Add product'}
          </Link>
        </div>
      </div>

      <Onboarding checklist={data.checklist} isAr={isAr} />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label={isAr ? 'المبيعات' : 'Sales'} value={formatPrice(sales.gross)} icon={Receipt} delta={sales.change.gross} isAr={isAr} to="/seller-center/reports" />
        <KpiCard label={isAr ? 'الطلبات' : 'Orders'} value={fmtNumber(sales.orders, isAr)} icon={ShoppingBag} tone="text-violet-600 bg-violet-50" delta={sales.change.orders} isAr={isAr} to="/seller-center/orders" />
        <KpiCard label={isAr ? 'القطع المباعة' : 'Units sold'} value={fmtNumber(sales.units, isAr)} icon={Boxes} tone="text-sky-600 bg-sky-50" delta={sales.change.units} isAr={isAr} />
        <KpiCard label={isAr ? 'متوسط قيمة الطلب' : 'Average order'} value={formatPrice(sales.avgOrder)} icon={Tags} tone="text-emerald-600 bg-emerald-50" hint={isAr ? `مقارنة بآخر ${days} يوم قبلها` : `vs the ${days} days before`} isAr={isAr} />
      </section>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card
            title={isAr ? 'المبيعات اليومية' : 'Daily sales'}
            action={<Link to="/seller-center/reports" className="text-xs font-semibold text-indigo-700 hover:underline">{isAr ? 'التقرير الكامل' : 'Full report'}</Link>}
          >
            <SalesChart series={data.series} isAr={isAr} />
          </Card>

          <Card title={isAr ? 'الأكثر مبيعاً' : 'Top products'} bodyClassName="p-0">
            {data.topProducts.length === 0 ? (
              <p className="p-5 text-sm text-slate-500">{isAr ? 'لا توجد مبيعات في هذه الفترة بعد.' : 'No sales in this period yet.'}</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500">
                  <tr>
                    <th className="px-5 py-2 text-start">{isAr ? 'المنتج' : 'Product'}</th>
                    <th className="px-3 py-2 text-end">{isAr ? 'قطع' : 'Units'}</th>
                    <th className="px-5 py-2 text-end">{isAr ? 'المبيعات' : 'Sales'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.topProducts.map((p, i) => (
                    <tr key={p.product || i}>
                      <td className="px-5 py-2.5">
                        <Link to={p.product ? `/seller-center/products/${p.product}` : '/seller-center/products'} className="flex items-center gap-3 hover:text-indigo-700">
                          <span className="w-4 text-xs font-bold text-slate-400">{i + 1}</span>
                          {p.image ? <img src={p.image} alt="" className="h-9 w-9 rounded-lg object-cover" /> : <span className="h-9 w-9 rounded-lg bg-slate-100" />}
                          <span className="truncate font-medium">{isAr ? p.nameAr : p.nameEn}</span>
                        </Link>
                      </td>
                      <td className="px-3 py-2.5 text-end tabular-nums">{fmtNumber(p.units, isAr)}</td>
                      <td className="px-5 py-2.5 text-end font-semibold tabular-nums">{formatPrice(p.gross)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <ActionCenter data={data} summary={summary} seller={seller} isAr={isAr} />

          <Card title={isAr ? 'رصيدك' : 'Your balance'} action={<Link to="/seller-center/finance" className="text-xs font-semibold text-indigo-700 hover:underline">{isAr ? 'التفاصيل' : 'Details'}</Link>}>
            <p className="flex items-center gap-2 text-sm text-slate-500"><Wallet className="h-4 w-4 text-emerald-600" />{isAr ? 'متاح للتحويل' : 'Available for payout'}</p>
            <p className="mt-1 text-3xl font-extrabold tabular-nums text-emerald-700">{formatPrice(balance.available)}</p>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs text-slate-500">{isAr ? 'قيد الانتظار' : 'Pending'}</p>
                <p className="font-bold tabular-nums">{formatPrice(balance.pending)}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs text-slate-500">{isAr ? 'حُوّل لك' : 'Paid out'}</p>
                <p className="font-bold tabular-nums">{formatPrice(balance.paidOut)}</p>
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-500">{isAr ? `تُتاح المبيعات بعد ${data.payoutHoldDays} يوماً من التسليم.` : `Sales become available ${data.payoutHoldDays} days after delivery.`}</p>
          </Card>

          <Card title={isAr ? 'صحة الحساب' : 'Account health'} action={<Link to="/seller-center/performance" className="text-xs font-semibold text-indigo-700 hover:underline">{isAr ? 'التفاصيل' : 'Details'}</Link>}>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ring-1 ${health.tone}`}>
              <health.Icon className="h-4 w-4" aria-hidden />{isAr ? health.ar : health.en}
            </span>
            <dl className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
              <div className="rounded-xl bg-slate-50 p-2">
                <dt className="text-[11px] text-slate-500">{isAr ? 'التقييم' : 'Rating'}</dt>
                <dd className="font-bold">{performance.ratingCount ? performance.rating.toFixed(1) : '—'}</dd>
              </div>
              <div className="rounded-xl bg-slate-50 p-2">
                <dt className="text-[11px] text-slate-500">{isAr ? 'الإلغاء' : 'Cancels'}</dt>
                <dd className="font-bold">{performance.cancelRate}%</dd>
              </div>
              <div className="rounded-xl bg-slate-50 p-2">
                <dt className="text-[11px] text-slate-500">{isAr ? 'تأخير الشحن' : 'Late ship'}</dt>
                <dd className="font-bold">{performance.lateShipRate}%</dd>
              </div>
            </dl>
          </Card>

          <Card title={isAr ? 'منتجاتك' : 'Your listings'}>
            <ul className="space-y-2 text-sm">
              {[
                ['approved', isAr ? 'معروضة' : 'Live', 'bg-emerald-500'],
                ['pending_review', isAr ? 'بانتظار المراجعة' : 'In review', 'bg-amber-400'],
                ['draft', isAr ? 'مسودات' : 'Drafts', 'bg-slate-400'],
                ['rejected', isAr ? 'مرفوضة' : 'Rejected', 'bg-red-500'],
                ['paused', isAr ? 'متوقفة' : 'Paused', 'bg-slate-300'],
              ].map(([key, text, dot]) => (
                <li key={key}>
                  <Link to={`/seller-center/products?listingStatus=${key}`} className="flex items-center gap-2 rounded-lg px-1 py-1 hover:bg-slate-50">
                    <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
                    <span className="flex-1">{text}</span>
                    <span className="font-bold tabular-nums">{listings[key] || 0}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>

          <LatestNotifications isAr={isAr} />
        </div>
      </div>
    </div>
  );
}
