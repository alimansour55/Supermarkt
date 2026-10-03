import Input from '../../../components/ui/Input';
import ProductSkuFields from '../ProductSkuFields';

export default function ProductSeoAdvancedSection({ register, watch, setValue, isAr, categories, productId }) {
  const formShim = watch();
  const setShim = (key, value) => setValue(key, value, { shouldDirty: true });

  return (
    <div className="space-y-6">
      <div>
        <Input
          label="Slug"
          placeholder={isAr ? 'يُنشأ تلقائياً من الاسم الإنجليزي' : 'Generated from the English name'}
          {...register('slug')}
        />
        <p className="mt-1.5 text-xs text-text-muted">
          {isAr
            ? 'رابط المنتج في المتجر — اتركه فارغاً ليُنشأ تلقائياً.'
            : "The product's storefront URL — leave empty to auto-generate."}
        </p>
      </div>

      <ProductSkuFields
        form={formShim}
        set={setShim}
        isAr={isAr}
        categories={categories}
        productId={productId}
      />
    </div>
  );
}
