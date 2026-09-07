import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Package } from 'lucide-react';
import { adminApi } from '../adminApi';
import ProductMultiPicker from './ProductMultiPicker';
import QtyPromoRulesEditor from './QtyPromoRulesEditor';
import SecondItemRulesEditor from './SecondItemRulesEditor';
import BundleRulesEditor from './BundleRulesEditor';
import CartOfferCopyEditor from './CartOfferCopyEditor';
import PromotionFormSection from './PromotionFormSection';
import PromotionTypePicker from './PromotionTypePicker';
import PromotionDiscountRules from './PromotionDiscountRules';
import PromotionScheduleEditor from './PromotionScheduleEditor';
import Input from '../../components/ui/Input';
import {
  describePromotionRules,
  formatScheduleSummary,
  getPromotionTypeMeta,
} from '../utils/promotionUtils';

function RulesBlock({ form, setForm, isAr }) {
  const rules = form.rules || {};
  const patchRules = (patch) => setForm((prev) => ({ ...prev, rules: { ...prev.rules, ...patch } }));

  if (form.type === 'percent_off' || form.type === 'amount_off') {
    return <PromotionDiscountRules formType={form.type} rules={rules} onPatch={patchRules} isAr={isAr} />;
  }
  if (form.type === 'bogo' || form.type === 'buy_x_get_y') {
    return <QtyPromoRulesEditor form={form} setForm={setForm} isAr={isAr} />;
  }
  if (form.type === 'second_percent_off') {
    return <SecondItemRulesEditor form={form} setForm={setForm} isAr={isAr} />;
  }
  if (form.type === 'bundle') {
    return <BundleRulesEditor form={form} setForm={setForm} isAr={isAr} showMinQty={false} />;
  }
  return null;
}

export default function SingleProductOfferPanel({
  isAr,
  initialForm,
  categories = [],
  brands = [],
  onSubmit,
  onCancel,
  saving = false,
}) {
  const [form, setForm] = useState(initialForm);
  const [showCartCopy, setShowCartCopy] = useState(false);
  const typeMeta = getPromotionTypeMeta(form.type);
  const selectedId = form.productIds?.[0] || null;
  const rulesSummary = describePromotionRules({ type: form.type, rules: form.rules }, isAr);

  const seedProducts = selectedId
    ? [{ _id: selectedId, nameAr: form.nameAr, nameEn: form.nameEn }]
    : [];

  useEffect(() => {
    const id = form.productIds?.[0];
    if (!id) return undefined;
    let active = true;
    adminApi.getProduct(id).then(({ data }) => {
      if (!active) return;
      const p = data.data || data;
      if (!p) return;
      setForm((prev) => ({
        ...prev,
        nameAr: prev.nameAr?.trim() ? prev.nameAr : (p.nameAr ? `عرض ${p.nameAr}` : ''),
        nameEn: prev.nameEn?.trim() ? prev.nameEn : (p.nameEn || p.nameAr ? `${p.nameEn || p.nameAr} offer` : ''),
      }));
    }).catch(() => {});
    return () => { active = false; };
  }, [form.productIds?.[0], setForm]);

  const handleProductChange = (productIds) => {
    const id = productIds[0];
    if (!id) {
      setForm((prev) => ({ ...prev, productIds: [], nameAr: '', nameEn: '' }));
      return;
    }
    setForm((prev) => ({ ...prev, productIds: [String(id)] }));
  };

  const pickType = ({ type, badgeAr, badgeEn }) => {
    setForm((prev) => ({ ...prev, type, badgeAr, badgeEn }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(e, form);
  };

  const scheduleSummary = formatScheduleSummary(form, isAr);

  return (
    <form onSubmit={handleSubmit} className="flex min-h-full flex-col">
      <div className="flex-1 space-y-4 pb-4">
        <div className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-2.5 text-xs leading-relaxed text-orange-950">
          {isAr
            ? '🎯 أسرع طريقة — منتج واحد، عرض واحد، تفعيل فوري.'
            : '🎯 Fastest path — one product, one offer, instant apply.'}
        </div>

        <PromotionFormSection
          step={1}
          title={isAr ? 'المنتج' : 'Product'}
          hint={isAr ? 'ابحث بالاسم واختر منتجاً واحداً' : 'Search by name and pick one product'}
          isAr={isAr}
        >
          <ProductMultiPicker
            value={form.productIds?.slice(0, 1) || []}
            onChange={handleProductChange}
            categories={categories}
            brands={brands}
            isAr={isAr}
            maxItems={1}
            seedProducts={seedProducts}
          />
        </PromotionFormSection>

        {selectedId && (
          <>
            <div className="rounded-2xl border border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50/80 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-orange-800/80">
                {isAr ? 'معاينة الشارة' : 'Badge preview'}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="inline-flex rounded-lg bg-orange-600 px-3 py-1 text-sm font-bold text-white">
                  {form.badgeAr || '—'}
                </span>
                <span className="text-sm font-semibold text-orange-950">{rulesSummary}</span>
              </div>
              <p className="mt-2 text-xs text-orange-800/90">⏱ {scheduleSummary}</p>
            </div>

            <PromotionFormSection
              step={2}
              title={isAr ? 'نوع العرض' : 'Offer type'}
              isAr={isAr}
            >
              <PromotionTypePicker
                formType={form.type}
                rules={form.rules}
                onPick={pickType}
                isAr={isAr}
              />
            </PromotionFormSection>

            <PromotionFormSection
              step={3}
              title={isAr ? 'قيمة العرض' : 'Offer value'}
              hint={
                typeMeta.priceEffect
                  ? (isAr ? 'يُطبّق على السعر' : 'Applied to price')
                  : (isAr ? 'يُطبّق في السلة' : 'Applied in cart')
              }
              isAr={isAr}
            >
              <RulesBlock form={form} setForm={setForm} isAr={isAr} />
            </PromotionFormSection>

            <PromotionFormSection
              step={4}
              title={isAr ? 'التفاصيل' : 'Details'}
              isAr={isAr}
            >
              <div className="space-y-3">
                <Input
                  label={isAr ? 'اسم العرض (عربي) *' : 'Offer name (Arabic) *'}
                  value={form.nameAr}
                  onChange={(e) => setForm((prev) => ({ ...prev, nameAr: e.target.value }))}
                  required
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    label={isAr ? 'شارة (عربي)' : 'Badge (Arabic)'}
                    value={form.badgeAr}
                    onChange={(e) => setForm((prev) => ({ ...prev, badgeAr: e.target.value }))}
                  />
                  <Input
                    label="Badge (EN)"
                    value={form.badgeEn}
                    onChange={(e) => setForm((prev) => ({ ...prev, badgeEn: e.target.value }))}
                    dir="ltr"
                  />
                </div>
                <PromotionScheduleEditor form={form} setForm={setForm} isAr={isAr} compact />
              </div>
            </PromotionFormSection>

            <PromotionFormSection step={5} title={isAr ? 'نص السلة' : 'Cart text'} optional isAr={isAr}>
              <button
                type="button"
                onClick={() => setShowCartCopy((v) => !v)}
                className="flex w-full items-center justify-between rounded-xl border border-teal-200 bg-teal-50/50 px-3 py-2 text-xs font-semibold text-teal-900"
              >
                {showCartCopy ? (isAr ? 'إخفاء' : 'Hide') : (isAr ? 'تخصيص النص' : 'Customize text')}
                {showCartCopy ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {showCartCopy && <div className="mt-3"><CartOfferCopyEditor form={form} setForm={setForm} isAr={isAr} /></div>}
            </PromotionFormSection>
          </>
        )}
      </div>

      <div className="sticky bottom-0 -mx-5 border-t border-border bg-white px-5 py-4">
        <label className="mb-3 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))} className="h-4 w-4 rounded" />
          {isAr ? 'تفعيل فوراً' : 'Activate immediately'}
        </label>
        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={saving || !selectedId || !form.nameAr?.trim()}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-orange-600 px-5 py-3 text-sm font-bold text-white hover:bg-orange-700 disabled:opacity-50 sm:flex-none"
          >
            <Package className="h-4 w-4" />
            {saving ? (isAr ? 'جار الحفظ…' : 'Saving…') : (isAr ? 'تطبيق على المنتج' : 'Apply to product')}
          </button>
          <button type="button" onClick={onCancel} className="rounded-xl border border-border px-5 py-3 text-sm font-semibold hover:bg-slate-50">
            {isAr ? 'إلغاء' : 'Cancel'}
          </button>
        </div>
      </div>
    </form>
  );
}
