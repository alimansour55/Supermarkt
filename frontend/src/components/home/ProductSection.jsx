import { Link } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import ProductGrid from '../product/ProductGrid';
import DealCountdown from './DealCountdown';

export default function ProductSection({
  titleAr,
  titleEn,
  products,
  link,
  compact = true,
  icon = null,
  countdownEnd = null,
  loading = false,
  skeletonCount = 4,
}) {
  const { language } = useLanguage();
  const title = language === 'ar' ? titleAr : titleEn;

  if (!loading && !products?.length) return null;

  return (
    <section className="py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-xl font-bold text-text md:text-2xl">
          {icon && <span className="text-2xl" aria-hidden>{icon}</span>}
          {title}
        </h2>
        <div className="flex items-center gap-3">
          {countdownEnd && <DealCountdown endDate={countdownEnd} />}
          {link && (
            <Link to={link} className="text-sm font-semibold text-primary-600 hover:text-primary-700">
              {language === 'ar' ? 'عرض الكل ←' : 'View All →'}
            </Link>
          )}
        </div>
      </div>
      {loading ? (
        <ProductGrid products={[]} loading skeletonCount={skeletonCount} compact={compact} />
      ) : (
        <ProductGrid products={products} compact={compact} />
      )}
    </section>
  );
}
