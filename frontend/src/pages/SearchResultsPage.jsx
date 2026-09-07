import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { fetchProductsPaginated, fetchProductFilters } from '../services/productApi';
import { addRecentSearch } from '../utils/searchStorage';
import { setLastSearchQuery } from '../utils/searchSession';
import { trackSearchEvent } from '../services/searchApi';
import SearchAutocomplete from '../components/search/SearchAutocomplete';
import ProductGrid from '../components/product/ProductGrid';
import ProductFilters, {
  ProductSortBar,
  ProductPagination,
  ActiveFilterChips,
} from '../components/product/ProductFilters';
import ProductGridSkeleton from '../components/product/ProductGridSkeleton';
import {
  DEFAULT_PRODUCT_FILTERS,
  paramsToProductFilters,
  productFiltersToParams,
  productFiltersToApiParams,
} from '../utils/productFilterParams';

function filtersForMeta(filters) {
  const rest = { ...filters };
  delete rest.page;
  delete rest.sort;
  return rest;
}

export default function SearchResultsPage() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState(() => paramsToProductFilters(searchParams));
  const [meta, setMeta] = useState(null);
  const [result, setResult] = useState({ data: [], pagination: null });
  const [loading, setLoading] = useState(true);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const lastTrackedQuery = useRef('');

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      fetchProductFilters(filtersForMeta(filters))
        .then((data) => { if (active) setMeta(data); });
    }, 150);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [filters.mainCategory, filters.subCategory, filters.productSource, filters.brand, filters.minPrice, filters.maxPrice, filters.minRating, filters.minDiscount, filters.offers, filters.inStock, filters.q]);

  useEffect(() => {
    if (filters.q?.trim()) {
      addRecentSearch(filters.q.trim());
      setLastSearchQuery(filters.q.trim());
    }
  }, [filters.q]);

  const loadProducts = useCallback(async () => {
    const q = filters.q?.trim();
    if (!q) {
      setResult({ data: [], pagination: { page: 1, limit: 24, total: 0, pages: 0 } });
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await fetchProductsPaginated(productFiltersToApiParams(filters));
      setResult(res);

      if (filters.page === 1 && lastTrackedQuery.current !== q) {
        lastTrackedQuery.current = q;
        trackSearchEvent({
          query: q,
          resultCount: res.pagination?.total ?? res.data.length,
          source: searchParams.get('src') || 'search',
        });
      }
    } finally {
      setLoading(false);
    }
  }, [filters, searchParams]);

  useEffect(() => {
    loadProducts();
    const next = productFiltersToParams(filters).toString();
    if (searchParams.toString() !== next) {
      setSearchParams(productFiltersToParams(filters), { replace: true });
    }
  }, [filters, loadProducts, setSearchParams, searchParams]);

  const updateFilters = (next) => setFilters(next);
  const clearFilters = () => setFilters({
    ...DEFAULT_PRODUCT_FILTERS,
    q: filters.q,
    sort: filters.sort,
  });

  const title = filters.q
    ? (isAr ? `نتائج البحث: «${filters.q}»` : `Results for “${filters.q}”`)
    : (isAr ? 'نتائج البحث' : 'Search results');

  return (
    <div className="container-app py-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold md:text-2xl line-clamp-2">{title}</h1>
        <div className="mt-4">
          <SearchAutocomplete key={filters.q} initialQuery={filters.q} />
        </div>
      </div>

      <div className="mb-4 lg:hidden">
        <button
          type="button"
          onClick={() => setShowMobileFilters(!showMobileFilters)}
          className="flex w-full min-h-[44px] items-center justify-center gap-2 rounded-xl border border-border bg-white py-2.5 text-sm font-semibold"
        >
          {isAr ? 'تصفية وترتيب' : 'Filters & Sort'}
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <div className={`${showMobileFilters ? 'block' : 'hidden'} lg:block`}>
          <ProductFilters filters={filters} meta={meta} onChange={updateFilters} onClear={clearFilters} />
        </div>

        <div className="space-y-4">
          <ActiveFilterChips
            filters={filters}
            meta={meta}
            language={language}
            onChange={updateFilters}
            onClear={clearFilters}
          />

          <ProductSortBar
            sort={filters.sort}
            total={result.pagination?.total ?? result.data.length}
            language={language}
            onSortChange={(sort) => updateFilters({ ...filters, sort, page: 1 })}
          />

          {loading ? (
            <ProductGridSkeleton count={12} />
          ) : !filters.q?.trim() ? (
            <div className="rounded-2xl border border-border bg-white py-20 text-center">
              <p className="text-text-muted">
                {isAr ? 'ابحث عن منتج لعرض النتائج' : 'Search for a product to see results'}
              </p>
            </div>
          ) : result.data.length === 0 ? (
            <div className="rounded-2xl border border-border bg-white py-20 text-center">
              <p className="text-text-muted">
                {isAr ? 'لا توجد منتجات تطابق بحثك' : 'No products match your search'}
              </p>
              <button type="button" onClick={clearFilters} className="mt-4 text-sm font-semibold text-primary-600">
                {isAr ? 'مسح الفلاتر' : 'Clear filters'}
              </button>
            </div>
          ) : (
            <>
              <ProductGrid products={result.data} />
              <ProductPagination
                pagination={result.pagination}
                language={language}
                onPageChange={(page) => updateFilters({ ...filters, page })}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
