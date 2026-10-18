import { Clock3 } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useLocation } from '../../context/LocationContext';
import { localizeEta } from '../../utils/deliveryEta';
import LocationSelector from '../layout/LocationSelector';

/**
 * "Next delivery: within 2 hours" for the shopper's area, with a one-tap area
 * change. Without a known area it asks the shopper to pick one.
 */
export default function HomepageDeliverySlot({ section }) {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const { location } = useLocation();
  const eta = localizeEta(location?.estimatedExpress || location?.estimatedScheduled || '', isAr);
  const title = isAr ? section.titleAr || section.titleEn : section.titleEn || section.titleAr;

  return (
    <section className="container-app py-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50 to-white px-4 py-3.5 shadow-sm sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
            <Clock3 className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-emerald-800">
              {title || (isAr ? 'أقرب موعد توصيل' : 'Next delivery')}
            </p>
            <p className="text-base font-bold text-text sm:text-lg">
              {eta || (isAr ? 'اختر منطقتك لنعرض لك أقرب موعد' : 'Pick your area to see the next delivery time')}
            </p>
          </div>
        </div>
        <LocationSelector variant="strip" className="shrink-0" />
      </div>
    </section>
  );
}
