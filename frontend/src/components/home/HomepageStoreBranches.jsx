import { useEffect, useState } from 'react';
import { Clock, MapPin, Phone } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useHydrated } from '../ui/ClientOnly';
import { branchOpenNow } from '../../utils/homepageBlocks';

const MINUTE = 60_000;

/** Store branches with address, phone, map link and an "Open now" badge (Cairo time). */
export default function HomepageStoreBranches({ section }) {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const hydrated = useHydrated();
  const [, setTick] = useState(0);

  // The badge depends on the clock — browser only, so the server HTML never disagrees.
  useEffect(() => {
    if (!hydrated) return undefined;
    const timer = setInterval(() => setTick((n) => n + 1), MINUTE);
    return () => clearInterval(timer);
  }, [hydrated]);
  const now = hydrated ? new Date() : null;

  const branches = section.blockConfig?.branches || [];
  if (!branches.length) return null;
  const title = isAr ? section.titleAr || section.titleEn : section.titleEn || section.titleAr;
  const subtitle = isAr ? section.subtitleAr || section.subtitleEn : section.subtitleEn || section.subtitleAr;
  const pick = (ar, en) => (isAr ? ar || en : en || ar);

  return (
    <section className="container-app py-6">
      {(title || subtitle) && (
        <div className="mb-4">
          {title && <h2 className="text-xl font-bold text-text md:text-2xl">{title}</h2>}
          {subtitle && <p className="mt-1 text-sm text-text-muted">{subtitle}</p>}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {branches.map((branch, index) => {
          const open = now ? branchOpenNow(branch, now) : null;
          const ownHours = pick(branch.hoursAr, branch.hoursEn);
          const hoursText = ownHours
            || (branch.opensAt && branch.closesAt ? `${branch.opensAt} – ${branch.closesAt}` : '');
          const address = pick(branch.addressAr, branch.addressEn);
          return (
            <article key={`${branch.nameEn || branch.nameAr}-${index}`} className="flex flex-col gap-3 rounded-2xl border border-border bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-base font-bold text-text">{pick(branch.nameAr, branch.nameEn)}</h3>
                {open !== null && (
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${open ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                    {open ? (isAr ? 'مفتوح الآن' : 'Open now') : (isAr ? 'مغلق الآن' : 'Closed now')}
                  </span>
                )}
              </div>
              {address && (
                <p className="flex items-start gap-2 text-sm text-text-muted">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <span>{address}</span>
                </p>
              )}
              {hoursText && (
                <p className="flex items-start gap-2 text-sm text-text-muted">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <span dir={ownHours ? 'auto' : 'ltr'}>{hoursText}</span>
                </p>
              )}
              {(branch.phone || branch.mapUrl) && (
                <div className="mt-auto flex flex-wrap gap-2 pt-1">
                  {branch.phone && (
                    <a href={`tel:${branch.phone.replace(/\s+/g, '')}`} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-text hover:bg-surface-muted">
                      <Phone className="h-3.5 w-3.5" aria-hidden />
                      <span dir="ltr">{branch.phone}</span>
                    </a>
                  )}
                  {branch.mapUrl && (
                    <a href={branch.mapUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-700">
                      <MapPin className="h-3.5 w-3.5" aria-hidden />
                      {isAr ? 'الاتجاهات' : 'Directions'}
                    </a>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
