import Input from '../../components/ui/Input';
import PromotionUnitPicker from './PromotionUnitPicker';
import { buildSecondItemBadge, buildSecondItemSubtitle, getPromoUnitMeta } from '../../utils/promotionDisplay';

export default function SecondItemRulesEditor({ form, setForm, isAr }) {
  const rules = form.rules || {};
  const unit = rules.promotionUnit || 'pieces';
  const unitMeta = getPromoUnitMeta(unit);
  const pct = Math.max(1, Math.min(100, Number(rules.secondPercentOff) || 50));

  const patch = (fields) => setForm((prev) => ({ ...prev, ...fields }));

  const updatePercent = (secondPercentOff) => {
    const nextPct = Math.max(1, Math.min(100, secondPercentOff));
    patch({
      rules: { ...form.rules, secondPercentOff: nextPct },
      badgeAr: buildSecondItemBadge(nextPct, true, unit),
      badgeEn: buildSecondItemBadge(nextPct, false, unit),
    });
  };

  const onUnitChange = (value) => {
    patch({
      rules: { ...form.rules, promotionUnit: value },
      badgeAr: buildSecondItemBadge(pct, true, value),
      badgeEn: buildSecondItemBadge(pct, false, value),
    });
  };

  return (
    <div className="space-y-4 rounded-2xl border border-amber-200 bg-amber-50/40 p-4">
      <PromotionUnitPicker
        form={form}
        setForm={setForm}
        isAr={isAr}
        tone="amber"
        compact
        onUnitChange={onUnitChange}
      />

      <Input
        label={isAr ? 'خصم القطعة الثانية %' : 'Second item discount %'}
        type="number"
        min="1"
        max="100"
        value={rules.secondPercentOff}
        onChange={(e) => updatePercent(Number(e.target.value) || 50)}
      />

      <div className="rounded-xl border border-amber-200 bg-white px-3 py-3">
        <p className="text-xs font-semibold text-amber-900">
          {isAr ? 'معاينة الشارة' : 'Badge preview'}
        </p>
        <p className="mt-1 text-lg font-black text-amber-950">
          2️⃣ {buildSecondItemBadge(pct, isAr, unit)}
        </p>
        <p className="mt-0.5 text-xs text-amber-800">
          {buildSecondItemSubtitle(pct, unit, isAr)}
        </p>
        {unit !== 'pieces' && (
          <p className="mt-1 text-[10px] text-amber-700">
            {isAr ? `الوحدة: ${unitMeta.labelAr}` : `Unit: ${unitMeta.labelEn}`}
          </p>
        )}
      </div>
    </div>
  );
}
