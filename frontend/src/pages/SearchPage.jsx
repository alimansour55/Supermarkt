import { useEffect, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import SearchAutocomplete from '../components/search/SearchAutocomplete';
import { Link, useNavigate } from '../app/router';
import { POPULAR_SEARCHES } from '../utils/searchConstants';
import { getCategoryLabel, useCategories } from '../context/CategoriesContext';
import { getRecentSearches } from '../utils/searchStorage';
import { buildSearchResultsUrl, fetchTrendingSearches, resolveTrendingSearchTerm } from '../services/searchApi';
import { Clock, Flame } from 'lucide-react';

export default function SearchPage() {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const isAr = language === 'ar';
  const { rootCategories } = useCategories();
  const recent = getRecentSearches();
  const [trending, setTrending] = useState(POPULAR_SEARCHES);

  useEffect(() => {
    fetchTrendingSearches().then(setTrending).catch(() => setTrending(POPULAR_SEARCHES));
  }, []);

  const go = (query) => navigate(buildSearchResultsUrl(query, 'all'));

  const goTrending = (item) => {
    const term = resolveTrendingSearchTerm(item, isAr);
    if (!term) return;
    navigate(buildSearchResultsUrl(term, 'all', { src: 'trending' }));
  };

  return (
    <div className="container-app py-6 pb-4">
      <h1 className="mb-4 text-xl font-bold md:text-2xl">{isAr ? 'بحث' : 'Search'}</h1>
      <SearchAutocomplete autoFocus className="shadow-md" />

      {recent.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-text-muted">
            <Clock className="h-4 w-4" />
            {isAr ? 'عمليات بحث سابقة' : 'Recent searches'}
          </h2>
          <div className="flex flex-wrap gap-2">
            {recent.map((term) => (
              <button
                key={term}
                type="button"
                onClick={() => go(term)}
                className="rounded-full border border-border bg-white px-4 py-2 text-sm font-medium shadow-sm active:scale-[0.98]"
              >
                {term}
              </button>
            ))}
          </div>
        </section>
      )}

      {trending.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-text-muted">
            <Flame className="h-4 w-4 text-orange-500" />
            {isAr ? 'الأكثر بحثاً' : 'Popular searches'}
          </h2>
          <div className="flex flex-wrap gap-2">
            {trending.map((item) => (
              <button
                key={item.query}
                type="button"
                onClick={() => goTrending(item)}
                className="rounded-full bg-orange-50 px-4 py-2 text-sm font-medium text-orange-900 active:scale-[0.98]"
              >
                {isAr ? (item.labelAr || item.query) : (item.labelEn || item.query)}
              </button>
            ))}
          </div>
        </section>
      )}

      <p className="mt-8 mb-3 text-sm font-semibold text-text-muted">
        {isAr ? 'تصفح حسب القسم' : 'Browse by category'}
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {rootCategories.map((cat) => (
          <Link
            key={cat.slug || cat._id}
            to={`/category/${cat.slug}`}
            className="flex items-center gap-3 rounded-2xl border border-border bg-white p-4 shadow-sm active:scale-[0.98] transition-transform"
          >
            <span className="text-2xl">{cat.icon || '🛒'}</span>
            <span className="text-sm font-semibold">{getCategoryLabel(cat, isAr)}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
