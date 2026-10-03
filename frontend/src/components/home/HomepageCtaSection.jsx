import { Link } from '../../app/router';
import { ChevronLeft } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

const VARIANTS = {
  horizontal: 'group flex items-center justify-between gap-4 rounded-2xl border border-border bg-white p-5 shadow-sm transition-all hover:border-primary-300 hover:shadow-md sm:p-6',
  centered: 'group flex flex-col items-center gap-4 rounded-2xl border border-border bg-white p-8 text-center shadow-sm transition-all hover:border-primary-300 hover:shadow-md',
  gradient: 'group flex flex-col gap-4 rounded-2xl border border-primary-200 bg-gradient-to-br from-primary-50 via-white to-emerald-50 p-5 shadow-sm transition-all hover:border-primary-300 hover:shadow-md sm:flex-row sm:items-center sm:justify-between sm:p-6',
};

export default function HomepageCtaSection({ section }) {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const layout = section.layout || 'horizontal';
  const title = isAr ? section.titleAr || section.titleEn : section.titleEn || section.titleAr;
  const subtitle = isAr ? section.subtitleAr || section.subtitleEn : section.subtitleEn || section.subtitleAr;
  const link = section.link || '/products';
  const ctaAr = section.ctaLabelAr || (isAr ? 'عرض الكل' : 'View all');
  const ctaEn = section.ctaLabelEn || 'View all';
  const cta = isAr ? ctaAr : ctaEn;

  if (!title && !subtitle) return null;

  const className = VARIANTS[layout] || VARIANTS.horizontal;
  const isCentered = layout === 'centered';

  return (
    <section className="container-app py-4">
      <Link to={link} className={className}>
        <div className={`flex items-start gap-4 ${isCentered ? 'flex-col items-center' : ''}`}>
          {section.icon && (
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-600 text-2xl text-white shadow-sm">
              {section.icon}
            </span>
          )}
          <div className={isCentered ? 'text-center' : ''}>
            {title && <h2 className="text-lg font-bold text-text md:text-xl">{title}</h2>}
            {subtitle && <p className="mt-1 text-sm text-text-muted">{subtitle}</p>}
          </div>
        </div>
        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full bg-primary-600 px-4 py-2.5 text-sm font-bold text-white transition-colors group-hover:bg-primary-700 ${isCentered ? '' : ''}`}>
          {cta}
          <ChevronLeft className={`h-4 w-4 ${isAr ? '' : 'rotate-180'}`} aria-hidden />
        </span>
      </Link>
    </section>
  );
}
