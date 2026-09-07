import { Link } from 'react-router-dom';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { formatPrice } from '../../utils/formatters';
import { calculatePromotedLineTotal } from '../../utils/cartLinePricing';
import { isSecondItemPromo } from '../../utils/promotionDisplay';
import { pickProductImage } from '../../utils/imageHelpers';
import ProductImage from '../ui/ProductImage';
import CartPromoLine from './CartPromoLine';

export default function CartItemRow({ item, onUpdateQuantity, onRemove, compact = false }) {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const name = isAr ? item.name : item.nameEn || item.name;
  const maxStock = item.availableStock;
  const atMaxStock = maxStock != null && item.quantity >= maxStock;
  const lineTotal = calculatePromotedLineTotal(item);
  const variantLabel = isAr ? item.variantLabelAr : item.variantLabelEn;

  if (compact) {
    return (
      <article className="rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm">
        <div className="flex gap-3">
          <Link
            to={`/products/${item.slug || item.productId}`}
            className="block h-[72px] w-[72px] shrink-0 overflow-hidden rounded-xl border border-slate-100 bg-slate-50"
          >
            <ProductImage
              src={pickProductImage(item)}
              alt={name}
              className="h-full w-full"
              imgClassName="h-full w-full object-contain p-1.5"
              placeholderClassName="scale-75"
            />
          </Link>

          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-start justify-between gap-2">
              <Link
                to={`/products/${item.slug || item.productId}`}
                className="line-clamp-2 text-sm font-semibold leading-snug text-slate-900 hover:text-primary-700"
              >
                {name}
              </Link>
              <button
                type="button"
                onClick={() => onRemove(item.cartKey || item.productId)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                aria-label={isAr ? 'حذف' : 'Remove'}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            {(variantLabel || item.sku) && (
              <p className="mt-0.5 text-[11px] text-slate-500">
                {[variantLabel, item.sku ? `SKU ${item.sku}` : null].filter(Boolean).join(' · ')}
              </p>
            )}

            <CartPromoLine item={item} isAr={isAr} compact />

            <div className="mt-2 flex items-end justify-between gap-3">
              <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-0.5">
                <button
                  type="button"
                  onClick={() => onUpdateQuantity(item.cartKey || item.productId, item.quantity - 1)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-white hover:text-slate-900"
                  aria-label={isAr ? 'تقليل' : 'Decrease'}
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="min-w-[2rem] text-center text-sm font-bold tabular-nums text-slate-900">
                  {item.quantity}
                </span>
                <button
                  type="button"
                  onClick={() => onUpdateQuantity(item.cartKey || item.productId, item.quantity + 1)}
                  disabled={atMaxStock}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-white hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label={isAr ? 'زيادة' : 'Increase'}
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="text-end">
                {!isSecondItemPromo(item) && (
                  <p className="text-[11px] text-slate-500 tabular-nums">
                    {formatPrice(item.price)}
                    <span className="mx-0.5">×</span>
                    {item.quantity}
                  </p>
                )}
                <p className="text-base font-bold tabular-nums text-primary-700">
                  {formatPrice(lineTotal)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </article>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-white p-4">
      <div className="flex gap-3">
        <Link
          to={`/products/${item.slug || item.productId}`}
          className="block h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-slate-100 bg-slate-50"
        >
          <ProductImage
            src={pickProductImage(item)}
            alt={name}
            className="h-full w-full"
            imgClassName="h-full w-full object-contain p-1.5"
            placeholderClassName="scale-75"
          />
        </Link>

        <div className="flex min-w-0 flex-1 flex-col">
          <Link
            to={`/products/${item.slug || item.productId}`}
            className="line-clamp-2 text-sm font-semibold text-text hover:text-primary-600"
          >
            {name}
          </Link>
          {variantLabel && (
            <p className="text-xs text-text-muted">{variantLabel}</p>
          )}
          {item.sku && <p className="text-[10px] text-text-muted">SKU: {item.sku}</p>}
          <CartPromoLine item={item} isAr={isAr} />
          {!isSecondItemPromo(item) && (
            <p className="mt-0.5 text-sm font-bold text-primary-700 tabular-nums">
              {formatPrice(item.price)}
            </p>
          )}

          <div className="mt-auto flex items-center justify-between pt-3">
            <div className="flex items-center rounded-xl border border-border bg-surface p-0.5">
              <button
                type="button"
                onClick={() => onUpdateQuantity(item.cartKey || item.productId, item.quantity - 1)}
                className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-white"
                aria-label={isAr ? 'تقليل' : 'Decrease'}
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-8 text-center text-sm font-semibold">{item.quantity}</span>
              <button
                type="button"
                onClick={() => onUpdateQuantity(item.cartKey || item.productId, item.quantity + 1)}
                disabled={atMaxStock}
                className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                aria-label={isAr ? 'زيادة' : 'Increase'}
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm font-bold tabular-nums">{formatPrice(lineTotal)}</span>
              <button
                type="button"
                onClick={() => onRemove(item.cartKey || item.productId)}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-red-500 hover:bg-red-50"
                aria-label={isAr ? 'حذف' : 'Remove'}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
