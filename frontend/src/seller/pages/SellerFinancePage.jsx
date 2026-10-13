import { useCallback, useEffect, useState } from 'react';
import { Link, useOutletContext } from '../../app/router';
import { Clock, Landmark, Wallet, CheckCircle2, Info } from 'lucide-react';
import Loader from '../../components/ui/Loader';
import { useToast } from '../../components/ui/Toast';
import { sellerApi } from '../../services/sellerApi';
import { formatPrice } from '../../utils/formatters';
import { LEDGER_TYPE, PAYOUT_STATUS, label } from '../sellerLabels';
import StatusBadge from '../StatusBadge';

function fmtDate(value, isAr) {
  return value ? new Date(value).toLocaleDateString(isAr ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
}

function Card({ icon: Icon, tone, title, value, hint }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="flex items-center gap-2 text-sm text-slate-500"><Icon className={`h-5 w-5 ${tone}`} aria-hidden />{title}</p>
      <p className={`mt-3 text-2xl font-extrabold tabular-nums ${value < 0 ? 'text-red-700' : ''}`}>{formatPrice(value)}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </article>
  );
}

export default function SellerFinancePage() {
  const { isAr, seller } = useOutletContext();
  const toast = useToast();
  const [finance, setFinance] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);

  useEffect(() => {
    sellerApi.getFinance().then(({ data }) => setFinance(data.data))
      .catch(() => toast.error(isAr ? 'تعذّر تحميل الأرباح' : 'Could not load earnings'));
  }, [isAr, toast]);

  const loadLedger = useCallback(() => {
    sellerApi.getLedger({ page, limit: 30 })
      .then(({ data }) => { setLedger(data.data || []); setPages(data.pagination?.pages || 1); })
      .catch(() => {});
  }, [page]);
  useEffect(() => { loadLedger(); }, [loadLedger]);

  if (!finance) return <div className="flex min-h-[40vh] items-center justify-center"><Loader size="lg" /></div>;
  const { balance } = finance;
  const hasPayoutDetails = Boolean(seller.bank?.accountNumber || seller.bank?.iban || seller.bank?.walletPhone);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{isAr ? 'الأرباح والمدفوعات' : 'Earnings & payouts'}</h1>

      {!hasPayoutDetails && (
        <Link to="/seller-center/store/payout" className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 hover:bg-amber-100">
          <Landmark className="h-5 w-5 shrink-0" aria-hidden />
          {isAr ? 'أضف بيانات حسابك البنكي أو محفظتك لتصلك أرباحك ←' : 'Add your bank account or wallet so we can pay you →'}
        </Link>
      )}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card icon={Wallet} tone="text-emerald-600" title={isAr ? 'متاح للتحويل' : 'Available'} value={balance.available}
          hint={balance.available < 0
            ? (isAr ? 'مستحق عليك (عمولات على مبيعات حصّلت نقديتها)' : 'You owe this (commission on cash you collected)')
            : (isAr ? `يُحوّل عند تجاوز ${formatPrice(finance.minPayoutAmount)}` : `Paid out once above ${formatPrice(finance.minPayoutAmount)}`)} />
        <Card icon={Clock} tone="text-amber-600" title={isAr ? 'قيد الانتظار' : 'On hold'} value={balance.pending}
          hint={isAr ? `يُتاح بعد ${finance.payoutHoldDays} يوماً من التسليم` : `Released ${finance.payoutHoldDays} days after delivery`} />
        <Card icon={Landmark} tone="text-indigo-600" title={isAr ? 'جاري تحويله' : 'Being transferred'} value={balance.inPayout} />
        <Card icon={CheckCircle2} tone="text-slate-500" title={isAr ? 'تم تحويله إجمالاً' : 'Paid to you so far'} value={balance.paidOut} />
      </section>

      <p className="flex items-start gap-2 text-xs text-slate-500">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        {isAr
          ? 'تُحتسب أرباح كل شحنة عند تسليمها: قيمة المنتجات ورسوم التوصيل، مخصوماً منها العمولة ورسوم الشحن والنقدية التي حصّلتها بنفسك.'
          : 'Each shipment is credited on delivery: items plus delivery fee, minus commission, fulfillment fees and any cash you collected yourself.'}
      </p>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <h2 className="border-b border-slate-100 px-5 py-3 font-bold">{isAr ? 'التحويلات' : 'Payouts'}</h2>
        {!finance.payouts.length ? (
          <p className="p-5 text-sm text-slate-500">{isAr ? 'لا توجد تحويلات بعد.' : 'No payouts yet.'}</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {finance.payouts.map((p) => (
              <li key={p._id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                <span className="font-semibold" dir="ltr">{p.payoutNumber}</span>
                <span className="text-slate-500">{fmtDate(p.paidAt || p.createdAt, isAr)}</span>
                {p.referenceNumber && <span className="text-xs text-slate-500" dir="ltr">{p.referenceNumber}</span>}
                <span className="ms-auto font-bold tabular-nums">{formatPrice(p.amount)}</span>
                <StatusBadge map={PAYOUT_STATUS} value={p.status} isAr={isAr} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <h2 className="border-b border-slate-100 px-5 py-3 font-bold">{isAr ? 'كشف الحساب' : 'Statement'}</h2>
        {!ledger.length ? (
          <p className="p-5 text-sm text-slate-500">{isAr ? 'لا توجد حركات بعد — تظهر أرباحك هنا عند تسليم أول طلب.' : 'No activity yet — earnings appear here when your first order is delivered.'}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-5 py-2 text-start">{isAr ? 'التاريخ' : 'Date'}</th>
                  <th className="px-5 py-2 text-start">{isAr ? 'البيان' : 'Description'}</th>
                  <th className="px-5 py-2 text-start">{isAr ? 'المرجع' : 'Reference'}</th>
                  <th className="px-5 py-2 text-end">{isAr ? 'المبلغ' : 'Amount'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ledger.map((e) => (
                  <tr key={e._id}>
                    <td className="px-5 py-2 text-slate-500">{fmtDate(e.createdAt, isAr)}</td>
                    <td className="px-5 py-2">
                      {label(LEDGER_TYPE, e.type, isAr)}
                      {e.note && <span className="block text-xs text-slate-500">{e.note}</span>}
                    </td>
                    <td className="px-5 py-2 text-xs text-slate-500" dir="ltr">{e.reference}</td>
                    <td className={`px-5 py-2 text-end font-semibold tabular-nums ${e.amount < 0 ? 'text-red-700' : 'text-emerald-700'}`} dir="ltr">
                      {e.amount > 0 ? '+' : ''}{formatPrice(e.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {pages > 1 && (
          <div className="flex items-center justify-center gap-2 border-t border-slate-100 p-3 text-sm">
            <button type="button" disabled={page <= 1} onClick={() => setPage((n) => n - 1)} className="rounded-lg px-3 py-1.5 ring-1 ring-slate-200 disabled:opacity-40">{isAr ? 'السابق' : 'Previous'}</button>
            <span>{page} / {pages}</span>
            <button type="button" disabled={page >= pages} onClick={() => setPage((n) => n + 1)} className="rounded-lg px-3 py-1.5 ring-1 ring-slate-200 disabled:opacity-40">{isAr ? 'التالي' : 'Next'}</button>
          </div>
        )}
      </section>
    </div>
  );
}
