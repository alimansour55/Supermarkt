import { useEffect, useState } from 'react';
import { Calculator } from 'lucide-react';
import { adminApi } from '../../adminApi';
import { formatPrice } from '../../../utils/formatters';
import { inputCls } from './fields';
import { PAYMENT_METHOD_OPTIONS } from '../../utils/sellerFeesAdmin';

const SOURCE = {
  seller_free: { ar: 'فترة بدون عمولة للبائع', en: 'seller’s commission-free period' },
  rule: { ar: 'قاعدة', en: 'rule' },
  seller_category: { ar: 'عمولة البائع لهذا القسم', en: 'seller’s rate for this category' },
  seller: { ar: 'عمولة البائع الخاصة', en: 'seller’s own rate' },
  category: { ar: 'عمولة القسم', en: 'category rate' },
  plan: { ar: 'الباقة', en: 'plan' },
  default: { ar: 'النسبة العامة', en: 'standard rate' },
};

/**
 * "What happens on one sale?" — asks the server to price a sale with the same engine checkout
 * uses. `settings` / `seller` preview unsaved edits; `sellerId` locks it to one seller.
 */
export default function FeeCalculator({ settings, seller, sellerId, sellers = [], categories = [], isAr, compact = false }) {
  const [input, setInput] = useState({ sellerId: sellerId || '', categoryId: '', price: '250', quantity: '1', fulfilledBy: 'seller', paymentMethod: 'cod' });
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const set = (k) => (e) => setInput((s) => ({ ...s, [k]: e.target.value }));

  const settingsKey = JSON.stringify(settings || null);
  const sellerKey = JSON.stringify(seller || null);
  useEffect(() => {
    if (!(Number(input.price) > 0)) return undefined;
    const handle = setTimeout(() => {
      adminApi.previewSellerFees({
        ...input,
        sellerId: sellerId || input.sellerId || undefined,
        categoryId: input.categoryId || undefined,
        settings: settings || undefined,
        seller: seller || undefined,
      })
        .then(({ data }) => { setResult(data.data); setError(''); })
        .catch((err) => setError(err?.response?.data?.message || (isAr ? 'تعذّر الحساب' : 'Could not calculate')));
    }, 350);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, settingsKey, sellerKey, sellerId, isAr]);

  const it = result?.items?.[0];
  const rows = result ? [
    [isAr ? `العمولة ${it?.commissionRate ?? 0}%` : `Commission ${it?.commissionRate ?? 0}%`, result.commissionTotal],
    [isAr ? 'رسوم ثابتة' : 'Fixed fees', result.fixedFees],
    [isAr ? 'رسوم الشحن من مخزنك' : 'Fulfillment fee', result.fulfillmentFee],
    [isAr ? 'رسوم الدفع' : 'Payment fee', result.paymentFee],
    [isAr ? `ضريبة ${result.vatPercent}% على الرسوم` : `VAT ${result.vatPercent}% on fees`, result.feeVat],
  ].filter(([, v]) => v) : [];

  return (
    <div className={`rounded-2xl border border-border bg-white ${compact ? 'p-4' : 'p-5 shadow-sm'}`}>
      <h3 className="mb-3 flex items-center gap-2 font-bold"><Calculator className="h-4 w-4 text-primary-600" />{isAr ? 'جرّب على بيعة' : 'Try it on a sale'}</h3>
      <div className="grid grid-cols-2 gap-2 text-sm">
        {!sellerId && sellers.length > 0 && (
          <select className={`${inputCls} col-span-2`} value={input.sellerId} onChange={set('sellerId')} aria-label={isAr ? 'البائع' : 'Seller'}>
            <option value="">{isAr ? 'بائع عادي (بدون عقد خاص)' : 'A typical seller (no deal)'}</option>
            {sellers.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        )}
        <select className={`${inputCls} col-span-2`} value={input.categoryId} onChange={set('categoryId')} aria-label={isAr ? 'القسم' : 'Category'}>
          <option value="">{isAr ? 'أي قسم' : 'Any category'}</option>
          {categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <label className="block"><span className="mb-0.5 block text-xs text-text-muted">{isAr ? 'سعر القطعة' : 'Item price'}</span><input type="number" min="1" className={inputCls} value={input.price} onChange={set('price')} dir="ltr" /></label>
        <label className="block"><span className="mb-0.5 block text-xs text-text-muted">{isAr ? 'الكمية' : 'Quantity'}</span><input type="number" min="1" className={inputCls} value={input.quantity} onChange={set('quantity')} dir="ltr" /></label>
        <select className={inputCls} value={input.fulfilledBy} onChange={set('fulfilledBy')} aria-label={isAr ? 'من يشحن' : 'Who ships'}>
          <option value="seller">{isAr ? 'يشحنها البائع' : 'Seller ships'}</option>
          <option value="store">{isAr ? 'يشحنها المتجر' : 'Store ships'}</option>
        </select>
        <select className={inputCls} value={input.paymentMethod} onChange={set('paymentMethod')} aria-label={isAr ? 'الدفع' : 'Payment'}>
          {PAYMENT_METHOD_OPTIONS.filter((m) => m.value !== '*').map((m) => <option key={m.value} value={m.value}>{isAr ? m.ar : m.en}</option>)}
        </select>
      </div>

      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
      {result && !error && (
        <div className="mt-4 space-y-1.5 text-sm">
          <div className="flex justify-between"><span>{isAr ? 'العميل يدفع' : 'Customer pays'}</span><span className="tabular-nums" dir="ltr">{formatPrice(result.subtotal + result.deliveryFee)}</span></div>
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between text-text-muted"><span>− {k}</span><span className="tabular-nums" dir="ltr">{formatPrice(v)}</span></div>
          ))}
          <div className="flex justify-between border-t border-border pt-1.5 font-semibold"><span>{isAr ? 'يحصل البائع على' : 'Seller gets'}</span><span className="tabular-nums" dir="ltr">{formatPrice(result.sellerNet)}</span></div>
          <div className="flex justify-between rounded-lg bg-emerald-50 px-2 py-1.5 font-bold text-emerald-800">
            <span>{isAr ? 'ربحك' : 'You earn'}</span>
            <span className="tabular-nums" dir="ltr">{formatPrice(result.marketplaceFees - result.feeVat)}</span>
          </div>
          {it && (
            <p className="pt-1 text-xs text-text-muted">
              {isAr ? 'النسبة من: ' : 'Rate from: '}{isAr ? SOURCE[it.commissionSource]?.ar : SOURCE[it.commissionSource]?.en}{it.commissionRule ? ` «${it.commissionRule}»` : ''}
              {result.monthlyFee > 0 ? (isAr ? ` · اشتراك ${formatPrice(result.monthlyFee)} شهرياً` : ` · plus ${formatPrice(result.monthlyFee)} a month`) : ''}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
