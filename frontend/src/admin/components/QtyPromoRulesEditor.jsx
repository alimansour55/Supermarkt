import Input from '../../components/ui/Input';
import PromotionUnitPicker from './PromotionUnitPicker';
import {
  QTY_PROMO_PRESETS,
  badgesForQtyPromoRules,
  buildQtyPromoBadge,
  buildQtyPromoSubtitle,
  getPromoUnitMeta,
} from '../../utils/promotionDisplay';

export default function QtyPromoRulesEditor({ form, setForm, isAr }) {
  const rules = form.rules || {};
  const unit = rules.promotionUnit || 'pieces';
  const unitMeta = getPromoUnitMeta(unit);
  const buy = Math.max(1, Number(rules.buyQty) || 1);
  const get = Math.max(1, Number(rules.getQty) || 1);

  const applyPatch = (patch) => {
    setForm((prev) => {
      const nextRules = { ...prev.rules, ...patch, sameProduct: true };
      const badges = badgesForQtyPromoRules(nextRules);
      return {
        ...prev,
        type: badges.type,
        badgeAr: badges.badgeAr,
        badgeEn: badges.badgeEn,
        rules: nextRules,
      };
    });
  };

  const applyPreset = (preset) => {
    applyPatch({ buyQty: preset.buy, getQty: preset.get, promotionUnit: unit });
  };

  const previewBadge = buildQtyPromoBadge(buy, get, unit, isAr);
  const previewSub = buildQtyPromoSubtitle(buy, get, unit, isAr);

  return (
    <div className="space-y-5 rounded-2xl border border-violet-200 bg-violet-50/30 p-4">
      <PromotionUnitPicker
        form={form}
        setForm={setForm}
        isAr={isAr}
        tone="violet"
        compact
        onUnitChange={(value) => applyPatch({ promotionUnit: value })}
      />

      <div>
        <p className="text-sm font-bold text-text">
          {isAr ? 'اختر العرض 🎁' : 'Pick deal 🎁'}
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {QTY_PROMO_PRESETS.map((preset) => {
            const active = buy === preset.buy && get === preset.get;
            const label = buildQtyPromoBadge(preset.buy, preset.get, unit, isAr);
            return (
              <button
                key={`${preset.buy}+${preset.get}`}
                type="button"
                onClick={() => applyPreset(preset)}
                className={`rounded-xl border px-2 py-2.5 text-center transition-colors ${
                  active
                    ? 'border-violet-500 bg-violet-600 text-white shadow-md ring-2 ring-violet-200'
                    : 'border-border bg-white hover:border-violet-300 hover:bg-violet-50'
                }`}
              >
                <span className="block text-base">🎁</span>
                <span className="mt-0.5 block text-[11px] font-bold leading-tight">{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label={isAr ? unitMeta.buyLabelAr : unitMeta.buyLabelEn}
          type="number"
          min="1"
          step={unit === 'pieces' ? '1' : '0.1'}
          value={rules.buyQty}
          onChange={(e) => applyPatch({ buyQty: Number(e.target.value) })}
        />
        <Input
          label={isAr ? unitMeta.getLabelAr : unitMeta.getLabelEn}
          type="number"
          min="1"
          step={unit === 'pieces' ? '1' : '0.1'}
          value={rules.getQty}
          onChange={(e) => applyPatch({ getQty: Number(e.target.value) })}
        />
      </div>

      <div className="rounded-xl border border-violet-200 bg-white px-3 py-3">
        <p className="text-xs font-semibold text-violet-800">
          {isAr ? 'معاينة الشارة على البطاقة' : 'Badge on product card'}
        </p>
        <p className="mt-1 text-lg font-black text-violet-900">{previewBadge}</p>
        <p className="mt-0.5 text-xs text-violet-700">{previewSub}</p>
        <p className="mt-2 text-[10px] text-violet-600">
          {isAr ? '↪ نص السلة يُعدّل في قسم «نص السلة والدفع» أدناه.' : '↪ Cart line text is configured in “Cart & checkout text” below.'}
        </p>
      </div>
    </div>
  );
}

export { badgesForQtyPromoRules } from '../../utils/promotionDisplay';
