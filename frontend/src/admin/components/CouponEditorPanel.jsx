import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Ticket, Users } from 'lucide-react';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import PromotionFormSection from './PromotionFormSection';
import {
  buildCouponLabelAr,
  buildCouponLabelEn,
  formatCouponDiscount,
  formatMinSubtotal,
  labelsMatchSuggestion,
  labelsMismatchDiscount,
  parseDiscountFromCode,
} from '../utils/couponHelpers';

const SELECT_CLASS =
  'w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-text transition-colors focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-200';

export default function CouponEditorPanel({
  form,
  setForm,
  onSubmit,
  onCancel,
  saving,
  isAr,
  isEdit,
}) {
  const [labelsEdited, setLabelsEdited] = useState(isEdit);
  const [usageUnlimited, setUsageUnlimited] = useState(() => form.usageLimit === '' || form.usageLimit == null);
  const initialized = useRef(false);

  const preview = {
    discountType: form.discountType,
    discountValue: Number(form.discountValue) || 0,
    minSubtotal: Number(form.minSubtotal) || 0,
  };

  const suggestedAr = buildCouponLabelAr(form.discountType, form.discountValue);
  const suggestedEn = buildCouponLabelEn(form.discountType, form.discountValue);
  const labelMismatch = labelsMismatchDiscount(
    form.labelAr,
    form.labelEn,
    form.discountType,
    form.discountValue,
  );

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    if (isEdit) return;
    setForm((prev) => ({
      ...prev,
      labelAr: buildCouponLabelAr(prev.discountType, prev.discountValue),
      labelEn: buildCouponLabelEn(prev.discountType, prev.discountValue),
    }));
  }, [isEdit, setForm]);

  const syncLabelsIfNeeded = (nextType, nextValue) => {
    if (labelsEdited) return {};
    return {
      labelAr: buildCouponLabelAr(nextType, nextValue),
      labelEn: buildCouponLabelEn(nextType, nextValue),
    };
  };

  const patchForm = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  const handleCodeChange = (raw) => {
    const code = raw.toUpperCase();
    const patch = { code };
    if (!isEdit && form.discountType === 'percent') {
      const fromCode = parseDiscountFromCode(code);
      if (fromCode != null && fromCode > 0 && fromCode <= 100) {
        patch.discountValue = fromCode;
        Object.assign(patch, syncLabelsIfNeeded('percent', fromCode));
      }
    }
    patchForm(patch);
  };

  const handleDiscountTypeChange = (discountType) => {
    const nextValue = discountType === 'free_delivery' ? 0 : form.discountValue;
    patchForm({
      discountType,
      discountValue: nextValue,
      ...syncLabelsIfNeeded(discountType, nextValue),
    });
  };

  const handleDiscountValueChange = (discountValue) => {
    patchForm({
      discountValue,
      ...syncLabelsIfNeeded(form.discountType, discountValue),
    });
  };

  const handleLabelArChange = (labelAr) => {
    setLabelsEdited(true);
    patchForm({ labelAr });
  };

  const handleLabelEnChange = (labelEn) => {
    setLabelsEdited(true);
    patchForm({ labelEn });
  };

  const applySuggestedLabels = () => {
    setLabelsEdited(false);
    patchForm({ labelAr: suggestedAr, labelEn: suggestedEn });
  };

  const handleUsageUnlimitedChange = (checked) => {
    setUsageUnlimited(checked);
    patchForm({ usageLimit: checked ? '' : (form.usageLimit || '100') });
  };

  const showLabelSyncHint = !labelsEdited && labelsMatchSuggestion(form.labelAr, form.labelEn, form.discountType, form.discountValue);

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {/* Live preview — what the customer sees at checkout */}
      <div className="rounded-2xl border border-primary-200 bg-gradient-to-br from-primary-50 to-violet-50/60 p-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-primary-800/80">
          {isAr ? 'ما يراه العميل' : 'What customers see'}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-primary-200 bg-white px-3 py-1.5 font-mono text-sm font-bold tracking-wide text-primary-800">
            <Ticket className="h-3.5 w-3.5 shrink-0 text-primary-600" aria-hidden />
            {form.code || 'CODE'}
          </span>
          <span className="rounded-lg bg-primary-600 px-2.5 py-1 text-sm font-bold text-white">
            {formatCouponDiscount(preview, isAr)}
          </span>
        </div>
        {(form.labelAr || form.labelEn) && (
          <p className="mt-2 text-sm text-text">
            {isAr ? (form.labelAr || form.labelEn) : (form.labelEn || form.labelAr)}
          </p>
        )}
        <p className="mt-1 text-xs text-text-muted">
          {formatMinSubtotal(preview.minSubtotal, isAr)}
        </p>
      </div>

      <PromotionFormSection
        step={1}
        title={isAr ? 'تفاصيل الكود' : 'Code details'}
        hint={isAr ? 'الكود يظهر للعميل عند الدفع' : 'Shown to customers at checkout'}
        isAr={isAr}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label={isAr ? 'كود الخصم' : 'Coupon code'}
            value={form.code}
            onChange={(e) => handleCodeChange(e.target.value)}
            required
            disabled={isEdit}
            placeholder="SAVE20"
            className="font-mono uppercase"
          />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text">
              {isAr ? 'نوع الخصم' : 'Discount type'}
            </label>
            <select
              className={SELECT_CLASS}
              value={form.discountType}
              onChange={(e) => handleDiscountTypeChange(e.target.value)}
            >
              <option value="percent">{isAr ? 'نسبة مئوية %' : 'Percentage %'}</option>
              <option value="fixed">{isAr ? 'مبلغ ثابت (ج.م)' : 'Fixed amount (EGP)'}</option>
              <option value="free_delivery">{isAr ? 'توصيل مجاني' : 'Free delivery'}</option>
            </select>
          </div>
          {form.discountType !== 'free_delivery' && (
            <Input
              label={form.discountType === 'percent'
                ? (isAr ? 'نسبة الخصم' : 'Discount percent')
                : (isAr ? 'قيمة الخصم (ج.م)' : 'Discount amount (EGP)')}
              type="number"
              min="0"
              max={form.discountType === 'percent' ? 100 : undefined}
              step={form.discountType === 'percent' ? 1 : 0.01}
              value={form.discountValue}
              onChange={(e) => handleDiscountValueChange(e.target.value)}
              required
              placeholder={form.discountType === 'percent' ? '20' : '50'}
            />
          )}
          <Input
            label={isAr ? 'حد أدنى للطلب (ج.م)' : 'Minimum order (EGP)'}
            type="number"
            min="0"
            step="0.01"
            value={form.minSubtotal}
            onChange={(e) => patchForm({ minSubtotal: e.target.value })}
            placeholder="0"
          />
        </div>
        {!isEdit && (
          <p className="mt-3 text-[11px] text-text-muted">
            {isAr
              ? 'الأرقام في نهاية الكود (مثل SAVE20) تقترح نسبة الخصم والوصف تلقائياً'
              : 'Trailing digits in the code (e.g. SAVE20) auto-suggest the discount and labels'}
          </p>
        )}
      </PromotionFormSection>

      <PromotionFormSection
        step={2}
        title={isAr ? 'العرض للعميل' : 'Customer-facing copy'}
        hint={isAr ? 'يظهر في السلة وعند تطبيق الكوبون' : 'Shown in cart and when the coupon is applied'}
        isAr={isAr}
      >
        <div className="space-y-3">
          {labelMismatch && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <div>
                <p className="font-medium">
                  {isAr ? 'الوصف لا يطابق نسبة الخصم' : 'Description does not match the discount'}
                </p>
                <p className="mt-0.5 text-xs text-amber-800/90">
                  {isAr
                    ? `الخصم المُعدّ ${form.discountValue}% لكن الوصف يذكر نسبة مختلفة.`
                    : `Discount is set to ${form.discountValue}% but the label mentions a different value.`}
                </p>
                <button
                  type="button"
                  onClick={applySuggestedLabels}
                  className="mt-1.5 text-xs font-semibold text-amber-900 underline underline-offset-2 hover:text-amber-950"
                >
                  {isAr ? `استخدم "${suggestedAr}"` : `Use "${suggestedEn}"`}
                </button>
              </div>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label={isAr ? 'الوصف (عربي)' : 'Label (Arabic)'}
              value={form.labelAr}
              onChange={(e) => handleLabelArChange(e.target.value)}
              placeholder={suggestedAr}
            />
            <Input
              label={isAr ? 'الوصف (إنجليزي)' : 'Label (English)'}
              value={form.labelEn}
              onChange={(e) => handleLabelEnChange(e.target.value)}
              placeholder={suggestedEn}
            />
          </div>
          {showLabelSyncHint && !labelMismatch && (
            <p className="text-[11px] text-text-muted">
              {isAr
                ? 'يتم تحديث الوصف تلقائياً عند تغيير الخصم'
                : 'Labels update automatically when you change the discount'}
            </p>
          )}
          {labelsEdited && (
            <button
              type="button"
              onClick={applySuggestedLabels}
              className="text-xs font-semibold text-primary-700 hover:text-primary-900"
            >
              {isAr ? 'إعادة المزامنة مع الخصم' : 'Re-sync labels with discount'}
            </button>
          )}
        </div>
      </PromotionFormSection>

      <PromotionFormSection
        step={3}
        title={isAr ? 'الصلاحية والحدود' : 'Validity & limits'}
        isAr={isAr}
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label={isAr ? 'تاريخ الانتهاء' : 'Expiry date'}
              type="date"
              value={form.expiryDate}
              onChange={(e) => patchForm({ expiryDate: e.target.value })}
              required
            />
            <div className="space-y-2">
              <span className="block text-sm font-medium text-text">
                {isAr ? 'حد الاستخدام' : 'Usage limit'}
              </span>
              <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-border bg-slate-50 px-3 py-2.5 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border text-primary-600 focus:ring-primary-500"
                  checked={usageUnlimited}
                  onChange={(e) => handleUsageUnlimitedChange(e.target.checked)}
                />
                <span className="flex items-center gap-1.5 font-medium text-text">
                  <Users className="h-3.5 w-3.5 text-text-muted" aria-hidden />
                  {isAr ? 'استخدام غير محدود' : 'Unlimited redemptions'}
                </span>
              </label>
              {!usageUnlimited && (
                <Input
                  type="number"
                  min="1"
                  value={form.usageLimit}
                  onChange={(e) => patchForm({ usageLimit: e.target.value })}
                  placeholder={isAr ? 'مثال: 100' : 'e.g. 100'}
                  required
                />
              )}
            </div>
          </div>
          <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/60 px-3 py-2.5 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-border text-emerald-600 focus:ring-emerald-500"
              checked={form.isActive}
              onChange={(e) => patchForm({ isActive: e.target.checked })}
            />
            <span className="font-medium text-emerald-900">
              {isAr ? 'الكوبون نشط ومتاح للاستخدام' : 'Coupon is active and redeemable'}
            </span>
          </label>
        </div>
      </PromotionFormSection>

      <div className="flex flex-wrap gap-3 border-t border-border pt-4">
        <Button type="submit" disabled={saving}>
          {saving ? (isAr ? 'جاري الحفظ…' : 'Saving…') : (isAr ? 'حفظ الكوبون' : 'Save coupon')}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          {isAr ? 'إلغاء' : 'Cancel'}
        </Button>
      </div>
    </form>
  );
}
