import { useFieldArray } from 'react-hook-form';
import { Plus, Trash2, Wand2 } from 'lucide-react';
import { VARIANT_TYPES, VARIANT_TYPE_LABELS } from '../../../constants/productCatalog';
import { buildVariantSku } from '../../utils/productSkuUtils';

const emptyVariant = () => ({
  type: 'size',
  valueAr: '',
  valueEn: '',
  sku: '',
  barcode: '',
  price: '',
  wholesalePrice: '',
  stock: 0,
  isDefault: false,
});

export default function ProductVariantsSection({ control, register, watch, setValue, isAr }) {
  const { fields, append, remove } = useFieldArray({ control, name: 'variants' });
  const parentSku = watch('sku');

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-text">
            {isAr ? 'المتغيرات (وزن / حجم / نكهة / عدد)' : 'Variants (weight / size / flavor / pack)'}
          </h3>
          <p className="mt-0.5 text-xs text-text-muted">
            {isAr
              ? 'اترك فارغاً للمنتج بدون متغيرات — يستخدم سعر البيع والمخزون الأساسي.'
              : 'Leave empty for a simple product — uses base price and stock.'}
          </p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-sm font-semibold text-primary-600"
          onClick={() => append(emptyVariant())}
        >
          <Plus className="h-4 w-4" />
          {isAr ? 'إضافة' : 'Add'}
        </button>
      </div>

      {fields.length > 0 && (
        <div className="space-y-3">
          {fields.map((field, idx) => {
            const valueAr = watch(`variants.${idx}.valueAr`);
            const valueEn = watch(`variants.${idx}.valueEn`);
            const isDefault = watch(`variants.${idx}.isDefault`);
            return (
              <div key={field.id} className="rounded-xl border border-border bg-slate-50 p-4">
                <div className="mb-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <select className="rounded-lg border border-border px-3 py-2 text-sm" {...register(`variants.${idx}.type`)}>
                    {VARIANT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {isAr ? VARIANT_TYPE_LABELS[t].ar : VARIANT_TYPE_LABELS[t].en}
                      </option>
                    ))}
                  </select>
                  <input
                    className="rounded-lg border border-border px-3 py-2 text-sm"
                    placeholder={isAr ? 'القيمة (عربي)' : 'Value (Arabic)'}
                    {...register(`variants.${idx}.valueAr`)}
                  />
                  <input
                    className="rounded-lg border border-border px-3 py-2 text-sm"
                    placeholder={isAr ? 'القيمة (إنجليزي)' : 'Value (English)'}
                    {...register(`variants.${idx}.valueEn`)}
                  />
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="defaultVariant"
                      checked={isDefault === true}
                      onChange={() => {
                        fields.forEach((_, i) => setValue(`variants.${i}.isDefault`, i === idx, { shouldDirty: true }));
                      }}
                    />
                    {isAr ? 'افتراضي' : 'Default'}
                  </label>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <div className="relative sm:col-span-2">
                    <input
                      className="w-full rounded-lg border border-border px-3 py-2 pe-9 font-mono text-sm"
                      placeholder="SKU"
                      {...register(`variants.${idx}.sku`, {
                        onChange: (e) => setValue(`variants.${idx}.sku`, e.target.value.toUpperCase(), { shouldDirty: true }),
                      })}
                    />
                    {parentSku && (
                      <button
                        type="button"
                        title={isAr ? 'إنشاء من SKU الرئيسي' : 'Generate from parent SKU'}
                        className="absolute end-1 top-1/2 -translate-y-1/2 rounded p-1 text-primary-600 hover:bg-primary-50"
                        onClick={() => setValue(`variants.${idx}.sku`, buildVariantSku(parentSku, valueEn, valueAr), { shouldDirty: true })}
                      >
                        <Wand2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <input
                    className="rounded-lg border border-border px-3 py-2 text-sm"
                    placeholder={isAr ? 'الباركود' : 'Barcode'}
                    {...register(`variants.${idx}.barcode`, {
                      onChange: (e) => setValue(`variants.${idx}.barcode`, e.target.value.replace(/\D/g, ''), { shouldDirty: true }),
                    })}
                  />
                  {['price', 'wholesalePrice', 'stock'].map((fkey) => (
                    <input
                      key={fkey}
                      type="number"
                      min="0"
                      step={fkey === 'stock' ? '1' : '0.01'}
                      className="rounded-lg border border-border px-3 py-2 text-sm"
                      placeholder={fkey}
                      {...register(`variants.${idx}.${fkey}`)}
                    />
                  ))}
                  <button
                    type="button"
                    className="flex items-center justify-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600"
                    onClick={() => remove(idx)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
