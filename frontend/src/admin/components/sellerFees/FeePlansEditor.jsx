import { Plus, Star, Trash2 } from 'lucide-react';
import { newPlan } from '../../utils/sellerFeesAdmin';
import { NumberField, inputCls } from './fields';

const PRESETS = [
  {
    ar: 'أساسية + احترافية (مثل أمازون)', en: 'Basic + Pro (Amazon style)',
    plans: [
      { key: 'basic', nameAr: 'أساسية', nameEn: 'Basic', descriptionAr: 'بدون اشتراك، رسوم على كل قطعة', descriptionEn: 'No monthly fee, a fee per item sold', isDefault: true, fixedFeePerItem: '5', monthlyFee: '0' },
      { key: 'pro', nameAr: 'احترافية', nameEn: 'Pro', descriptionAr: 'اشتراك شهري، بدون رسوم على القطعة وعمولة أقل', descriptionEn: 'Monthly fee, no per-item fee and a lower rate', fixedFeePerItem: '0', monthlyFee: '299', commissionRate: '' },
    ],
  },
];

/**
 * Seller plans: each plan can replace any standard fee; an empty field means "use the
 * standard value". One plan is the default for sellers without a plan.
 */
export default function FeePlansEditor({ plans, onChange, defaults, isAr, disabled }) {
  const set = (i, patch) => onChange(plans.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  const makeDefault = (i) => onChange(plans.map((p, idx) => ({ ...p, isDefault: idx === i })));
  const ph = (v, unit = '') => (isAr ? `العام: ${v}${unit}` : `Standard: ${v}${unit}`);

  return (
    <div className="space-y-3">
      {!plans.length && (
        <div className="rounded-xl border border-dashed border-border p-4 text-sm text-text-muted">
          <p>{isAr ? 'بدون باقات كل البائعين على نفس الرسوم. الباقات تسمح مثلاً بباقة مجانية برسوم على كل قطعة، وباقة باشتراك شهري برسوم أقل.' : 'Without plans every seller pays the same. Plans let you offer, say, a free plan with a fee per item and a monthly plan with lower fees.'}</p>
          {!disabled && PRESETS.map((p) => (
            <button key={p.en} type="button" className="mt-2 rounded-lg px-2.5 py-1 text-xs font-semibold text-primary-700 ring-1 ring-border hover:bg-slate-50" onClick={() => onChange(p.plans.map((x) => ({ ...newPlan([]), ...x })))}>
              {isAr ? `ابدأ بـ ${p.ar}` : `Start with ${p.en}`}
            </button>
          ))}
        </div>
      )}
      <div className="grid gap-3 lg:grid-cols-2">
        {plans.map((p, i) => (
          <fieldset key={i} disabled={disabled} className={`rounded-xl border p-4 ${p.isDefault ? 'border-primary-300 bg-primary-50/30' : 'border-border'}`}>
            <div className="mb-3 flex items-center gap-2">
              <input className={`${inputCls} flex-1 font-semibold`} value={isAr ? p.nameAr : p.nameEn} placeholder={isAr ? 'اسم الباقة' : 'Plan name'} onChange={(e) => set(i, isAr ? { nameAr: e.target.value } : { nameEn: e.target.value })} />
              <button type="button" onClick={() => makeDefault(i)} title={isAr ? 'الباقة الافتراضية' : 'Default plan'} className={`rounded-lg p-2 ring-1 ring-border ${p.isDefault ? 'bg-primary-600 text-white' : 'text-text-muted hover:bg-slate-50'}`}><Star className="h-4 w-4" /></button>
              <button type="button" onClick={() => onChange(plans.filter((_, idx) => idx !== i))} className="rounded-lg p-2 text-red-600 ring-1 ring-border hover:bg-red-50" aria-label={isAr ? 'حذف' : 'Delete'}><Trash2 className="h-4 w-4" /></button>
            </div>
            <div className="mb-3 grid grid-cols-2 gap-2">
              <input className={inputCls} value={isAr ? p.nameEn : p.nameAr} placeholder={isAr ? 'الاسم بالإنجليزية' : 'Arabic name'} dir={isAr ? 'ltr' : 'rtl'} onChange={(e) => set(i, isAr ? { nameEn: e.target.value } : { nameAr: e.target.value })} />
              <input className={inputCls} value={p.key} placeholder="key" dir="ltr" onChange={(e) => set(i, { key: e.target.value.toLowerCase().replace(/[^a-z0-9_-]+/g, '-') })} title={isAr ? 'رمز الباقة' : 'Plan code'} />
            </div>
            <input className={`${inputCls} mb-3`} value={isAr ? p.descriptionAr : p.descriptionEn} placeholder={isAr ? 'وصف قصير يراه البائع' : 'Short description sellers see'} onChange={(e) => set(i, isAr ? { descriptionAr: e.target.value } : { descriptionEn: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <NumberField label={isAr ? 'العمولة %' : 'Commission %'} value={p.commissionRate} placeholder={ph(defaults.defaultCommissionRate, '%')} onChange={(v) => set(i, { commissionRate: v })} max={100} />
              <NumberField label={isAr ? 'اشتراك شهري' : 'Monthly fee'} value={p.monthlyFee} placeholder={ph(defaults.fees.monthlyFee)} onChange={(v) => set(i, { monthlyFee: v })} step={1} suffix="EGP" />
              <NumberField label={isAr ? 'رسوم لكل قطعة' : 'Fee per item'} value={p.fixedFeePerItem} placeholder={ph(defaults.fees.fixedFeePerItem)} onChange={(v) => set(i, { fixedFeePerItem: v })} suffix="EGP" />
              <NumberField label={isAr ? 'رسوم لكل شحنة' : 'Fee per shipment'} value={p.fixedFeePerShipment} placeholder={ph(defaults.fees.fixedFeePerShipment)} onChange={(v) => set(i, { fixedFeePerShipment: v })} suffix="EGP" />
              <NumberField label={isAr ? 'أقل عمولة للقطعة' : 'Min commission / item'} value={p.minCommissionPerItem} placeholder={ph(defaults.fees.minCommissionPerItem)} onChange={(v) => set(i, { minCommissionPerItem: v })} suffix="EGP" />
              <NumberField label={isAr ? 'أقصى عمولة للقطعة' : 'Max commission / item'} value={p.maxCommissionPerItem} placeholder={ph(defaults.fees.maxCommissionPerItem || '∞')} onChange={(v) => set(i, { maxCommissionPerItem: v })} suffix="EGP" />
              <NumberField label={isAr ? 'رسوم الشحن من مخزنك / قطعة' : 'Fulfillment fee / item'} value={p.storeFulfillmentFeePerItem} placeholder={ph(defaults.storeFulfillmentFeePerItem)} onChange={(v) => set(i, { storeFulfillmentFeePerItem: v })} suffix="EGP" />
              <NumberField label={isAr ? 'أيام الانتظار قبل التحويل' : 'Hold before payout (days)'} value={p.payoutHoldDays} placeholder={ph(defaults.payoutHoldDays)} onChange={(v) => set(i, { payoutHoldDays: v })} step={1} max={90} />
            </div>
          </fieldset>
        ))}
      </div>
      {!disabled && plans.length > 0 && (
        <button type="button" onClick={() => onChange([...plans, newPlan(plans)])} className="inline-flex items-center gap-1 text-sm font-semibold text-primary-700"><Plus className="h-4 w-4" />{isAr ? 'باقة جديدة' : 'New plan'}</button>
      )}
    </div>
  );
}
