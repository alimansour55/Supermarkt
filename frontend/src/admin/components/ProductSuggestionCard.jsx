import { Check, Plus } from 'lucide-react';
import { pickProductImage } from '../../utils/imageHelpers';
import { productPickerLabel } from '../utils/productPickerUtils';

export default function ProductSuggestionCard({
  product,
  isAr,
  selected,
  disabled,
  onToggle,
  compact = false,
}) {
  const title = productPickerLabel(product, isAr).split(' · ')[0];
  const brand = product.brand;
  const image = pickProductImage(product);
  const price = Number(product.price ?? 0);
  const oldPrice = Number(product.oldPrice ?? 0);
  const discount = Number(product.discount ?? product.discountPercent ?? 0);

  return (
    <button
      type="button"
      onClick={() => onToggle(product)}
      disabled={disabled && !selected}
      className={[
        'flex w-full flex-col overflow-hidden rounded-xl border text-start transition-colors',
        selected
          ? 'border-orange-400 bg-orange-50 ring-2 ring-orange-200'
          : 'border-border bg-white hover:border-orange-300 hover:shadow-sm',
        disabled && !selected ? 'cursor-not-allowed opacity-50' : '',
      ].join(' ')}
    >
      <div className={`relative flex items-center justify-center bg-slate-50 ${compact ? 'h-16' : 'h-20'} p-2`}>
        {image ? (
          <img src={image} alt="" className="max-h-full max-w-full object-contain" loading="lazy" />
        ) : (
          <span className="text-2xl text-slate-300" aria-hidden>📦</span>
        )}
        {discount > 0 && (
          <span className="absolute start-1.5 top-1.5 rounded-md bg-red-600 px-1.5 py-0.5 text-[9px] font-bold text-white">
            −{discount}%
          </span>
        )}
        {selected ? (
          <span className="absolute end-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-orange-600 text-white">
            <Check className="h-3 w-3" strokeWidth={3} />
          </span>
        ) : (
          <span className="absolute end-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-white/90 text-orange-600 shadow-sm ring-1 ring-border">
            <Plus className="h-3 w-3" strokeWidth={2.5} />
          </span>
        )}
      </div>
      <div className={`space-y-0.5 ${compact ? 'p-1.5' : 'p-2'}`}>
        <p className={`line-clamp-2 font-semibold leading-tight text-text ${compact ? 'min-h-[1.75rem] text-[10px]' : 'min-h-[2rem] text-[11px]'}`}>
          {title}
        </p>
        {brand && (
          <p className="truncate text-[9px] text-text-muted">{brand}</p>
        )}
        <p className={`font-bold tabular-nums text-primary-700 ${compact ? 'text-[10px]' : 'text-[11px]'}`}>
          {price.toFixed(price % 1 ? 2 : 0)} EGP
          {oldPrice > price && (
            <span className="ms-1 font-normal text-text-muted line-through">{oldPrice.toFixed(0)}</span>
          )}
        </p>
      </div>
    </button>
  );
}
