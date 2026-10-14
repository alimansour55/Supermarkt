import { ArrowDownLeft, ArrowUpRight, Scale, Wallet } from 'lucide-react';
import { formatPrice } from '../../../utils/formatters';

const TYPE_COPY = {
  collect: { ar: 'تحصيل', en: 'Collected', icon: ArrowDownLeft, tone: 'text-emerald-700 bg-emerald-50' },
  handover: { ar: 'تسليم للفرع', en: 'Handed to store', icon: ArrowUpRight, tone: 'text-sky-700 bg-sky-50' },
  adjust: { ar: 'تسوية', en: 'Adjustment', icon: Scale, tone: 'text-amber-700 bg-amber-50' },
};

/** Cash the driver holds for the store, and the latest movements. */
export default function DriverCashCard({ summary, isAr }) {
  if (!summary) return null;
  const { balance = 0, entries = [] } = summary;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-3 border-b border-slate-100 bg-gradient-to-br from-violet-50 to-white px-4 py-4">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
          <Wallet className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {isAr ? 'النقدية معك' : 'Cash in hand'}
          </p>
          <p className="text-2xl font-bold tabular-nums text-slate-900">{formatPrice(balance)}</p>
        </div>
      </div>
      {balance > 0 && (
        <p className="border-b border-slate-100 px-4 py-2.5 text-xs text-slate-500">
          {isAr
            ? 'سلّم هذا المبلغ للفرع في نهاية الوردية — المسؤول يسجّل الاستلام.'
            : 'Hand this to the store at the end of your shift — the store records it.'}
        </p>
      )}
      {entries.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-slate-400">
          {isAr ? 'لا توجد حركات نقدية بعد' : 'No cash movements yet'}
        </p>
      ) : (
        <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto">
          {entries.slice(0, 20).map((entry) => {
            const copy = TYPE_COPY[entry.type] || TYPE_COPY.adjust;
            const Icon = copy.icon;
            return (
              <li key={entry._id} className="flex items-center gap-3 px-4 py-2.5">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${copy.tone}`}>
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-800">
                    {isAr ? copy.ar : copy.en}
                    {entry.orderNumber && <span className="ms-1 font-mono text-xs text-slate-500">#{entry.orderNumber}</span>}
                  </p>
                  <p className="truncate text-xs text-slate-400">
                    {new Date(entry.createdAt).toLocaleString(isAr ? 'ar-EG' : undefined, {
                      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                    })}
                    {entry.note && !entry.orderNumber ? ` · ${entry.note}` : ''}
                  </p>
                </div>
                <span className={`shrink-0 text-sm font-semibold tabular-nums ${entry.amount < 0 ? 'text-slate-600' : 'text-emerald-700'}`} dir="ltr">
                  {entry.amount > 0 ? '+' : '−'}{formatPrice(Math.abs(entry.amount))}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
