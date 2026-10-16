import { useState } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, Copy, Plus, Trash2 } from 'lucide-react';
import { describeRule, newRule, ruleState } from '../../utils/sellerFeesAdmin';
import { MultiPick, NumberField, Toggle, inputCls } from './fields';

const STATE = {
  live: { ar: 'يعمل الآن', en: 'Live', tone: 'bg-emerald-100 text-emerald-800' },
  scheduled: { ar: 'مجدول', en: 'Scheduled', tone: 'bg-sky-100 text-sky-800' },
  ended: { ar: 'انتهى', en: 'Ended', tone: 'bg-slate-100 text-slate-600' },
  off: { ar: 'متوقف', en: 'Off', tone: 'bg-slate-100 text-slate-600' },
};

const TEMPLATES = [
  { key: 'welcome', ar: 'عرض البائع الجديد', en: 'New-seller welcome', rule: { name: 'Welcome offer', rate: '0', newSellerDays: '60' } },
  { key: 'premium', ar: 'منتجات غالية بنسبة أقل', en: 'Lower rate on expensive items', rule: { name: 'Premium items', rate: '5', minPrice: '5000' } },
  { key: 'fbs', ar: 'خصم لمن يشحن من مخزنك', en: 'Discount for store-shipped', rule: { name: 'Shipped by store', rate: '8', fulfillment: 'store' } },
  { key: 'campaign', ar: 'حملة لفترة محددة', en: 'Time-limited campaign', rule: { name: 'Campaign', rate: '5', overrideSellerDeals: true } },
];

/**
 * Commission rules, checked top to bottom — the first rule that fits a sale sets its rate.
 * Each rule is a card: summary when closed, every condition when open.
 */
export default function CommissionRulesEditor({ rules, onChange, categories, sellers, plans, isAr, disabled }) {
  const [openIdx, setOpenIdx] = useState(-1);
  const set = (i, patch) => onChange(rules.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= rules.length) return;
    const next = [...rules];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
    setOpenIdx((o) => (o === i ? j : o === j ? i : o));
  };
  const add = (template = {}) => {
    onChange([...rules, { ...newRule(), ...template }]);
    setOpenIdx(rules.length);
  };
  const lookups = {
    categoryName: (id) => (categories.find((c) => c.value === id)?.label || '').replace(/^(— )+/, ''),
    sellerName: (id) => sellers.find((s) => s.value === id)?.label || '',
    planName: (k) => plans.find((p) => p.key === k)?.[isAr ? 'nameAr' : 'nameEn'] || k,
  };

  return (
    <div className="space-y-3">
      {!rules.length && (
        <p className="rounded-xl border border-dashed border-border p-4 text-sm text-text-muted">
          {isAr ? 'لا توجد قواعد — كل البيع يتبع النسب العامة. أضف قاعدة لعروض البائعين الجدد، أو أقسام بنسب مختلفة، أو حملات مؤقتة.' : 'No rules — every sale uses the standard rates. Add rules for new-seller offers, price bands, or time-limited campaigns.'}
        </p>
      )}
      {rules.map((r, i) => {
        const st = STATE[ruleState(r)];
        const open = openIdx === i;
        return (
          <div key={r._id || `new-${i}`} className={`rounded-xl border ${open ? 'border-primary-300 ring-2 ring-primary-50' : 'border-border'}`}>
            <div className="flex flex-wrap items-center gap-2 p-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-text-muted">{i + 1}</span>
              <button type="button" className="min-w-0 flex-1 text-start" onClick={() => setOpenIdx(open ? -1 : i)}>
                <span className="font-semibold">{r.name || (isAr ? 'قاعدة بدون اسم' : 'Untitled rule')}</span>
                <span className="ms-2 text-sm font-bold text-primary-700" dir="ltr">{r.rate === '' ? '—' : `${r.rate}%`}</span>
                {r.overrideSellerDeals && <span className="ms-2 rounded-full bg-amber-100 px-2 text-xs text-amber-900">{isAr ? 'تتجاوز العقود الخاصة' : 'beats seller deals'}</span>}
                <span className="block truncate text-xs text-text-muted">{describeRule(r, lookups, isAr)}</span>
              </button>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${st.tone}`}>{isAr ? st.ar : st.en}</span>
              {!disabled && (
                <span className="flex items-center gap-0.5">
                  <button type="button" className="rounded p-1 hover:bg-slate-100 disabled:opacity-30" disabled={i === 0} onClick={() => move(i, -1)} aria-label={isAr ? 'لأعلى' : 'Move up'}><ArrowUp className="h-4 w-4" /></button>
                  <button type="button" className="rounded p-1 hover:bg-slate-100 disabled:opacity-30" disabled={i === rules.length - 1} onClick={() => move(i, 1)} aria-label={isAr ? 'لأسفل' : 'Move down'}><ArrowDown className="h-4 w-4" /></button>
                  <button type="button" className="rounded p-1 hover:bg-slate-100" onClick={() => { const { _id, ...copy } = r; onChange([...rules.slice(0, i + 1), { ...copy, name: `${r.name} (2)` }, ...rules.slice(i + 1)]); }} aria-label={isAr ? 'نسخ' : 'Duplicate'}><Copy className="h-4 w-4" /></button>
                  <button type="button" className="rounded p-1 text-red-600 hover:bg-red-50" onClick={() => { onChange(rules.filter((_, idx) => idx !== i)); setOpenIdx(-1); }} aria-label={isAr ? 'حذف' : 'Delete'}><Trash2 className="h-4 w-4" /></button>
                </span>
              )}
              <ChevronDown className={`h-4 w-4 text-text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
            </div>

            {open && (
              <fieldset disabled={disabled} className="grid gap-4 border-t border-border p-4 md:grid-cols-2">
                <label className="block text-sm md:col-span-2"><span className="mb-1 block font-medium">{isAr ? 'اسم القاعدة' : 'Rule name'}</span>
                  <input className={inputCls} value={r.name} onChange={(e) => set(i, { name: e.target.value })} placeholder={isAr ? 'مثال: عرض رمضان على الإلكترونيات' : 'e.g. Ramadan electronics offer'} />
                </label>
                <NumberField label={isAr ? 'العمولة %' : 'Commission %'} value={r.rate} onChange={(v) => set(i, { rate: v })} max={100} suffix="%" />
                <NumberField label={isAr ? 'رسوم ثابتة لكل قطعة (اختياري)' : 'Fee per item (optional)'} hint={isAr ? 'فارغ = الرسوم العادية' : 'Empty = the normal fee'} value={r.fixedFeePerItem} onChange={(v) => set(i, { fixedFeePerItem: v })} suffix="EGP" />

                <p className="text-xs font-semibold uppercase tracking-wide text-text-muted md:col-span-2">{isAr ? 'تنطبق على — اترك الحقل فارغاً ليشمل الكل' : 'Applies to — leave a field empty to include everything'}</p>
                <div className="text-sm"><span className="mb-1 block font-medium">{isAr ? 'الأقسام (وأقسامها الفرعية)' : 'Categories (and their subcategories)'}</span>
                  <MultiPick options={categories} value={r.categories} onChange={(v) => set(i, { categories: v })} placeholder={isAr ? '+ إضافة قسم' : '+ Add category'} emptyLabel={isAr ? 'كل الأقسام' : 'All categories'} />
                </div>
                <div className="text-sm"><span className="mb-1 block font-medium">{isAr ? 'البائعون' : 'Sellers'}</span>
                  <MultiPick options={sellers} value={r.sellers} onChange={(v) => set(i, { sellers: v })} placeholder={isAr ? '+ إضافة بائع' : '+ Add seller'} emptyLabel={isAr ? 'كل البائعين' : 'All sellers'} />
                </div>
                {plans.length > 0 && (
                  <div className="text-sm"><span className="mb-1 block font-medium">{isAr ? 'الباقات' : 'Plans'}</span>
                    <MultiPick options={plans.map((p) => ({ value: p.key, label: (isAr ? p.nameAr : p.nameEn) || p.key }))} value={r.plans} onChange={(v) => set(i, { plans: v })} placeholder={isAr ? '+ إضافة باقة' : '+ Add plan'} emptyLabel={isAr ? 'كل الباقات' : 'All plans'} />
                  </div>
                )}
                <label className="block text-sm"><span className="mb-1 block font-medium">{isAr ? 'من يشحن' : 'Who ships'}</span>
                  <select className={inputCls} value={r.fulfillment} onChange={(e) => set(i, { fulfillment: e.target.value })}>
                    <option value="any">{isAr ? 'أي طريقة' : 'Either'}</option>
                    <option value="store">{isAr ? 'يشحنها المتجر (من مخزنك)' : 'Shipped by the store'}</option>
                    <option value="seller">{isAr ? 'يشحنها البائع' : 'Shipped by the seller'}</option>
                  </select>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <NumberField label={isAr ? 'سعر القطعة من' : 'Item price from'} value={r.minPrice} onChange={(v) => set(i, { minPrice: v })} step={1} suffix="EGP" />
                  <NumberField label={isAr ? 'إلى' : 'to'} value={r.maxPrice} onChange={(v) => set(i, { maxPrice: v })} step={1} suffix="EGP" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-sm"><span className="mb-1 block font-medium">{isAr ? 'تبدأ' : 'Starts'}</span><input type="date" className={inputCls} value={r.startsAt} onChange={(e) => set(i, { startsAt: e.target.value })} /></label>
                  <label className="block text-sm"><span className="mb-1 block font-medium">{isAr ? 'تنتهي (شاملة)' : 'Ends (inclusive)'}</span><input type="date" className={inputCls} value={r.endsAt} min={r.startsAt || undefined} onChange={(e) => set(i, { endsAt: e.target.value })} /></label>
                </div>
                <NumberField label={isAr ? 'للبائعين الجدد فقط — خلال أول (يوم)' : 'Only new sellers — within their first (days)'} hint={isAr ? 'من تاريخ اعتماد البائع' : 'Counted from the seller’s approval date'} value={r.newSellerDays} onChange={(v) => set(i, { newSellerDays: v })} step={1} />
                <div className="grid gap-2 md:col-span-2 md:grid-cols-2">
                  <Toggle label={isAr ? 'القاعدة مفعّلة' : 'Rule is on'} checked={r.active} onChange={(v) => set(i, { active: v })} />
                  <Toggle label={isAr ? 'تتجاوز العمولة الخاصة بالبائعين' : 'Beats sellers’ own deals'} hint={isAr ? 'للحملات العامة: تُطبّق حتى على من لهم نسبة متفق عليها' : 'For store-wide campaigns: applies even to sellers with a negotiated rate'} checked={r.overrideSellerDeals} onChange={(v) => set(i, { overrideSellerDeals: v })} />
                </div>
              </fieldset>
            )}
          </div>
        );
      })}

      {!disabled && (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => add()} className="inline-flex items-center gap-1 rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary-700"><Plus className="h-4 w-4" />{isAr ? 'قاعدة جديدة' : 'New rule'}</button>
          <span className="text-xs text-text-muted">{isAr ? 'أو ابدأ من:' : 'or start from:'}</span>
          {TEMPLATES.map((tpl) => (
            <button key={tpl.key} type="button" onClick={() => add({ ...tpl.rule, name: isAr ? tpl.ar : tpl.rule.name })} className="rounded-lg px-2.5 py-1 text-xs font-semibold ring-1 ring-border hover:bg-slate-50">{isAr ? tpl.ar : tpl.en}</button>
          ))}
        </div>
      )}
    </div>
  );
}
