import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { fetchProductsPaginated, fetchProductFilters } from '../services/productApi';
import { addRecentSearch } from '../utils/searchStorage';
import SearchAutocomplete from '../components/search/SearchAutocomplete';
import ProductGrid from '../components/product/ProductGrid';
import ProductFilters, { ProductSortBar, ProductPagination } from '../components/product/ProductFilters';
import ProductGridSkeleton from '../components/product/ProductGridSkeleton';

const DEFAULT_FILTERS = {
  category: '',
  brand: '',
  minPrice: '',
  maxPrice: '',
  minRating: '',
  offers: '',
  sort: '',
  q: '',
  page: 1,
};

function paramsToFilters(params) {
  return {
    category: params.get('category') || '',
    brand: params.get('brand') || '',
    minPrice: params.get('minPrice') || '',
    maxPrice: params.get('maxPrice') || '',
    minRating: params.get('minRating') || '',
    offers: params.get('offers') || '',
    sort: params.get('sort') || '',
    q: params.get('q') || '',
    page: Number(params.get('page')) || 1,
  };
}

function filtersToParams(filters) {
  const p = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v && v !== 1 && !(k === 'page' && v === 1)) p.set(k, String(v));
    if (k === 'page' && v > 1) p.set(k, String(v));
  });
  return p;
}

export default function SearchResultsPage() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState(() => paramsToFilters(searchParams));
  const [meta, setMeta] = useState(null);
  const [result, setResult] = useState({ data: [], pagination: null });
  const [loading, setLoading] = useState(true);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  useEffect(() => {
    fetchProductFilters().then(setMeta);
  }, []);

  useEffect(() => {
    if (filters.q?.trim()) addRecentSearch(filters.q.trim());
  }, [filters.q]);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchProductsPaginated(filters);
      setResult(res);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadProducts();
    setSearchParams(filtersToParams(filters), { replace: true });
  }, [filters, loadProducts, setSearchParams]);

  const updateFilters = (next) => setFilters(next);
  const clearFilters = () => setFilters({ ...DEFAULT_FILTERS });

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

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <div className={`${showMobileFilters ? 'block' : 'hidden'} lg:block`}>
          <ProductFilters filters={filters} meta={meta} onChange={updateFilters} onClear={clearFilters} />
        </div>

        <div className="space-y-4">
          <ProductSortBar
            sort={filters.sort}
            total={result.pagination?.total ?? result.data.length}
            language={language}
            onSortChange={(sort) => updateFilters({ ...filters, sort, page: 1 })}
          />

          {loading ? (
            <ProductGridSkeleton count={12} />
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
