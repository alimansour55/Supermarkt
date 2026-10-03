import { useMemo, useState } from 'react';
import { Link, useSearchParams } from '../app/router';
import {
  LayoutGrid, Search, X, ShoppingBag, ChevronLeft, Sparkles,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useCategories } from '../context/CategoriesContext';
import {
  getAllSubcategories,
  categoryLabel,
  isUnderRootCategory,
} from '../utils/categoryHelpers';
import AllSubcategoriesGrid from '../components/category/AllSubcategoriesGrid';
import CategoryImage from '../components/category/CategoryImage';
import { CategoryGridSkeleton } from '../components/ui/Skeleton';

export default function SubcategoriesPage() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const { categoryTree, categories, rootCategories, loading } = useCategories();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState('');

  const mainFilter = searchParams.get('main') || '';

  const setMainFilter = (slug) => {
    const next = new URLSearchParams(searchParams);
    if (slug) next.set('main', slug);
    else next.delete('main');
    setSearchParams(next, { replace: true });
  };

  const allSubcategories = useMemo(
    () => getAllSubcategories(categoryTree, categories),
    [categoryTree, categories],
  );

  const filteredTree = useMemo(() => {
    if (!mainFilter) return categoryTree;
    return categoryTree.filter((m) => m.slug === mainFilter);
  }, [categoryTree, mainFilter]);

  const filteredSubs = useMemo(() => {
    const needle = query.trim().toLowerCase();
    let list = mainFilter
      ? allSubcategories.filter((s) => isUnderRootCategory(s, mainFilter, categories))
      : allSubcategories;

    if (!needle) return list;

    return list.filter((sub) => {
      const nameAr = (sub.nameAr || sub.name || '').toLowerCase();
      const nameEn = (sub.nameEn || '').toLowerCase();
      const parentAr = (sub.parentNameAr || '').toLowerCase();
      const parentEn = (sub.parentNameEn || '').toLowerCase();
      return nameAr.includes(needle) || nameEn.includes(needle)
        || parentAr.includes(needle) || parentEn.includes(needle);
    });
  }, [allSubcategories, mainFilter, query, categories]);

  const activeMain = rootCategories.find((m) => m.slug === mainFilter);
  const hasActiveFilters = Boolean(mainFilter || query.trim());
  const showGrouped = !query.trim();

  const clearAllFilters = () => {
    setQuery('');
    setMainFilter('');
  };

  return (
    <div className="pb-12">
      {/* Hero */}
      <section className="bg-gradient-to-br from-primary-700 via-primary-600 to-emerald-600 text-white">
        <div className="container-app py-8 md:py-10">
          <nav className="mb-4 flex flex-wrap items-center gap-1 text-sm text-white/80">
            <Link to="/" className="hover:text-white">{isAr ? 'الرئيسية' : 'Home'}</Link>
            <span className="opacity-60">/</span>
            <Link to="/categories" className="hover:text-white">{isAr ? 'الأقسام' : 'Categories'}</Link>
            <span className="opacity-60">/</span>
            <span className="font-medium text-white">{isAr ? 'الأقسام الفرعية' : 'Subcategories'}</span>
          </nav>

          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur-sm">
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                {isAr ? 'تصفح سريع' : 'Quick browse'}
              </div>
              <h1 className="flex items-center gap-3 text-2xl font-bold md:text-4xl">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
                  <LayoutGrid className="h-6 w-6" aria-hidden />
                </span>
                {isAr ? 'جميع الأقسام الفرعية' : 'All subcategories'}
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-white/90 md:text-base">
                {isAr
                  ? 'كل العلامات والأنواع في مكان واحد — اختر قسمًا فرعيًا لعرض منتجاته مباشرة'
                  : 'Every brand and product type in one place — tap a subcategory to shop'}
              </p>
              {!loading && (
                <div className="mt-5 flex flex-wrap gap-2">
                  <span className="rounded-full bg-white/20 px-4 py-1.5 text-sm font-bold backdrop-blur-sm">
                    {allSubcategories.length} {isAr ? 'قسم فرعي' : 'subcategories'}
                  </span>
                  <span className="rounded-full bg-white/20 px-4 py-1.5 text-sm font-bold backdrop-blur-sm">
                    {rootCategories.length} {isAr ? 'قسم رئيسي' : 'main departments'}
                  </span>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                to="/products"
                className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-primary-800 shadow-lg transition-transform hover:scale-[1.02]"
              >
                <ShoppingBag className="h-4 w-4" aria-hidden />
                {isAr ? 'كل المنتجات' : 'All products'}
              </Link>
              <Link
                to="/categories"
                className="inline-flex items-center gap-2 rounded-xl border border-white/40 bg-white/10 px-5 py-3 text-sm font-bold text-white backdrop-blur-sm hover:bg-white/20"
              >
                {isAr ? 'الأقسام الرئيسية' : 'Main categories'}
                <ChevronLeft className={`h-4 w-4 ${isAr ? '' : 'rotate-180'}`} aria-hidden />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <div className="container-app -mt-4 md:-mt-6">
        {/* Sticky toolbar */}
        <div className="sticky top-[72px] z-30 mb-6 rounded-2xl border border-border bg-white/95 p-4 shadow-md backdrop-blur-md md:top-24 md:p-5">
          <div className="relative mb-4">
            <Search className="absolute start-3 top-1/2 h-5 w-5 -translate-y-1/2 text-text-muted" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={isAr ? 'ابحث عن علامة، نوع، أو قسم...' : 'Search brand, type, or department...'}
              className="w-full rounded-xl border border-border bg-surface py-3 ps-11 pe-10 text-sm outline-none transition-shadow focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute end-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-text-muted hover:bg-white hover:text-text"
                aria-label={isAr ? 'مسح' : 'Clear'}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
            {isAr ? 'تصفية حسب القسم الرئيسي' : 'Filter by main department'}
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin [-webkit-overflow-scrolling:touch]">
            <button
              type="button"
              onClick={() => setMainFilter('')}
              className={`inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-all ${
                !mainFilter
                  ? 'bg-primary-600 text-white shadow-sm ring-2 ring-primary-100'
                  : 'border border-border bg-surface text-text hover:border-primary-300 hover:bg-primary-50/50'
              }`}
            >
              {isAr ? 'الكل' : 'All'}
            </button>
            {rootCategories.map((main) => {
              const active = mainFilter === main.slug;
              return (
                <button
                  key={main.slug}
                  type="button"
                  onClick={() => setMainFilter(active ? '' : main.slug)}
                  className={`inline-flex shrink-0 items-center gap-2 rounded-full py-1.5 pe-4 ps-1.5 text-sm font-semibold transition-all ${
                    active
                      ? 'bg-primary-600 text-white shadow-sm ring-2 ring-primary-100'
                      : 'border border-border bg-surface text-text hover:border-primary-300 hover:bg-primary-50/50'
                  }`}
                >
                  <CategoryImage category={main} size="xs" className="!h-7 !w-7 ring-1 ring-black/5" />
                  {categoryLabel(main, isAr)}
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-sm">
            <p className="text-text-muted">
              {loading ? (
                isAr ? 'جاري التحميل...' : 'Loading...'
              ) : (
                <>
                  <span className="font-bold text-text">{filteredSubs.length}</span>
                  {' '}
                  {isAr ? 'نتيجة' : 'results'}
                  {activeMain && (
                    <span className="text-text-muted">
                      {' '}
                      ·
                      {' '}
                      {categoryLabel(activeMain, isAr)}
                    </span>
                  )}
                </>
              )}
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="font-semibold text-primary-600 hover:text-primary-700"
              >
                {isAr ? 'مسح الفلاتر' : 'Clear filters'}
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <CategoryGridSkeleton count={12} />
        ) : (
          <AllSubcategoriesGrid
            subcategories={filteredSubs}
            categoryTree={filteredTree}
            groupByMain={showGrouped}
            isAr={isAr}
            hasQuery={Boolean(query.trim())}
            onClearSearch={() => setQuery('')}
          />
        )}

        {/* Bottom CTA */}
        {!loading && filteredSubs.length > 0 && (
          <section className="mt-10 rounded-2xl border border-primary-200 bg-gradient-to-br from-primary-50 to-white p-6 text-center md:p-8">
            <h2 className="text-lg font-bold text-text md:text-xl">
              {isAr ? 'لم تجد ما تبحث عنه؟' : "Didn't find what you need?"}
            </h2>
            <p className="mt-2 text-sm text-text-muted">
              {isAr ? 'تصفح كل المنتجات مع الفلاتر المتقدمة' : 'Browse all products with advanced filters'}
            </p>
            <Link
              to="/products"
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary-600 px-6 py-3 text-sm font-bold text-white hover:bg-primary-700"
            >
              <ShoppingBag className="h-4 w-4" aria-hidden />
              {isAr ? 'تصفح كل المنتجات' : 'Browse all products'}
            </Link>
          </section>
        )}
      </div>
    </div>
  );
}
