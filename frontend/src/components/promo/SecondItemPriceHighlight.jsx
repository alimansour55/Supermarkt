import { formatPrice } from '../../utils/formatters';
import { getSecondItemPriceInfo, getSecondItemUnitLabels } from '../../utils/promotionDisplay';

export default function SecondItemPriceHighlight({
  item,
  isAr = true,
  compact = false,
  className = '',
  showFirst = true,
}) {
  const info = getSecondItemPriceInfo(item);
  if (!info) return null;

  const { firstPrice, secondPrice, percent } = info;
  const unit = item?.promotionUnit || 'pieces';
  const labels = getSecondItemUnitLabels(unit, isAr);

  return (
    <div
      className={`inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5 rounded-lg border border-amber-200 bg-amber-50 font-semibold text-amber-950 ${
        compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'
      } ${className}`}
    >
      {showFirst && (
        <>
          <span>
            <span className="font-medium text-amber-800/75">{labels.first}:</span>
            {' '}
            <span className="tabular-nums">{formatPrice(firstPrice)}</span>
          </span>
          <span className="text-amber-300" aria-hidden>·</span>
        </>
      )}
      <span>
        <span className="font-medium text-amber-800/75">{labels.second}:</span>
        {' '}
        <span className="font-bold tabular-nums text-amber-700">{formatPrice(secondPrice)}</span>
      </span>
      <span className="rounded bg-amber-100 px-1 py-0.5 text-[9px] font-bold text-amber-900">
        −{percent}%
      </span>
    </div>
  );
}
