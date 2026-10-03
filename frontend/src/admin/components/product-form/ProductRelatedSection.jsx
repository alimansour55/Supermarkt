import { useFieldArray } from 'react-hook-form';
import { Plus } from 'lucide-react';
import ProductMultiPicker from '../ProductMultiPicker';

const SIMILAR_MODES = [
  { id: 'auto', labelAr: 'تلقائي', labelEn: 'Auto' },
  { id: 'manual', labelAr: 'اختياراتي فقط', labelEn: 'My picks only' },
  { id: 'off', labelAr: 'إخفاء القسم', labelEn: 'Hide section' },
];

const SIMILAR_MODE_HINT = {
  auto: {
    ar: 'نعرض اختياراتك أولاً ثم نكمل تلقائياً بمنتجات متوفرة وقريبة من نفس القسم/السعر.',
    en: 'Your picks show first, then we auto-fill with in-stock products from the same category/price range.',
  },
  manual: {
    ar: 'نعرض اختياراتك فقط — بدون إكمال تلقائي. إن كانت فارغة، لن يظهر القسم.',
    en: 'Only your picks are shown — no auto-fill. If empty, the section is hidden.',
  },
  off: {
    ar: 'قسم «منتجات مشابهة» مخفي تماماً في صفحة هذا المنتج.',
    en: 'The "Similar products" section is fully hidden on this product page.',
  },
};

const emptySpec = () => ({ keyAr: '', keyEn: '', valueAr: '', valueEn: '' });

export default function ProductRelatedSection({
  control,
  register,
  watch,
  setValue,
  isAr,
  products,
  seedProducts,
  categories,
  brands,
}) {
  const { fields, append, remove } = useFieldArray({ control, name: 'specs' });
  const similarMode = watch('similarMode') || 'auto';
  const frequentlyBoughtTogether = watch('frequentlyBoughtTogether') || [];
  const similarProducts = watch('similarProducts') || [];
  const pickerSeed = [...seedProducts, ...products];

  return (
    <div className="space-y-8">
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold text-text">{isAr ? 'المواصفات' : 'Specifications'}</h3>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-sm font-semibold text-primary-600"
            onClick={() => append(emptySpec())}
          >
            <Plus className="h-4 w-4" />
            {isAr ? 'إضافة' : 'Add'}
          </button>
        </div>
        <div className="space-y-2">
          {fields.map((field, idx) => (
            <div key={field.id} className="grid gap-2 sm:grid-cols-5">
              <input className="rounded-lg border border-border px-3 py-2 text-sm" placeholder={isAr ? 'المفتاح EN' : 'Key EN'} {...register(`specs.${idx}.keyEn`)} />
              <input className="rounded-lg border border-border px-3 py-2 text-sm" placeholder={isAr ? 'المفتاح AR' : 'Key AR'} {...register(`specs.${idx}.keyAr`)} />
              <input className="rounded-lg border border-border px-3 py-2 text-sm" placeholder={isAr ? 'القيمة EN' : 'Value EN'} {...register(`specs.${idx}.valueEn`)} />
              <input className="rounded-lg border border-border px-3 py-2 text-sm" placeholder={isAr ? 'القيمة AR' : 'Value AR'} {...register(`specs.${idx}.valueAr`)} />
              <button type="button" className="text-sm text-red-600" onClick={() => remove(idx)}>{isAr ? 'حذف' : 'Remove'}</button>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-1 text-sm font-bold text-text">{isAr ? 'يُشترى معاً بكثرة' : 'Frequently bought together'}</h3>
        <p className="mb-3 text-xs text-text-muted">
          {isAr
            ? 'منتجات تُقترح مع هذا المنتج في صفحته. ابحث أو تصفّح لإضافتها، ورتّبها كما تريد.'
            : 'Shown alongside this product on its page. Search or browse to add, drag to reorder.'}
        </p>
        <ProductMultiPicker
          value={frequentlyBoughtTogether}
          onChange={(v) => setValue('frequentlyBoughtTogether', v, { shouldDirty: true })}
          seedProducts={pickerSeed}
          categories={categories}
          brands={brands}
          isAr={isAr}
          maxItems={12}
        />
      </section>

      <section>
        <h3 className="mb-1 text-sm font-bold text-text">{isAr ? 'منتجات مشابهة' : 'Similar products'}</h3>
        <p className="mb-3 text-xs text-text-muted">
          {isAr ? SIMILAR_MODE_HINT[similarMode].ar : SIMILAR_MODE_HINT[similarMode].en}
        </p>
        <div className="inline-flex rounded-xl border border-border bg-slate-100 p-1">
          {SIMILAR_MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setValue('similarMode', m.id, { shouldDirty: true })}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                similarMode === m.id ? 'bg-white text-primary-700 shadow-sm' : 'text-text-muted hover:text-text'
              }`}
            >
              {isAr ? m.labelAr : m.labelEn}
            </button>
          ))}
        </div>
        {similarMode !== 'off' && (
          <div className="mt-4">
            <ProductMultiPicker
              value={similarProducts}
              onChange={(v) => setValue('similarProducts', v, { shouldDirty: true })}
              seedProducts={pickerSeed}
              categories={categories}
              brands={brands}
              isAr={isAr}
              maxItems={12}
            />
          </div>
        )}
      </section>
    </div>
  );
}
