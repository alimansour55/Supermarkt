import { Plus, Trash2, Wand2 } from 'lucide-react';
import { VARIANT_TYPES, VARIANT_TYPE_LABELS } from '../../constants/productCatalog';
import ProductSkuFields from './ProductSkuFields';
import { buildVariantSku } from '../utils/productSkuUtils';

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

const emptySpec = () => ({
  keyAr: '',
  keyEn: '',
  valueAr: '',
  valueEn: '',
});

export default function ProductCatalogFields({
  form,
  set,
  isAr,
  products = [],
  categories = [],
  productId,
}) {
  const variants = form.variants || [];
  const specs = form.specs || [];

  const setVariants = (next) => set('variants', next);
  const setSpecs = (next) => set('specs', next);

  const toggleRelated = (field, id) => {
    const list = form[field] || [];
    const exists = list.includes(id);
    set(
      field,
      exists ? list.filter((x) => x !== id) : [...list, id],
    );
  };

  return (
    <div className="space-y-8 border-t border-border pt-6">
      <ProductSkuFields
        form={form}
        set={set}
        isAr={isAr}
        categories={categories}
        productId={productId}
      />

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold text-text">
            {isAr ? 'المتغيرات (وزن / حجم / نكهة / عدد)' : 'Variants (weight / size / flavor / pack)'}
          </h3>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-sm font-semibold text-primary-600"
            onClick={() => setVariants([...variants, emptyVariant()])}
          >
            <Plus className="h-4 w-4" />
            {isAr ? 'إضافة' : 'Add'}
          </button>
        </div>
        {variants.length === 0 ? (
          <p className="text-sm text-text-muted">
            {isAr
              ? 'اترك فارغاً للمنتج بدون متغيرات — يستخدم سعر البيع والمخزون الأساسي.'
              : 'Leave empty for a simple product — uses base price and stock.'}
          </p>
        ) : (
          <div className="space-y-3">
            {variants.map((v, idx) => (
              <div key={idx} className="rounded-xl border border-border bg-slate-50 p-4">
                <div className="mb-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <select
                    className="rounded-lg border border-border px-3 py-2 text-sm"
                    value={v.type}
                    onChange={(e) => {
                      const next = [...variants];
                      next[idx] = { ...v, type: e.target.value };
                      setVariants(next);
                    }}
                  >
                    {VARIANT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {isAr ? VARIANT_TYPE_LABELS[t].ar : VARIANT_TYPE_LABELS[t].en}
                      </option>
                    ))}
                  </select>
                  <input
                    className="rounded-lg border border-border px-3 py-2 text-sm"
                    placeholder={isAr ? 'القيمة (عربي)' : 'Value (Arabic)'}
                    value={v.valueAr}
                    onChange={(e) => {
                      const next = [...variants];
                      next[idx] = { ...v, valueAr: e.target.value };
                      setVariants(next);
                    }}
                  />
                  <input
                    className="rounded-lg border border-border px-3 py-2 text-sm"
                    placeholder={isAr ? 'القيمة (إنجليزي)' : 'Value (English)'}
                    value={v.valueEn}
                    onChange={(e) => {
                      const next = [...variants];
                      next[idx] = { ...v, valueEn: e.target.value };
                      setVariants(next);
                    }}
                  />
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="defaultVariant"
                      checked={v.isDefault === true}
                      onChange={() => {
                        setVariants(variants.map((row, i) => ({
                          ...row,
                          isDefault: i === idx,
                        })));
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
                      value={v.sku || ''}
                      onChange={(e) => {
                        const next = [...variants];
                        next[idx] = { ...v, sku: e.target.value.toUpperCase() };
                        setVariants(next);
                      }}
                    />
                    {form.sku && (
                      <button
                        type="button"
                        title={isAr ? 'إنشاء من SKU الرئيسي' : 'Generate from parent SKU'}
                        className="absolute end-1 top-1/2 -translate-y-1/2 rounded p-1 text-primary-600 hover:bg-primary-50"
                        onClick={() => {
                          const next = [...variants];
                          next[idx] = {
                            ...v,
                            sku: buildVariantSku(form.sku, v.valueEn, v.valueAr),
                          };
                          setVariants(next);
                        }}
                      >
                        <Wand2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <input
                    className="rounded-lg border border-border px-3 py-2 text-sm"
                    placeholder={isAr ? 'الباركود' : 'Barcode'}
                    value={v.barcode || ''}
                    onChange={(e) => {
                      const next = [...variants];
                      next[idx] = { ...v, barcode: e.target.value.replace(/\D/g, '') };
                      setVariants(next);
                    }}
                  />
                  {['price', 'wholesalePrice', 'stock'].map((field) => (
                    <input
                      key={field}
                      type="number"
                      min="0"
                      step={field === 'stock' ? '1' : '0.01'}
                      className="rounded-lg border border-border px-3 py-2 text-sm"
                      placeholder={field}
                      value={v[field] ?? ''}
                      onChange={(e) => {
                        const next = [...variants];
                        next[idx] = { ...v, [field]: e.target.value };
                        setVariants(next);
                      }}
                    />
                  ))}
                  <button
                    type="button"
                    className="flex items-center justify-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600"
                    onClick={() => setVariants(variants.filter((_, i) => i !== idx))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold text-text">
            {isAr ? 'المواصفات' : 'Specifications'}
          </h3>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-sm font-semibold text-primary-600"
            onClick={() => setSpecs([...specs, emptySpec()])}
          >
            <Plus className="h-4 w-4" />
            {isAr ? 'إضافة' : 'Add'}
          </button>
        </div>
        <div className="space-y-2">
          {specs.map((s, idx) => (
            <div key={idx} className="grid gap-2 sm:grid-cols-5">
              <input className="rounded-lg border border-border px-3 py-2 text-sm" placeholder={isAr ? 'المفتاح AR' : 'Key EN'} value={s.keyEn} onChange={(e) => { const n = [...specs]; n[idx] = { ...s, keyEn: e.target.value }; setSpecs(n); }} />
              <input className="rounded-lg border border-border px-3 py-2 text-sm" placeholder={isAr ? 'المفتاح EN' : 'Key AR'} value={s.keyAr} onChange={(e) => { const n = [...specs]; n[idx] = { ...s, keyAr: e.target.value }; setSpecs(n); }} />
              <input className="rounded-lg border border-border px-3 py-2 text-sm" placeholder={isAr ? 'القيمة AR' : 'Value EN'} value={s.valueEn} onChange={(e) => { const n = [...specs]; n[idx] = { ...s, valueEn: e.target.value }; setSpecs(n); }} />
              <input className="rounded-lg border border-border px-3 py-2 text-sm" placeholder={isAr ? 'القيمة EN' : 'Value AR'} value={s.valueAr} onChange={(e) => { const n = [...specs]; n[idx] = { ...s, valueAr: e.target.value }; setSpecs(n); }} />
              <button type="button" className="text-sm text-red-600" onClick={() => setSpecs(specs.filter((_, i) => i !== idx))}>{isAr ? 'حذف' : 'Remove'}</button>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="mb-2 text-sm font-bold text-text">
            {isAr ? 'يُشترى معاً بكثرة' : 'Frequently bought together'}
          </h3>
          <div className="max-h-48 overflow-y-auto rounded-xl border border-border p-2">
            {products.filter((p) => p._id !== form._id).map((p) => (
              <label key={p._id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={(form.frequentlyBoughtTogether || []).includes(p._id)}
                  onChange={() => toggleRelated('frequentlyBoughtTogether', p._id)}
                />
                <span>{isAr ? p.nameAr || p.name : p.nameEn}</span>
              </label>
            ))}
          </div>
        </div>
        <div>
          <h3 className="mb-2 text-sm font-bold text-text">
            {isAr ? 'منتجات مشابهة' : 'Similar products'}
          </h3>
          <div className="max-h-48 overflow-y-auto rounded-xl border border-border p-2">
            {products.filter((p) => p._id !== form._id).map((p) => (
              <label key={p._id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={(form.similarProducts || []).includes(p._id)}
                  onChange={() => toggleRelated('similarProducts', p._id)}
                />
                <span>{isAr ? p.nameAr || p.name : p.nameEn}</span>
              </label>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
