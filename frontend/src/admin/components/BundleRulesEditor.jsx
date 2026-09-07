import Input from '../../components/ui/Input';
import PromotionUnitPicker from './PromotionUnitPicker';
import { getPromoUnitMeta } from '../../utils/promotionDisplay';

export default function BundleRulesEditor({ form, setForm, isAr, showMinQty = true }) {
  const rules = form.rules || {};
  const unit = rules.promotionUnit || 'pieces';
  const unitMeta = getPromoUnitMeta(unit);
  const patchRules = (patch) => setForm((prev) => ({ ...prev, rules: { ...prev.rules, ...patch } }));

  const minLabel = unit === 'pieces'
    ? (isAr ? 'الحد الأدنى للكمية (قطع)' : 'Min quantity (pieces)')
    : (isAr ? `الحد الأدنى (${unitMeta.shortAr})` : `Min quantity (${unitMeta.shortEn})`);

  return (
    <div className="space-y-4 rounded-2xl border border-teal-200 bg-teal-50/40 p-4">
      <PromotionUnitPicker form={form} setForm={setForm} isAr={isAr} tone="teal" compact />

      <div className={`grid gap-4 ${showMinQty ? 'sm:grid-cols-2' : ''}`}>
        <Input
          label={isAr ? 'سعر الباقة (جنيه)' : 'Bundle price (EGP)'}
          type="number"
          min="0"
          value={rules.bundlePrice}
          onChange={(e) => patchRules({ bundlePrice: Number(e.target.value) })}
        />
        {showMinQty && (
          <Input
            label={minLabel}
            type="number"
            min="1"
            step={unit === 'pieces' ? '1' : '0.1'}
            value={rules.minPurchaseQty}
            onChange={(e) => patchRules({ minPurchaseQty: Number(e.target.value) })}
          />
        )}
      </div>

      <div className="rounded-xl border border-teal-200 bg-white px-3 py-3 text-xs text-teal-900">
        <p className="font-semibold">📦 {isAr ? 'باقة' : 'Bundle'}</p>
        <p className="mt-1 text-teal-800">
          {isAr
            ? `يُطبّق عند شراء ${rules.minPurchaseQty || 1} ${unitMeta.shortAr} أو أكثر`
            : `Applies when buying ${rules.minPurchaseQty || 1}+ ${unitMeta.shortEn}`}
        </p>
      </div>
    </div>
  );
}
