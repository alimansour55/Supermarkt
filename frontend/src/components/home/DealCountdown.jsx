import { useCountdown } from '../../hooks/useCountdown';
import { useLanguage } from '../../context/LanguageContext';

export default function DealCountdown({ endDate }) {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const { label, expired } = useCountdown(endDate);

  if (expired) return null;

  return (
    <div
      className="flex items-center gap-1.5 rounded-lg bg-red-600 px-2.5 py-1 text-xs font-bold text-white tabular-nums"
      aria-live="polite"
    >
      <span className="opacity-90">{isAr ? 'ينتهي خلال' : 'Ends in'}</span>
      <span>{label}</span>
    </div>
  );
}
