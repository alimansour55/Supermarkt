import { PROMOTION_UNIT_MODES } from '../../utils/promotionDisplay';

const TONE_STYLES = {
  violet: {
    active: 'border-violet-500 bg-violet-600 text-white shadow-sm',
    idle: 'border-border bg-white hover:border-violet-300',
    box: 'border-violet-200 bg-violet-50/40',
  },
  amber: {
    active: 'border-amber-500 bg-amber-600 text-white shadow-sm',
    idle: 'border-border bg-white hover:border-amber-300',
    box: 'border-amber-200 bg-amber-50/40',
  },
  teal: {
    active: 'border-teal-500 bg-teal-600 text-white shadow-sm',
    idle: 'border-border bg-white hover:border-teal-300',
    box: 'border-teal-200 bg-teal-50/40',
  },
  orange: {
    active: 'border-orange-500 bg-orange-600 text-white shadow-sm',
    idle: 'border-border bg-white hover:border-orange-300',
    box: 'border-orange-200 bg-orange-50/40',
  },
};

export default function PromotionUnitPicker({
  form,
  setForm,
  isAr,
  tone = 'violet',
  onUnitChange,
  compact = false,
}) {
  const rules = form?.rules || {};
  const unit = rules.promotionUnit || 'pieces';
  const styles = TONE_STYLES[tone] || TONE_STYLES.violet;

  const selectUnit = (value) => {
    if (onUnitChange) {
      onUnitChange(value);
      return;
    }
    setForm((prev) => ({
      ...prev,
      rules: { ...prev.rules, promotionUnit: value },
    }));
  };

  return (
    <div className={compact ? '' : `rounded-2xl border ${styles.box} p-4`}>
      <div>
        <p className={`font-bold text-text ${compact ? 'text-xs' : 'text-sm'}`}>
          {isAr ? 'نوع الكمية' : 'Quantity type'}
        </p>
        <p className={`mt-0.5 text-text-muted ${compact ? 'text-[10px]' : 'text-xs'}`}>
          {isAr
            ? 'مثال: صابون سائل = لتر · لبن = لتر · عبوات = قطع'
            : 'e.g. liquid soap = liters · milk = L · packs = pieces'}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {PROMOTION_UNIT_MODES.map((mode) => (
            <button
              key={mode.value}
              type="button"
              onClick={() => selectUnit(mode.value)}
              className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                unit === mode.value ? styles.active : styles.idle
              }`}
            >
              {isAr ? mode.labelAr : mode.labelEn}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export { PROMOTION_UNIT_MODES };
