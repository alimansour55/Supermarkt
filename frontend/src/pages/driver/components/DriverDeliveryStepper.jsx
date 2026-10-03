import { Check, MapPin, Navigation, PackageCheck, UserCheck, X } from 'lucide-react';

const BASE_STEPS = [
  { key: 'assigned', icon: UserCheck, ar: 'مُعيّن', en: 'Assigned' },
  { key: 'enroute', icon: Navigation, ar: 'في الطريق', en: 'On the way' },
  { key: 'arrived', icon: MapPin, ar: 'وصل', en: 'Arrived' },
  { key: 'done', icon: PackageCheck, ar: 'تم التسليم', en: 'Delivered' },
];

/**
 * Derives the active stage purely from data the page already tracks —
 * no extra state, no backend round-trip.
 */
export function computeDeliveryStep({ orderStatus, sharing, trackingActive, arrivedAt }) {
  if (orderStatus === 'delivered' || orderStatus === 'delivery_failed') return 3;
  if (arrivedAt) return 2;
  if (trackingActive || sharing) return 1;
  return 0;
}

export default function DriverDeliveryStepper({ step, failed, isAr }) {
  const steps = BASE_STEPS.map((s, i) => (i === 3 && failed ? { ...s, icon: X, ar: 'فشل التسليم', en: 'Failed' } : s));

  return (
    <div className="flex items-center px-1">
      {steps.map((s, i) => {
        const Icon = s.icon;
        const state = i < step ? 'done' : i === step ? 'active' : 'upcoming';
        const isFailedFinal = failed && i === 3 && state !== 'upcoming';
        return (
          <div key={s.key} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <span
                className={[
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                  isFailedFinal
                    ? 'border-red-500 bg-red-500 text-white'
                    : state === 'done'
                      ? 'border-teal-600 bg-teal-600 text-white'
                      : state === 'active'
                        ? 'border-teal-600 bg-white text-teal-700 ring-4 ring-teal-100'
                        : 'border-slate-200 bg-white text-slate-300',
                ].join(' ')}
              >
                {state === 'done' && !isFailedFinal ? (
                  <Check className="h-4 w-4" aria-hidden />
                ) : (
                  <Icon className="h-4 w-4" aria-hidden />
                )}
              </span>
              <span
                className={[
                  'text-center text-[10px] font-semibold leading-tight',
                  state === 'upcoming' ? 'text-slate-400' : isFailedFinal ? 'text-red-700' : 'text-slate-700',
                ].join(' ')}
              >
                {isAr ? s.ar : s.en}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={[
                  'mx-1 mb-4 h-0.5 flex-1 rounded-full transition-colors',
                  i < step ? 'bg-teal-600' : 'bg-slate-200',
                ].join(' ')}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
