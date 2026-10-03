import { useEffect, useState } from 'react';
import { Link, useNavigate } from '../../app/router';
import { useLanguage } from '../../context/LanguageContext';
import { fetchTrendingSearches, buildSearchResultsUrl, resolveTrendingSearchTerm } from '../../services/searchApi';
import { POPULAR_SEARCHES } from '../../utils/searchConstants';
import ProductGrid from '../product/ProductGrid';

export default function TrendingSearchesHomeSection({ section }) {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const navigate = useNavigate();
  const [trending, setTrending] = useState(POPULAR_SEARCHES);

  useEffect(() => {
    fetchTrendingSearches(10).then(setTrending).catch(() => setTrending(POPULAR_SEARCHES));
  }, []);

  const title = isAr ? section.titleAr || section.titleEn : section.titleEn || section.titleAr;
  const chips = trending.filter((item) => resolveTrendingSearchTerm(item, isAr));

  const pickTrending = (item) => {
    if (item?.productSlug) {
      navigate(`/products/${item.productSlug}`);
      return;
    }
    const term = resolveTrendingSearchTerm(item, isAr);
    if (term) navigate(buildSearchResultsUrl(term, 'all', { src: 'trending' }));
  };

  const hasProducts = section.products?.length > 0;
  const hasChips = chips.length > 0;

  if (!hasProducts && !hasChips) return null;

  return (
    <section className="container-app py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-xl font-bold text-text md:text-2xl">
          {section.icon && <span className="text-2xl" aria-hidden>{section.icon}</span>}
          {title || (isAr ? 'الأكثر بحثاً' : 'Trending searches')}
        </h2>
        {section.link && (
          <Link to={section.link} className="text-sm font-semibold text-primary-600 hover:text-primary-700">
            {isAr ? 'عرض الكل' : 'View all'}
          </Link>
        )}
      </div>

      {chips.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {chips.map((item, index) => {
            const label = isAr ? (item.labelAr || item.query) : (item.labelEn || item.query);
            if (!label) return null;
            return (
              <button
                key={item.productId || item.productSlug || `${item.query}-${index}`}
                type="button"
                onClick={() => pickTrending(item)}
                className="rounded-full border border-orange-200 bg-orange-50 px-4 py-2 text-sm font-medium text-orange-900 transition hover:bg-orange-100"
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      {hasProducts && (
        <ProductGrid products={section.products} layout="scroll" />
      )}
    </section>
  );
}
