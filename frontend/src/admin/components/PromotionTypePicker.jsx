import {
  PROMOTION_TYPES,
  defaultBadgesForType,
  badgesForQtyPromoRules,
  isPromotionPickerSelected,
} from '../utils/promotionUtils';
import { buildSecondItemBadge } from '../../utils/promotionDisplay';

const ACCENT = {
  rose: {
    active: 'border-rose-400 bg-rose-50 ring-2 ring-rose-200',
    icon: 'bg-rose-100 text-rose-700',
  },
  blue: {
    active: 'border-blue-400 bg-blue-50 ring-2 ring-blue-200',
    icon: 'bg-blue-100 text-blue-700',
  },
  violet: {
    active: 'border-violet-400 bg-violet-50 ring-2 ring-violet-200',
    icon: 'bg-violet-100 text-violet-700',
  },
  amber: {
    active: 'border-amber-400 bg-amber-50 ring-2 ring-amber-200',
    icon: 'bg-amber-100 text-amber-700',
  },
};

export default function PromotionTypePicker({ formType, rules, onPick, isAr }) {
  const handlePick = (type) => {
    if (type.value === 'bogo') {
      const badges = badgesForQtyPromoRules(rules || {});
      onPick({
        type: badges.type || type.value,
        badgeAr: badges.badgeAr,
        badgeEn: badges.badgeEn,
      });
      return;
    }
    if (type.value === 'second_percent_off') {
      const pct = Math.max(1, Number(rules?.secondPercentOff) || 50);
      const unit = rules?.promotionUnit || 'pieces';
      onPick({
        type: type.value,
        badgeAr: buildSecondItemBadge(pct, true, unit),
        badgeEn: buildSecondItemBadge(pct, false, unit),
      });
      return;
    }
    const badges = defaultBadgesForType(type.value);
    onPick({
      type: type.value,
      badgeAr: badges.badgeAr,
      badgeEn: badges.badgeEn,
    });
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {PROMOTION_TYPES.map((type) => {
        const selected = isPromotionPickerSelected(formType, type.value);
        const accent = ACCENT[type.accent] || ACCENT.rose;
        return (
          <button
            key={type.value}
            type="button"
            onClick={() => handlePick(type)}
            className={`group rounded-2xl border p-4 text-start transition-colors ${
              selected ? accent.active : 'border-border bg-slate-50/50 hover:border-orange-200 hover:bg-white'
            }`}
          >
            <div className="flex items-start gap-3">
              <span
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg font-bold ${
                  selected ? accent.icon : 'bg-white text-slate-600 ring-1 ring-border'
                }`}
              >
                {type.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-text">{isAr ? type.labelAr : type.labelEn}</p>
                <p className="mt-1 text-[11px] leading-snug text-text-muted">
                  {isAr ? type.descAr : type.descEn}
                </p>
                <p className="mt-1.5 text-[10px] font-medium text-slate-500">
                  {isAr ? type.exampleAr : type.exampleEn}
                </p>
              </div>
              {selected && (
                <span className="shrink-0 rounded-full bg-orange-600 px-2 py-0.5 text-[9px] font-bold text-white">
                  ✓
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
