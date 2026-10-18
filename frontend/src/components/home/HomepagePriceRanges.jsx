import { Link } from '../../app/router';
import { useLanguage } from '../../context/LanguageContext';
import { priceRangeHref, priceRangeLabel } from '../../utils/homepageBlocks';
import ShopIcon, { ShopIconBadge } from '../ui/ShopIcon';

const ACCENTS = [
  'from-emerald-50 to-white border-emerald-100 text-emerald-900',
  'from-sky-50 to-white border-sky-100 text-sky-900',
  'from-amber-50 to-white border-amber-100 text-amber-900',
  'from-violet-50 to-white border-violet-100 text-violet-900',
  'from-rose-50 to-white border-rose-100 text-rose-900',
];

/** "Shop by price" tiles — each opens the product list filtered to its range. */
export default function HomepagePriceRanges({ section }) {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const ranges = section.blockConfig?.priceRanges || [];
  if (!ranges.length) return null;
  const title = isAr ? section.titleAr || section.titleEn : section.titleEn || section.titleAr;
  const subtitle = isAr ? section.subtitleAr || section.subtitleEn : section.subtitleEn || section.subtitleAr;
  const cols = ranges.length >= 4 ? 'md:grid-cols-4' : ranges.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2';

  return (
    <section className="container-app py-6">
      {(title || subtitle) && (
        <div className="mb-4">
          {title && (
            <h2 className="flex items-center gap-2 text-xl font-bold text-text md:text-2xl">
              <ShopIconBadge name={section.icon} />
              {title}
            </h2>
          )}
          {subtitle && <p className="mt-1 text-sm text-text-muted">{subtitle}</p>}
        </div>
      )}
      <div className={`grid grid-cols-2 gap-3 ${cols}`}>
        {ranges.map((range, index) => (
          <Link
            key={`${range.min}-${range.max}-${index}`}
            to={priceRangeHref(range)}
            className={`flex min-h-[5.5rem] items-center gap-3 rounded-2xl border bg-gradient-to-br p-4 font-bold shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${ACCENTS[index % ACCENTS.length]}`}
          >
            {range.emoji && (
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/80 shadow-sm">
                <ShopIcon name={range.emoji} className="h-6 w-6" />
              </span>
            )}
            <span className="text-sm leading-snug sm:text-base">{priceRangeLabel(range, isAr)}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
