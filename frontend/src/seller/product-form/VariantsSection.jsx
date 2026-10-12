import { useState } from 'react';
import { Copy, Layers, Plus, Trash2, Wand2 } from 'lucide-react';
import { SectionHeader, inputCls } from './ui';

const VARIANT_TYPES = {
  weight: { ar: 'الوزن', en: 'Weight' },
  size: { ar: 'الحجم', en: 'Size' },
  flavor: { ar: 'النكهة', en: 'Flavor' },
  pack_count: { ar: 'عدد القطع', en: 'Pack count' },
};

const cell = `${inputCls} px-2 py-1.5`;

export default function VariantsSection({ form, setForm, isAr, storeHeld, errors }) {
  const [genType, setGenType] = useState('size');
  const [genValues, setGenValues] = useState('');
  const variants = form.variants;

  const update = (next) => setForm((f) => ({ ...f, variants: next }));
  const setRow = (i, field, value) => update(variants.map((v, j) => (j === i ? { ...v, [field]: value } : v)));
  const blank = (over = {}) => ({ type: genType, valueAr: '', valueEn: '', price: form.price, stock: '0', sku: '', ...over });

  const generate = () => {
    const values = genValues.split(',').map((s) => s.trim()).filter(Boolean);
    if (!values.length) return;
    const existing = new Set(variants.map((v) => `${v.type}|${(v.valueEn || v.valueAr).toLowerCase()}`));
    const rows = values
      .filter((v) => !existing.has(`${genType}|${v.toLowerCase()}`))
      .map((v) => blank({ valueAr: v, valueEn: v }));
    update([...variants, ...rows].slice(0, 50));
    setGenValues('');
  };

  const fillColumn = (field) => {
    const first = variants[0]?.[field];
    if (first === undefined) return;
    update(variants.map((v) => ({ ...v, [field]: first })));
  };

  const totalStock = variants.reduce((s, v) => s + (Number(v.stock) || 0), 0);

  return (
    <div>
      <SectionHeader
        title={isAr ? 'الأنواع (اختياري)' : 'Variants (optional)'}
        description={isAr
          ? 'استخدمها إذا كان للمنتج أحجام أو أوزان أو نكهات مختلفة بسعر أو مخزون مختلف. اترك القسم فارغاً للمنتج البسيط.'
          : 'Use these when the product comes in sizes, weights or flavours with their own price or stock. Leave empty for a simple product.'}
      >
        {variants.length > 0 && (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
            {isAr ? `${variants.length} نوع · مخزون ${totalStock}` : `${variants.length} variant(s) · ${totalStock} in stock`}
          </span>
        )}
      </SectionHeader>

      <div className="rounded-2xl bg-indigo-50/60 p-4 ring-1 ring-indigo-100">
        <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-indigo-900"><Wand2 className="h-4 w-4" />{isAr ? 'إنشاء سريع' : 'Quick create'}</p>
        <div className="grid gap-2 sm:grid-cols-[10rem_1fr_auto]">
          <select className={inputCls} value={genType} onChange={(e) => setGenType(e.target.value)}>
            {Object.entries(VARIANT_TYPES).map(([k, v]) => <option key={k} value={k}>{isAr ? v.ar : v.en}</option>)}
          </select>
          <input
            className={inputCls}
            value={genValues}
            onChange={(e) => setGenValues(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); generate(); } }}
            placeholder={isAr ? 'القيم مفصولة بفاصلة: 250 جم, 500 جم, 1 كجم' : 'Values, comma separated: 250 g, 500 g, 1 kg'}
          />
          <button type="button" onClick={generate} disabled={!genValues.trim()} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {isAr ? 'إنشاء' : 'Create'}
          </button>
        </div>
      </div>

      {errors.variants && <p className="mt-3 text-xs font-medium text-red-600">{errors.variants}</p>}

      {variants.length === 0 ? (
        <div className="mt-4 flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          <Layers className="h-8 w-8 text-slate-300" aria-hidden />
          {isAr ? 'منتج بسيط — بدون أنواع.' : 'Simple product — no variants.'}
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-2xl ring-1 ring-slate-200">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-2 py-2 text-start">{isAr ? 'النوع' : 'Type'}</th>
                <th className="px-2 py-2 text-start">{isAr ? 'القيمة (عربي)' : 'Value (Arabic)'}</th>
                <th className="px-2 py-2 text-start">{isAr ? 'القيمة (إنجليزي)' : 'Value (English)'}</th>
                <th className="px-2 py-2 text-start">
                  {isAr ? 'السعر' : 'Price'}
                  {variants.length > 1 && <button type="button" onClick={() => fillColumn('price')} className="ms-1 text-indigo-600" title={isAr ? 'نسخ الأول للكل' : 'Copy first to all'}><Copy className="inline h-3 w-3" /></button>}
                </th>
                <th className="px-2 py-2 text-start">
                  {isAr ? 'المخزون' : 'Stock'}
                  {variants.length > 1 && !storeHeld && <button type="button" onClick={() => fillColumn('stock')} className="ms-1 text-indigo-600" title={isAr ? 'نسخ الأول للكل' : 'Copy first to all'}><Copy className="inline h-3 w-3" /></button>}
                </th>
                <th className="px-2 py-2 text-start">SKU</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {variants.map((v, i) => (
                <tr key={v._id || i}>
                  <td className="px-2 py-1.5">
                    <select className={cell} value={v.type} onChange={(e) => setRow(i, 'type', e.target.value)}>
                      {Object.entries(VARIANT_TYPES).map(([k, t]) => <option key={k} value={k}>{isAr ? t.ar : t.en}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-1.5"><input className={cell} value={v.valueAr} onChange={(e) => setRow(i, 'valueAr', e.target.value)} dir="rtl" /></td>
                  <td className="px-2 py-1.5"><input className={cell} value={v.valueEn} onChange={(e) => setRow(i, 'valueEn', e.target.value)} dir="ltr" /></td>
                  <td className="px-2 py-1.5"><input className={`${cell} w-24`} type="number" min="0" step="0.01" value={v.price} onChange={(e) => setRow(i, 'price', e.target.value)} dir="ltr" /></td>
                  <td className="px-2 py-1.5"><input className={`${cell} w-20`} type="number" min="0" value={v.stock} onChange={(e) => setRow(i, 'stock', e.target.value)} dir="ltr" disabled={storeHeld} /></td>
                  <td className="px-2 py-1.5"><input className={`${cell} w-28`} value={v.sku} onChange={(e) => setRow(i, 'sku', e.target.value)} dir="ltr" placeholder={isAr ? 'تلقائي' : 'Auto'} /></td>
                  <td className="px-2 py-1.5 text-end">
                    <button type="button" onClick={() => update(variants.filter((_, j) => j !== i))} className="rounded-lg p-1.5 text-red-600 hover:bg-red-50" aria-label={isAr ? 'حذف' : 'Remove'}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => update([...variants, blank()].slice(0, 50))} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold text-indigo-700 ring-1 ring-indigo-200 hover:bg-indigo-50">
          <Plus className="h-4 w-4" />{isAr ? 'إضافة نوع' : 'Add variant'}
        </button>
        {variants.length > 0 && (
          <button type="button" onClick={() => update([])} className="rounded-lg px-3 py-1.5 text-sm font-semibold text-red-600 ring-1 ring-red-200 hover:bg-red-50">
            {isAr ? 'إزالة كل الأنواع' : 'Remove all variants'}
          </button>
        )}
      </div>
      {storeHeld && variants.length > 0 && (
        <p className="mt-2 text-xs text-slate-500">{isAr ? 'مخزون الأنواع في مخزننا ويزيد عند استلام شحناتك.' : 'Variant stock is held in our warehouse and grows when we receive your shipments.'}</p>
      )}
    </div>
  );
}
