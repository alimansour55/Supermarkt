import { useState } from 'react';
import { ChevronDown, ChevronUp, Sparkles, Target, Users } from 'lucide-react';
import ProductMultiPicker from './ProductMultiPicker';
import CategoryMultiBrowsePicker from './CategoryMultiBrowsePicker';
import QtyPromoRulesEditor from './QtyPromoRulesEditor';
import SecondItemRulesEditor from './SecondItemRulesEditor';
import BundleRulesEditor from './BundleRulesEditor';
import CartOfferCopyEditor from './CartOfferCopyEditor';
import PromotionFormSection from './PromotionFormSection';
import PromotionTypePicker from './PromotionTypePicker';
import PromotionDiscountRules from './PromotionDiscountRules';
import PromotionScheduleEditor from './PromotionScheduleEditor';
import Input from '../../components/ui/Input';
import Textarea from '../../components/ui/Textarea';
import {
  PROMOTION_TARGET_MODES,
  defaultBadgesForType,
  describePromotionRules,
  formatScheduleSummary,
  getPromotionTypeMeta,
} from '../utils/promotionUtils';

const TARGET_ICONS = {
  products: Target,
  categories: Users,
  brands: Sparkles,
  all: Users,
};

function RulesBlock({ form, setForm, isAr }) {
  const rules = form.rules || {};
  const patchRules = (patch) => setForm((prev) => ({ ...prev, rules: { ...prev.rules, ...patch } }));

  if (form.type === 'percent_off' || form.type === 'amount_off') {
    return (
      <PromotionDiscountRules
        formType={form.type}
        rules={rules}
        onPatch={patchRules}
        isAr={isAr}
      />
    );
  }
  if (form.type === 'bogo' || form.type === 'buy_x_get_y') {
    return <QtyPromoRulesEditor form={form} setForm={setForm} isAr={isAr} />;
  }
  if (form.type === 'second_percent_off') {
    return <SecondItemRulesEditor form={form} setForm={setForm} isAr={isAr} />;
  }
  if (form.type === 'fixed_price') {
    return (
      <Input
        label={isAr ? 'سعر العرض (جنيه)' : 'Sale price (EGP)'}
        type="number"
        min="0"
        value={rules.fixedPrice}
        onChange={(e) => patchRules({ fixedPrice: Number(e.target.value) })}
      />
    );
  }
  if (form.type === 'bundle') {
    return <BundleRulesEditor form={form} setForm={setForm} isAr={isAr} />;
  }
  return null;
}

export default function PromotionEditorPanel({
  isAr,
  initialForm,
  categories = [],
  brands = [],
  onSubmit,
  onCancel,
  saving = false,
  editId = null,
}) {
  const [form, setForm] = useState(initialForm);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showCartCopy, setShowCartCopy] = useState(false);
  const typeMeta = getPromotionTypeMeta(form.type);
  const rulesSummary = describePromotionRules({ type: form.type, rules: form.rules }, isAr);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(e, form);
  };

  const pickType = ({ type, badgeAr, badgeEn }) => {
    setForm((prev) => {
      const next = { ...prev, type, badgeAr, badgeEn };
      if (!prev.nameAr?.trim() && !editId) {
        const badges = defaultBadgesForType(type);
        if (type === 'percent_off') {
          next.nameAr = `خصم ${prev.rules?.percent || 15}%`;
          next.nameEn = `${prev.rules?.percent || 15}% off`;
        } else if (type === 'amount_off') {
          next.nameAr = `خصم ${prev.rules?.amountOff || 20} جنيه`;
          next.nameEn = `${prev.rules?.amountOff || 20} EGP off`;
        } else if (!prev.nameAr) {
          next.nameAr = badges.badgeAr || 'عرض';
          next.nameEn = badges.badgeEn || 'Offer';
        }
      }
      return next;
    });
  };

  const legacyType = ['fixed_price', 'bundle'].includes(form.type);
  const scheduleSummary = formatScheduleSummary(form, isAr);

  return (
    <form onSubmit={handleSubmit} className="flex min-h-full flex-col">
      <div className="flex-1 space-y-4 pb-4">
        {/* Live summary */}
        <div className="rounded-2xl border border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50/80 p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-orange-800/80">
            {isAr ? 'ما يراه العميل' : 'What customers see'}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-lg bg-orange-600 px-3 py-1 text-sm font-bold text-white shadow-sm">
              {form.badgeAr || form.badgeEn || '—'}
            </span>
            <span className="text-sm font-semibold text-orange-950">{rulesSummary}</span>
          </div>
          {form.nameAr && (
            <p className="mt-2 text-xs text-orange-900/70">
              {isAr ? 'اسم الحملة:' : 'Campaign:'} {form.nameAr}
            </p>
          )}
          <p className="mt-2 text-xs font-medium text-orange-800/90">
            ⏱ {scheduleSummary}
          </p>
        </div>

        {legacyType && (
          <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
            {isAr
              ? '↪ هذا النوع لم يعد متاحاً للعروض الجديدة — يمكنك تعديله أو إيقافه.'
              : '↪ This type is legacy — edit or pause only.'}
          </p>
        )}

        <PromotionFormSection
          step={1}
          title={isAr ? 'نوع العرض' : 'Offer type'}
          hint={isAr ? 'اختر نوعاً واحداً — يمكنك تغييره لاحقاً قبل الحفظ' : 'Pick one type — you can change it before saving'}
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
          step={2}
          title={isAr ? 'قيمة العرض' : 'Offer value'}
          hint={
            typeMeta.priceEffect
              ? (isAr ? 'يُطبّق على سعر المنتج مباشرة' : 'Applied directly to product price')
              : (isAr ? 'يُطبّق في السلة — السعر على البطاقة يبقى كما هو' : 'Applied in cart — card price unchanged')
          }
          isAr={isAr}
        >
          <RulesBlock form={form} setForm={setForm} isAr={isAr} />
        </PromotionFormSection>

        <PromotionFormSection
          step={3}
          title={isAr ? 'تفاصيل الحملة' : 'Campaign details'}
          hint={isAr ? 'اسم داخلي + الشارة على بطاقة المنتج' : 'Internal name + badge on product card'}
          isAr={isAr}
        >
          <div className="space-y-4">
            <Input
              label={isAr ? 'اسم الحملة (عربي) *' : 'Campaign name (Arabic) *'}
              value={form.nameAr}
              onChange={(e) => setForm((prev) => ({ ...prev, nameAr: e.target.value }))}
              placeholder={isAr ? 'مثال: خصم الصيف على الألبان' : 'e.g. Summer dairy sale'}
              required
            />
            <Input
              label={isAr ? 'اسم الحملة (EN)' : 'Campaign name (English)'}
              value={form.nameEn}
              onChange={(e) => setForm((prev) => ({ ...prev, nameEn: e.target.value }))}
              placeholder="Summer dairy sale"
              dir="ltr"
            />

            <div className="rounded-xl border border-border bg-slate-50/80 p-4">
              <p className="mb-3 text-xs font-bold text-text">
                {isAr ? 'شارة على بطاقة المنتج' : 'Product card badge'}
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  label={isAr ? 'عربي' : 'Arabic'}
                  value={form.badgeAr}
                  onChange={(e) => setForm((prev) => ({ ...prev, badgeAr: e.target.value }))}
                  placeholder={isAr ? 'خصم 20%' : '20% off'}
                />
                <Input
                  label="English"
                  value={form.badgeEn}
                  onChange={(e) => setForm((prev) => ({ ...prev, badgeEn: e.target.value }))}
                  placeholder="20% OFF"
                  dir="ltr"
                />
              </div>
            </div>

            <PromotionScheduleEditor form={form} setForm={setForm} isAr={isAr} isEdit={!!editId} />

            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="flex w-full items-center justify-between rounded-xl border border-dashed border-border px-4 py-2.5 text-xs font-semibold text-text-muted hover:bg-slate-50"
            >
              {isAr ? 'إعدادات متقدمة (أولوية، حد استخدام، ملاحظات)' : 'Advanced (priority, usage limit, notes)'}
              {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>

            {showAdvanced && (
              <div className="space-y-3 rounded-xl border border-border p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    label={isAr ? 'الأولوية' : 'Priority'}
                    type="number"
                    value={form.priority}
                    onChange={(e) => setForm((prev) => ({ ...prev, priority: e.target.value }))}
                    placeholder="0"
                  />
                  <Input
                    label={isAr ? 'حد الاستخدام' : 'Usage limit'}
                    type="number"
                    min="1"
                    value={form.usageLimit}
                    onChange={(e) => setForm((prev) => ({ ...prev, usageLimit: e.target.value }))}
                    placeholder={isAr ? 'بدون حد' : 'No limit'}
                  />
                </div>
                <Textarea
                  label={isAr ? 'ملاحظات داخلية' : 'Internal notes'}
                  value={form.notes}
                  onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                  rows={2}
                />
              </div>
            )}
          </div>
        </PromotionFormSection>

        <PromotionFormSection
          step={4}
          title={isAr ? 'من يستفيد؟' : 'Who gets it?'}
          hint={isAr ? 'حدّد المنتجات أو الأقسام المستهدفة' : 'Pick products, categories, or brands'}
          isAr={isAr}
        >
          <div className="grid gap-2 sm:grid-cols-2">
            {PROMOTION_TARGET_MODES.map((mode) => {
              const Icon = TARGET_ICONS[mode.value] || Target;
              const active = form.targetMode === mode.value;
              return (
                <button
                  key={mode.value}
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, targetMode: mode.value }))}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-3 text-start text-xs font-semibold transition-colors ${
                    active
                      ? 'border-orange-500 bg-orange-50 text-orange-950 ring-1 ring-orange-200'
                      : 'border-border bg-slate-50/50 hover:border-orange-200'
                  }`}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-orange-600' : 'text-slate-400'}`} />
                  {isAr ? mode.labelAr : mode.labelEn}
                </button>
              );
            })}
          </div>

          <div className="mt-4">
            {form.targetMode === 'products' && (
              <ProductMultiPicker
                value={form.productIds}
                onChange={(productIds) => setForm((prev) => ({ ...prev, productIds }))}
                categories={categories}
                brands={brands}
                isAr={isAr}
                maxItems={200}
              />
            )}

            {form.targetMode === 'categories' && (
              <p className="mb-3 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-900">
                {isAr
                  ? '✓ الأفضل لآلاف المنتجات — اختر قسماً واحداً أو أكثر دون الحاجة لتحديد كل منتج.'
                  : '✓ Best for thousands of products — pick one or more categories without listing each item.'}
              </p>
            )}

            {form.targetMode === 'categories' && (
              <CategoryMultiBrowsePicker
                categories={categories}
                value={form.categoryIds}
                onChange={(categoryIds) => setForm((prev) => ({ ...prev, categoryIds }))}
                isAr={isAr}
                maxItems={48}
              />
            )}

            {form.targetMode === 'brands' && (
              <Input
                label={isAr ? 'ماركات (slug مفصولة بفاصلة)' : 'Brand slugs (comma-separated)'}
                value={(form.brandSlugs || []).join(', ')}
                onChange={(e) => setForm((prev) => ({
                  ...prev,
                  brandSlugs: e.target.value.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
                }))}
                placeholder="dettol, pepsi, nestle"
                dir="ltr"
              />
            )}

            {form.targetMode === 'all' && (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                {isAr ? '⚠️ سيطبّق على كل المنتجات النشطة في المتجر' : '⚠️ Applies to all active products in the store'}
              </p>
            )}
          </div>
        </PromotionFormSection>

        <PromotionFormSection
          step={5}
          title={isAr ? 'نص السلة والدفع' : 'Cart & checkout text'}
          hint={isAr ? 'اترك فارغاً للنص الافتراضي — أو خصّصه هنا' : 'Leave blank for defaults — or customize below'}
          optional
          isAr={isAr}
        >
          <button
            type="button"
            onClick={() => setShowCartCopy((v) => !v)}
            className="mb-3 flex w-full items-center justify-between rounded-xl border border-teal-200 bg-teal-50/50 px-4 py-2.5 text-xs font-semibold text-teal-900 hover:bg-teal-50"
          >
            {showCartCopy
              ? (isAr ? 'إخفاء محرر النص' : 'Hide text editor')
              : (isAr ? 'فتح محرر النص (اختياري)' : 'Open text editor (optional)')}
            {showCartCopy ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {showCartCopy && <CartOfferCopyEditor form={form} setForm={setForm} isAr={isAr} />}
          {!showCartCopy && (
            <p className="text-xs text-text-muted">
              {isAr
                ? '✓ النص الافتراضي يُنشأ تلقائياً حسب نوع العرض والكمية في السلة.'
                : '✓ Default copy is generated from offer type and cart quantity.'}
            </p>
          )}
        </PromotionFormSection>
      </div>

      {/* Sticky footer */}
      <div className="sticky bottom-0 -mx-5 border-t border-border bg-white px-5 py-4 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
        <label className="mb-3 flex cursor-pointer items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/80 px-3 py-2.5 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-emerald-400 text-emerald-600 focus:ring-emerald-200"
            checked={form.isActive}
            onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
          />
          <span className="font-medium text-emerald-950">
            {isAr ? 'تفعيل فوراً عند الحفظ' : 'Activate immediately on save'}
          </span>
        </label>
        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={saving || !form.nameAr?.trim()}
            className="flex-1 rounded-xl bg-orange-600 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-orange-700 disabled:opacity-50 sm:flex-none"
          >
            {saving
              ? (isAr ? 'جار الحفظ…' : 'Saving…')
              : (editId ? (isAr ? 'حفظ التعديلات' : 'Save changes') : (isAr ? 'إنشاء الحملة' : 'Create campaign'))}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-border px-5 py-3 text-sm font-semibold hover:bg-slate-50"
          >
            {isAr ? 'إلغاء' : 'Cancel'}
          </button>
        </div>
      </div>
    </form>
  );
}
