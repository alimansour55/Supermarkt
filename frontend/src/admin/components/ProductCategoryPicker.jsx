import { useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, FolderTree, LayoutGrid, X } from 'lucide-react';
import CategoryLeafTreePicker from './CategoryLeafTreePicker';
import CategoryBrowsePicker from './CategoryBrowsePicker';
import {
  buildCategorySelectionFromLeaf,
  categoryHasChildren,
  getCategoryBreadcrumb,
  isRootCategory,
} from '../../utils/categoryHelpers';
import { validateProductCategoryLeaf } from '../utils/productFormValidation';
import { productCategoryError } from '../constants/productCategoryErrors';

const PICKER_MODE_KEY = 'admin.productCategoryPicker.mode';

function readStoredPickerMode() {
  try {
    return window.localStorage.getItem(PICKER_MODE_KEY) === 'browse' ? 'browse' : 'tree';
  } catch {
    return 'tree';
  }
}

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
  const [mode, setMode] = useState(readStoredPickerMode);

  const selectMode = (next) => {
    setMode(next);
    try {
      window.localStorage.setItem(PICKER_MODE_KEY, next);
    } catch {
      // storage unavailable — the toggle still works for this session
    }
  };

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

  const statusTone = !leafId
    ? 'empty'
    : isValid
      ? 'valid'
      : isInactive || isIncomplete
        ? 'warning'
        : 'neutral';

  const statusStyles = {
    empty: 'border-dashed border-slate-300 bg-white',
    valid: 'border-emerald-200 bg-emerald-50',
    warning: 'border-amber-200 bg-amber-50',
    neutral: 'border-slate-200 bg-white',
  };

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-slate-50/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
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

        <div className="inline-flex shrink-0 items-center gap-0.5 rounded-lg border border-border bg-white p-0.5">
          <button
            type="button"
            onClick={() => selectMode('tree')}
            className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors ${
              mode === 'tree' ? 'bg-orange-600 text-white' : 'text-text-muted hover:bg-slate-50'
            }`}
          >
            <FolderTree className="h-3.5 w-3.5" />
            {isAr ? 'شجرة' : 'Tree'}
          </button>
          <button
            type="button"
            onClick={() => selectMode('browse')}
            className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors ${
              mode === 'browse' ? 'bg-orange-600 text-white' : 'text-text-muted hover:bg-slate-50'
            }`}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            {isAr ? 'بطاقات' : 'Cards'}
          </button>
        </div>
      </div>

      <div className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 ${statusStyles[statusTone]}`}>
        <span
          className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
            statusTone === 'valid'
              ? 'bg-emerald-100 text-emerald-700'
              : statusTone === 'warning'
                ? 'bg-amber-100 text-amber-700'
                : statusTone === 'empty'
                  ? 'bg-slate-100 text-slate-400'
                  : 'bg-slate-100 text-slate-500'
          }`}
        >
          <FolderTree className="h-4 w-4" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted">
            {isAr ? 'المسار المختار' : 'Selected path'}
          </p>
          {leafId && selectedCategory ? (
            <p className="mt-0.5 truncate text-sm font-semibold text-text">{breadcrumb}</p>
          ) : (
            <p className="mt-0.5 text-sm text-text-muted">
              {isAr ? 'لم يتم اختيار قسم بعد' : 'No category selected yet'}
            </p>
          )}

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

        {leafId && (
          <button
            type="button"
            onClick={() => handleSelect('')}
            className="shrink-0 rounded-lg p-1.5 text-text-muted hover:bg-white hover:text-red-600"
            aria-label={isAr ? 'إلغاء اختيار القسم' : 'Clear category'}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div
        onBlur={onTouchSubCategory}
        className={displayError ? 'rounded-xl ring-1 ring-red-300' : ''}
      >
        {mode === 'tree' ? (
          <CategoryLeafTreePicker
            categories={safeCategories}
            value={leafId}
            onChange={handleSelect}
            isAr={isAr}
            includeInactive
            excludeCategoryId={excludeCategoryId}
          />
        ) : (
          <CategoryBrowsePicker
            categories={safeCategories}
            value={leafId}
            onChange={handleSelect}
            isAr={isAr}
            includeInactive
            leafOnly
            showSelectionBanner={false}
            showIcons={false}
          />
        )}
      </div>

      {displayError && (
        <p className="text-sm text-red-600">{displayError}</p>
      )}
    </div>
  );
}
