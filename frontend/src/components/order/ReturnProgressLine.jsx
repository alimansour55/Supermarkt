import { Check } from 'lucide-react';
import {
  RETURN_FLOW_STEPS,
  returnFlowStepIndex,
  resolveReturnFulfillment,
} from '../../constants/returnFlow';

/** 4-step return progress line — synced for customer and admin read-only views */
export default function ReturnProgressLine({ returnItem, isAr, compact = false }) {
  if (!returnItem || returnItem.status === 'rejected') {
    return null;
  }

  const fulfillment = resolveReturnFulfillment(returnItem);
  const activeIdx = returnFlowStepIndex(returnItem);
  const progressPercent = RETURN_FLOW_STEPS.length > 1
    ? (activeIdx / (RETURN_FLOW_STEPS.length - 1)) * 100
    : 0;

  const dotSize = compact ? 'h-9 w-9 text-base' : 'h-11 w-11 text-lg';
  const labelClass = compact ? 'text-[9px]' : 'text-[10px]';

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="mt-3 w-full">
      <p className="mb-2 text-center text-xs font-semibold text-text-muted">
        {isAr ? 'مسار الاسترجاع' : 'Return progress'}
      </p>
      <div className="relative px-1">
        <div
          className="absolute top-4 sm:top-5 h-1 rounded-full bg-slate-200 start-[10%] end-[10%]"
          aria-hidden
        />
        <div
          className={[
            'absolute top-4 sm:top-5 h-1 rounded-full transition-all duration-500 start-[10%]',
            isAr ? 'bg-gradient-to-l from-green-500 via-purple-500 to-amber-500' : 'bg-gradient-to-r from-amber-500 via-blue-500 to-green-500',
          ].join(' ')}
          style={{ width: `${Math.max(0, progressPercent * 0.8)}%` }}
          aria-hidden
        />
        <ol className="relative flex items-start justify-between gap-0.5">
          {RETURN_FLOW_STEPS.map((step, index) => {
            const completed = activeIdx >= 0 && index < activeIdx;
            const active = activeIdx >= 0 && index === activeIdx;
            const upcoming = activeIdx >= 0 && index > activeIdx;

            return (
              <li key={step.step} className="flex min-w-0 flex-1 flex-col items-center text-center">
                <span
                  className={[
                    'relative z-10 flex shrink-0 items-center justify-center rounded-full border-2 shadow-sm transition-all',
                    dotSize,
                    completed ? `${step.bgDone} border-transparent text-white` : '',
                    active ? `bg-white ${step.ring} ring-2 ${step.text} border-transparent scale-105` : '',
                    upcoming ? 'border-slate-200 bg-white text-slate-300' : '',
                  ].join(' ')}
                >
                  {completed ? (
                    <Check className="h-4 w-4" strokeWidth={3} aria-hidden />
                  ) : (
                    <span
                      className={[
                        'leading-none',
                        active && step.value === 'pickup_en_route' ? 'animate-bounce' : '',
                      ].join(' ')}
                      aria-hidden
                    >
                      {step.timelineIcon}
                    </span>
                  )}
                </span>
                <p
                  className={[
                    'mt-1.5 max-w-[4rem] font-bold leading-tight sm:max-w-[5rem]',
                    labelClass,
                    completed || active ? step.text : 'text-text-muted',
                  ].join(' ')}
                >
                  {isAr ? step.labelAr : step.labelEn}
                </p>
                {active && step.value === 'pickup_en_route' && (
                  <span className="mt-0.5 text-[9px] font-semibold text-purple-600">
                    {isAr ? 'في الطريق' : 'On the way'}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </div>
      {returnItem.status === 'pending' && (
        <p className="mt-2 text-center text-xs text-amber-700">
          {isAr ? 'بانتظار موافقة المتجر على الإرجاع' : 'Awaiting store approval'}
        </p>
      )}
      {fulfillment === 'completed' && (
        <p className="mt-2 text-center text-xs font-medium text-green-800">
          {isAr ? 'تم استلام المنتج — تم تحديث حالة الطلب' : 'Product received — order status updated'}
        </p>
      )}
    </div>
  );
}
