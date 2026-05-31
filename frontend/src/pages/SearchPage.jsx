import { useLanguage } from '../context/LanguageContext';
import SearchAutocomplete from '../components/search/SearchAutocomplete';
import { Link } from 'react-router-dom';
import { CATEGORIES } from '../data/mockData';
import { POPULAR_SEARCHES } from '../utils/searchConstants';
import { getRecentSearches } from '../utils/searchStorage';
import { useNavigate } from 'react-router-dom';
import { buildSearchResultsUrl } from '../services/searchApi';
import { Clock, Flame } from 'lucide-react';

export default function SearchPage() {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const isAr = language === 'ar';
  const recent = getRecentSearches();

  const go = (query) => navigate(buildSearchResultsUrl(query));

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

      <section className="mt-6">
        <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-text-muted">
          <Flame className="h-4 w-4 text-orange-500" />
          {isAr ? 'الأكثر بحثاً' : 'Popular searches'}
        </h2>
        <div className="flex flex-wrap gap-2">
          {POPULAR_SEARCHES.map((item) => (
            <button
              key={item.query}
              type="button"
              onClick={() => go(item.query)}
              className="rounded-full bg-orange-50 px-4 py-2 text-sm font-medium text-orange-900 active:scale-[0.98]"
            >
              {isAr ? item.labelAr : item.labelEn}
            </button>
          ))}
        </div>
      </section>

      <p className="mt-8 mb-3 text-sm font-semibold text-text-muted">
        {isAr ? 'تصفح حسب القسم' : 'Browse by category'}
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {CATEGORIES.map((cat) => (
          <Link
            key={cat.slug}
            to={`/categories/${cat.slug}`}
            className="flex items-center gap-3 rounded-2xl border border-border bg-white p-4 shadow-sm active:scale-[0.98] transition-transform"
          >
            <span className="text-2xl">{cat.icon}</span>
            <span className="text-sm font-semibold">{isAr ? cat.nameAr : cat.nameEn}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
