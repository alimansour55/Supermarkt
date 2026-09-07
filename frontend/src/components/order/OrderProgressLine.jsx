import { Check, CheckCircle2, Circle, Inbox, Package, Truck, XCircle } from 'lucide-react';
import {
  getTimelinePoints,
  getTimelineProgressIndex,
  orderFlowStepIndex,
} from '../../constants/orderFlow';

const STEP_ICONS = {
  received: Inbox,
  preparing: Package,
  out_for_delivery: Truck,
  delivered: CheckCircle2,
  delivery_failed: XCircle,
  outcome: CheckCircle2,
};

function PointIcon({ pointKey, className }) {
  const Icon = STEP_ICONS[pointKey] || Circle;
  return <Icon className={className} strokeWidth={2} aria-hidden />;
}

/**
 * Horizontal progress line — RTL (ar) right→left, LTR (en) left→right.
 */
export default function OrderProgressLine({ order, isAr, compact = false }) {
  const currentStatus = order?.orderStatus || order?.status || 'pending';
  const activeIdx = orderFlowStepIndex(currentStatus);
  const progressIdx = getTimelineProgressIndex(currentStatus);
  const points = getTimelinePoints(currentStatus, isAr);
  const cancelled = currentStatus === 'cancelled';
  const returned = currentStatus === 'returned';

  if (returned) {
    return (
      <p className="rounded-xl border border-teal-200/80 bg-teal-50/80 px-4 py-3 text-center text-sm font-medium text-teal-900">
        {isAr ? 'تم استرجاع المنتج — الطلب مكتمل' : 'Product returned — order complete'}
      </p>
    );
  }

  if (cancelled) {
    return (
      <p className="rounded-xl bg-slate-100/80 px-4 py-3 text-center text-sm font-medium text-slate-600">
        {isAr ? 'تم إلغاء هذا الطلب' : 'This order was cancelled'}
      </p>
    );
  }

  const progressPercent = points.length > 1
    ? (progressIdx / (points.length - 1)) * 100
    : 0;

  const dotSize = compact ? 'h-9 w-9' : 'h-10 w-10 sm:h-11 sm:w-11';
  const labelClass = compact ? 'text-[10px]' : 'text-[11px]';

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="w-full px-1">
      <div className="relative">
        <div
          className="absolute top-[18px] sm:top-5 h-0.5 rounded-full bg-slate-200 start-[12%] end-[12%]"
          aria-hidden
        />
        <div
          className="absolute top-[18px] sm:top-5 h-0.5 rounded-full bg-primary-500 transition-all duration-500 ease-out start-[12%]"
          style={{ width: `${Math.max(0, progressPercent * 0.76)}%` }}
          aria-hidden
        />

        <ol className="relative flex items-start justify-between gap-1">
          {points.map((point, index) => {
            const completed = activeIdx >= 0 && index < progressIdx;
            const active = activeIdx >= 0 && index === progressIdx;
            const upcoming = activeIdx >= 0 && index > progressIdx;
            const isFailed = point.key === 'outcome' && currentStatus === 'delivery_failed';

            return (
              <li
                key={point.key}
                className="flex min-w-0 flex-1 flex-col items-center text-center"
              >
                <span
                  className={[
                    'relative z-10 flex shrink-0 items-center justify-center rounded-full border-2 transition-all duration-300',
                    dotSize,
                    completed ? 'border-primary-600 bg-primary-600 text-white' : '',
                    active && !isFailed ? 'border-primary-600 bg-white text-primary-700 ring-4 ring-primary-100' : '',
                    active && isFailed ? 'border-red-500 bg-red-50 text-red-600 ring-4 ring-red-100' : '',
                    upcoming ? 'border-slate-200 bg-white text-slate-300' : '',
                  ].join(' ')}
                >
                  {completed ? (
                    <Check className="h-4 w-4" strokeWidth={3} aria-hidden />
                  ) : (
                    <PointIcon
                      pointKey={point.key === 'outcome' && currentStatus === 'delivered' ? 'delivered' : point.key}
                      className={[
                        'h-4 w-4',
                        active && point.key === 'out_for_delivery' ? 'animate-pulse' : '',
                      ].join(' ')}
                    />
                  )}
                </span>
                <p
                  className={[
                    'mt-2 max-w-[4.5rem] font-semibold leading-tight sm:max-w-[5.5rem]',
                    labelClass,
                    completed || active ? 'text-text' : 'text-text-muted',
                    active && isFailed ? 'text-red-700' : '',
                  ].join(' ')}
                >
                  {point.label}
                </p>
                {active && point.key === 'out_for_delivery' && (
                  <span className="mt-0.5 text-[10px] font-medium text-primary-600">
                    {isAr ? 'في الطريق' : 'On the way'}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
