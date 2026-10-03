import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLoaderData, useSearchParams } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { fetchProductsPaginated, fetchProductFilters } from '../services/productApi';
import ProductGrid from '../components/product/ProductGrid';
import ProductFilters, {
  ProductSortBar,
  ProductPagination,
  ActiveFilterChips,
} from '../components/product/ProductFilters';
import SearchBar from '../components/search/SearchBar';
import ProductGridSkeleton from '../components/product/ProductGridSkeleton';
import {
  DEFAULT_PRODUCT_FILTERS,
  paramsToProductFilters,
  productFiltersToParams,
  productFiltersToApiParams,
  countActiveProductFilters,
} from '../utils/productFilterParams';
import { paramsKey } from '../utils/listingParams';
import { useSsrSeed } from '../hooks/useSsrSeed';

function filtersForMeta(filters) {
  const rest = { ...filters };
  delete rest.page;
  delete rest.sort;
  return rest;
}

export default function ProductListingPage() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const [searchParams, setSearchParams] = useSearchParams();
  const loaderData = useLoaderData();
  const isSsrSeeded = useSsrSeed(loaderData?.seedKey);
  const [filters, setFilters] = useState(() => paramsToProductFilters(searchParams));
  const [meta, setMeta] = useState(null);
  const [result, setResult] = useState(() => loaderData?.result || { data: [], pagination: null });
  const [loading, setLoading] = useState(() => !loaderData?.result);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

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

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchProductsPaginated(productFiltersToApiParams(filters));
      setResult(res);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    // The server already rendered these exact results — don't fetch them again.
    if (!isSsrSeeded(paramsKey(productFiltersToApiParams(filters)))) loadProducts();
    const next = productFiltersToParams(filters).toString();
    if (searchParams.toString() !== next) {
      setSearchParams(productFiltersToParams(filters), { replace: true });
    }
  }, [filters, loadProducts, setSearchParams, searchParams, isSsrSeeded]);

  const updateFilters = (next) => setFilters(next);
  const clearFilters = () => setFilters({
    ...DEFAULT_PRODUCT_FILTERS,
    q: filters.q,
    sort: filters.sort,
  });

  const activeCount = useMemo(
    () => countActiveProductFilters(filters),
    [filters],
  );

  return (
    <div className="container-app py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold md:text-3xl">
          {filters.q
            ? `${isAr ? 'نتائج البحث' : 'Search'}: "${filters.q}"`
            : (isAr ? 'كل المنتجات' : 'All Products')}
        </h1>
        <div className="mt-4 max-w-xl"><SearchBar /></div>
      </div>

      <div className="mb-4 lg:hidden">
        <button
          type="button"
          onClick={() => setShowMobileFilters(!showMobileFilters)}
          aria-expanded={showMobileFilters}
          className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-border bg-white py-2.5 text-sm font-semibold shadow-sm"
        >
          {isAr ? 'تصفية وترتيب' : 'Filters & Sort'}
          {activeCount > 0 && (
            <span className="rounded-full bg-primary-600 px-2 py-0.5 text-xs text-white">{activeCount}</span>
          )}
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <div className={`${showMobileFilters ? 'block' : 'hidden'} lg:block`}>
          <ProductFilters
            filters={filters}
            meta={meta}
            onChange={updateFilters}
            onClear={clearFilters}
          />
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
            <ProductGridSkeleton count={12} layout="grid" />
          ) : result.data.length === 0 ? (
            <div className="rounded-2xl border border-border bg-white py-20 text-center">
              <span className="text-5xl" aria-hidden>🔍</span>
              <p className="mt-4 text-text-muted">{isAr ? 'لا توجد منتجات' : 'No products found'}</p>
              {activeCount > 1 && (
                <p className="mx-auto mt-2 max-w-md text-sm text-text-muted">
                  {isAr
                    ? 'لا يوجد منتج يطابق كل الفلاتر المفعّلة معاً. جرّب إزالة فلتر الماركة أو مسح الكل.'
                    : 'No product matches all active filters together. Try removing the brand filter or clear all.'}
                </p>
              )}
              <button type="button" onClick={clearFilters} className="mt-4 text-sm font-semibold text-primary-600">
                {isAr ? 'مسح الفلاتر' : 'Clear filters'}
              </button>
            </div>
          ) : (
            <>
              <ProductGrid products={result.data} layout="grid" />
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
