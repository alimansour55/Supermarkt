import { memo, useMemo } from 'react';
import Textarea from '../../components/ui/Textarea';
import {
  CART_PROMO_VARIABLES,
  getCartPromoSuggestions,
  previewCartCopyTemplates,
  suggestedCartCopyFields,
  resolveSecondItemCartCopy,
} from '../../utils/cartPromoCopy';
import { isQtyPromoType } from '../../utils/promotionDisplay';

function CartOfferCopyEditor({ form, setForm, isAr }) {
  const type = form.type || 'percent_off';
  const rules = form.rules || {};
  const unit = rules.promotionUnit || 'pieces';
  const buy = Math.max(1, Number(rules.buyQty) || 1);
  const get = Math.max(1, Number(rules.getQty) || 1);
  const isQty = isQtyPromoType(type);
  const isSecondOff = type === 'second_percent_off';
  const secondOff = Math.max(1, Number(rules.secondPercentOff) || 50);

  const suggestions = useMemo(
    () => getCartPromoSuggestions({ type, unit, buy, get, secondOff, isAr }),
    [type, unit, buy, get, secondOff, isAr],
  );

  const preview = useMemo(
    () => (isQty ? previewCartCopyTemplates(form, isAr) : null),
    [isQty, form, isAr],
  );

  const secondPreview = useMemo(() => {
    if (!isSecondOff) return null;
    const itemBase = {
      offerBadgeAr: form.badgeAr,
      offerBadgeEn: form.badgeEn,
      price: 35,
      promotionUnit: unit,
    };
    return {
      earned: resolveSecondItemCartCopy({
        ...itemBase,
        promotionCartLineAr: form.cartLineAr,
        promotionCartLineEn: form.cartLineEn,
      }, secondOff, 2, isAr),
      earnedFour: resolveSecondItemCartCopy({
        ...itemBase,
        promotionCartLineAr: form.cartLineAr,
        promotionCartLineEn: form.cartLineEn,
      }, secondOff, 4, isAr),
      progress: resolveSecondItemCartCopy({
        ...itemBase,
        promotionCartProgressAr: form.cartProgressAr,
        promotionCartProgressEn: form.cartProgressEn,
      }, secondOff, 1, isAr),
    };
  }, [
    isSecondOff,
    form.badgeAr,
    form.badgeEn,
    form.cartLineAr,
    form.cartLineEn,
    form.cartProgressAr,
    form.cartProgressEn,
    secondOff,
    unit,
    isAr,
  ]);

  const patch = (fields) => setForm((prev) => ({ ...prev, ...fields }));

  const applySuggestion = (suggestion) => {
    const field = suggestion.field || 'line';
    const keys = {
      line: { ar: 'cartLineAr', en: 'cartLineEn' },
      progress: { ar: 'cartProgressAr', en: 'cartProgressEn' },
      subtext: { ar: 'cartSubtextAr', en: 'cartSubtextEn' },
    }[field];
    const enSuggestion = getCartPromoSuggestions({ type, unit, buy, get, secondOff, isAr: false })
      .find((s) => s.id === suggestion.id);
    patch({
      [keys.ar]: suggestion.line,
      ...(enSuggestion ? { [keys.en]: enSuggestion.line } : {}),
    });
  };

  const fillSuggested = () => {
    patch(suggestedCartCopyFields(form, isAr));
  };

  return (
    <div className="space-y-4 rounded-2xl border border-teal-200 bg-teal-50/30 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-text">
            {isAr ? 'نص السلة والدفع' : 'Cart & checkout text'}
          </p>
          <p className="mt-0.5 text-xs text-text-muted">
            {isAr
              ? 'يظهر في السلة وصفحة الدفع. اترك فارغاً لاستخدام الملخص الافتراضي.'
              : 'Shown in cart drawer and checkout. Leave blank for default summary.'}
          </p>
        </div>
        <button
          type="button"
          onClick={fillSuggested}
          className="rounded-lg border border-teal-300 bg-white px-3 py-1.5 text-xs font-semibold text-teal-800 hover:bg-teal-50"
        >
          {isAr ? '↺ اقتراح افتراضي' : '↺ Use defaults'}
        </button>
      </div>

      <div className="rounded-xl border border-teal-100 bg-white p-3">
        <p className="text-[11px] font-bold text-teal-900">
          {isAr ? 'متغيّرات (ضعها بين { } )' : 'Variables (wrap in { })'}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {CART_PROMO_VARIABLES.map((v) => (
            <span
              key={v.key}
              className="rounded-md bg-teal-100 px-2 py-0.5 font-mono text-[10px] text-teal-900"
              title={isAr ? v.labelAr : v.labelEn}
            >
              {'{'}
              {v.key}
              {'}'}
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-text-muted">
          {isAr ? 'اقتراحات جاهزة' : 'Quick suggestions'}
        </p>
        <div className="flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => applySuggestion(s)}
              className="rounded-lg border border-border bg-white px-2.5 py-1.5 text-left text-[11px] font-medium hover:border-teal-300 hover:bg-teal-50"
            >
              <span className="block font-bold text-teal-900">{s.label}</span>
              <span className="mt-0.5 block text-text-muted">{s.line}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Textarea
          label={isAr ? 'سطر السلة — عند اكتمال العرض (عربي)' : 'Cart line — deal earned (Arabic)'}
          rows={2}
          value={form.cartLineAr || ''}
          onChange={(e) => patch({ cartLineAr: e.target.value })}
          placeholder={isAr ? '{paid} + {free} هدية = {total} ل' : '{paid} + {free} free = {total}'}
        />
        <Textarea
          label={isAr ? 'سطر السلة — عند اكتمال العرض (EN)' : 'Cart line — deal earned (English)'}
          rows={2}
          value={form.cartLineEn || ''}
          onChange={(e) => patch({ cartLineEn: e.target.value })}
          placeholder="Bought {paid} {unit}, got {free} free = {total} {unit}"
        />
      </div>

      {(isQty || isSecondOff) && (
        <div className="grid gap-4 md:grid-cols-2">
          <Textarea
            label={isSecondOff
              ? (isAr ? 'سطر السلة — قطعة واحدة (عربي)' : 'Cart line — 1 item (Arabic)')
              : (isAr ? 'سطر السلة — قبل اكتمال العرض (عربي)' : 'Cart line — not enough yet (Arabic)')}
            rows={2}
            value={form.cartProgressAr || ''}
            onChange={(e) => patch({ cartProgressAr: e.target.value })}
            placeholder={isSecondOff
              ? (isAr ? 'أضف قطعة أخرى — الثانية بخصم {secondOff}%' : 'Add one more — 2nd item {secondOff}% off')
              : (isAr ? 'عرض {badge} — أضف {need} {unit} للحصول على {get} مجاناً' : '')}
          />
          <Textarea
            label={isSecondOff
              ? (isAr ? 'سطر السلة — قطعة واحدة (EN)' : 'Cart line — 1 item (English)')
              : (isAr ? 'سطر السلة — قبل اكتمال العرض (EN)' : 'Cart line — not enough yet (English)')}
            rows={2}
            value={form.cartProgressEn || ''}
            onChange={(e) => patch({ cartProgressEn: e.target.value })}
          />
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Textarea
          label={isAr ? 'سطر توضيحي اختياري (عربي)' : 'Optional subtext (Arabic)'}
          rows={2}
          value={form.cartSubtextAr ?? ''}
          onChange={(e) => patch({ cartSubtextAr: e.target.value })}
          placeholder={isAr ? 'اتركه فارغاً لإخفاء السطر الثاني' : 'Leave empty to hide second line'}
        />
        <Textarea
          label={isAr ? 'سطر توضيحي اختياري (EN)' : 'Optional subtext (English)'}
          rows={2}
          value={form.cartSubtextEn ?? ''}
          onChange={(e) => patch({ cartSubtextEn: e.target.value })}
        />
      </div>

      {(preview || secondPreview) && (
        <div className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-3 text-xs">
          <p className="font-bold text-violet-900">{isAr ? 'معاينة في السلة' : 'Cart preview'}</p>
          {preview && (
            <>
              <p className="mt-2 font-semibold text-violet-950">
                🎁 {isAr ? 'عند اكتمال العرض:' : 'When deal earned:'} {preview.earned}
              </p>
              <p className="mt-1 font-semibold text-violet-900">
                {isAr ? 'قبل الاكتمال (مثال كمية 1):' : 'Before complete (qty 1):'} {preview.progress}
              </p>
              {preview.subtext && (
                <p className="mt-1 text-violet-700">{preview.subtext}</p>
              )}
            </>
          )}
          {secondPreview && (
            <>
              <p className="mt-2 font-semibold text-amber-950">
                2️⃣ {isAr ? 'قطعتان في السلة:' : '2 items in cart:'} {secondPreview.earned}
              </p>
              <p className="mt-1 font-semibold text-amber-900">
                {isAr ? '4 قطع (مثال):' : '4 items (example):'} {secondPreview.earnedFour}
              </p>
              <p className="mt-1 font-semibold text-amber-900">
                {isAr ? 'قطعة واحدة:' : '1 item:'} {secondPreview.progress}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default memo(CartOfferCopyEditor);
