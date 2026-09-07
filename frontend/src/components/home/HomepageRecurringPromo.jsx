import { Link } from 'react-router-dom';
import { ChevronLeft, RefreshCw } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

export default function HomepageRecurringPromo({ section }) {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const title = isAr ? section.titleAr || section.titleEn : section.titleEn || section.titleAr;
  const subtitle = isAr ? section.subtitleAr || section.subtitleEn : section.subtitleEn || section.subtitleAr;
  const link = section.link || '/recurring-deliveries';
  const layout = section.layout || 'gradient';

  const cardClass = layout === 'horizontal'
    ? 'flex flex-col gap-4 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-5 sm:flex-row sm:items-center sm:justify-between'
    : 'rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-6 shadow-sm';

  return (
    <section className="container-app py-4">
      <div className={cardClass}>
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-sm">
            {section.icon ? <span className="text-2xl">{section.icon}</span> : <RefreshCw className="h-6 w-6" aria-hidden />}
          </span>
          <div>
            <h2 className="text-lg font-bold text-text md:text-xl">{title || (isAr ? 'التوصيل الدوري' : 'Recurring delivery')}</h2>
            {subtitle && <p className="mt-1 text-sm text-emerald-900">{subtitle}</p>}
          </div>
        </div>
        <Link
          to={link}
          className="inline-flex items-center gap-1 self-start rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 sm:self-center"
        >
          {isAr ? (section.ctaLabelAr || 'اشترك الآن') : (section.ctaLabelEn || 'Subscribe')}
          <ChevronLeft className={`h-4 w-4 ${isAr ? '' : 'rotate-180'}`} aria-hidden />
        </Link>
      </div>
    </section>
  );
}
