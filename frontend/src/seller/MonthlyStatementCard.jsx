import { useEffect, useState } from 'react';
import { Download, FileText, Printer } from 'lucide-react';
import { downloadBlob } from '../admin/utils/downloadBlob';
import { feeInvoiceHtml, ledgerLabel, monthOptions, openPrintable, statementHtml } from './statementPrint';
import { apiError } from './sellerLabels';

const money = (n, isAr) => `${(Math.round((Number(n) || 0) * 100) / 100).toLocaleString('en-US', { maximumFractionDigits: 2 })} ${isAr ? 'ج.م' : 'EGP'}`;

/**
 * Monthly statement + fee invoice — used in the admin seller panel (Money tab) and in Seller
 * Center → Finance. `load(month)` and `exportCsv(month)` call the right API for each side.
 */
export default function MonthlyStatementCard({ isAr, load, exportCsv, onError, fileName = 'statement', className = '' }) {
  const [months] = useState(() => monthOptions(new Date(), 12, isAr));
  const [month, setMonth] = useState(months[0].value);
  const [data, setData] = useState(null);

  useEffect(() => {
    let alive = true;
    setData(null);
    load(month).then(({ data: d }) => { if (alive) setData(d.data); }).catch(() => { if (alive) setData({ error: true }); });
    return () => { alive = false; };
  }, [month, load]);

  const download = async () => {
    try {
      const res = await exportCsv(month);
      downloadBlob(res.data, `${fileName}-${month}.csv`);
    } catch (err) {
      onError?.(apiError(err, isAr ? 'تعذّر التنزيل' : 'Download failed'));
    }
  };
  const print = (html) => {
    if (!openPrintable(html)) onError?.(isAr ? 'اسمح بالنوافذ المنبثقة للطباعة' : 'Allow pop-ups to print');
  };

  const t = data?.totals;
  const tiles = t ? [
    ['sales', isAr ? 'المبيعات' : 'Sales', t.sales],
    ['returns', isAr ? 'المرتجعات' : 'Returns', -t.returns],
    ['fees', isAr ? 'الرسوم + الضريبة' : 'Fees + VAT', -t.feesWithVat],
    ['penalties', isAr ? 'الغرامات' : 'Penalties', -t.penalties],
    ['paid', isAr ? 'المحوَّل' : 'Paid out', -t.paidOut],
    ['net', isAr ? 'صافي الشهر' : 'Net for the month', t.net],
  ] : [];

  return (
    <section className={`rounded-2xl border border-border bg-white p-4 ${className}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 font-bold"><FileText className="h-4 w-4" />{isAr ? 'كشف الحساب الشهري' : 'Monthly statement'}</h3>
        <select className="rounded-lg border border-border px-2 py-1 text-sm" value={month} onChange={(e) => setMonth(e.target.value)}>
          {months.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </div>
      {!data ? <div className="h-24 animate-pulse rounded-xl bg-slate-100" /> : data.error ? (
        <p className="text-sm text-text-muted">{isAr ? 'تعذّر تحميل الكشف.' : 'Could not load the statement.'}</p>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
            {tiles.map(([k, l, v]) => (
              <div key={k} className={`rounded-xl p-2.5 ${k === 'net' ? 'bg-primary-50' : 'bg-slate-50'}`}>
                <dt className="text-xs text-text-muted">{l}</dt>
                <dd className={`font-semibold tabular-nums ${v < 0 ? 'text-red-700' : ''}`} dir="ltr">{money(v, isAr)}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-xs text-text-muted">
            {ledgerLabel('opening_balance', isAr)}: <span dir="ltr">{money(data.openingBalance, isAr)}</span> · {ledgerLabel('closing_balance', isAr)}: <span dir="ltr">{money(data.closingBalance, isAr)}</span> · {data.entries.length} {isAr ? 'حركة' : 'transactions'}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={download} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-slate-50"><Download className="h-4 w-4" />CSV</button>
            <button type="button" onClick={() => print(statementHtml(data, isAr))} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-slate-50"><Printer className="h-4 w-4" />{isAr ? 'طباعة الكشف' : 'Print statement'}</button>
            <button type="button" onClick={() => print(feeInvoiceHtml(data, isAr))} disabled={!t.invoiceLines.length} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"><Printer className="h-4 w-4" />{isAr ? 'فاتورة الرسوم' : 'Fee invoice'}</button>
          </div>
        </>
      )}
    </section>
  );
}
