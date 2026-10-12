import { Percent, Truck, Warehouse } from 'lucide-react';
import { formatPrice } from '../../utils/formatters';
import { FULFILLMENT, label } from '../sellerLabels';
import { Field, SectionHeader, errorInputCls, inputCls } from './ui';

const UNITS = [
  { value: 'piece', ar: 'قطعة', en: 'Piece' },
  { value: 'kg', ar: 'كيلو', en: 'Kilogram' },
  { value: 'g', ar: 'جرام', en: 'Gram' },
  { value: 'l', ar: 'لتر', en: 'Litre' },
  { value: 'ml', ar: 'مل', en: 'Millilitre' },
  { value: 'pack', ar: 'عبوة', en: 'Pack' },
  { value: 'box', ar: 'كرتونة', en: 'Box' },
  { value: 'dozen', ar: 'دستة', en: 'Dozen' },
];

const round2 = (n) => Math.round(n * 100) / 100;

export default function PricingSection({
  form, set, errors, isAr, commissionRate, allowedFulfillment, storeHeld, hasVariants, isEdit,
}) {
  const price = Number(form.price) || 0;
  const oldPrice = Number(form.oldPrice) || 0;
  const discountPct = oldPrice > price && price > 0 ? Math.round(((oldPrice - price) / oldPrice) * 100) : 0;
  const commission = round2((price * commissionRate) / 100);
  const earnings = round2(price - commission);

  /** Quick sale: keep the current price as "before" and cut by pct. */
  const applyDiscount = (pct) => {
    const base = oldPrice > price ? oldPrice : price;
    if (!(base > 0)) return;
    set('oldPrice')(String(base));
    set('price')(String(round2(base * (1 - pct / 100))));
  };

  return (
    <div>
      <SectionHeader
        title={isAr ? 'السعر والمخزون' : 'Price & stock'}
        description={isAr ? 'تغييرات السعر والمخزون تُطبّق فوراً حتى على المنتجات المعروضة.' : 'Price and stock changes apply instantly, even on live products.'}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={isAr ? 'سعر البيع (ج.م) *' : 'Selling price (EGP) *'} error={errors.price}>
          <input type="number" inputMode="decimal" min="0" step="0.01" className={`${inputCls} ${errors.price ? errorInputCls : ''}`} value={form.price} onChange={set('price')} dir="ltr" />
        </Field>
        <Field
          label={isAr ? 'السعر قبل الخصم' : 'Price before discount'}
          hint={discountPct ? (isAr ? `يظهر للعملاء خصم ${discountPct}%` : `Customers see ${discountPct}% off`) : (isAr ? 'اتركه فارغاً إن لم يوجد خصم' : 'Leave empty if there is no discount')}
          error={errors.oldPrice}
        >
          <input type="number" inputMode="decimal" min="0" step="0.01" className={`${inputCls} ${errors.oldPrice ? errorInputCls : ''}`} value={form.oldPrice} onChange={set('oldPrice')} dir="ltr" />
        </Field>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="inline-flex items-center gap-1 font-semibold text-slate-600"><Percent className="h-3.5 w-3.5" />{isAr ? 'خصم سريع:' : 'Quick discount:'}</span>
        {[5, 10, 15, 20, 25, 30].map((pct) => (
          <button key={pct} type="button" onClick={() => applyDiscount(pct)} disabled={!(price > 0)} className="rounded-lg px-2.5 py-1 font-semibold ring-1 ring-slate-200 hover:bg-indigo-50 hover:ring-indigo-300 disabled:opacity-40">
            -{pct}%
          </button>
        ))}
        {oldPrice > 0 && (
          <button type="button" onClick={() => { set('price')(String(oldPrice)); set('oldPrice')(''); }} className="rounded-lg px-2.5 py-1 font-semibold text-red-600 ring-1 ring-red-200 hover:bg-red-50">
            {isAr ? 'إلغاء الخصم' : 'Remove discount'}
          </button>
        )}
      </div>

      {price > 0 && (
        <div className="mt-4 grid gap-3 rounded-2xl bg-emerald-50 p-4 text-sm ring-1 ring-emerald-200 sm:grid-cols-3">
          <div>
            <p className="text-xs text-emerald-800">{isAr ? 'سعر البيع' : 'Selling price'}</p>
            <p className="font-bold">{formatPrice(price)}</p>
          </div>
          <div>
            <p className="text-xs text-emerald-800">{isAr ? `عمولة المنصة (~${commissionRate}%)` : `Marketplace fee (~${commissionRate}%)`}</p>
            <p className="font-bold">− {formatPrice(commission)}</p>
          </div>
          <div>
            <p className="text-xs text-emerald-800">{isAr ? 'صافي ربحك التقريبي' : 'You receive (approx.)'}</p>
            <p className="text-lg font-extrabold text-emerald-700">{formatPrice(earnings)}</p>
          </div>
          <p className="text-[11px] text-emerald-800 sm:col-span-3">
            {isAr ? 'تقدير لكل قطعة قبل رسوم الشحن — قد تختلف العمولة حسب القسم.' : 'Per-unit estimate before delivery fees — the fee may vary by category.'}
          </p>
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Field
          label={isAr ? 'المخزون المتاح' : 'Stock available'}
          error={errors.stock}
          hint={storeHeld
            ? (isAr ? 'في مخزننا — يزيد عند استلام شحناتك' : 'In our warehouse — grows when we receive your inbound shipments')
            : hasVariants ? (isAr ? 'يُحدد لكل نوع في قسم الأنواع' : 'Set per variant in the Variants step') : null}
        >
          <input type="number" inputMode="numeric" min="0" className={inputCls} value={hasVariants ? '' : form.stock} placeholder={hasVariants ? '—' : ''} onChange={set('stock')} dir="ltr" disabled={hasVariants || storeHeld} />
        </Field>
        <Field label="SKU" hint={isAr ? 'رمزك الداخلي — يُنشأ تلقائياً إن تُرك فارغاً' : 'Your own code — generated if left empty'}>
          <input className={inputCls} value={form.sku} onChange={set('sku')} dir="ltr" maxLength={80} />
        </Field>
        <Field label={isAr ? 'الباركود (EAN / UPC)' : 'Barcode (EAN / UPC)'} error={errors.barcode}>
          <input className={`${inputCls} ${errors.barcode ? errorInputCls : ''}`} value={form.barcode} onChange={set('barcode')} dir="ltr" inputMode="numeric" maxLength={20} />
        </Field>
        <Field label={isAr ? 'وحدة البيع' : 'Selling unit'}>
          <select className={inputCls} value={form.unit} onChange={set('unit')}>
            {UNITS.map((u) => <option key={u.value} value={u.value}>{isAr ? u.ar : u.en}</option>)}
            {!UNITS.some((u) => u.value === form.unit) && form.unit && <option value={form.unit}>{form.unit}</option>}
          </select>
        </Field>
        <Field label={isAr ? 'الحجم / الوزن' : 'Size / weight'} hint={isAr ? 'مثال: 500 جم، 1 لتر، 12 قطعة' : 'e.g. 500 g, 1 L, 12 pcs'}>
          <input className={inputCls} value={form.size} onChange={set('size')} maxLength={60} />
        </Field>
      </div>

      {allowedFulfillment.length > 1 && (
        <div className="mt-6">
          <p className="mb-2 text-sm font-medium text-slate-800">{isAr ? 'من يشحن هذا المنتج؟' : 'Who ships this product?'}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {allowedFulfillment.map((mode) => {
              const Icon = mode === 'store' ? Warehouse : Truck;
              const active = form.fulfilledBy === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => set('fulfilledBy')(mode)}
                  className={`flex items-start gap-3 rounded-2xl p-4 text-start ring-1 transition ${active ? 'bg-indigo-50 ring-2 ring-indigo-500' : 'bg-white ring-slate-200 hover:bg-slate-50'}`}
                >
                  <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${active ? 'text-indigo-600' : 'text-slate-400'}`} aria-hidden />
                  <span>
                    <span className="block text-sm font-semibold">{label(FULFILLMENT, mode, isAr)}</span>
                    <span className="block text-xs text-slate-500">
                      {mode === 'store'
                        ? (isAr ? 'ترسل البضاعة لمخزننا ونحن نغلّف ونوصّل. المخزون يزيد عند الاستلام.' : 'Send stock to our warehouse — we pack and deliver. Stock grows when we receive it.')
                        : (isAr ? 'تحتفظ بالبضاعة وتشحن الطلبات بنفسك.' : 'You keep the stock and ship orders yourself.')}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          {isEdit && storeHeld && (
            <p className="mt-2 text-xs text-slate-500">{isAr ? 'لا يمكن التحويل للشحن الذاتي بينما توجد وحدات في مخزننا.' : "You can't switch to self-shipping while units are in our warehouse."}</p>
          )}
        </div>
      )}
    </div>
  );
}
