import Input from '../../components/ui/Input';

const PERCENT_PRESETS = [10, 15, 20, 25, 30, 40, 50];
const AMOUNT_PRESETS = [5, 10, 15, 20, 25, 50, 100];

function PresetChips({ values, suffix = '', active, onSelect }) {
  return (
    <div className="flex flex-wrap gap-2">
      {values.map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onSelect(v)}
          className={`rounded-lg border px-3 py-1.5 text-xs font-bold tabular-nums transition-colors ${
            active === v
              ? 'border-orange-500 bg-orange-600 text-white'
              : 'border-border bg-white text-text hover:border-orange-300 hover:bg-orange-50'
          }`}
        >
          {v}{suffix}
        </button>
      ))}
    </div>
  );
}

export default function PromotionDiscountRules({ formType, rules, onPatch, isAr }) {
  if (formType === 'percent_off') {
    const pct = Math.max(1, Math.min(99, Number(rules.percent) || 15));
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-full max-w-[140px]">
            <Input
              label={isAr ? 'نسبة الخصم' : 'Discount %'}
              type="number"
              min="1"
              max="99"
              value={pct}
              onChange={(e) => onPatch({ percent: Number(e.target.value) })}
              inputClassName="text-center text-lg font-bold tabular-nums"
            />
          </div>
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-rose-700">
              {isAr ? 'معاينة' : 'Preview'}
            </p>
            <p className="mt-0.5 text-sm font-bold text-rose-950">
              {isAr ? `خصم ${pct}% على السعر` : `${pct}% off the price`}
            </p>
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold text-text-muted">
            {isAr ? 'اختيار سريع' : 'Quick pick'}
          </p>
          <PresetChips
            values={PERCENT_PRESETS}
            suffix="%"
            active={PERCENT_PRESETS.includes(pct) ? pct : null}
            onSelect={(v) => onPatch({ percent: v })}
            isAr={isAr}
          />
        </div>
      </div>
    );
  }

  if (formType === 'amount_off') {
    const amount = Math.max(0, Number(rules.amountOff) || 0);
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-full max-w-[160px]">
            <Input
              label={isAr ? 'مبلغ الخصم (جنيه)' : 'Amount off (EGP)'}
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => onPatch({ amountOff: Number(e.target.value) })}
              inputClassName="text-center text-lg font-bold tabular-nums"
            />
          </div>
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-700">
              {isAr ? 'معاينة' : 'Preview'}
            </p>
            <p className="mt-0.5 text-sm font-bold text-blue-950">
              {isAr ? `−${amount} EGP من السعر` : `−${amount} EGP from price`}
            </p>
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold text-text-muted">
            {isAr ? 'اختيار سريع' : 'Quick pick'}
          </p>
          <PresetChips
            values={AMOUNT_PRESETS}
            suffix={isAr ? ' ج' : ' EGP'}
            active={AMOUNT_PRESETS.includes(amount) ? amount : null}
            onSelect={(v) => onPatch({ amountOff: v })}
            isAr={isAr}
          />
        </div>
      </div>
    );
  }

  return null;
}
