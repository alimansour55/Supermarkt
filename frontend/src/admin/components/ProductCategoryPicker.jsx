import { useMemo } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import CategoryBrowsePicker from './CategoryBrowsePicker';
import {
  buildCategorySelectionFromLeaf,
  categoryHasChildren,
  getCategoryBreadcrumb,
  isRootCategory,
} from '../../utils/categoryHelpers';
import { validateProductCategoryLeaf } from '../utils/productFormValidation';
import { productCategoryError } from '../constants/productCategoryErrors';

export default function ProductCategoryPicker({
  categories = [],
  value = '',
  onChange,
  subCategoryError,
  onTouchSubCategory,
  isAr,
  excludeCategoryId,
}) {
  const safeCategories = Array.isArray(categories) ? categories : [];
  const leafId = value ? String(value) : '';

  const selectedCategory = useMemo(
    () => (leafId ? safeCategories.find((c) => String(c._id) === leafId) : null),
    [safeCategories, leafId],
  );

  const breadcrumb = useMemo(
    () => (selectedCategory ? getCategoryBreadcrumb(selectedCategory, safeCategories, isAr) : ''),
    [selectedCategory, safeCategories, isAr],
  );

  const inlineError = useMemo(() => {
    if (excludeCategoryId && leafId && String(leafId) === String(excludeCategoryId)) {
      return productCategoryError('sameAsSource', isAr);
    }
    return validateProductCategoryLeaf(leafId, safeCategories, isAr);
  }, [leafId, safeCategories, isAr, excludeCategoryId]);

  const displayError = subCategoryError || (leafId && inlineError ? inlineError : '');

  const handleSelect = (nextLeafId) => {
    onTouchSubCategory?.();
    if (!nextLeafId) {
      onChange({ mainCategory: '', subCategory: '' });
      return;
    }
    const selection = buildCategorySelectionFromLeaf(safeCategories, nextLeafId);
    onChange({
      mainCategory: selection.level1 ? String(selection.level1) : '',
      subCategory: String(nextLeafId),
    });
  };

  const isValid = leafId && !inlineError && !subCategoryError;
  const isInactive = selectedCategory?.isActive === false;
  const isIncomplete = leafId && categoryHasChildren(safeCategories, leafId);

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-slate-50/60 p-4">
      <div>
        <p className="text-sm font-semibold text-text">
          {isAr ? 'قسم المنتج' : 'Product category'}
        </p>
        <p className="mt-0.5 text-xs text-text-muted">
          {isAr
            ? 'ابحث أو تصفّح الشجرة — يُربط المنتج بأعمق قسم بدون أبناء.'
            : 'Search or browse the tree — products attach to the deepest category without children.'}
        </p>
      </div>

      {leafId && selectedCategory && (
        <div
          className={`rounded-xl border px-3 py-2.5 ${
            isValid
              ? 'border-emerald-200 bg-emerald-50'
              : isInactive || isIncomplete
                ? 'border-amber-200 bg-amber-50'
                : 'border-slate-200 bg-white'
          }`}
        >
          <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted">
            {isAr ? 'المسار المختار' : 'Selected path'}
          </p>
          <p className="mt-1 text-sm font-semibold text-text">{breadcrumb}</p>
          {isInactive && (
            <p className="mt-1.5 flex items-start gap-1.5 text-xs text-amber-900">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {productCategoryError('inactiveWarning', isAr)}
            </p>
          )}
          {isIncomplete && (
            <p className="mt-1.5 flex items-start gap-1.5 text-xs text-amber-900">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {selectedCategory && isRootCategory(selectedCategory)
                ? productCategoryError('hasChildrenMain', isAr)
                : productCategoryError('hasChildrenHint', isAr)}
            </p>
          )}
          {isValid && (
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-emerald-800">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              {isAr ? 'جاهز للحفظ' : 'Ready to save'}
            </p>
          )}
        </div>
      )}

      <div
        onBlur={onTouchSubCategory}
        className={displayError ? 'rounded-xl ring-1 ring-red-300' : ''}
      >
        <CategoryBrowsePicker
          categories={safeCategories}
          value={leafId}
          onChange={handleSelect}
          isAr={isAr}
          includeInactive
          leafOnly
          showSelectionBanner={false}
        />
      </div>

      {displayError && (
        <p className="text-sm text-red-600">{displayError}</p>
      )}
    </div>
  );
}
