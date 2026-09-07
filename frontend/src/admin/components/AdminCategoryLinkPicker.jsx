import { useMemo } from 'react';
import CategoryBrowsePicker from './CategoryBrowsePicker';
import CategorySectionPreview from './CategorySectionPreview';
import {
  categoryLabel,
  getCategoryBreadcrumb,
} from '../../utils/categoryHelpers';

/**
 * Single category link for homepage sections, nav, etc.
 * Uses the same browse tree as product filters — expands to leaf descendants on the API.
 */
export default function AdminCategoryLinkPicker({
  categories = [],
  value = '',
  onChange,
  isAr = true,
  required = false,
  labelAr = 'القسم',
  labelEn = 'Category',
  hintAr = 'اختر قسماً — يُطبَّق على المنتجات في هذا القسم وجميع الأقسام الفرعية الورقية (نفس منطق المتجر).',
  hintEn = 'Pick a category — applies to products in this category and all leaf subcategories (same as storefront).',
  leafOnly = false,
  showPreview = true,
  productQuery = {},
  sectionLimit,
  categoryIssue = null,
}) {
  const selectedCategory = useMemo(
    () => (value ? categories.find((c) => String(c._id) === String(value)) : null),
    [categories, value],
  );

  const breadcrumb = useMemo(
    () => (selectedCategory ? getCategoryBreadcrumb(selectedCategory, categories, isAr) : ''),
    [selectedCategory, categories, isAr],
  );

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium text-text">
          {isAr ? labelAr : labelEn}
          {required && <span className="text-red-600"> *</span>}
        </p>
        <p className="mt-0.5 text-xs text-text-muted">{isAr ? hintAr : hintEn}</p>
      </div>

      {selectedCategory && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-3 py-2.5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-800/80">
            {isAr ? 'القسم المرتبط' : 'Linked category'}
          </p>
          <p className="mt-0.5 text-sm font-semibold text-emerald-950">{breadcrumb || categoryLabel(selectedCategory, isAr)}</p>
        </div>
      )}

      <CategoryBrowsePicker
        categories={categories}
        value={value ? String(value) : ''}
        onChange={(id) => onChange(id || '')}
        isAr={isAr}
        leafOnly={leafOnly}
      />

      {showPreview && value && (
        <CategorySectionPreview
          categoryId={value}
          categories={categories}
          categoryIssue={categoryIssue}
          isAr={isAr}
          productQuery={productQuery}
          sectionLimit={sectionLimit}
          requireLeaf={leafOnly}
        />
      )}
    </div>
  );
}
