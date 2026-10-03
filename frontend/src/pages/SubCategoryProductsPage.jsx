import { useState, useEffect } from 'react';
import { Link, useParams, useSearchParams } from '../app/router';
import { useLanguage } from '../context/LanguageContext';
import { fetchProductsByMainSub, fetchProductFilters } from '../services/productApi';
import ProductGrid from '../components/product/ProductGrid';
import ProductFilters, {
  ProductSortBar,
  ProductPagination,
  ActiveFilterChips,
} from '../components/product/ProductFilters';
import ProductGridSkeleton from '../components/product/ProductGridSkeleton';
import CategoryBreadcrumb from '../components/category/CategoryBreadcrumb';
import SubcategoryChips from '../components/category/SubcategoryChips';
import { categoryLabel } from '../utils/categoryHelpers';
import CategoryImage from '../components/category/CategoryImage';
import { productFiltersToParams } from '../utils/productFilterParams';

const DEFAULT_FILTERS = {
  productSource: '',
  brand: '',
  minPrice: '',
  maxPrice: '',
  minRating: '',
  offers: '',
  inStock: '',
  sort: '',
  page: 1,
};

function paramsToFilters(params) {
  return {
    productSource: params.get('productSource') || '',
    brand: params.get('brand') || '',
    minPrice: params.get('minPrice') || '',
    maxPrice: params.get('maxPrice') || '',
    minRating: params.get('minRating') || '',
    offers: params.get('offers') || '',
    inStock: params.get('inStock') || '',
    sort: params.get('sort') || '',
    page: Number(params.get('page')) || 1,
  };
}

export default function SubCategoryProductsPage() {
  const { mainSlug, subSlug } = useParams();
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState(() => paramsToFilters(searchParams));
  const [meta, setMeta] = useState(null);
  const [mainCategory, setMainCategory] = useState(null);
  const [category, setCategory] = useState(null);
  const [subcategories, setSubcategories] = useState([]);
  const [result, setResult] = useState({ products: [], pagination: null });
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const facetParams = {
    mainCategory: mainSlug,
    subCategory: subSlug,
    productSource: filters.productSource,
    brand: filters.brand,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
    minRating: filters.minRating,
    offers: filters.offers,
    inStock: filters.inStock,
    q: '',
  };

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      fetchProductFilters(facetParams)
        .then((data) => { if (active) setMeta(data); });
    }, 150);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [mainSlug, subSlug, filters.productSource, filters.brand, filters.minPrice, filters.maxPrice, filters.minRating, filters.offers, filters.inStock]);

  useEffect(() => {
    setFilters({ ...DEFAULT_FILTERS });
    setCategory(null);
    setMainCategory(null);
    setSubcategories([]);
    setResult({ products: [], pagination: null });
    setNotFound(false);
    setLoading(true);
  }, [mainSlug, subSlug]);

  useEffect(() => {
    if (!mainSlug || !subSlug) return undefined;

    let active = true;
    setLoading(true);
    setNotFound(false);

    fetchProductsByMainSub(mainSlug, subSlug, filters)
      .then((res) => {
        if (!active) return;
        if (!res.category) {
          setNotFound(true);
          return;
        }
        setMainCategory(res.mainCategory || res.parentCategory);
        setCategory(res.category);
        setSubcategories(res.subcategories || []);
        setResult({ products: res.products || [], pagination: res.pagination });
      })
      .catch(() => {
        if (active) setNotFound(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [mainSlug, subSlug, filters]);

  useEffect(() => {
    const next = productFiltersToParams(filters).toString();
    if (searchParams.toString() !== next) {
      setSearchParams(productFiltersToParams(filters), { replace: true });
    }
  }, [filters, setSearchParams, searchParams]);

  const updateFilters = (next) => setFilters(next);
  const clearFilters = () => setFilters({ ...DEFAULT_FILTERS });

  const filterStateForUi = {
    mainCategory: mainSlug,
    subCategory: subSlug,
    ...filters,
  };

  if (loading && !category) {
    if (notFound) {
      return (
        <div className="container-app py-20 text-center">
          <p className="text-xl text-text-muted">{isAr ? 'القسم غير موجود' : 'Category not found'}</p>
          <Link to={`/category/${mainSlug}`} className="mt-4 inline-block text-primary-600">
            {isAr ? 'العودة للقسم الرئيسي' : 'Back to main category'}
          </Link>
        </div>
      );
    }
    return (
      <div className="container-app py-8">
        <div className="mb-4 h-4 w-64 animate-pulse rounded bg-slate-200" />
        <ProductGridSkeleton count={12} layout="grid" />
      </div>
    );
  }

  const catName = categoryLabel(category, isAr);
  const total = result.pagination?.total ?? result.products.length;

  return (
    <div className="container-app py-6 md:py-8">
      <CategoryBreadcrumb
        parentCategory={mainCategory}
        currentCategory={category}
      />

      <div className="mb-6 flex items-center gap-4">
        <CategoryImage category={category} size="md" alt={catName} />
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">{catName}</h1>
          <p className="text-sm text-text-muted">
            {total} {isAr ? 'منتج' : 'products'}
          </p>
        </div>
      </div>

      <SubcategoryChips
        currentSlug={subSlug}
        parentCategory={mainCategory}
        subcategories={subcategories}
        mainSlug={mainSlug}
      />

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
          <ProductFilters
            filters={filterStateForUi}
            meta={meta}
            onChange={(next) => updateFilters({
              productSource: next.productSource,
              brand: next.brand,
              minPrice: next.minPrice,
              maxPrice: next.maxPrice,
              minRating: next.minRating,
              offers: next.offers,
              inStock: next.inStock,
              page: next.page ?? 1,
            })}
            onClear={clearFilters}
            hideMainCategory
            hideSubCategory
            lockedMainSlug={mainSlug}
            lockedSubSlug={subSlug}
          />
        </div>

        <div className="space-y-4">
          <ActiveFilterChips
            filters={filterStateForUi}
            meta={meta}
            language={language}
            hideCategoryChips
            onChange={(next) => updateFilters({
              productSource: next.productSource,
              brand: next.brand,
              minPrice: next.minPrice,
              maxPrice: next.maxPrice,
              minRating: next.minRating,
              offers: next.offers,
              inStock: next.inStock,
              page: next.page ?? 1,
            })}
            onClear={clearFilters}
          />

          <ProductSortBar
            sort={filters.sort}
            total={total}
            language={language}
            onSortChange={(sort) => updateFilters({ ...filters, sort, page: 1 })}
          />

          {loading ? (
            <ProductGridSkeleton count={12} layout="grid" />
          ) : result.products.length === 0 ? (
            <div className="rounded-2xl border border-border bg-white py-20 text-center">
              <p className="text-text-muted">{isAr ? 'لا توجد منتجات في هذا القسم' : 'No products in this category'}</p>
              <Link to={`/category/${mainSlug}`} className="mt-4 inline-block text-sm font-semibold text-primary-600">
                {isAr ? 'اختر قسمًا فرعيًا آخر' : 'Choose another sub category'}
              </Link>
            </div>
          ) : (
            <>
              <ProductGrid products={result.products} layout="grid" />
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
