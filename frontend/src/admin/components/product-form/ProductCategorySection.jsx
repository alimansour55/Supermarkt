import ProductCategoryPicker from '../ProductCategoryPicker';

export default function ProductCategorySection({ watch, setValue, trigger, errors, isAr, categories }) {
  const subCategory = watch('subCategory');

  const handleChange = ({ mainCategory, subCategory: nextSub }) => {
    setValue('mainCategory', mainCategory, { shouldDirty: true });
    setValue('subCategory', nextSub, { shouldDirty: true });
    setValue('category', nextSub, { shouldDirty: true });
    trigger('subCategory');
  };

  return (
    <ProductCategoryPicker
      categories={categories}
      value={subCategory}
      onChange={handleChange}
      subCategoryError={errors.subCategory?.message}
      onTouchSubCategory={() => trigger('subCategory')}
      isAr={isAr}
    />
  );
}
