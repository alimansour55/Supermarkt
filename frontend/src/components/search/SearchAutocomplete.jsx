import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search, Clock, Flame, Package, FolderOpen, X, Loader2,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { fetchSearchSuggestions, buildSearchResultsUrl } from '../../services/searchApi';
import { getRecentSearches, addRecentSearch, clearRecentSearches } from '../../utils/searchStorage';
import { POPULAR_SEARCHES, SEARCH_DEBOUNCE_MS } from '../../utils/searchConstants';
import { CATEGORIES } from '../../data/mockData';
import { formatPrice } from '../../utils/formatters';

function isImageUrl(src) {
  return typeof src === 'string' && (src.startsWith('http') || src.startsWith('/'));
}

export default function SearchAutocomplete({
  className = '',
  autoFocus = false,
  initialQuery = '',
  showCategorySelect = true,
}) {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const isAr = language === 'ar';
  const wrapperRef = useRef(null);

  const [query, setQuery] = useState(initialQuery);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);
  const [category, setCategory] = useState('all');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState({ products: [], categories: [], totalProducts: 0 });
  const [recent, setRecent] = useState(() => getRecentSearches());

  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS);
  const trimmed = query.trim();
  const hasQuery = trimmed.length >= 2;

  const refreshRecent = useCallback(() => setRecent(getRecentSearches()), []);

  useEffect(() => {
    if (!hasQuery) {
      setSuggestions({ products: [], categories: [], totalProducts: 0 });
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    fetchSearchSuggestions(debouncedQuery)
      .then((res) => { if (active) setSuggestions(res); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [debouncedQuery, hasQuery]);

  useEffect(() => {
    const onDocClick = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('touchstart', onDocClick);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('touchstart', onDocClick);
    };
  }, []);

  const goToResults = (q, cat = category) => {
    const term = (q ?? query).trim();
    if (!term && cat === 'all') return;
    if (term) addRecentSearch(term);
    refreshRecent();
    setOpen(false);
    navigate(buildSearchResultsUrl(term, cat));
  };

  const pickSuggestion = (term) => {
    setQuery(term);
    goToResults(term);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    goToResults(query);
  };

  const showDropdown = open && (hasQuery || recent.length > 0 || POPULAR_SEARCHES.length > 0);
  const { products, categories, totalProducts } = suggestions;

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <form onSubmit={handleSubmit} className="flex overflow-hidden rounded-xl border border-border bg-white shadow-sm">
        {showCategorySelect && (
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="hidden shrink-0 border-e border-border bg-surface px-3 py-2.5 text-sm font-medium text-text focus:outline-none sm:block sm:max-w-[140px]"
            aria-label={isAr ? 'اختر القسم' : 'Select category'}
          >
            <option value="all">{isAr ? 'كل الأقسام' : 'All'}</option>
            {CATEGORIES.map((cat) => (
              <option key={cat.slug} value={cat.slug}>
                {isAr ? cat.nameAr : cat.nameEn}
              </option>
            ))}
          </select>
        )}
        <div className="relative min-w-0 flex-1">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => { setOpen(true); refreshRecent(); }}
            autoFocus={autoFocus}
            placeholder={t.nav.search}
            className="w-full px-3 py-3 text-sm focus:outline-none md:px-4 md:py-2.5"
            autoComplete="off"
            aria-expanded={showDropdown}
            aria-autocomplete="list"
          />
        </div>
        {query && (
          <button
            type="button"
            onClick={() => { setQuery(''); setOpen(true); }}
            className="flex shrink-0 items-center px-2 text-text-muted hover:text-text"
            aria-label={isAr ? 'مسح' : 'Clear'}
          >
            <X className="h-4 w-4" />
          </button>
        )}
        <button
          type="submit"
          className="flex shrink-0 items-center justify-center gap-1 bg-primary-600 px-4 py-3 text-sm font-semibold text-white hover:bg-primary-700 min-w-[48px] md:min-w-0"
        >
          <Search className="h-5 w-5 md:hidden" aria-hidden />
          <span className="hidden md:inline">{isAr ? 'بحث' : 'Search'}</span>
        </button>
      </form>

      {showDropdown && (
        <div className="absolute start-0 end-0 top-full z-[60] mt-1 max-h-[min(70vh,420px)] overflow-y-auto rounded-2xl border border-border bg-white py-2 shadow-2xl">
          {!hasQuery && (
            <>
              {recent.length > 0 && (
                <section className="px-3 pb-2">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-text-muted">
                      <Clock className="h-3.5 w-3.5" />
                      {isAr ? 'عمليات بحث سابقة' : 'Recent'}
                    </span>
                    <button
                      type="button"
                      onClick={() => { clearRecentSearches(); refreshRecent(); }}
                      className="text-[10px] font-medium text-primary-600"
                    >
                      {isAr ? 'مسح' : 'Clear'}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {recent.map((term) => (
                      <button
                        key={term}
                        type="button"
                        onClick={() => pickSuggestion(term)}
                        className="rounded-full bg-surface px-3 py-1.5 text-xs font-medium text-text hover:bg-primary-50"
                      >
                        {term}
                      </button>
                    ))}
                  </div>
                </section>
              )}
              <section className="border-t border-border px-3 py-2">
                <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-text-muted">
                  <Flame className="h-3.5 w-3.5 text-orange-500" />
                  {isAr ? 'الأكثر بحثاً' : 'Popular'}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {POPULAR_SEARCHES.map((item) => (
                    <button
                      key={item.query}
                      type="button"
                      onClick={() => pickSuggestion(item.query)}
                      className="rounded-full bg-orange-50 px-3 py-1.5 text-xs font-medium text-orange-800 hover:bg-orange-100"
                    >
                      {isAr ? item.labelAr : item.labelEn}
                    </button>
                  ))}
                </div>
              </section>
            </>
          )}

          {hasQuery && (
            <>
              {loading && (
                <div className="flex items-center justify-center gap-2 py-6 text-sm text-text-muted">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {isAr ? 'جاري البحث...' : 'Searching...'}
                </div>
              )}

              {!loading && products.length > 0 && (
                <section className="px-2">
                  <p className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-semibold text-text-muted">
                    <Package className="h-3.5 w-3.5" />
                    {isAr ? `منتجات (${totalProducts})` : `Products (${totalProducts})`}
                  </p>
                  <ul>
                    {products.map((p) => {
                      const label = isAr ? p.name : (p.nameEn || p.name);
                      return (
                        <li key={p._id}>
                          <Link
                            to={`/products/${p.slug}`}
                            onClick={() => { addRecentSearch(trimmed); setOpen(false); }}
                            className="flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-primary-50 active:bg-primary-100"
                          >
                            <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-50">
                              {p.image && isImageUrl(p.image) ? (
                                <img src={p.image} alt="" className="h-full w-full object-contain p-1" loading="lazy" />
                              ) : (
                                <span className="text-xl">{p.emoji || '🛍️'}</span>
                              )}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-sm font-medium">{label}</span>
                            <span className="shrink-0 text-sm font-bold text-primary-700">{formatPrice(p.price)}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                  {totalProducts > products.length && (
                    <button
                      type="button"
                      onClick={() => goToResults(trimmed)}
                      className="mx-2 mt-1 w-[calc(100%-1rem)] rounded-xl py-2.5 text-center text-sm font-semibold text-primary-600 hover:bg-primary-50"
                    >
                      {isAr ? `عرض كل النتائج (${totalProducts})` : `View all ${totalProducts} results`}
                    </button>
                  )}
                </section>
              )}

              {!loading && categories.length > 0 && (
                <section className={`px-2 ${products.length > 0 ? 'mt-2 border-t border-border pt-2' : ''}`}>
                  <p className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-semibold text-text-muted">
                    <FolderOpen className="h-3.5 w-3.5" />
                    {isAr ? `أقسام (${categories.length})` : `Categories (${categories.length})`}
                  </p>
                  <ul>
                    {categories.map((cat) => (
                      <li key={cat.slug}>
                        <button
                          type="button"
                          onClick={() => goToResults(trimmed, cat.slug)}
                          className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-start text-sm font-medium hover:bg-primary-50"
                        >
                          <span className="text-lg">{cat.icon || '🗂️'}</span>
                          <span>{isAr ? (cat.nameAr || cat.name) : cat.nameEn}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {!loading && products.length === 0 && categories.length === 0 && (
                <p className="px-4 py-6 text-center text-sm text-text-muted">
                  {isAr ? 'لا توجد نتائج' : 'No results found'}
                </p>
              )}

              {!loading && (products.length > 0 || categories.length > 0) && (
                <button
                  type="button"
                  onClick={() => goToResults(trimmed)}
                  className="mx-3 mt-2 flex w-[calc(100%-1.5rem)] items-center justify-center gap-2 rounded-xl border border-primary-200 bg-primary-50 py-3 text-sm font-bold text-primary-700"
                >
                  <Search className="h-4 w-4" />
                  {isAr ? `بحث عن "${trimmed}"` : `Search for "${trimmed}"`}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
