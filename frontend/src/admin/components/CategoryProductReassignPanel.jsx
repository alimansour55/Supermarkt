import { productCategoryError } from '../constants/productCategoryErrors';
import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import AdminSlidePanel from './AdminSlidePanel';
import ProductCategoryPicker from './ProductCategoryPicker';
import Button from '../../components/ui/Button';
import { categoryLabel } from '../../utils/categoryHelpers';

export default function CategoryProductReassignPanel({
  open,
  onClose,
  category,
  categories,
  isAr,
  pendingAction = 'delete',
  fromBulk = false,
  onReassignAndContinue,
  applying = false,
}) {
  const [selection, setSelection] = useState({ mainCategory: '', subCategory: '' });
  const [error, setError] = useState('');

  const activeCount = category?.activeProductCount ?? category?.productCount ?? 0;
  const sourceName = category ? categoryLabel(category, isAr) : '';

  const handleClose = () => {
    setSelection({ mainCategory: '', subCategory: '' });
    setError('');
    onClose();
  };

  const handleSubmit = async () => {
    if (!selection.subCategory) {
      setError(productCategoryError('reassignRequired', isAr));
      return;
    }
    if (category && String(selection.subCategory) === String(category._id)) {
      setError(productCategoryError('sameAsSource', isAr));
      return;
    }
    await onReassignAndContinue({
      mainCategory: selection.mainCategory,
      subCategory: selection.subCategory,
      category: selection.subCategory,
    });
  };

  const actionLabel = fromBulk
    ? (isAr ? 'نقل المنتجات' : 'Move products')
    : pendingAction === 'deactivate'
      ? (isAr ? 'نقل المنتجات وتعطيل القسم' : 'Move products & deactivate')
      : (isAr ? 'نقل المنتجات وحذف القسم' : 'Move products & delete');

  return (
    <AdminSlidePanel
      open={open}
      onClose={handleClose}
      isAr={isAr}
      title={isAr ? 'نقل المنتجات قبل المتابعة' : 'Move products before continuing'}
      subtitle={
        isAr
          ? `«${sourceName}» مرتبط بـ ${activeCount} منتج نشط`
          : `"${sourceName}" has ${activeCount} active product(s)`
      }
      width="max-w-xl"
    >
      <div className="space-y-4">
        <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <p>
            {pendingAction === 'deactivate'
              ? (isAr
                ? 'لا يمكن تعطيل قسم فيه منتجات نشطة. انقل المنتجات إلى قسم ورقة آخر ثم أكمل التعطيل.'
                : 'Categories with active products cannot be deactivated. Move products to another leaf category, then continue.')
              : (isAr
                ? 'لا يمكن حذف قسم فيه منتجات نشطة. انقل المنتجات أولاً ثم أكمل الحذف.'
                : 'Categories with active products cannot be deleted. Move products first, then continue.')}
          </p>
        </div>

        <ProductCategoryPicker
          categories={categories}
          value={selection.subCategory}
          onChange={(next) => {
            setSelection(next);
            if (next.subCategory) setError('');
          }}
          subCategoryError={error}
          onTouchSubCategory={() => setError('')}
          excludeCategoryId={category?._id}
          isAr={isAr}
        />

        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          <Button onClick={handleSubmit} disabled={applying || !selection.subCategory}>
            {applying ? (isAr ? 'جاري النقل…' : 'Moving…') : actionLabel}
          </Button>
          <Button variant="secondary" onClick={handleClose} disabled={applying}>
            {isAr ? 'إلغاء' : 'Cancel'}
          </Button>
        </div>
      </div>
    </AdminSlidePanel>
  );
}
