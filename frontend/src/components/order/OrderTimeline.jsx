import { Check } from 'lucide-react';
import { ORDER_TIMELINE, orderTimelineIndex } from '../../utils/orderStatus';

function findStepTime(step, statusHistory, createdAt) {
  const match = statusHistory?.find((h) => step.statuses.includes(h.status));
  if (match?.changedAt) return new Date(match.changedAt);
  if (step.step === 'placed' && createdAt) return new Date(createdAt);
  return null;
}

export default function OrderTimeline({ order, isAr }) {
  const currentStatus = order.orderStatus || order.status;
  const activeIdx = orderTimelineIndex(currentStatus);
  const history = order.statusHistory || [];
  const cancelled = currentStatus === 'cancelled';

  if (cancelled) {
    return (
      <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
        {isAr ? 'تم إلغاء هذا الطلب' : 'This order was cancelled'}
      </p>
    );
  }

  return (
    <ol className="relative flex justify-between gap-1">
      {ORDER_TIMELINE.map((step, index) => {
        const completed = activeIdx >= 0 && index < activeIdx;
        const active = index === activeIdx;
        const upcoming = activeIdx >= 0 && index > activeIdx;
        const time = findStepTime(step, history, order.createdAt);

        return (
          <li key={step.step} className="flex flex-1 flex-col items-center text-center">
            <div
              className={[
                'flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors',
                completed ? 'border-primary-600 bg-primary-600 text-white' : '',
                active ? 'border-primary-600 bg-white text-primary-600 ring-4 ring-primary-100' : '',
                upcoming ? 'border-slate-200 bg-white text-slate-300' : '',
              ].join(' ')}
            >
              {completed ? <Check className="h-4 w-4" strokeWidth={3} /> : index + 1}
            </div>
            <p
              className={[
                'mt-2 text-xs font-medium leading-tight',
                active || completed ? 'text-text' : 'text-text-muted',
              ].join(' ')}
            >
              {isAr ? step.labelAr : step.labelEn}
            </p>
            {time && (completed || active) && (
              <p className="mt-0.5 text-[10px] text-text-muted">
                {time.toLocaleDateString(isAr ? 'ar-EG' : 'en-GB', { month: 'short', day: 'numeric' })}
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
