import { Check } from 'lucide-react';
import { RETURN_FLOW_STEPS, returnFlowStepIndex } from '../../constants/returnFlow';
import ReturnProgressLine from './ReturnProgressLine';

/** Admin: tap return fulfillment steps (after approval) */
export default function ReturnFlowSteps({
  returnItem,
  isAr,
  updating = false,
  onFulfillmentChange,
  compact = false,
}) {
  if (!returnItem || returnItem.status === 'rejected') return null;

  const activeIdx = returnFlowStepIndex(returnItem);
  const canAdvance = returnItem.status === 'approved';

  const handleSelect = (value) => {
    if (!canAdvance || updating || !onFulfillmentChange) return;
    if (value === 'requested') return;
    onFulfillmentChange(value);
  };

  return (
    <div className={[
      'rounded-lg border border-border bg-slate-50/80',
      compact ? 'space-y-1.5 p-2' : 'space-y-4 rounded-xl p-3',
    ].join(' ')}>
      <p className={compact ? 'text-[10px] font-semibold text-text-muted' : 'text-xs font-semibold text-text-muted'}>
        {canAdvance
          ? (isAr ? 'اضغط لتحديث مرحلة الاسترجاع' : 'Tap to update return stage')
          : (isAr ? 'مسار الاسترجاع (يُفعّل بعد الموافقة)' : 'Return path (active after approval)')}
      </p>

      <div className={compact ? 'grid grid-cols-4 gap-1' : 'grid grid-cols-2 gap-2 sm:grid-cols-4'}>
        {RETURN_FLOW_STEPS.map((step, index) => {
          const completed = activeIdx > index;
          const active = activeIdx === index;
          const label = isAr ? step.labelAr : step.labelEn;
          const disabled = !canAdvance || step.value === 'requested' || updating;

          return (
            <button
              key={step.step}
              type="button"
              disabled={disabled}
              onClick={() => handleSelect(step.value)}
              className={[
                'flex flex-col items-center text-center transition-all',
                compact ? 'rounded-md border px-1 py-1' : 'rounded-xl border-2 px-1.5 py-2',
                canAdvance && !disabled ? 'hover:shadow-md active:scale-[0.98]' : '',
                'disabled:cursor-default disabled:opacity-70',
                completed ? `${step.border} ${step.bgActive}` : '',
                active ? `${step.ring} ring-2 ${step.bgActive} ${step.border}` : '',
                !completed && !active ? 'border-border bg-white' : '',
              ].join(' ')}
            >
              <span className={compact ? 'text-xs' : 'mb-0.5 text-sm'}>{step.timelineIcon}</span>
              <span className={`font-bold leading-tight ${compact ? 'text-[9px]' : 'text-[10px]'} ${active || completed ? step.text : 'text-text-muted'}`}>
                {label}
              </span>
              {active && canAdvance && <Check className={`mt-0.5 h-3 w-3 ${step.text}`} strokeWidth={3} />}
            </button>
          );
        })}
      </div>

      <ReturnProgressLine returnItem={returnItem} isAr={isAr} compact />
    </div>
  );
}
