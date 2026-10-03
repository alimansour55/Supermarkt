import { useMemo, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import CategoryBrowsePicker from './CategoryBrowsePicker';
import {
  categoryLabel,
  getCategoryBreadcrumb,
} from '../../utils/categoryHelpers';
import {
  fromStorefrontCategoryFilter,
  toStorefrontCategoryFilter,
} from '../utils/adminCategoryFilter';

export default function AdminProductCategoryFilter({
  categories = [],
  mainCategory = '',
  subCategory = '',
  onChange,
  isAr,
}) {
  const [open, setOpen] = useState(false);

  const selectedId = useMemo(
    () => fromStorefrontCategoryFilter(categories, { mainCategory, subCategory }),
    [categories, mainCategory, subCategory],
  );

  const selectedCategory = useMemo(
    () => (selectedId ? categories.find((c) => String(c._id) === String(selectedId)) : null),
    [categories, selectedId],
  );

  const summaryLabel = useMemo(() => {
    if (!selectedCategory) {
      return isAr ? 'كل الأقسام' : 'All categories';
    }
    return getCategoryBreadcrumb(selectedCategory, categories, isAr);
  }, [selectedCategory, categories, isAr]);

  const handleSelect = (categoryId) => {
    onChange(toStorefrontCategoryFilter(categories, categoryId));
    if (categoryId) setOpen(false);
  };

  const clearFilter = () => {
    onChange({ mainCategory: '', subCategory: '' });
    setOpen(false);
  };

  const hasFilter = Boolean(mainCategory || subCategory);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={[
          'inline-flex min-w-[11rem] max-w-[18rem] items-center gap-2 rounded-xl border bg-white px-3 py-2 text-start text-sm shadow-sm transition-colors',
          hasFilter
            ? 'border-orange-300 text-orange-950 hover:border-orange-400'
            : 'border-border text-text hover:border-orange-200',
        ].join(' ')}
        aria-expanded={open}
      >
        <span className="min-w-0 flex-1 truncate font-medium">{summaryLabel}</span>
        {hasFilter ? (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              clearFilter();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                clearFilter();
              }
            }}
            className="shrink-0 rounded-md p-0.5 text-orange-700 hover:bg-orange-100"
            aria-label={isAr ? 'مسح فلتر القسم' : 'Clear category filter'}
          >
            <X className="h-3.5 w-3.5" />
          </span>
        ) : (
          <ChevronDown className={`h-4 w-4 shrink-0 text-text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
        )}
      </button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-30 cursor-default"
            aria-label={isAr ? 'إغلاق' : 'Close'}
            onClick={() => setOpen(false)}
          />
          <div className="absolute start-0 top-full z-40 mt-2 w-[min(24rem,calc(100vw-2rem))] rounded-2xl border border-border bg-white p-3 shadow-xl">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-bold uppercase tracking-wide text-text-muted">
                {isAr ? 'فلتر القسم (مثل المتجر)' : 'Category filter (storefront logic)'}
              </p>
              {hasFilter && (
                <button
                  type="button"
                  onClick={clearFilter}
                  className="text-[11px] font-semibold text-orange-700 hover:underline"
                >
                  {isAr ? 'مسح' : 'Clear'}
                </button>
              )}
            </div>
            <CategoryBrowsePicker
              categories={categories}
              value={selectedId}
              onChange={handleSelect}
              isAr={isAr}
              includeInactive={false}
              leafOnly={false}
              showIcons={false}
            />
            {selectedCategory && (
              <p className="mt-2 rounded-lg bg-slate-50 px-2.5 py-2 text-[11px] text-text-muted">
                {isAr
                  ? `يعرض المنتجات في «${categoryLabel(selectedCategory, isAr)}» وجميع الأقسام الفرعية الورقية — نفس منطق المتجر.`
                  : `Shows products in «${categoryLabel(selectedCategory, isAr)}» and all leaf subcategories — same as storefront.`}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
