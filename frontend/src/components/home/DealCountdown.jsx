import { useCountdown } from '../../hooks/useCountdown';
import { useLanguage } from '../../context/LanguageContext';

const VARIANTS = {
  compact: {
    wrap: 'flex items-center gap-1.5 rounded-lg bg-red-600 px-2.5 py-1 text-xs font-bold text-white tabular-nums',
    labelClass: 'opacity-90',
  },
  prominent: {
    wrap: 'flex flex-row items-center gap-2 rounded-xl border-2 border-red-200 bg-red-50 px-3 py-2 text-red-700',
    labelClass: 'shrink-0 text-[10px] font-bold uppercase tracking-wide text-red-600 sm:text-xs',
    timeClass: 'text-lg font-black tabular-nums sm:text-xl',
  },
  flash: {
    wrap: 'flex flex-row items-center gap-2 rounded-xl bg-black/25 px-3 py-2 backdrop-blur-sm',
    labelClass: 'shrink-0 text-[10px] font-bold uppercase tracking-wide text-white/90',
    timeClass: 'text-xl font-black tabular-nums text-white sm:text-2xl',
  },
};

function CountdownUnits({ hours, minutes, seconds, variant }) {
  const timeClass = variant === 'flash'
    ? 'text-xl font-black text-white sm:text-2xl'
    : variant === 'prominent'
      ? 'text-lg font-black text-red-700 sm:text-xl'
      : 'text-xs font-black text-white';

  return (
    <div
      dir="ltr"
      className={`flex flex-row items-center gap-1 tabular-nums ${timeClass}`}
    >
      <TimeBox value={hours} variant={variant} />
      <span className="opacity-60" aria-hidden>:</span>
      <TimeBox value={minutes} variant={variant} />
      <span className="opacity-60" aria-hidden>:</span>
      <TimeBox value={seconds} variant={variant} />
    </div>
  );
}

function TimeBox({ value, variant = 'compact' }) {
  const boxClass = variant === 'flash'
    ? 'bg-white/25 text-white'
    : variant === 'prominent'
      ? 'bg-red-100 text-red-800'
      : '';
  return (
    <span className={`inline-flex min-w-[2.25rem] justify-center rounded-md px-1.5 py-0.5 ${boxClass}`}>
      {String(value).padStart(2, '0')}
    </span>
  );
}

export default function DealCountdown({ endDate, variant = 'compact' }) {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const { label, expired, hours, minutes, seconds } = useCountdown(endDate);
  const v = VARIANTS[variant] || VARIANTS.compact;

  if (expired) return null;

  const showUnits = variant === 'flash' || variant === 'prominent' || variant === 'compact';

  return (
    <div className={v.wrap} aria-live="polite" role="timer">
      <span className={v.labelClass}>{isAr ? 'ينتهي خلال' : 'Ends in'}</span>
      {showUnits ? (
        <CountdownUnits hours={hours} minutes={minutes} seconds={seconds} variant={variant} />
      ) : (
        <span dir="ltr" className="font-black tabular-nums">{label}</span>
      )}
    </div>
  );
}
