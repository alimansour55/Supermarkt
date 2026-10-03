import { memo } from 'react';
import { Link } from 'react-router-dom';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { formatPrice } from '../../utils/formatters';
import { calculatePromotedLineTotal } from '../../utils/cartLinePricing';
import { isSecondItemPromo } from '../../utils/promotionDisplay';
import { pickProductImage } from '../../utils/imageHelpers';
import ProductImage from '../ui/ProductImage';
import CartPromoLine from './CartPromoLine';

function CartItemRow({ item, onUpdateQuantity, onRemove, compact = false, bare = false }) {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const name = isAr ? item.name : item.nameEn || item.name;
  const maxStock = item.availableStock;
  const atMaxStock = maxStock != null && item.quantity >= maxStock;
  const lineTotal = calculatePromotedLineTotal(item);
  const variantLabel = isAr ? item.variantLabelAr : item.variantLabelEn;
  const cartKey = item.cartKey || item.productId;
  const showUnitPrice = !isSecondItemPromo(item) && item.quantity > 1;

  const imageSize = compact ? 'h-[76px] w-[76px]' : 'h-[88px] w-[88px] sm:h-28 sm:w-28';
  const cardPad = compact ? 'p-3' : 'p-4 sm:p-5';
  const nameSize = compact ? 'text-sm' : 'text-[15px] sm:text-base';
  const stepperBtn = compact ? 'h-7 w-7' : 'h-8 w-8';
  const stepperIcon = compact ? 'h-3 w-3' : 'h-3.5 w-3.5';
  const priceSize = compact ? 'text-sm' : 'text-base sm:text-lg';

  const Wrapper = bare ? 'div' : 'article';
  const wrapperClass = bare
    ? ''
    : 'rounded-2xl bg-white shadow-sm ring-1 ring-slate-100 transition-shadow hover:shadow-md';

  return (
    <Wrapper className={wrapperClass}>
      <div className={`flex gap-3.5 sm:gap-4 ${cardPad}`}>
        <Link
          to={`/products/${item.slug || item.productId}`}
          className={`relative block shrink-0 overflow-hidden rounded-2xl bg-slate-50 ring-1 ring-slate-100 ${imageSize}`}
        >
          <ProductImage
            src={pickProductImage(item)}
            alt={name}
            className="h-full w-full"
            imgClassName="h-full w-full object-contain p-2.5"
            placeholderClassName="scale-75"
          />
        </Link>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-start justify-between gap-3">
            <Link
              to={`/products/${item.slug || item.productId}`}
              className={`line-clamp-2 font-bold leading-snug text-slate-900 hover:text-primary-700 ${nameSize}`}
            >
              {name}
            </Link>
            <div className="shrink-0 text-end">
              {showUnitPrice && (
                <p className="text-[11px] leading-none text-slate-400 tabular-nums">
                  {formatPrice(item.price)}
                  <span className="mx-0.5">×</span>
                  {item.quantity}
                </p>
              )}
              <p className={`font-extrabold leading-tight tabular-nums text-slate-900 ${priceSize} ${showUnitPrice ? 'mt-0.5' : ''}`}>
                {formatPrice(lineTotal)}
              </p>
            </div>
          </div>

          {(variantLabel || item.sku) && (
            <p className="mt-0.5 truncate text-[11px] text-slate-400">
              {[variantLabel, item.sku ? `SKU ${item.sku}` : null].filter(Boolean).join(' · ')}
            </p>
          )}

          <CartPromoLine item={item} isAr={isAr} compact={compact} />

          <div className="mt-auto flex items-center justify-between gap-2 pt-2.5">
            <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-white p-0.5">
              <button
                type="button"
                onClick={() => onUpdateQuantity(cartKey, item.quantity - 1)}
                className={`flex items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-primary-700 active:scale-95 ${stepperBtn}`}
                aria-label={isAr ? 'تقليل' : 'Decrease'}
              >
                <Minus className={stepperIcon} />
              </button>
              <span className="min-w-[1.75rem] text-center text-sm font-bold tabular-nums text-slate-900">
                {item.quantity}
              </span>
              <button
                type="button"
                onClick={() => onUpdateQuantity(cartKey, item.quantity + 1)}
                disabled={atMaxStock}
                className={`flex items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-primary-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 ${stepperBtn}`}
                aria-label={isAr ? 'زيادة' : 'Increase'}
              >
                <Plus className={stepperIcon} />
              </button>
            </div>

            <button
              type="button"
              onClick={() => onRemove(cartKey)}
              className="flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
              aria-label={isAr ? 'حذف' : 'Remove'}
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
              {!compact && (isAr ? 'حذف' : 'Remove')}
            </button>
          </div>
        </div>
      </div>
    </Wrapper>
  );
}

export default memo(CartItemRow);
