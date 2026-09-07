import { Link } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import ProductGrid from '../product/ProductGrid';
import DealCountdown from './DealCountdown';
import {
  isDealSectionType,
  normalizeDealConfig,
  resolveDealCountdownEnd,
  resolveDealProductLayout,
  resolveDealViewAllLink,
} from '../../utils/dealSectionShared';

export default function HomepageDealSection({ section, loading = false }) {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const config = normalizeDealConfig(section?.dealConfig || {}, section);
  const countdownEnd = resolveDealCountdownEnd(section);
  const { layout, columns, showViewAll } = resolveDealProductLayout(section);

  const title = isAr ? (section.titleAr || section.titleEn) : (section.titleEn || section.titleAr);
  const subtitle = isAr ? (section.subtitleAr || section.subtitleEn) : (section.subtitleEn || section.subtitleAr);
  const products = section.products || [];
  const viewAllLink = resolveDealViewAllLink(section);
  const skeletonCount = Number(section.productQuery?.limit) || 8;

  if (!loading && !products.length) return null;

  const isFlash = config.style === 'flash';
  const isMinimal = config.style === 'minimal';

  return (
    <section className="py-6">
      {isFlash && (
        <div className="mb-4 overflow-hidden rounded-2xl bg-gradient-to-r from-red-600 via-orange-500 to-amber-500 px-4 py-3 text-white shadow-md sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className="text-2xl" aria-hidden>{section.icon || '⚡'}</span>
              <div>
                <p className="text-base font-bold sm:text-lg">{title}</p>
                {config.showSubtitle && subtitle && (
                  <p className="text-xs text-white/90 sm:text-sm">{subtitle}</p>
                )}
              </div>
            </div>
            {countdownEnd && (
              <DealCountdown endDate={countdownEnd} variant="flash" />
            )}
          </div>
        </div>
      )}

      {!isFlash && (
        <div className={`mb-4 ${isMinimal ? '' : 'rounded-2xl border border-orange-100 bg-gradient-to-br from-orange-50/90 to-white px-4 py-4 sm:px-5'}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="flex items-center gap-2 text-xl font-bold text-text md:text-2xl">
                {section.icon && <span className="text-2xl" aria-hidden>{section.icon}</span>}
                {title}
              </h2>
              {config.showSubtitle && subtitle && (
                <p className="mt-1 text-sm text-text-muted">{subtitle}</p>
              )}
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2 sm:gap-3">
              {countdownEnd && (
                <DealCountdown endDate={countdownEnd} variant={isMinimal ? 'compact' : 'prominent'} />
              )}
              {showViewAll && viewAllLink && (
                <Link to={viewAllLink} className="text-sm font-semibold text-primary-600 hover:text-primary-700">
                  {isAr ? 'عرض الكل' : 'View all'}
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      {isFlash && showViewAll && viewAllLink && (
        <div className="mb-3 flex justify-end">
          <Link to={viewAllLink} className="text-sm font-semibold text-primary-600 hover:text-primary-700">
            {isAr ? 'عرض الكل' : 'View all'}
          </Link>
        </div>
      )}

      <ProductGrid
        products={products}
        loading={loading}
        layout={layout}
        columns={columns}
        skeletonCount={skeletonCount}
      />
    </section>
  );
}

export { isDealSectionType };
