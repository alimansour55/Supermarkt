import { Link } from '../../app/router';
import { useLanguage } from '../../context/LanguageContext';
import ProductGrid from '../product/ProductGrid';
import { productSectionLayout } from '../../utils/dealSectionShared';

export default function ProductSection({
  titleAr,
  titleEn,
  subtitleAr,
  subtitleEn,
  products,
  link,
  icon = null,
  layout = 'scroll',
  columns = 4,
  loading = false,
  skeletonCount = 4,
  showViewAll = true,
}) {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const title = isAr ? titleAr : titleEn;
  const subtitle = isAr ? (subtitleAr || subtitleEn) : (subtitleEn || subtitleAr);

  if (!loading && !products?.length) return null;

  return (
    <section className="py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-xl font-bold text-text md:text-2xl">
            {icon && <span className="text-2xl" aria-hidden>{icon}</span>}
            {title}
          </h2>
          {subtitle && <p className="mt-1 text-sm text-text-muted">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-3">
          {showViewAll && link && (
            <Link to={link} className="text-sm font-semibold text-primary-600 hover:text-primary-700">
              {isAr ? 'عرض الكل' : 'View all'}
            </Link>
          )}
        </div>
      </div>
      <ProductGrid
        products={products || []}
        loading={loading}
        layout={layout}
        columns={columns}
        skeletonCount={skeletonCount}
      />
    </section>
  );
}

export { productSectionLayout };
