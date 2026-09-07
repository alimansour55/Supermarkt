import { Link } from 'react-router-dom';
import { ChevronLeft, Package } from 'lucide-react';
import { useCategories } from '../../context/CategoriesContext';
import { categoryLabel, categoryHref, filterSubcategoryLabel } from '../../utils/categoryHelpers';
import CategoryImage from './CategoryImage';

export function SubcategoryCard({ sub, isAr, compact = false }) {
  const { categories } = useCategories();
  const to = categoryHref(sub, sub.parentSlug, null, categories);
  const parentName = isAr
    ? (sub.parentNameAr || sub.parentNameEn)
    : (sub.parentNameEn || sub.parentNameAr);

  return (
    <Link
      to={to}
      className={`group flex flex-col items-center rounded-2xl border border-border bg-white text-center shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-md ${
        compact ? 'gap-2 p-3 sm:p-4' : 'gap-2 p-4 sm:gap-3 sm:p-5'
      }`}
    >
      <CategoryImage
        category={sub}
        size={compact ? 'sm' : 'md'}
        alt={categoryLabel(sub, isAr)}
        className="transition-transform group-hover:scale-105"
      />
      <span className="line-clamp-2 text-sm font-semibold text-text">
        {filterSubcategoryLabel(sub, isAr)}
      </span>
      {!compact && parentName && (
        <span className="line-clamp-1 max-w-full rounded-full bg-surface px-2.5 py-0.5 text-[10px] font-medium text-text-muted">
          {parentName}
        </span>
      )}
      {sub.productCount != null && sub.productCount > 0 && (
        <span className="inline-flex items-center gap-1 text-xs text-text-muted">
          <Package className="h-3 w-3" aria-hidden />
          {sub.productCount} {isAr ? 'منتج' : 'products'}
        </span>
      )}
      <span className="mt-auto flex items-center gap-1 pt-1 text-xs font-semibold text-primary-600 sm:opacity-80 sm:group-hover:opacity-100">
        {isAr ? 'عرض المنتجات' : 'Shop now'}
        <ChevronLeft className={`h-3.5 w-3.5 ${isAr ? '' : 'rotate-180'}`} aria-hidden />
      </span>
    </Link>
  );
}

function EmptyState({ isAr, hasQuery, onClear }) {
  return (
    <div className="rounded-3xl border border-dashed border-border bg-surface/60 px-6 py-16 text-center">
      <p className="text-lg font-bold text-text">
        {hasQuery
          ? (isAr ? 'لا توجد نتائج' : 'No matches found')
          : (isAr ? 'لا توجد أقسام فرعية بعد' : 'No subcategories yet')}
      </p>
      <p className="mx-auto mt-2 max-w-md text-sm text-text-muted">
        {hasQuery
          ? (isAr ? 'جرّب كلمة بحث أخرى أو امسح الفلاتر' : 'Try another search or clear filters')
          : (isAr
            ? 'ستظهر العلامات والأنواع هنا عند إضافتها من لوحة التحكم'
            : 'Brands and types will appear here once added from admin')}
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        {hasQuery && onClear && (
          <button
            type="button"
            onClick={onClear}
            className="rounded-full border border-border bg-white px-5 py-2.5 text-sm font-semibold text-text hover:bg-surface"
          >
            {isAr ? 'مسح البحث' : 'Clear search'}
          </button>
        )}
        <Link
          to="/categories"
          className="rounded-full bg-primary-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-primary-700"
        >
          {isAr ? 'الأقسام الرئيسية' : 'Main categories'}
        </Link>
        <Link
          to="/products"
          className="rounded-full border border-primary-200 bg-primary-50 px-5 py-2.5 text-sm font-bold text-primary-700 hover:bg-primary-100"
        >
          {isAr ? 'كل المنتجات' : 'All products'}
        </Link>
      </div>
    </div>
  );
}

/** Grid of subcategories, optionally grouped under main category headings. */
export default function AllSubcategoriesGrid({
  subcategories = [],
  categoryTree = [],
  groupByMain = true,
  isAr,
  hasQuery = false,
  onClearSearch,
}) {
  if (!subcategories.length) {
    return <EmptyState isAr={isAr} hasQuery={hasQuery} onClear={onClearSearch} />;
  }

  if (groupByMain && categoryTree.length) {
    const flatSubs = subcategories.length
      ? subcategories
      : categoryTree.flatMap((main) => (main.children || []).map((sub) => ({
        ...sub,
        rootSlug: main.slug,
        parentSlug: main.slug,
        parentNameAr: main.nameAr || main.name,
        parentNameEn: main.nameEn,
      })));

    const mainsWithSubs = categoryTree.filter((main) =>
      flatSubs.some((s) => s.rootSlug === main.slug || (!s.rootSlug && s.parentSlug === main.slug)),
    );

    return (
      <div className="space-y-8 md:space-y-10">
        {mainsWithSubs.map((main) => {
          const subsForMain = flatSubs.filter(
            (s) => s.rootSlug === main.slug || (!s.rootSlug && s.parentSlug === main.slug),
          );
          return (
          <section
            key={main.slug || main._id}
            id={`sub-main-${main.slug}`}
            className="scroll-mt-28 rounded-2xl border border-border bg-white p-4 shadow-sm md:p-6"
          >
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
              <Link
                to={`/category/${main.slug}`}
                className="flex min-w-0 items-center gap-3 hover:text-primary-700"
              >
                <CategoryImage category={main} size="sm" alt={categoryLabel(main, isAr)} />
                <div className="min-w-0 text-start">
                  <h2 className="text-lg font-bold text-text md:text-xl">
                    {categoryLabel(main, isAr)}
                  </h2>
                  <p className="text-xs text-text-muted md:text-sm">
                    {subsForMain.length} {isAr ? 'قسم فرعي' : 'subcategories'}
                  </p>
                </div>
              </Link>
              <Link
                to={`/category/${main.slug}`}
                className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary-50 px-4 py-2 text-xs font-bold text-primary-700 hover:bg-primary-100"
              >
                {isAr ? 'صفحة القسم' : 'Department page'}
                <ChevronLeft className={`h-3.5 w-3.5 ${isAr ? '' : 'rotate-180'}`} aria-hidden />
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {subsForMain.map((sub) => (
                <SubcategoryCard
                  key={sub.slug || sub._id}
                  sub={sub}
                  isAr={isAr}
                />
              ))}
            </div>
          </section>
          );
        })}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {subcategories.map((sub) => (
        <SubcategoryCard key={`${sub.parentSlug}-${sub.slug}`} sub={sub} isAr={isAr} />
      ))}
    </div>
  );
}
