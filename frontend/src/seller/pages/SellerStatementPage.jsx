import { useEffect, useState } from 'react';
import { Link, useOutletContext, useParams } from '../../app/router';
import { ArrowLeft, ArrowRight, Download, Printer } from 'lucide-react';
import { useToast } from '../../components/ui/Toast';
import { sellerApi } from '../../services/sellerApi';
import { formatPrice } from '../../utils/formatters';
import { LEDGER_TYPE, PAYOUT_STATUS, apiError, label } from '../sellerLabels';
import StatusBadge from '../StatusBadge';
import { fmtDate, saveBlob } from '../sellerUtils';
import { PageSkeleton } from '../ui';

/** Printable statement of one payout: what was sold, every fee and deduction, the total paid. */
export default function SellerStatementPage() {
  const { id } = useParams();
  const { isAr } = useOutletContext();
  const toast = useToast();
  const [data, setData] = useState(null);

  useEffect(() => {
    sellerApi.getPayoutStatement(id).then(({ data: d }) => setData(d.data)).catch((err) => { toast.error(apiError(err, isAr ? 'تعذّر التحميل' : 'Could not load')); setData(false); });
  }, [id, isAr, toast]);

  const csv = async () => {
    try {
      saveBlob(await sellerApi.downloadPayoutStatement(id), 'statement.csv');
    } catch (err) {
      toast.error(apiError(err, isAr ? 'تعذّر التحميل' : 'Download failed'));
    }
  };

  if (data === null) return <PageSkeleton />;
  if (!data) return <p className="rounded-2xl bg-white p-6 text-sm">{isAr ? 'الكشف غير موجود.' : 'Statement not found.'}</p>;
  const Back = isAr ? ArrowRight : ArrowLeft;
  const { payout, seller, totals, entries } = data;

  return (
    <div className="mx-auto max-w-4xl">
      <style>{`@media print { body * { visibility: hidden; } #statement, #statement * { visibility: visible; } #statement { position: absolute; inset: 0; box-shadow: none; border: 0; } }`}</style>
      <div className="mb-4 flex flex-wrap items-center gap-2 print:hidden">
        <Link to="/seller-center/finance" className="rounded-lg p-2 ring-1 ring-slate-200 hover:bg-white" aria-label={isAr ? 'رجوع' : 'Back'}><Back className="h-4 w-4" /></Link>
        <h1 className="me-auto text-xl font-bold">{isAr ? 'كشف التحويل' : 'Payout statement'}</h1>
        <button type="button" onClick={csv} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold ring-1 ring-slate-300 hover:bg-white"><Download className="h-4 w-4" />CSV</button>
        <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white"><Printer className="h-4 w-4" />{isAr ? 'طباعة / PDF' : 'Print / PDF'}</button>
      </div>

      <article id="statement" className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <p className="text-2xl font-extrabold">{isAr ? 'كشف حساب تحويل' : 'Payout statement'}</p>
            <p className="mt-1 font-mono text-sm" dir="ltr">{payout.payoutNumber}</p>
            <div className="mt-2"><StatusBadge map={PAYOUT_STATUS} value={payout.status} isAr={isAr} /></div>
          </div>
          <div className="text-sm text-end">
            <p className="font-bold">{isAr ? seller.nameAr : seller.nameEn}</p>
            {seller.legalName && <p>{seller.legalName}</p>}
            {seller.taxId && <p>{isAr ? 'رقم ضريبي: ' : 'Tax ID: '}<span dir="ltr">{seller.taxId}</span></p>}
            {seller.commercialRegisterNo && <p>{isAr ? 'سجل تجاري: ' : 'CR: '}<span dir="ltr">{seller.commercialRegisterNo}</span></p>}
          </div>
        </header>

        <dl className="grid gap-4 border-b border-slate-200 py-5 text-sm sm:grid-cols-4">
          <div><dt className="text-slate-500">{isAr ? 'حتى تاريخ' : 'Period end'}</dt><dd className="font-semibold">{fmtDate(payout.periodEnd, isAr)}</dd></div>
          <div><dt className="text-slate-500">{isAr ? 'تاريخ التحويل' : 'Paid on'}</dt><dd className="font-semibold">{payout.paidAt ? fmtDate(payout.paidAt, isAr) : '—'}</dd></div>
          <div><dt className="text-slate-500">{isAr ? 'مرجع التحويل' : 'Reference'}</dt><dd className="font-semibold" dir="ltr">{payout.referenceNumber || '—'}</dd></div>
          <div><dt className="text-slate-500">{isAr ? 'المبلغ المحوّل' : 'Amount paid'}</dt><dd className="text-lg font-extrabold">{formatPrice(payout.amount)}</dd></div>
        </dl>

        <section className="py-5">
          <h2 className="mb-2 font-bold">{isAr ? 'الملخص' : 'Summary'}</h2>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-100">
              {Object.entries(totals).map(([type, amount]) => (
                <tr key={type}><td className="py-1.5">{label(LEDGER_TYPE, type, isAr)}</td><td className={`py-1.5 text-end font-semibold tabular-nums ${amount < 0 ? 'text-red-700' : ''}`}>{formatPrice(amount)}</td></tr>
              ))}
              <tr className="border-t-2 border-slate-300"><td className="py-2 font-bold">{isAr ? 'الصافي' : 'Net'}</td><td className="py-2 text-end text-base font-extrabold tabular-nums">{formatPrice(Object.values(totals).reduce((a, b) => a + b, 0))}</td></tr>
            </tbody>
          </table>
        </section>

        <section>
          <h2 className="mb-2 font-bold">{isAr ? 'التفاصيل' : 'Details'} <span className="text-sm font-normal text-slate-500">({entries.length})</span></h2>
          <table className="w-full text-xs">
            <thead className="border-b border-slate-300 text-slate-500">
              <tr>
                <th className="py-1.5 text-start">{isAr ? 'التاريخ' : 'Date'}</th>
                <th className="py-1.5 text-start">{isAr ? 'النوع' : 'Type'}</th>
                <th className="py-1.5 text-start">{isAr ? 'المرجع' : 'Reference'}</th>
                <th className="py-1.5 text-end">{isAr ? 'المبلغ' : 'Amount'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {entries.map((e) => (
                <tr key={e._id}>
                  <td className="py-1.5">{fmtDate(e.date, isAr)}</td>
                  <td className="py-1.5">{label(LEDGER_TYPE, e.type, isAr)}{e.note ? ` — ${e.note}` : ''}</td>
                  <td className="py-1.5 font-mono" dir="ltr">{e.reference || '—'}</td>
                  <td className={`py-1.5 text-end tabular-nums ${e.amount < 0 ? 'text-red-700' : ''}`}>{formatPrice(e.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <p className="mt-6 text-[11px] text-slate-400">{isAr ? 'هذا الكشف صادر إلكترونياً من مركز البائعين.' : 'This statement was generated by Seller Center.'}</p>
      </article>
    </div>
  );
}
