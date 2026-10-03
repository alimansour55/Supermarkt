import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLoaderData, useSearchParams } from '../app/router';
import { ArrowLeft } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { fetchTodaysDealsPaginated } from '../services/productApi';
import ProductGrid from '../components/product/ProductGrid';
import ProductGridSkeleton from '../components/product/ProductGridSkeleton';
import { ProductPagination, ProductSortBar } from '../components/product/ProductFilters';
import DealCountdown from '../components/home/DealCountdown';
import {
  TODAYS_DEALS_DEFAULT_SORT,
  TODAYS_DEALS_PAGE_SIZE,
  paramsKey,
  parsePage,
  todaysDealsApiParams,
} from '../utils/listingParams';
import { useSsrSeed } from '../hooks/useSsrSeed';

const DEFAULT_SORT = TODAYS_DEALS_DEFAULT_SORT;

export default function TodaysDealsPage() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const [searchParams, setSearchParams] = useSearchParams();
  const [sort, setSort] = useState(() => searchParams.get('sort') || DEFAULT_SORT);
  const [page, setPage] = useState(() => parsePage(searchParams.get('page')));
  const loaderData = useLoaderData();
  const isSsrSeeded = useSsrSeed(loaderData?.seedKey);
  const [result, setResult] = useState(() => loaderData?.result || { data: [], pagination: null, meta: null });
  const [loading, setLoading] = useState(() => !loaderData?.result);

  const countdownEnd = useMemo(() => {
    const raw = result.meta?.countdownEnd;
    if (!raw) return null;
    const end = new Date(raw);
    return Number.isNaN(end.getTime()) ? null : end;
  }, [result.meta?.countdownEnd]);

  const loadDeals = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchTodaysDealsPaginated({ page, limit: TODAYS_DEALS_PAGE_SIZE, sort });
      setResult(res);
    } finally {
      setLoading(false);
    }
  }, [page, sort]);

  useEffect(() => {
    // The server already rendered these exact results — don't fetch them again.
    if (isSsrSeeded(paramsKey(todaysDealsApiParams({ page, sort })))) return;
    loadDeals();
  }, [loadDeals, isSsrSeeded, page, sort]);

  useEffect(() => {
    const next = new URLSearchParams();
    if (sort && sort !== DEFAULT_SORT) next.set('sort', sort);
    if (page > 1) next.set('page', String(page));
    const nextStr = next.toString();
    if (searchParams.toString() !== nextStr) {
      setSearchParams(next, { replace: true });
    }
  }, [page, sort, searchParams, setSearchParams]);

  const total = result.pagination?.total ?? result.data.length;

  return (
    <div className="max-md:overflow-x-hidden">
      <div className="border-b border-orange-100 bg-gradient-to-br from-orange-50/90 to-white py-6 md:py-8">
        <div className="container-app">
          <Link
            to="/"
            className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary-600 hover:text-primary-700"
          >
            <ArrowLeft className="h-4 w-4" />
            {isAr ? 'العودة للرئيسية' : 'Back to home'}
          </Link>

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="flex items-center gap-2 text-2xl font-bold text-text md:text-4xl">
                <span className="text-3xl" aria-hidden>🔥</span>
                {isAr ? 'عروض اليوم' : "Today's Deals"}
              </h1>
              <p className="mt-2 text-sm text-text-muted md:text-base">
                {isAr ? 'خصومات لفترة محدودة' : 'Limited-time discounts'}
              </p>
            </div>
            {countdownEnd && (
              <DealCountdown endDate={countdownEnd} variant="prominent" />
            )}
          </div>
        </div>
      </div>

      <div className="container-app py-6 md:py-8">
        <ProductSortBar
          sort={sort}
          total={total}
          language={language}
          onSortChange={(nextSort) => {
            setSort(nextSort);
            setPage(1);
          }}
        />

        {loading && result.data.length === 0 ? (
          <ProductGridSkeleton count={12} layout="grid" />
        ) : result.data.length === 0 && !loading ? (
          <div className="rounded-2xl border border-border bg-white py-20 text-center">
            <p className="text-lg font-semibold text-text">
              {isAr ? 'لا توجد عروض اليوم حالياً' : 'No deals available right now'}
            </p>
            <p className="mt-2 text-sm text-text-muted">
              {isAr ? 'عد لاحقاً أو تصفح كل العروض' : 'Check back later or browse all offers'}
            </p>
            <Link
              to="/offers"
              className="mt-6 inline-flex text-sm font-semibold text-primary-700 hover:underline"
            >
              {isAr ? 'كل العروض' : 'All offers'}
            </Link>
          </div>
        ) : (
          <div className={`min-w-0 space-y-6 ${loading ? 'pointer-events-none opacity-50' : ''}`}>
            <ProductGrid products={result.data} layout="grid" />
            <ProductPagination
              pagination={result.pagination}
              language={language}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>
    </div>
  );
}
