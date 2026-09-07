import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { fetchCategoryBrowse, fetchProductsByCategoryPath, fetchProductFilters } from '../services/productApi';
import ProductGrid from '../components/product/ProductGrid';
import ProductFilters, {
  ProductSortBar,
  ProductPagination,
  ActiveFilterChips,
} from '../components/product/ProductFilters';
import ProductGridSkeleton from '../components/product/ProductGridSkeleton';
import CategoryBreadcrumb from '../components/category/CategoryBreadcrumb';
import SubcategoryGrid from '../components/category/SubcategoryGrid';
import SubcategoryChips from '../components/category/SubcategoryChips';
import { buildCategoryPath, categoryLabel } from '../utils/categoryHelpers';
import { CategoryGridSkeleton } from '../components/ui/Skeleton';
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

export default function CategoryBrowsePage() {
  const params = useParams();
  const navigate = useNavigate();
  const slugPath = (params['*'] || '').replace(/^\/+|\/+$/g, '');
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState(() => paramsToFilters(searchParams));
  const [meta, setMeta] = useState(null);
  const [browse, setBrowse] = useState(null);
  const [siblingSubcategories, setSiblingSubcategories] = useState([]);
  const [result, setResult] = useState({ products: [], pagination: null });
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const chain = browse?.chain || [];
  const category = browse?.category;
  const children = browse?.children || [];
  const isLeaf = browse?.isLeaf;
  const parentPath = useMemo(() => {
    const segments = slugPath.split('/').filter(Boolean);
    if (segments.length <= 1) return '';
    return segments.slice(0, -1).join('/');
  }, [slugPath]);

  const facetParams = {
    category: category?.slug,
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
    setFilters({ ...DEFAULT_FILTERS });
    setBrowse(null);
    setSiblingSubcategories([]);
    setResult({ products: [], pagination: null });
    setNotFound(false);
    setLoading(true);
  }, [slugPath]);

  useEffect(() => {
    if (!slugPath) {
      setNotFound(true);
      setLoading(false);
      return undefined;
    }

    let active = true;
    setLoading(true);
    setNotFound(false);

    fetchCategoryBrowse(slugPath)
      .then((res) => {
        if (!active) return;
        if (!res?.category) {
          setNotFound(true);
          setLoading(false);
          return;
        }
        const canonical = res.redirectTo || res.canonicalSlugPath || res.slugPath;
        if (canonical && canonical !== slugPath) {
          navigate(buildCategoryPath(canonical), { replace: true });
          return;
        }
        setBrowse(res);
        if (!res.isLeaf) {
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setNotFound(true);
          setLoading(false);
        }
      });

    return () => { active = false; };
  }, [slugPath, navigate]);

  useEffect(() => {
    if (!slugPath || !browse?.isLeaf) return undefined;

    let active = true;
    setLoading(true);
    setNotFound(false);

    fetchProductsByCategoryPath(slugPath, filters)
      .then((res) => {
        if (!active) return;
        setResult({ products: res.products || [], pagination: res.pagination });
        setSiblingSubcategories(res.subcategories || []);
        if (res.chain?.length) {
          setBrowse((prev) => (prev ? { ...prev, chain: res.chain } : prev));
        }
      })
      .catch(() => {
        if (active) setNotFound(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [slugPath, browse?.isLeaf, filters]);

  useEffect(() => {
    if (!isLeaf || !category?.slug) return undefined;
    let active = true;
    const timer = setTimeout(() => {
      fetchProductFilters(facetParams)
        .then((data) => { if (active) setMeta(data); });
    }, 150);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [isLeaf, category?.slug, filters.productSource, filters.brand, filters.minPrice, filters.maxPrice, filters.minRating, filters.offers, filters.inStock]);

  useEffect(() => {
    const next = productFiltersToParams(filters).toString();
    if (searchParams.toString() !== next) {
      setSearchParams(productFiltersToParams(filters), { replace: true });
    }
  }, [filters, setSearchParams, searchParams]);

  const updateFilters = (next) => setFilters(next);
  const clearFilters = () => setFilters({ ...DEFAULT_FILTERS });

  if (!slugPath) {
    return (
      <div className="container-app py-20 text-center">
        <p className="text-xl text-text-muted">{isAr ? 'اختر قسمًا' : 'Choose a category'}</p>
        <Link to="/categories" className="mt-4 inline-block text-primary-600">
          {isAr ? 'عرض الأقسام' : 'View categories'}
        </Link>
      </div>
    );
  }

  if (loading && !category) {
    if (notFound) {
      return (
        <div className="container-app py-20 text-center">
          <p className="text-xl text-text-muted">{isAr ? 'القسم غير موجود' : 'Category not found'}</p>
          <Link to="/categories" className="mt-4 inline-block text-primary-600">
            {isAr ? 'عرض الأقسام' : 'View categories'}
          </Link>
        </div>
      );
    }
    return (
      <div className="container-app py-8">
        <div className="mb-4 h-4 w-48 animate-pulse rounded bg-slate-200" />
        <CategoryGridSkeleton count={6} />
      </div>
    );
  }

  if (notFound || !category) {
    return (
      <div className="container-app py-20 text-center">
        <p className="text-xl text-text-muted">{isAr ? 'القسم غير موجود' : 'Category not found'}</p>
        <Link to="/categories" className="mt-4 inline-block text-primary-600">
          {isAr ? 'عرض الأقسام' : 'View categories'}
        </Link>
      </div>
    );
  }

  const catName = categoryLabel(category, isAr);

  if (!isLeaf) {
    return (
      <div className="container-app py-6 md:py-8">
        <CategoryBreadcrumb chain={chain} />

        <div className="mb-6 flex items-center gap-4">
          <CategoryImage category={category} size="lg" alt={catName} />
          <div>
            <h1 className="text-2xl font-bold md:text-3xl">{catName}</h1>
            <p className="text-sm text-text-muted">
              {isAr ? 'اختر القسم التالي لعرض المزيد' : 'Choose the next category to continue'}
            </p>
          </div>
        </div>

        <SubcategoryGrid
          subcategories={children}
          parentName={catName}
          pathPrefix={slugPath}
        />
      </div>
    );
  }

  const total = result.pagination?.total ?? result.products.length;
  const filterStateForUi = { category: category.slug, ...filters };

  return (
    <div className="container-app py-6 md:py-8">
      <CategoryBreadcrumb chain={chain} />

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
        currentSlug={category.slug}
        parentCategory={chain.length > 1 ? chain[chain.length - 2] : null}
        subcategories={siblingSubcategories}
        pathPrefix={parentPath}
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
              {parentPath && (
                <Link to={buildCategoryPath(parentPath)} className="mt-4 inline-block text-sm font-semibold text-primary-600">
                  {isAr ? 'العودة للقسم السابق' : 'Back to previous category'}
                </Link>
              )}
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
