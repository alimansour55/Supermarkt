import { Link } from '../../app/router';
import { ChevronLeft, Gift, Sparkles } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useStoreSettings } from '../../context/StoreSettingsContext';
import { getCashbackPercent } from '../../utils/loyaltyHelpers';

export default function HomepageLoyaltyPromo({ section }) {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const { settings } = useStoreSettings();
  const rules = settings?.loyalty || {};
  const cashbackPercent = rules.cashbackPercent ?? getCashbackPercent(rules);
  const enabled = rules.enabled !== false;

  const title = isAr ? section.titleAr || section.titleEn : section.titleEn || section.titleAr;
  const subtitle = isAr ? section.subtitleAr || section.subtitleEn : section.subtitleEn || section.subtitleAr;
  const link = section.link || '/my-points';
  const layout = section.layout || 'gradient';

  if (!enabled) return null;

  const cardClass = layout === 'horizontal'
    ? 'flex flex-col gap-4 rounded-2xl border border-amber-200 bg-amber-50/80 p-5 sm:flex-row sm:items-center sm:justify-between'
    : 'rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-orange-50 p-6 shadow-sm';

  return (
    <section className="container-app py-4">
      <div className={cardClass}>
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-sm">
            {section.icon ? <span className="text-2xl">{section.icon}</span> : <Gift className="h-6 w-6" aria-hidden />}
          </span>
          <div>
            <h2 className="text-lg font-bold text-text md:text-xl">{title || (isAr ? 'برنامج النقاط' : 'Loyalty program')}</h2>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-amber-900">
              <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
              {subtitle || (isAr
                ? `استرداد نقدي ${cashbackPercent}% على كل طلب`
                : `${cashbackPercent}% cashback on every order`)}
            </p>
          </div>
        </div>
        <Link
          to={link}
          className="inline-flex items-center gap-1 self-start rounded-full bg-amber-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-amber-700 sm:self-center"
        >
          {isAr ? (section.ctaLabelAr || 'اعرف المزيد') : (section.ctaLabelEn || 'Learn more')}
          <ChevronLeft className={`h-4 w-4 ${isAr ? '' : 'rotate-180'}`} aria-hidden />
        </Link>
      </div>
    </section>
  );
}
