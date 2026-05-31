import { Link } from 'react-router-dom';
import { Heart, ShoppingCart, Minus, Plus } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useCart } from '../../context/CartContext';
import { useFavorites } from '../../context/FavoritesContext';
import { formatPrice } from '../../utils/formatters';
import { getDiscountPercent, getProductBadges, getStockStatus } from '../../utils/productHelpers';

function StarRating({ rating }) {
  const full = Math.floor(rating || 0);
  const half = (rating || 0) - full >= 0.5;
  return (
    <div className="flex items-center gap-0.5 text-amber-400">
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className={`text-xs ${i < full ? 'opacity-100' : i === full && half ? 'opacity-70' : 'opacity-25'}`}>★</span>
      ))}
      <span className="ms-1 text-[10px] text-text-muted">({rating?.toFixed(1) || '0.0'})</span>
    </div>
  );
}

function isImageUrl(src) {
  return typeof src === 'string' && (src.startsWith('http') || src.startsWith('/'));
}

export default function ProductCard({ product, compact = false }) {
  const { language } = useLanguage();
  const { items, addItem, updateQuantity, bumpProductId } = useCart();
  const { isFavorite, toggleFavorite } = useFavorites();

  const discount = product.discountPercent ?? getDiscountPercent(product);
  const badges = getProductBadges(product, language);
  const stockStatus = getStockStatus(product, language);
  const cartItem = items.find((i) => i.productId === product._id);
  const favorited = isFavorite(product._id);
  const bumped = bumpProductId != null && String(bumpProductId) === String(product._id);

  const handleAdd = (e) => {
    e.preventDefault();
    e.stopPropagation();
    addItem(product, 1, false);
  };

  const handleFavorite = (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleFavorite(product._id);
  };

  return (
    <article
      className={`group relative flex flex-col overflow-hidden rounded-xl border border-border bg-white shadow-sm transition-all duration-200 hover:border-primary-200 hover:shadow-md ${
        compact ? 'min-w-[168px]' : ''
      } ${bumped ? 'ring-2 ring-primary-400 ring-offset-1' : ''}`}
    >
      <Link to={`/products/${product.slug}`} className="relative block aspect-square overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100">
        {product.image && isImageUrl(product.image) ? (
          <img
            src={product.image}
            alt={product.name}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-contain p-3 transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <span className="flex h-full items-center justify-center text-5xl transition-transform duration-300 group-hover:scale-110">{product.emoji || '🛍️'}</span>
        )}

        <div className="absolute start-2 top-2 flex flex-col gap-1">
          {discount > 0 && (
            <span className="rounded-md bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white shadow-sm">
              -{discount}%
            </span>
          )}
          {badges.filter((b) => b.key !== 'offer' || discount === 0).slice(0, 2).map((badge) => (
            <span key={badge.key} className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold shadow-sm ${badge.color}`}>
              {badge.label}
            </span>
          ))}
        </div>

        <button
          type="button"
          onClick={handleFavorite}
          className={`absolute end-2 top-2 flex h-11 w-11 items-center justify-center rounded-full bg-white/90 shadow-sm active:scale-95 ${
            favorited ? 'text-red-500' : 'text-text-muted hover:text-red-400'
          }`}
          aria-label={language === 'ar' ? 'المفضلة' : 'Favorite'}
        >
          <Heart className={`h-5 w-5 ${favorited ? 'fill-current' : ''}`} />
        </button>

        {!product.inStock && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <span className="rounded-lg bg-white px-3 py-1 text-xs font-bold text-red-600">
              {language === 'ar' ? 'غير متوفر' : 'Out of Stock'}
            </span>
          </div>
        )}
      </Link>

      <div className="flex flex-1 flex-col p-3">
        <Link to={`/products/${product.slug}`} className="block flex-1">
          <h3 className="line-clamp-2 text-sm font-bold leading-snug text-text">{product.name}</h3>
          <p className="mt-0.5 line-clamp-1 text-[11px] text-text-muted">{product.nameEn}</p>
          <p className="mt-1 text-[11px] text-text-muted">{product.unit}</p>
          <div className="mt-1.5"><StarRating rating={product.rating} /></div>
          <p className={`mt-1 text-[10px] font-medium ${stockStatus.color}`}>{stockStatus.label}</p>
        </Link>

        <div className="mt-2 border-t border-border/60 pt-2">
          <div className="flex items-baseline gap-1.5">
            <span className="text-base font-extrabold text-primary-700">{formatPrice(product.price)}</span>
            {product.compareAtPrice && product.compareAtPrice > product.price && (
              <span className="text-xs text-text-muted line-through">{formatPrice(product.compareAtPrice)}</span>
            )}
          </div>

          {cartItem ? (
            <div className="mt-2 flex items-center justify-between rounded-lg border border-primary-200 bg-primary-50">
              <button
                type="button"
                onClick={() => updateQuantity(product._id, cartItem.quantity - 1)}
                className="flex h-11 w-11 items-center justify-center text-primary-700 hover:bg-primary-100 rounded-s-lg active:bg-primary-200"
                aria-label={language === 'ar' ? 'تقليل' : 'Decrease'}
              >
                <Minus className="h-5 w-5" />
              </button>
              <span className="flex-1 text-center text-sm font-bold text-primary-800 min-w-[2rem]">{cartItem.quantity}</span>
              <button
                type="button"
                onClick={() => updateQuantity(product._id, cartItem.quantity + 1)}
                disabled={!product.inStock}
                className="flex h-11 w-11 items-center justify-center text-primary-700 hover:bg-primary-100 rounded-e-lg active:bg-primary-200 disabled:opacity-40"
                aria-label={language === 'ar' ? 'زيادة' : 'Increase'}
              >
                <Plus className="h-5 w-5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleAdd}
              disabled={!product.inStock}
              className="mt-2 flex w-full min-h-[44px] items-center justify-center gap-1.5 rounded-lg bg-primary-600 py-2.5 text-xs font-bold text-white transition-colors hover:bg-primary-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ShoppingCart className="h-4 w-4" aria-hidden />
              {language === 'ar' ? 'أضف للسلة' : 'Add to Cart'}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
