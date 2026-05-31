import { useState, useEffect, useCallback } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { fetchProductsByCategory, fetchProductFilters } from '../services/productApi';
import ProductGrid from '../components/product/ProductGrid';
import ProductFilters, { ProductSortBar, ProductPagination } from '../components/product/ProductFilters';
import ProductGridSkeleton from '../components/product/ProductGridSkeleton';
import CategoryBreadcrumb from '../components/category/CategoryBreadcrumb';
import SubcategoryChips from '../components/category/SubcategoryChips';
import { categoryLabel } from '../utils/categoryHelpers';

const DEFAULT_FILTERS = {
  brand: '',
  minPrice: '',
  maxPrice: '',
  minRating: '',
  offers: '',
  sort: '',
  page: 1,
};

function paramsToFilters(params) {
  return {
    brand: params.get('brand') || '',
    minPrice: params.get('minPrice') || '',
    maxPrice: params.get('maxPrice') || '',
    minRating: params.get('minRating') || '',
    offers: params.get('offers') || '',
    sort: params.get('sort') || '',
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

export default function CategoryPage() {
  const { slug } = useParams();
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState(() => paramsToFilters(searchParams));
  const [meta, setMeta] = useState(null);
  const [category, setCategory] = useState(null);
  const [parentCategory, setParentCategory] = useState(null);
  const [subcategories, setSubcategories] = useState([]);
  const [result, setResult] = useState({ products: [], pagination: null });
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  useEffect(() => {
    fetchProductFilters().then(setMeta);
  }, []);

  const loadCategory = useCallback(async () => {
    setLoading(true);
    setNotFound(false);
    try {
      const res = await fetchProductsByCategory(slug, filters);
      if (!res.category) {
        setNotFound(true);
        return;
      }
      setCategory(res.category);
      setParentCategory(res.parentCategory || null);
      setSubcategories(res.subcategories || []);
      setResult({ products: res.products || [], pagination: res.pagination });
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [slug, filters]);

  useEffect(() => {
    setFilters({ ...DEFAULT_FILTERS });
  }, [slug]);

  useEffect(() => {
    loadCategory();
    setSearchParams(filtersToParams(filters), { replace: true });
  }, [slug, filters, loadCategory, setSearchParams]);

  const updateFilters = (next) => setFilters(next);
  const clearFilters = () => setFilters({ ...DEFAULT_FILTERS });

  if (loading && !category) {
    return (
      <div className="container-app py-8">
        <div className="mb-4 h-4 w-48 animate-pulse rounded bg-slate-200" />
        <div className="mb-8 h-16 w-64 animate-pulse rounded-2xl bg-slate-200" />
        <ProductGridSkeleton count={8} />
      </div>
    );
  }

  if (notFound || !category) {
    return (
      <div className="container-app py-20 text-center">
        <p className="text-xl text-text-muted">{isAr ? 'القسم غير موجود' : 'Category not found'}</p>
        <Link to="/categories" className="mt-4 inline-block text-primary-600">
          {isAr ? 'عرض الأقسام' : 'View Categories'}
        </Link>
      </div>
    );
  }

  const catName = categoryLabel(category, isAr);
  const total = result.pagination?.total ?? result.products.length;

  return (
    <div className="container-app py-6 md:py-8">
      <CategoryBreadcrumb parentCategory={parentCategory} currentCategory={category} />

      <div className="mb-6 flex items-center gap-4">
        <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-3xl md:h-16 md:w-16 ${category.color || 'bg-primary-50'}`}>
          {category.icon}
        </span>
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">{catName}</h1>
          <p className="text-sm text-text-muted">
            {total} {isAr ? 'منتج' : 'products'}
          </p>
        </div>
      </div>

      <SubcategoryChips
        currentSlug={slug}
        parentCategory={parentCategory}
        subcategories={subcategories}
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

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <div className={`${showMobileFilters ? 'block' : 'hidden'} lg:block`}>
          <ProductFilters
            filters={filters}
            meta={meta}
            onChange={updateFilters}
            onClear={clearFilters}
            hideCategory
          />
        </div>

        <div className="space-y-4">
          <ProductSortBar
            sort={filters.sort}
            total={total}
            language={language}
            onSortChange={(sort) => updateFilters({ ...filters, sort, page: 1 })}
          />

          {loading ? (
            <ProductGridSkeleton count={12} />
          ) : result.products.length === 0 ? (
            <div className="rounded-2xl border border-border bg-white py-20 text-center">
              <p className="text-text-muted">{isAr ? 'لا توجد منتجات' : 'No products found'}</p>
              <button type="button" onClick={clearFilters} className="mt-4 text-sm font-semibold text-primary-600">
                {isAr ? 'مسح الفلاتر' : 'Clear filters'}
              </button>
            </div>
          ) : (
            <>
              <ProductGrid products={result.products} />
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
