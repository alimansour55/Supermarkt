import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLoaderData, useSearchParams } from '../app/router';
import { SlidersHorizontal, Tag } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { fetchOffersPaginated, fetchProductFilters } from '../services/productApi';
import ProductGrid from '../components/product/ProductGrid';
import ProductFilters, {
  ProductSortBar,
  ProductPagination,
  ActiveFilterChips,
} from '../components/product/ProductFilters';
import ProductGridSkeleton from '../components/product/ProductGridSkeleton';
import PromoBanners from '../components/home/PromoBanners';
import CategoryImage from '../components/category/CategoryImage';
import { categoryLabel } from '../utils/categoryHelpers';
import {
  productFiltersToParams,
  countActiveProductFilters,
} from '../utils/productFilterParams';
import {
  DEFAULT_OFFERS_FILTERS,
  offersApiParams,
  offersFiltersFromSearch,
  paramsKey,
} from '../utils/listingParams';
import { useSsrSeed } from '../hooks/useSsrSeed';

function filtersForMeta(filters) {
  const rest = { ...filters };
  delete rest.page;
  delete rest.sort;
  return { ...rest, offers: 'true' };
}

function OffersCategoryStrip({ meta, filters, onChange, isAr }) {
  const categories = (meta?.mainCategories || []).filter((c) => (c.count ?? 0) > 0);
  if (!categories.length) return null;

  return (
    <div className="mb-3 min-w-0 max-md:-mx-1 max-md:mb-4 md:mb-5">
      <p className="mb-2 text-xs font-semibold text-text-muted md:hidden">
        {isAr ? 'تصفح حسب القسم' : 'Browse by department'}
      </p>
      <div className="overflow-x-auto pb-1 scrollbar-none [-webkit-overflow-scrolling:touch]">
        <div className="flex w-max min-w-full gap-1.5 md:gap-2">
          <button
            type="button"
            onClick={() => onChange({ ...filters, mainCategory: '', subCategory: '', page: 1 })}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors md:gap-2 md:px-4 md:py-2 md:text-sm ${
              !filters.mainCategory
                ? 'border-primary-600 bg-primary-700 text-white shadow-sm'
                : 'border-border bg-white text-text hover:border-primary-200'
            }`}
          >
            <Tag className="h-3.5 w-3.5 md:h-4 md:w-4" />
            {isAr ? 'كل العروض' : 'All offers'}
          </button>
          {categories.map((cat) => {
            const active = filters.mainCategory === cat.slug;
            return (
              <button
                key={cat.slug}
                type="button"
                onClick={() => onChange({
                  ...filters,
                  mainCategory: active ? '' : cat.slug,
                  subCategory: '',
                  page: 1,
                })}
                className={`inline-flex max-w-[9.5rem] shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-semibold transition-colors sm:max-w-none md:gap-2 md:px-3 md:py-2 md:text-sm ${
                  active
                    ? 'border-primary-600 bg-primary-50 text-primary-900'
                    : 'border-border bg-white text-text hover:border-primary-200'
                }`}
              >
                <CategoryImage category={cat} size="xs" className="!h-6 !w-6 shrink-0 md:!h-7 md:!w-7" />
                <span className="truncate">{categoryLabel(cat, isAr)}</span>
                <span
                  className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold md:px-2 md:text-[10px] ${
                    active ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {cat.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function OffersPage() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const [searchParams, setSearchParams] = useSearchParams();
  const loaderData = useLoaderData();
  const isSsrSeeded = useSsrSeed(loaderData?.seedKey);
  const [filters, setFilters] = useState(() => offersFiltersFromSearch(searchParams));
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
  }, [
    filters.mainCategory,
    filters.subCategory,
    filters.productSource,
    filters.brand,
    filters.minPrice,
    filters.maxPrice,
    filters.minRating,
    filters.inStock,
  ]);

  const loadOffers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchOffersPaginated(offersApiParams(filters));
      setResult(res);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    // The server already rendered these exact results — don't fetch them again.
    if (!isSsrSeeded(paramsKey(offersApiParams(filters)))) loadOffers();
    const next = productFiltersToParams({ ...filters, offers: 'true' }).toString();
    if (searchParams.toString() !== next) {
      setSearchParams(productFiltersToParams({ ...filters, offers: 'true' }), { replace: true });
    }
  }, [filters, loadOffers, setSearchParams, searchParams, isSsrSeeded]);

  const updateFilters = (next) => setFilters({ ...next, offers: 'true' });
  const clearFilters = () => setFilters({ ...DEFAULT_OFFERS_FILTERS });

  const activeCount = useMemo(
    () => countActiveProductFilters(filters, { excludeKeys: ['sort', 'page', 'q', 'offers'] }),
    [filters],
  );

  const total = result.pagination?.total ?? result.data.length;

  return (
    <div className="max-md:overflow-x-hidden">
      <div className="bg-gradient-to-l from-red-600 via-orange-500 to-amber-500 py-6 text-white max-md:pb-5 md:py-12">
        <div className="container-app">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/80 md:text-sm">
            {isAr ? 'سوق+ · عروض حصرية' : 'MarketPlus · Exclusive deals'}
          </p>
          <h1 className="mt-1.5 text-2xl font-extrabold leading-tight md:mt-2 md:text-4xl">
            {isAr ? 'عروض لا تُفوَّت' : 'Unmissable Offers'}
          </h1>
          <p className="mt-1.5 max-w-xl text-sm leading-snug text-white/90 md:mt-2 md:text-base">
            {isAr
              ? 'صفِّ العروض حسب القسم والماركة والسعر.'
              : 'Filter deals by department, brand, and price.'}
          </p>
        </div>
      </div>

      {/* Promo row — compact single column on mobile (offers page only) */}
      <div className="max-md:[&_a]:min-h-[5.5rem] max-md:[&_a]:p-4 max-md:[&_a]:hover:scale-100 max-md:[&_h3]:text-base max-md:[&_section]:py-3 max-md:[&_section_.grid]:grid-cols-1 max-md:[&_section_.grid]:gap-2.5">
        <PromoBanners />
      </div>

      <div className="container-app py-4 md:py-8">
        <div className="mb-3 lg:hidden">
          <button
            type="button"
            onClick={() => setShowMobileFilters(!showMobileFilters)}
            className="flex w-full min-h-[44px] items-center justify-center gap-2 rounded-xl border border-border bg-white py-2.5 text-sm font-semibold shadow-sm"
          >
            <SlidersHorizontal className="h-4 w-4 shrink-0" />
            {isAr ? 'تصفية وترتيب' : 'Filters & Sort'}
            {activeCount > 0 && (
              <span className="rounded-full bg-primary-600 px-2 py-0.5 text-xs text-white">
                {activeCount}
              </span>
            )}
          </button>
        </div>

        <div className="grid min-w-0 gap-4 md:gap-6 lg:grid-cols-[280px_1fr]">
          <div
            className={[
              showMobileFilters ? 'block' : 'hidden',
              'lg:block',
              'max-md:mb-1 max-md:max-h-[min(70vh,520px)] max-md:overflow-y-auto max-md:rounded-xl max-md:border max-md:border-border max-md:bg-white max-md:p-3 max-md:shadow-sm',
            ].join(' ')}
          >
            <ProductFilters
              filters={filters}
              meta={meta}
              onChange={updateFilters}
              onClear={clearFilters}
              hideOffersFilter
            />
          </div>

          <div className="min-w-0 space-y-3 md:space-y-4">
            <OffersCategoryStrip
              meta={meta}
              filters={filters}
              onChange={updateFilters}
              isAr={isAr}
            />

            <div className="min-w-0 max-md:-mx-0.5 max-md:overflow-x-auto max-md:pb-0.5">
              <ActiveFilterChips
                filters={filters}
                meta={meta}
                language={language}
                hideOffersChip
                onChange={updateFilters}
                onClear={clearFilters}
              />
            </div>

            <div className="max-md:[&>div]:flex-col max-md:[&>div]:items-stretch max-md:[&>div]:gap-2 max-md:[&_select]:w-full max-md:[&_select]:min-h-[44px]">
              <ProductSortBar
                sort={filters.sort}
                total={total}
                language={language}
                onSortChange={(sort) => updateFilters({ ...filters, sort, page: 1 })}
              />
            </div>

            {loading && result.data.length === 0 ? (
              <ProductGridSkeleton count={12} layout="grid" />
            ) : result.data.length === 0 && !loading ? (
              <div className="rounded-2xl border border-border bg-white py-20 text-center">
                <p className="text-lg font-semibold text-text">
                  {isAr ? 'لا توجد عروض بهذه الفلاتر' : 'No offers match these filters'}
                </p>
                <p className="mt-2 text-sm text-text-muted">
                  {isAr ? 'جرّب تغيير القسم أو نطاق السعر' : 'Try a different department or price range'}
                </p>
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-6 text-sm font-semibold text-primary-700 hover:underline"
                >
                  {isAr ? 'مسح كل الفلاتر' : 'Clear all filters'}
                </button>
              </div>
            ) : (
              <div className={`min-w-0 ${loading ? 'pointer-events-none opacity-50' : ''}`}>
                <ProductGrid products={result.data} layout="grid" />
                <ProductPagination
                  pagination={result.pagination}
                  language={language}
                  onPageChange={(page) => updateFilters({ ...filters, page })}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
