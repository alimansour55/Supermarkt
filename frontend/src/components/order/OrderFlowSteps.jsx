import { Check, CheckCircle2, Circle, Inbox, Package, Truck, XCircle } from 'lucide-react';
import {
  ORDER_FLOW_STEPS,
  ORDER_OUTCOMES,
  orderFlowStepIndex,
} from '../../constants/orderFlow';
import OrderProgressLine from './OrderProgressLine';
import { scrollToTop } from '../../utils/scrollToTop';

const STEP_ICONS = {
  received: Inbox,
  preparing: Package,
  out_for_delivery: Truck,
  delivered: CheckCircle2,
  delivery_failed: XCircle,
};

const SHORT_LABELS = {
  pending: { ar: 'استلام', en: 'Received' },
  preparing: { ar: 'تحضير', en: 'Preparing' },
  out_for_delivery: { ar: 'في الطريق', en: 'On the way' },
  delivered: { ar: 'تسليم', en: 'Delivered' },
  delivery_failed: { ar: 'فشل', en: 'Failed' },
};

function StepIcon({ stepKey, className }) {
  const Icon = STEP_ICONS[stepKey] || Circle;
  return <Icon className={className} strokeWidth={2} aria-hidden />;
}

function shortLabel(value, isAr, fallback) {
  const entry = SHORT_LABELS[value];
  if (entry) return isAr ? entry.ar : entry.en;
  return fallback;
}

export default function OrderFlowSteps({
  order,
  isAr,
  interactive = false,
  updating = false,
  onStatusChange,
  onRequestDeliveryFailed,
}) {
  const currentStatus = order?.orderStatus || order?.status || 'pending';
  const activeIdx = orderFlowStepIndex(currentStatus);
  const cancelled = currentStatus === 'cancelled';
  const isOutcome = currentStatus === 'delivered' || currentStatus === 'delivery_failed';

  if (cancelled) {
    return <OrderProgressLine order={order} isAr={isAr} />;
  }

  const handleSelect = (status) => {
    if (!interactive || updating || !onStatusChange || status === currentStatus) return;
    if (status === 'delivery_failed') {
      onRequestDeliveryFailed?.();
      return;
    }
    scrollToTop();
    onStatusChange(status);
  };

  if (!interactive) {
    return <OrderProgressLine order={order} isAr={isAr} />;
  }

  const allSteps = [
    ...ORDER_FLOW_STEPS.map((step) => ({
      value: step.value,
      label: shortLabel(step.value, isAr, isAr ? step.labelAr : step.labelEn),
      fullLabel: isAr ? step.labelAr : step.labelEn,
      iconKey: step.step,
    })),
    ...ORDER_OUTCOMES.map((outcome) => ({
      value: outcome.value,
      label: shortLabel(outcome.value, isAr, isAr ? outcome.labelAr : outcome.labelEn),
      fullLabel: isAr ? outcome.labelAr : outcome.labelEn,
      iconKey: outcome.value,
      isOutcome: true,
    })),
  ];

  const progressIdx = isOutcome
    ? ORDER_FLOW_STEPS.length + ORDER_OUTCOMES.findIndex((o) => o.value === currentStatus)
    : activeIdx;

  const progressWidth = `${Math.max(0, (progressIdx / Math.max(allSteps.length - 1, 1)) * 100)}%`;

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="relative rounded-xl bg-slate-50/80 px-2 py-5 sm:px-4">
      <div
        className="absolute top-[26px] h-px bg-slate-200/90 start-[10%] end-[10%] sm:top-[28px]"
        aria-hidden
      />
      <div
        className="absolute top-[26px] h-px bg-primary-500 transition-all duration-500 ease-out start-[10%] sm:top-[28px]"
        style={{ width: `calc(${progressWidth} * 0.8)` }}
        aria-hidden
      />

      <ol className="relative flex items-start justify-between gap-1">
        {allSteps.map((step, index) => {
          const completed = progressIdx > index;
          const active = progressIdx === index;
          const upcoming = progressIdx < index;
          const isFailed = step.value === 'delivery_failed';
          const isDelivered = step.value === 'delivered';

          return (
            <li key={step.value} className="flex min-w-0 flex-1 flex-col items-center">
              <button
                type="button"
                disabled={updating}
                onClick={() => handleSelect(step.value)}
                title={step.fullLabel}
                aria-label={step.fullLabel}
                aria-current={active ? 'step' : undefined}
                className={[
                  'group relative z-10 flex h-11 w-11 items-center justify-center rounded-full transition-all duration-200 sm:h-12 sm:w-12',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                  completed
                    ? 'bg-primary-600 text-white shadow-sm hover:bg-primary-700'
                    : '',
                  active && !isFailed && !isDelivered
                    ? 'bg-white text-primary-700 shadow-md ring-[3px] ring-primary-200'
                    : '',
                  active && isDelivered
                    ? 'bg-emerald-600 text-white shadow-md ring-[3px] ring-emerald-200'
                    : '',
                  active && isFailed
                    ? 'bg-red-600 text-white shadow-md ring-[3px] ring-red-200'
                    : '',
                  upcoming
                    ? 'border border-slate-200/90 bg-white text-slate-400 hover:border-primary-300 hover:text-primary-600'
                    : '',
                ].join(' ')}
              >
                {completed ? (
                  <Check className="h-4 w-4 sm:h-[18px] sm:w-[18px]" strokeWidth={2.5} />
                ) : (
                  <StepIcon
                    stepKey={step.iconKey}
                    className={[
                      'h-4 w-4 sm:h-[18px] sm:w-[18px] transition-transform group-hover:scale-105',
                      active && step.value === 'out_for_delivery' ? 'animate-pulse' : '',
                    ].join(' ')}
                  />
                )}
              </button>
              <span
                className={[
                  'mt-2.5 max-w-[3.5rem] text-center text-[10px] font-semibold leading-tight sm:max-w-[4.5rem] sm:text-[11px]',
                  active ? 'text-text' : '',
                  completed ? 'text-text-muted' : '',
                  upcoming ? 'text-text-muted/70' : '',
                ].join(' ')}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
