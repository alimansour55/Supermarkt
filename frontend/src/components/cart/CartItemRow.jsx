import { Link } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { formatPrice } from '../../utils/formatters';

export default function CartItemRow({ item, onUpdateQuantity, onRemove, compact = false }) {
  const { language } = useLanguage();
  const name = language === 'ar' ? item.name : item.nameEn || item.name;

  return (
    <div className={`flex gap-3 ${compact ? 'py-3 border-b border-border last:border-0' : 'rounded-2xl border border-border bg-white p-4'}`}>
      <Link
        to={`/products/${item.slug || item.productId}`}
        className={`flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 ${compact ? 'h-16 w-16 text-2xl' : 'h-20 w-20 text-3xl'}`}
      >
        {item.emoji || '🛍️'}
      </Link>

      <div className="flex min-w-0 flex-1 flex-col">
        <Link
          to={`/products/${item.slug || item.productId}`}
          className="line-clamp-2 text-sm font-semibold text-text hover:text-primary-600"
        >
          {name}
        </Link>
        <p className="mt-0.5 text-sm font-bold text-primary-700">{formatPrice(item.price)}</p>

        <div className="mt-auto flex items-center justify-between pt-2">
          <div className="flex items-center rounded-lg border border-border bg-surface">
            <button
              type="button"
              onClick={() => onUpdateQuantity(item.productId, item.quantity - 1)}
              className="flex h-8 w-8 items-center justify-center text-lg hover:bg-white rounded-s-lg"
              aria-label="Decrease"
            >
              −
            </button>
            <span className="w-8 text-center text-sm font-semibold">{item.quantity}</span>
            <button
              type="button"
              onClick={() => onUpdateQuantity(item.productId, item.quantity + 1)}
              className="flex h-8 w-8 items-center justify-center text-lg hover:bg-white rounded-e-lg"
              aria-label="Increase"
            >
              +
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-bold">{formatPrice(item.price * item.quantity)}</span>
            <button
              type="button"
              onClick={() => onRemove(item.productId)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-red-500 hover:bg-red-50"
              aria-label="Remove"
            >
              🗑️
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
