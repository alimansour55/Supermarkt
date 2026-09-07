import { useMemo } from 'react';
import { X } from 'lucide-react';
import CategoryBrowsePicker from './CategoryBrowsePicker';
import {
  categoryLabel,
  getCategoryBreadcrumb,
} from '../../utils/categoryHelpers';

/**
 * Multi-select category picker for promotions and bulk targeting.
 * Values are category ids — backend expands each to leaf descendants.
 */
export default function CategoryMultiBrowsePicker({
  categories = [],
  value = [],
  onChange,
  isAr = true,
  maxItems = 24,
}) {
  const selectedIds = useMemo(() => (value || []).map(String), [value]);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const selectedRows = useMemo(
    () => selectedIds.map((id) => {
      const cat = categories.find((c) => String(c._id) === id);
      return {
        id,
        cat,
        label: cat ? getCategoryBreadcrumb(cat, categories, isAr) : id,
      };
    }),
    [selectedIds, categories, isAr],
  );

  const addCategory = (categoryId) => {
    const id = String(categoryId);
    if (!id || selectedSet.has(id) || selectedIds.length >= maxItems) return;
    onChange([...selectedIds, id]);
  };

  const removeCategory = (categoryId) => {
    onChange(selectedIds.filter((id) => id !== String(categoryId)));
  };

  const clearAll = () => onChange([]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-violet-200 bg-violet-50/60 px-3 py-2.5 text-[11px] leading-relaxed text-violet-950">
        {isAr
          ? '↪ كل قسم يشمل منتجاته وجميع الأقسام الفرعية الورقية تحته — نفس منطق المتجر والفلاتر.'
          : '↪ Each category includes its products and all leaf subcategories beneath it — same as storefront filters.'}
      </div>

      {selectedRows.length > 0 && (
        <div className="rounded-xl border border-border bg-white p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-bold text-text">
              {isAr
                ? `محدد (${selectedRows.length}${maxItems < 100 ? ` / ${maxItems}` : ''})`
                : `Selected (${selectedRows.length}${maxItems < 100 ? ` / ${maxItems}` : ''})`}
            </p>
            <button
              type="button"
              onClick={clearAll}
              className="text-[11px] font-semibold text-red-600 hover:text-red-700"
            >
              {isAr ? 'مسح الكل' : 'Clear all'}
            </button>
          </div>
          <ul className="flex flex-wrap gap-2">
            {selectedRows.map(({ id, cat, label }) => (
              <li key={id}>
                <span className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50 px-2.5 py-1.5 text-[11px] font-semibold text-orange-950">
                  <span className="min-w-0 truncate">{label || categoryLabel(cat, isAr)}</span>
                  <button
                    type="button"
                    onClick={() => removeCategory(id)}
                    className="shrink-0 rounded p-0.5 text-orange-700 hover:bg-orange-100"
                    aria-label={isAr ? 'إزالة' : 'Remove'}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {selectedIds.length < maxItems ? (
        <CategoryBrowsePicker
          categories={categories}
          value=""
          onChange={addCategory}
          isAr={isAr}
          showSelectionBanner={false}
        />
      ) : (
        <p className="text-xs font-semibold text-amber-800">
          {isAr ? `وصلت للحد الأقصى (${maxItems})` : `Maximum reached (${maxItems})`}
        </p>
      )}
    </div>
  );
}
