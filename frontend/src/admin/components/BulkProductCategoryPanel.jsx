import { useState } from 'react';
import { productCategoryError } from '../constants/productCategoryErrors';
import AdminSlidePanel from './AdminSlidePanel';
import ProductCategoryPicker from './ProductCategoryPicker';
import Button from '../../components/ui/Button';

export default function BulkProductCategoryPanel({
  open,
  onClose,
  count,
  categories,
  isAr,
  onApply,
  applying,
}) {
  const [selection, setSelection] = useState({ mainCategory: '', subCategory: '' });
  const [error, setError] = useState('');

  const handleApply = async () => {
    if (!selection.subCategory) {
      setError(productCategoryError('bulkRequired', isAr));
      return;
    }
    await onApply({
      mainCategory: selection.mainCategory,
      subCategory: selection.subCategory,
      category: selection.subCategory,
    });
  };

  const handleClose = () => {
    setSelection({ mainCategory: '', subCategory: '' });
    setError('');
    onClose();
  };

  return (
    <AdminSlidePanel
      open={open}
      onClose={handleClose}
      isAr={isAr}
      title={isAr ? 'تغيير قسم المنتجات' : 'Change product category'}
      subtitle={
        isAr
          ? `${count} منتج — يجب اختيار أعمق قسم فرعي (ورقة)`
          : `${count} products — must pick the deepest leaf category`
      }
      width="max-w-xl"
    >
      <div className="space-y-4">
        <ProductCategoryPicker
          categories={categories}
          value={selection.subCategory}
          onChange={(next) => {
            setSelection(next);
            if (next.subCategory) setError('');
          }}
          subCategoryError={error}
          onTouchSubCategory={() => setError('')}
          isAr={isAr}
        />
        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          <Button onClick={handleApply} disabled={applying || !selection.subCategory}>
            {applying
              ? (isAr ? 'جاري التطبيق...' : 'Applying...')
              : (isAr ? 'تطبيق على المحدد' : 'Apply to selected')}
          </Button>
          <Button variant="secondary" onClick={handleClose} disabled={applying}>
            {isAr ? 'إلغاء' : 'Cancel'}
          </Button>
        </div>
      </div>
    </AdminSlidePanel>
  );
}
