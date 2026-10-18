import { ChevronLeft } from 'lucide-react';
import { Link } from '../../app/router';
import { useLanguage } from '../../context/LanguageContext';
import { useCountdown } from '../../hooks/useCountdown';

const STYLES = {
  brand: { wrap: 'bg-gradient-to-br from-primary-600 via-primary-600 to-primary-800 text-white', box: 'bg-white/15 text-white', cta: 'bg-white text-primary-700 hover:bg-primary-50', muted: 'text-white/80' },
  sale: { wrap: 'bg-gradient-to-br from-red-600 via-rose-600 to-orange-500 text-white', box: 'bg-white/15 text-white', cta: 'bg-white text-red-700 hover:bg-red-50', muted: 'text-white/85' },
  dark: { wrap: 'bg-gradient-to-br from-slate-900 to-slate-800 text-white', box: 'bg-white/10 text-white', cta: 'bg-amber-400 text-slate-900 hover:bg-amber-300', muted: 'text-white/70' },
  light: { wrap: 'border border-border bg-white text-text', box: 'bg-primary-50 text-primary-800', cta: 'bg-primary-600 text-white hover:bg-primary-700', muted: 'text-text-muted' },
};

function TimeUnit({ value, labelText, boxClass }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className={`flex min-w-[3.25rem] justify-center rounded-xl px-2 py-2 text-2xl font-black tabular-nums sm:min-w-[4rem] sm:text-3xl ${boxClass}`}>
        {value}
      </span>
      <span className="text-[11px] font-semibold uppercase tracking-wide opacity-80">{labelText}</span>
    </div>
  );
}

/** Big headline + days / hours / minutes / seconds to a Cairo end time. */
export default function HomepageCountdownBanner({ section }) {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const cfg = section.blockConfig || {};
  const { total, hours, minutes, seconds, expired } = useCountdown(cfg.endsAt || 0);
  const style = STYLES[cfg.countdownStyle] || STYLES.brand;

  if (!cfg.endsAt) return null;
  const ended = expired || (total === null && section.countdownEnded);
  if (ended && cfg.hideWhenEnded !== false) return null;

  const title = isAr ? section.titleAr || section.titleEn : section.titleEn || section.titleAr;
  const subtitle = isAr ? section.subtitleAr || section.subtitleEn : section.subtitleEn || section.subtitleAr;
  const cta = isAr ? section.ctaLabelAr || section.ctaLabelEn : section.ctaLabelEn || section.ctaLabelAr;
  const endedText = isAr ? cfg.endedTextAr || 'انتهى العرض' : cfg.endedTextEn || 'This offer has ended';
  const pending = total === null;
  const pad = (n) => (pending ? '--' : String(n).padStart(2, '0'));
  const days = Math.floor(hours / 24);

  return (
    <section className="container-app py-4">
      <div className={`relative overflow-hidden rounded-3xl p-5 shadow-sm sm:p-8 ${style.wrap}`}>
        <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-center gap-5">
            {cfg.image && (
              <img src={cfg.image} alt="" className="hidden h-28 w-28 shrink-0 rounded-2xl object-cover shadow-md sm:block md:h-32 md:w-32" loading="lazy" />
            )}
            <div className="min-w-0">
              {title && <h2 className="text-2xl font-black leading-tight md:text-3xl">{title}</h2>}
              {subtitle && <p className={`mt-2 text-sm md:text-base ${style.muted}`}>{subtitle}</p>}
            </div>
          </div>
          <div className="flex flex-col items-start gap-4 md:items-end">
            {ended ? (
              <p className="rounded-xl bg-black/10 px-4 py-2 text-lg font-bold">{endedText}</p>
            ) : (
              <div dir="ltr" className="flex items-start gap-2 sm:gap-3" role="timer" aria-live="off">
                {days > 0 && <TimeUnit value={pad(days)} labelText={isAr ? 'يوم' : 'days'} boxClass={style.box} />}
                <TimeUnit value={pad(hours % 24)} labelText={isAr ? 'ساعة' : 'hrs'} boxClass={style.box} />
                <TimeUnit value={pad(minutes)} labelText={isAr ? 'دقيقة' : 'min'} boxClass={style.box} />
                <TimeUnit value={pad(seconds)} labelText={isAr ? 'ثانية' : 'sec'} boxClass={style.box} />
              </div>
            )}
            {section.link && cta && !ended && (
              <Link to={section.link} className={`inline-flex items-center gap-1 rounded-full px-5 py-2.5 text-sm font-bold shadow-sm transition-colors ${style.cta}`}>
                {cta}
                <ChevronLeft className={`h-4 w-4 ${isAr ? '' : 'rotate-180'}`} aria-hidden />
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
