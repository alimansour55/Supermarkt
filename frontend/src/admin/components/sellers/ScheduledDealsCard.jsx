import { useState } from 'react';
import { CalendarClock, X } from 'lucide-react';
import { useConfirm, useToast } from '../index';
import { adminApi } from '../../adminApi';
import { apiError } from '../../../seller/sellerLabels';
import { formatDate } from '../../../utils/formatters';
import { describeScheduledChanges } from '../../utils/sellerDeal';

const STATUS = {
  pending: { ar: 'بانتظار موعده', en: 'Waiting', tone: 'bg-amber-50 text-amber-800' },
  applied: { ar: 'طُبّق', en: 'Applied', tone: 'bg-emerald-50 text-emerald-700' },
  cancelled: { ar: 'أُلغي', en: 'Cancelled', tone: 'bg-slate-100 text-slate-600' },
};

/** Deal changes waiting for a date (and the last few done), with cancel. */
export default function ScheduledDealsCard({ sellerId, scheduled = [], isAr, canWrite, lookup, onChanged }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [busy, setBusy] = useState('');
  if (!scheduled.length) return null;

  const cancel = async (d) => {
    const ok = await confirm({
      title: isAr ? 'إلغاء التغيير المجدول؟' : 'Cancel this scheduled change?',
      message: isAr ? 'لن يُطبَّق في موعده.' : 'It will not be applied on its date.',
      confirmLabel: isAr ? 'إلغاء التغيير' : 'Cancel change',
      cancelLabel: isAr ? 'رجوع' : 'Back',
    });
    if (!ok) return;
    setBusy(d._id);
    try {
      await adminApi.cancelSellerDeal(sellerId, d._id);
      toast.success(isAr ? 'تم الإلغاء' : 'Cancelled');
      onChanged();
    } catch (err) {
      toast.error(apiError(err, isAr ? 'تعذّر الإلغاء' : 'Could not cancel'));
    } finally {
      setBusy('');
    }
  };

  return (
    <section className="rounded-2xl border border-amber-200 bg-white p-4">
      <h3 className="mb-2 flex items-center gap-1.5 font-bold"><CalendarClock className="h-4 w-4 text-amber-600" />{isAr ? 'تغييرات مجدولة' : 'Scheduled changes'}</h3>
      <ul className="space-y-2">
        {scheduled.map((d) => (
          <li key={d._id} className="rounded-xl border border-border p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold">
                {formatDate(d.applyAt, isAr ? 'ar-EG' : 'en-GB')}
                <span className={`ms-2 rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS[d.status]?.tone}`}>{isAr ? STATUS[d.status]?.ar : STATUS[d.status]?.en}</span>
              </p>
              {canWrite && d.status === 'pending' && (
                <button type="button" disabled={busy === d._id} onClick={() => cancel(d)} className="inline-flex items-center gap-1 text-xs font-semibold text-red-700">
                  <X className="h-3.5 w-3.5" />{isAr ? 'إلغاء' : 'Cancel'}
                </button>
              )}
            </div>
            <ul className="mt-1 text-xs text-text-muted">
              {describeScheduledChanges(d.changes, { isAr, lookup }).map((line) => <li key={line}>{line}</li>)}
            </ul>
            {(d.note || d.createdByName) && (
              <p className="mt-1 text-xs text-text-muted">{[d.note, d.createdByName && `${isAr ? 'بواسطة' : 'by'} ${d.createdByName}`].filter(Boolean).join(' · ')}</p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
