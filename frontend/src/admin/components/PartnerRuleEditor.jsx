import { useId, useState } from 'react';
import {
  Package, MapPin, User, Percent, Users, Plus, Trash2, X, ChevronDown, ChevronUp,
} from 'lucide-react';
import CategoryMultiBrowsePicker from './CategoryMultiBrowsePicker';
import {
  MultiIdSelect, SimpleProductPicker, UserScopePicker, ScopeSection,
} from './PartnerScopeEditor';
import {
  RULE_SCOPES, RULE_BASES, RULE_RATE_TYPES, CUSTOMER_TYPES,
  PAYMENT_METHOD_OPTIONS, DELIVERY_METHOD_OPTIONS, WEEKDAYS, describeRate,
} from '../constants/partnerRuleMeta';
import { partnerColor } from './PartnerPercentageBar';

function partnerKeyOf(p) {
  if (p.userId) return String(p.userId);
  if (p._id) return String(p._id);
  return null;
}

function ChipInput({ value = [], onChange, isAr, placeholder, suggestions = [], lowercase = false, disabled }) {
  const [draft, setDraft] = useState('');
  const listId = useId();
  const add = (raw) => {
    let v = String(raw || '').trim();
    if (lowercase) v = v.toLowerCase();
    if (!v || value.includes(v)) return;
    onChange([...value, v]);
    setDraft('');
  };
  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {value.map((v) => (
            <li key={v}>
              <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold">
                {v}
                {!disabled && <button type="button" onClick={() => onChange(value.filter((x) => x !== v))} className="hover:text-red-600">×</button>}
              </span>
            </li>
          ))}
        </ul>
      )}
      {!disabled && (
        <div className="flex gap-2">
          <input
            list={suggestions.length ? listId : undefined}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(draft); } }}
            placeholder={placeholder}
            className="min-w-0 flex-1 rounded-lg border border-border px-3 py-2 text-sm"
          />
          <button type="button" onClick={() => add(draft)} className="rounded-lg border border-border px-3 text-sm hover:bg-slate-50">
            {isAr ? 'إضافة' : 'Add'}
          </button>
          {suggestions.length > 0 && (
            <datalist id={listId}>
              {suggestions.slice(0, 200).map((s) => <option key={s} value={s} />)}
            </datalist>
          )}
        </div>
      )}
    </div>
  );
}

function NumField({ label, value, onChange, disabled }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-text-muted">{label}</span>
      <input
        type="number" min={0} step="any" disabled={disabled}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        className="w-full rounded-lg border border-border px-3 py-2 text-sm disabled:bg-slate-100"
      />
    </label>
  );
}

export default function PartnerRuleEditor({
  rule, onChange, onRemove, isAr, canEdit,
  partners = [], catalog = {},
}) {
  const [openConds, setOpenConds] = useState(true);
  const c = rule.conditions || {};
  const readOnly = !canEdit || rule.source === 'auto';
  const patch = (p) => onChange({ ...rule, ...p });
  const patchCond = (p) => onChange({ ...rule, conditions: { ...c, ...p } });
  const patchRate = (p) => onChange({ ...rule, rate: { ...rule.rate, ...p } });

  const basisOptions = RULE_BASES.filter((b) => rule.scope === 'order' || !b.orderOnly);
  const activePartners = partners.filter((p) => p.status !== 'archived' && p.isActive !== false);
  const beneTotal = (rule.beneficiaries || []).reduce((s, b) => s + (Number(b.sharePercent) || 0), 0);

  const setBeneficiary = (idx, p) => {
    const next = [...(rule.beneficiaries || [])];
    next[idx] = { ...next[idx], ...p };
    patch({ beneficiaries: next });
  };

  return (
    <div className={`rounded-2xl border ${rule.source === 'auto' ? 'border-violet-200 bg-violet-50/30' : 'border-border bg-white'} p-4 shadow-sm space-y-4`}>
      <div className="flex flex-wrap items-start gap-3">
        <label className="flex items-center gap-2 pt-2">
          <input type="checkbox" disabled={readOnly} checked={rule.enabled !== false}
            onChange={(e) => patch({ enabled: e.target.checked })} className="h-4 w-4 rounded text-primary-600" />
        </label>
        <div className="min-w-0 flex-1">
          <input
            type="text" disabled={readOnly} value={rule.name || ''}
            onChange={(e) => patch({ name: e.target.value })}
            placeholder={isAr ? 'اسم القاعدة (مثال: طلبات القاهرة → شريك أ)' : 'Rule name (e.g. Cairo orders → Partner A)'}
            className="w-full rounded-lg border border-border px-3 py-2 text-sm font-semibold disabled:bg-slate-100"
          />
          <p className="mt-1 text-xs text-text-muted">{describeRate(rule, isAr)}</p>
          {rule.source === 'auto' && (
            <p className="mt-1 text-[11px] font-semibold text-violet-700">
              {isAr ? 'مُولّدة من تخصيصات الشريك — عدّلها من بطاقة الشريك' : 'Generated from partner assignments — edit on the partner card'}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-xs text-text-muted">
            {isAr ? 'الأولوية' : 'Priority'}
            <input type="number" disabled={readOnly} value={rule.priority ?? 100}
              onChange={(e) => patch({ priority: Number(e.target.value) })}
              className="w-16 rounded-lg border border-border px-2 py-1 text-center text-sm disabled:bg-slate-100" />
          </label>
          {onRemove && rule.source !== 'auto' && canEdit && (
            <button type="button" onClick={onRemove} className="rounded-lg p-2 text-red-500 hover:bg-red-50">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Payout: basis + rate + beneficiaries */}
      <div className="grid gap-3 rounded-xl border border-amber-200 bg-amber-50/40 p-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-text-muted">{isAr ? 'نطاق' : 'Scope'}</span>
          <select disabled={readOnly} value={rule.scope}
            onChange={(e) => patch({ scope: e.target.value })}
            className="w-full rounded-lg border border-border px-2 py-2 text-sm disabled:bg-slate-100">
            {RULE_SCOPES.map((s) => <option key={s.value} value={s.value}>{isAr ? s.labelAr : s.labelEn}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-text-muted">{isAr ? 'أساس الحساب' : 'Basis'}</span>
          <select disabled={readOnly} value={rule.basis}
            onChange={(e) => patch({ basis: e.target.value })}
            className="w-full rounded-lg border border-border px-2 py-2 text-sm disabled:bg-slate-100">
            {basisOptions.map((b) => <option key={b.value} value={b.value}>{isAr ? b.labelAr : b.labelEn}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-text-muted">{isAr ? 'نوع المعدل' : 'Rate type'}</span>
          <select disabled={readOnly} value={rule.rate?.type || 'percent'}
            onChange={(e) => patchRate({ type: e.target.value })}
            className="w-full rounded-lg border border-border px-2 py-2 text-sm disabled:bg-slate-100">
            {RULE_RATE_TYPES.map((r) => <option key={r.value} value={r.value}>{isAr ? r.labelAr : r.labelEn}</option>)}
          </select>
        </label>
        {rule.rate?.type !== 'tiered' && (
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-text-muted">
              {rule.rate?.type === 'percent' ? '%' : (isAr ? 'المبلغ' : 'Amount')}
            </span>
            <input type="number" min={0} step="any" disabled={readOnly} value={rule.rate?.value ?? 0}
              onChange={(e) => patchRate({ value: Number(e.target.value) })}
              className="w-full rounded-lg border border-border px-2 py-2 text-sm disabled:bg-slate-100" />
          </label>
        )}
        {rule.rate?.type === 'tiered' && (
          <div className="sm:col-span-2 lg:col-span-4">
            <p className="mb-1 text-xs font-medium text-text-muted">
              {isAr ? 'الشرائح — نسبة % تُطبَّق عندما يكون الأساس ≤ الحد' : 'Tiers — % applied when basis ≤ threshold'}
            </p>
            <div className="space-y-2">
              {(rule.rate?.tiers || []).map((t, ti) => (
                <div key={ti} className="flex items-center gap-2">
                  <input type="number" placeholder={isAr ? 'حتى قيمة' : 'up to value'} disabled={readOnly}
                    value={t.upToValue ?? ''} onChange={(e) => {
                      const tiers = [...rule.rate.tiers];
                      tiers[ti] = { ...t, upToValue: e.target.value === '' ? null : Number(e.target.value) };
                      patchRate({ tiers });
                    }} className="w-32 rounded-lg border border-border px-2 py-1.5 text-sm" />
                  <input type="number" placeholder="%" disabled={readOnly}
                    value={t.value ?? ''} onChange={(e) => {
                      const tiers = [...rule.rate.tiers];
                      tiers[ti] = { ...t, value: Number(e.target.value) };
                      patchRate({ tiers });
                    }} className="w-24 rounded-lg border border-border px-2 py-1.5 text-sm" />
                  {!readOnly && (
                    <button type="button" onClick={() => patchRate({ tiers: rule.rate.tiers.filter((_, i) => i !== ti) })}
                      className="text-red-500"><X className="h-4 w-4" /></button>
                  )}
                </div>
              ))}
              {!readOnly && (
                <button type="button" onClick={() => patchRate({ tiers: [...(rule.rate.tiers || []), { upToValue: null, value: 0 }] })}
                  className="text-xs font-semibold text-primary-700">+ {isAr ? 'شريحة' : 'tier'}</button>
              )}
            </div>
          </div>
        )}
        <label className="flex items-center gap-2 text-xs sm:col-span-2 lg:col-span-4">
          <input type="checkbox" disabled={readOnly} checked={rule.stackable === true}
            onChange={(e) => patch({ stackable: e.target.checked })} className="h-4 w-4 rounded text-primary-600" />
          {isAr
            ? 'قابلة للتراكم — لا تمنع القواعد التالية من مطابقة نفس الطلب/السطر'
            : 'Stackable — does not block later rules from matching the same order/line'}
        </label>
      </div>

      {/* Beneficiaries */}
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold text-emerald-950 flex items-center gap-1.5">
            <Users className="h-4 w-4" />
            {isAr ? 'المستفيدون من هذه القاعدة' : 'Rule beneficiaries'}
          </p>
          <span className={`text-xs font-bold ${beneTotal > 100.01 ? 'text-red-600' : 'text-emerald-700'}`}>
            {beneTotal.toFixed(0)}%
          </span>
        </div>
        <div className="space-y-2">
          {(rule.beneficiaries || []).map((b, bi) => {
            const idx = activePartners.findIndex((p) => partnerKeyOf(p) === b.partnerKey);
            return (
              <div key={bi} className="flex items-center gap-2">
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[10px] font-bold text-white ${partnerColor(idx < 0 ? bi : idx)}`}>
                  {(activePartners[idx]?.nameEn || activePartners[idx]?.nameAr || '?').charAt(0).toUpperCase()}
                </span>
                <select disabled={readOnly} value={b.partnerKey}
                  onChange={(e) => setBeneficiary(bi, { partnerKey: e.target.value })}
                  className="min-w-0 flex-1 rounded-lg border border-border px-2 py-1.5 text-sm disabled:bg-slate-100">
                  <option value="">{isAr ? '— اختر شريكاً —' : '— select partner —'}</option>
                  {activePartners.map((p, pi) => (
                    <option key={partnerKeyOf(p) || pi} value={partnerKeyOf(p)}>
                      {isAr ? (p.nameAr || p.nameEn) : (p.nameEn || p.nameAr)}
                    </option>
                  ))}
                </select>
                <div className="flex items-center gap-1">
                  <input type="number" min={0} max={100} disabled={readOnly} value={b.sharePercent ?? 100}
                    onChange={(e) => setBeneficiary(bi, { sharePercent: Number(e.target.value) })}
                    className="w-16 rounded-lg border border-border px-2 py-1.5 text-center text-sm disabled:bg-slate-100" />
                  <span className="text-xs">%</span>
                </div>
                {!readOnly && (
                  <button type="button" onClick={() => patch({ beneficiaries: rule.beneficiaries.filter((_, i) => i !== bi) })}
                    className="text-red-500"><X className="h-4 w-4" /></button>
                )}
              </div>
            );
          })}
          {!readOnly && (
            <button type="button"
              onClick={() => patch({ beneficiaries: [...(rule.beneficiaries || []), { partnerKey: '', sharePercent: beneTotal >= 100 ? 0 : 100 - beneTotal }] })}
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary-700">
              <Plus className="h-3.5 w-3.5" /> {isAr ? 'مستفيد' : 'beneficiary'}
            </button>
          )}
        </div>
        {beneTotal < 100 && (
          <p className="mt-2 text-[11px] text-text-muted">
            {isAr
              ? `${(100 - beneTotal).toFixed(0)}% من مبلغ القاعدة يبقى في المجموعة العامة`
              : `${(100 - beneTotal).toFixed(0)}% of the rule amount stays in the general pool`}
          </p>
        )}
      </div>

      {/* Conditions */}
      <div>
        <button type="button" onClick={() => setOpenConds((v) => !v)}
          className="flex w-full items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm font-semibold">
          <span>{isAr ? 'الشروط (الكل يجب أن يتحقق)' : 'Conditions (all must match)'}</span>
          {openConds ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {openConds && (
          <div className="mt-3 space-y-3">
            <ScopeSection title={isAr ? 'عملاء' : 'Customers'} icon={User}
              count={c.customers?.length + (c.customerType !== 'any' ? 1 : 0)}>
              <UserScopePicker value={c.customers || []} onChange={(v) => patchCond({ customers: v })} isAr={isAr} canEdit={!readOnly} />
              <label className="mt-3 block">
                <span className="mb-1 block text-xs text-text-muted">{isAr ? 'نوع العميل' : 'Customer type'}</span>
                <select disabled={readOnly} value={c.customerType || 'any'} onChange={(e) => patchCond({ customerType: e.target.value })}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm disabled:bg-slate-100">
                  {CUSTOMER_TYPES.map((t) => <option key={t.value} value={t.value}>{isAr ? t.labelAr : t.labelEn}</option>)}
                </select>
              </label>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <NumField label={isAr ? 'أقل عدد طلبات (كلي)' : 'Min lifetime orders'} value={c.minCustomerOrderCount}
                  onChange={(v) => patchCond({ minCustomerOrderCount: v })} disabled={readOnly} />
                <NumField label={isAr ? 'أقصى عدد طلبات (كلي)' : 'Max lifetime orders'} value={c.maxCustomerOrderCount}
                  onChange={(v) => patchCond({ maxCustomerOrderCount: v })} disabled={readOnly} />
              </div>
            </ScopeSection>

            <ScopeSection title={isAr ? 'المكان' : 'Location'} icon={MapPin}
              count={(c.deliveryZones?.length || 0) + (c.cities?.length || 0) + (c.governorates?.length || 0) + (c.fulfillmentLocations?.length || 0)}>
              <div className="space-y-3">
                <div>
                  <p className="mb-1 text-xs text-text-muted">{isAr ? 'مناطق التوصيل' : 'Delivery zones'}</p>
                  <MultiIdSelect options={catalog.deliveryZones || []} value={c.deliveryZones || []}
                    onChange={(v) => patchCond({ deliveryZones: v })} isAr={isAr} disabled={readOnly}
                    labelKeyAr="areaAr" labelKeyEn="areaEn"
                    placeholderAr="— اختر منطقة —" placeholderEn="— select zone —" />
                </div>
                <div>
                  <p className="mb-1 text-xs text-text-muted">{isAr ? 'مواقع الشحن' : 'Fulfillment locations'}</p>
                  <MultiIdSelect options={catalog.fulfillmentLocations || []} value={c.fulfillmentLocations || []}
                    onChange={(v) => patchCond({ fulfillmentLocations: v })} isAr={isAr} disabled={readOnly} fallbackKey="name"
                    placeholderAr="— اختر موقعاً —" placeholderEn="— select location —" />
                </div>
                <div>
                  <p className="mb-1 text-xs text-text-muted">{isAr ? 'مدن' : 'Cities'}</p>
                  <ChipInput value={c.cities || []} onChange={(v) => patchCond({ cities: v })} isAr={isAr}
                    disabled={readOnly} suggestions={catalog.cities || []} placeholder={isAr ? 'اسم المدينة' : 'City name'} />
                </div>
                <div>
                  <p className="mb-1 text-xs text-text-muted">{isAr ? 'محافظات' : 'Governorates'}</p>
                  <ChipInput value={c.governorates || []} onChange={(v) => patchCond({ governorates: v })} isAr={isAr}
                    disabled={readOnly} suggestions={catalog.governorates || []} placeholder={isAr ? 'اسم المحافظة' : 'Governorate'} />
                </div>
              </div>
            </ScopeSection>

            <ScopeSection title={isAr ? 'المنتجات' : 'Products'} icon={Package}
              count={(c.products?.length || 0) + (c.categories?.length || 0) + (c.brands?.length || 0) + (c.promotions?.length || 0)}>
              <div className="space-y-3">
                <div>
                  <p className="mb-1 text-xs text-text-muted">{isAr ? 'منتجات' : 'Products'}</p>
                  <SimpleProductPicker value={c.products || []} onChange={(v) => patchCond({ products: v })} isAr={isAr} canEdit={!readOnly} />
                </div>
                <div>
                  <p className="mb-1 text-xs text-text-muted">{isAr ? 'أقسام (يشمل الفرعية)' : 'Categories (incl. sub)'}</p>
                  {(catalog.categories || []).length > 0 ? (
                    <CategoryMultiBrowsePicker categories={catalog.categories} value={c.categories || []}
                      onChange={(v) => patchCond({ categories: v })} isAr={isAr} maxItems={24} />
                  ) : <p className="text-xs text-text-muted">—</p>}
                </div>
                <div>
                  <p className="mb-1 text-xs text-text-muted">{isAr ? 'علامات تجارية' : 'Brands'}</p>
                  <MultiIdSelect options={catalog.brands || []} value={c.brands || []}
                    onChange={(v) => patchCond({ brands: v })} isAr={isAr} disabled={readOnly}
                    placeholderAr="— اختر علامة —" placeholderEn="— select brand —" />
                </div>
                <div>
                  <p className="mb-1 text-xs text-text-muted">{isAr ? 'عروض' : 'Promotions'}</p>
                  <MultiIdSelect options={catalog.promotions || []} value={c.promotions || []}
                    onChange={(v) => patchCond({ promotions: v })} isAr={isAr} disabled={readOnly}
                    placeholderAr="— اختر عرضاً —" placeholderEn="— select promotion —" />
                </div>
              </div>
            </ScopeSection>

            <ScopeSection title={isAr ? 'الطلب' : 'Order'} icon={Percent}
              count={(c.paymentMethods?.length || 0) + (c.deliveryMethods?.length || 0) + (c.couponCodes?.length || 0)
                + (c.minOrderValue != null ? 1 : 0) + (c.maxOrderValue != null ? 1 : 0) + (c.weekdays?.length || 0)
                + (c.dateFromKey ? 1 : 0) + (c.dateToKey ? 1 : 0)}>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <NumField label={isAr ? 'أقل قيمة طلب' : 'Min order value'} value={c.minOrderValue}
                    onChange={(v) => patchCond({ minOrderValue: v })} disabled={readOnly} />
                  <NumField label={isAr ? 'أقصى قيمة طلب' : 'Max order value'} value={c.maxOrderValue}
                    onChange={(v) => patchCond({ maxOrderValue: v })} disabled={readOnly} />
                </div>
                <div>
                  <p className="mb-1 text-xs text-text-muted">{isAr ? 'طرق الدفع' : 'Payment methods'}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {PAYMENT_METHOD_OPTIONS.map((m) => {
                      const on = (c.paymentMethods || []).includes(m.value);
                      return (
                        <button key={m.value} type="button" disabled={readOnly}
                          onClick={() => patchCond({ paymentMethods: on ? c.paymentMethods.filter((x) => x !== m.value) : [...(c.paymentMethods || []), m.value] })}
                          className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${on ? 'border-primary-500 bg-primary-50 text-primary-800' : 'border-border text-text-muted'}`}>
                          {isAr ? m.labelAr : m.labelEn}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <p className="mb-1 text-xs text-text-muted">{isAr ? 'طرق التوصيل' : 'Delivery methods'}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {DELIVERY_METHOD_OPTIONS.map((m) => {
                      const on = (c.deliveryMethods || []).includes(m.value);
                      return (
                        <button key={m.value} type="button" disabled={readOnly}
                          onClick={() => patchCond({ deliveryMethods: on ? c.deliveryMethods.filter((x) => x !== m.value) : [...(c.deliveryMethods || []), m.value] })}
                          className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${on ? 'border-primary-500 bg-primary-50 text-primary-800' : 'border-border text-text-muted'}`}>
                          {isAr ? m.labelAr : m.labelEn}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <p className="mb-1 text-xs text-text-muted">{isAr ? 'أكواد الخصم' : 'Coupon codes'}</p>
                  <ChipInput value={c.couponCodes || []} onChange={(v) => patchCond({ couponCodes: v })} isAr={isAr}
                    disabled={readOnly} lowercase suggestions={catalog.couponCodes || []} placeholder={isAr ? 'الكود' : 'Code'} />
                </div>
                <div>
                  <p className="mb-1 text-xs text-text-muted">{isAr ? 'أيام الأسبوع' : 'Weekdays'}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {WEEKDAYS.map((d) => {
                      const on = (c.weekdays || []).includes(d.value);
                      return (
                        <button key={d.value} type="button" disabled={readOnly}
                          onClick={() => patchCond({ weekdays: on ? c.weekdays.filter((x) => x !== d.value) : [...(c.weekdays || []), d.value] })}
                          className={`rounded-lg border px-2 py-1 text-xs font-medium ${on ? 'border-primary-500 bg-primary-50 text-primary-800' : 'border-border text-text-muted'}`}>
                          {isAr ? d.labelAr : d.labelEn}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="mb-1 block text-xs text-text-muted">{isAr ? 'ساري من' : 'Effective from'}</span>
                    <input type="date" disabled={readOnly} value={c.dateFromKey || ''}
                      onChange={(e) => patchCond({ dateFromKey: e.target.value })}
                      className="w-full rounded-lg border border-border px-3 py-2 text-sm disabled:bg-slate-100" />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-text-muted">{isAr ? 'ساري حتى' : 'Effective to'}</span>
                    <input type="date" disabled={readOnly} value={c.dateToKey || ''}
                      onChange={(e) => patchCond({ dateToKey: e.target.value })}
                      className="w-full rounded-lg border border-border px-3 py-2 text-sm disabled:bg-slate-100" />
                  </label>
                </div>
              </div>
            </ScopeSection>
          </div>
        )}
      </div>
    </div>
  );
}
