import { Link } from '../../app/router';
import { Heart, Plus, Star, Trash2 } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useCart } from '../../context/CartContext';
import { useLocation } from '../../context/LocationContext';
import { useFavorites } from '../../context/FavoritesContext';
import { useStoreSettings } from '../../context/StoreSettingsContext';
import { DELIVERY_METHODS } from '../../constants/deliveryOptions';
import { getDiscountPercent, getProductBadges, getPromotionHighlight, getStockStatus, getProductAvailableStock, shouldShowLowStockAlert } from '../../utils/productHelpers';
import { formatPrice } from '../../utils/formatters';
import { pickProductImage, pickProductEmoji } from '../../utils/imageHelpers';
import { prefetchProduct } from '../../services/productApi';
import ProductImage from '../ui/ProductImage';
import { calculateSecondPiecePrice } from '../../utils/promotionDisplay';

function formatMoneyNumber(amount, locale) {
  try {
    const formatted = new Intl.NumberFormat(locale, { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(amount ?? 0);
    // Hard-normalize Arabic/Persian numerals to Latin digits for consistent alignment.
    return formatted
      .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
      .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
  } catch {
    return String(amount ?? 0);
  }
}

function splitPriceParts(amount, locale) {
  const formatted = formatMoneyNumber(amount, locale);
  const separator = formatted.includes('٫') ? '٫' : formatted.includes('.') ? '.' : null;
  if (!separator) return { major: formatted, minor: '' };
  const [major, minor] = formatted.split(separator);
  return { major, minor };
}

function normalizeEtaLabel({ isAr, rawEta, methodMeta, deliveryPromise }) {
  const fallback = isAr ? methodMeta?.etaAr : methodMeta?.etaEn;
  const raw = String(rawEta || '').trim();
  if (!raw) return String(deliveryPromise || fallback || '').trim();

  if (!isAr) return raw;

  // If Arabic already, keep it.
  if (/[اأإآء-ي]/.test(raw)) return raw;

  // Convert common English ETA patterns → Arabic.
  // Examples:
  // - "4-6 hours" → "التوصيل خلال 4-6 ساعات"
  // - "within 2 hours" → "التوصيل خلال ساعتين"
  const normalized = raw.toLowerCase().replace(/\s+/g, ' ').trim();
  const range = normalized.match(/(\d+\s*[-–]\s*\d+)\s*hours?/);
  if (range) {
    const r = range[1].replace(/\s+/g, '');
    return `التوصيل خلال ${r} ساعات`;
  }
  const within = normalized.match(/within\s+(\d+)\s*hours?/);
  if (within) {
    const h = Number(within[1]);
    if (h === 1) return 'التوصيل خلال ساعة';
    if (h === 2) return 'التوصيل خلال ساعتين';
    return `التوصيل خلال ${h} ساعات`;
  }

  // If we couldn't convert, fall back to Arabic meta/promise.
  return String(deliveryPromise || fallback || '').trim() || raw;
}

function productDisplayRating(product) {
  const value = Number(product?.rating);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function StarRating({ rating, reviewCount, compact = false }) {
  const value = Number(rating);
  if (!Number.isFinite(value) || value <= 0) return null;

  if (compact) {
    return (
      <div className="flex items-center gap-0.5 text-amber-500" aria-label={`${value.toFixed(1)} / 5`}>
        <Star className="h-3 w-3 fill-current" aria-hidden />
        <span className="text-[10px] font-bold leading-none text-slate-800">{value.toFixed(1)}</span>
        {reviewCount > 0 && <span className="text-[9px] leading-none text-slate-500">({reviewCount})</span>}
      </div>
    );
  }

  const full = Math.floor(value);
  return (
    <div className="flex items-center gap-0.5 text-amber-400" aria-label={`${value.toFixed(1)} / 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={`h-3 w-3 ${i < full ? 'fill-current opacity-100' : 'opacity-25'}`} aria-hidden />
      ))}
      <span className="ms-1 text-[10px] font-semibold text-slate-500">({value.toFixed(1)})</span>
      {reviewCount > 0 && <span className="text-[10px] text-slate-500">{reviewCount}</span>}
    </div>
  );
}

const CARD_STEPPER_SHELL = 'card-stepper-shell flex h-8 items-stretch overflow-hidden rounded-full border border-primary-200 bg-white shadow-[0_1px_4px_rgba(15,23,42,0.14)]';
const CARD_STEPPER_BTN = 'card-stepper-btn flex h-8 w-8 shrink-0 items-center justify-center text-primary-600 hover:bg-primary-50 active:bg-primary-100 active:scale-95';

function CardAddButton({ onClick, disabled, isAr }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="card-stepper-btn flex h-8 w-8 items-center justify-center rounded-full border border-primary-600 bg-primary-600 text-white shadow-[0_1px_3px_rgba(15,23,42,0.12)] transition-all duration-300 ease-out hover:bg-primary-700 hover:scale-105 active:scale-95 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 focus-visible:ring-offset-1"
      aria-label={isAr ? 'أضف للسلة' : 'Add to cart'}
    >
      <Plus className="h-4 w-4 transition-transform duration-200 ease-out" aria-hidden />
    </button>
  );
}

function CardQtyStepper({
  cartItem,
  isAr,
  outOfStock,
  atMaxStock,
  onDecrease,
  onOpenCart,
  onIncrease,
}) {
  return (
    <div className={CARD_STEPPER_SHELL} dir="ltr">
      <button
        type="button"
        onClick={onIncrease}
        disabled={outOfStock || atMaxStock}
        className={`${CARD_STEPPER_BTN} border-e border-primary-100 disabled:opacity-40`}
        aria-label={isAr ? 'زيادة الكمية' : 'Increase quantity'}
      >
        <Plus className="h-4 w-4 transition-transform duration-200 ease-out" aria-hidden />
      </button>
      <button
        type="button"
        onClick={onOpenCart}
        className="card-stepper-qty flex h-8 min-w-10 shrink-0 items-center justify-center bg-primary-600 px-2.5 text-[12px] font-extrabold text-white tabular-nums transition-all duration-200 ease-in-out hover:bg-primary-700 active:bg-primary-800 active:scale-95"
        aria-label={isAr ? 'افتح السلة' : 'Open cart'}
      >
        <span key={cartItem.quantity} className="card-qty-pop inline-block">
          {cartItem.quantity}
        </span>
      </button>
      <button
        type="button"
        onClick={onDecrease}
        className={`${CARD_STEPPER_BTN} border-s border-primary-100`}
        aria-label={isAr ? 'تقليل الكمية' : 'Decrease quantity'}
      >
        <Trash2 className="h-4 w-4 transition-transform duration-200 ease-out" aria-hidden />
      </button>
    </div>
  );
}

function CardCartControl({
  cartItem,
  isAr,
  outOfStock,
  atMaxStock,
  onAdd,
  onDecrease,
  onOpenCart,
  onIncrease,
}) {
  const hasItem = Boolean(cartItem);

  return (
    <div className="relative h-8 origin-bottom-left">
      <div className="invisible pointer-events-none" aria-hidden>
        {hasItem ? (
          <CardQtyStepper
            cartItem={cartItem}
            isAr={isAr}
            outOfStock={outOfStock}
            atMaxStock={atMaxStock}
            onDecrease={onDecrease}
            onOpenCart={onOpenCart}
            onIncrease={onIncrease}
          />
        ) : (
          <CardAddButton onClick={() => {}} disabled={outOfStock} isAr={isAr} />
        )}
      </div>
      <div
        aria-hidden={hasItem}
        className={[
          'absolute inset-0 flex items-end transition-all duration-300 ease-out',
          hasItem ? 'pointer-events-none scale-75 opacity-0' : 'pointer-events-auto scale-100 opacity-100',
        ].join(' ')}
      >
        <CardAddButton onClick={onAdd} disabled={outOfStock} isAr={isAr} />
      </div>
      <div
        aria-hidden={!hasItem}
        className={[
          'absolute inset-0 flex items-end transition-all duration-300 ease-out',
          hasItem
            ? 'pointer-events-auto scale-100 opacity-100 card-cart-control-enter'
            : 'pointer-events-none scale-75 opacity-0',
        ].join(' ')}
      >
        {hasItem && (
          <CardQtyStepper
            cartItem={cartItem}
            isAr={isAr}
            outOfStock={outOfStock}
            atMaxStock={atMaxStock}
            onDecrease={onDecrease}
            onOpenCart={onOpenCart}
            onIncrease={onIncrease}
          />
        )}
      </div>
    </div>
  );
}

export default function ProductCard({ product, compact = false }) {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const { items, addItem, updateQuantity, bumpProductId, deliveryMethod, openDrawer } = useCart();
  const { location } = useLocation();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { settings: storeSettings } = useStoreSettings();

  const discount = product.discountPercent ?? product.discount ?? getDiscountPercent(product);
  const promotion = getPromotionHighlight(product, language);
  const badges = getProductBadges(product, language).filter((b) => b.key !== 'offer');
  const lowStockSettings = {
    lowStockAlertEnabled: storeSettings?.lowStockAlertEnabled,
    lowStockAlertThreshold: storeSettings?.lowStockAlertThreshold,
    lowStockMessageAr: storeSettings?.lowStockMessageAr,
    lowStockMessageEn: storeSettings?.lowStockMessageEn,
  };
  const stockStatus = getStockStatus(product, language, {
    lowStockThreshold: storeSettings?.lowStockAlertThreshold ?? 10,
    lowStockEnabled: storeSettings?.lowStockAlertEnabled !== false,
    lowStockMessageAr: storeSettings?.lowStockMessageAr,
    lowStockMessageEn: storeSettings?.lowStockMessageEn,
  });
  const cartItem = items.find((i) => i.productId === product._id);
  const favorited = isFavorite(product._id);
  const bumped = bumpProductId != null && String(bumpProductId) === String(product._id);
  // Show ONLY the active language name (no second language line)
  const title = isAr ? (product.name || '') : (product.nameEn || product.name || '');
  const imageSrc = pickProductImage(product) || pickProductEmoji(product);
  const detailPrefetchHandlers = product.slug
    ? {
        onMouseEnter: () => prefetchProduct(product.slug),
        onFocus: () => prefetchProduct(product.slug),
        onTouchStart: () => prefetchProduct(product.slug),
      }
    : {};
  const stockNumber = getProductAvailableStock(product);
  const outOfStock = product.inStock === false || (stockNumber != null && stockNumber <= 0);
  const displayRating = productDisplayRating(product);
  const reviewCount = product.reviewCount ?? product.reviews?.length ?? 0;
  const imageCount = Array.isArray(product?.images) ? product.images.length : 0;
  const deliveryPromise = isAr ? storeSettings?.deliveryPromiseAr : storeSettings?.deliveryPromiseEn;
  const effectiveMethod = deliveryMethod === 'express' && location?.expressAvailable ? 'express' : (deliveryMethod || 'scheduled');
  const methodMeta = DELIVERY_METHODS[effectiveMethod] || DELIVERY_METHODS.scheduled;
  const zoneEta = effectiveMethod === 'express'
    ? location?.estimatedExpress
    : location?.estimatedScheduled;
  const deliveryTime = normalizeEtaLabel({
    isAr,
    rawEta: product.deliveryTime || zoneEta,
    methodMeta,
    deliveryPromise,
  });
  const lowStock = shouldShowLowStockAlert(stockNumber, lowStockSettings);
  const currencyLabel = 'EGP';
  const priceNow = Number(product.price ?? 0);
  const oldRaw = product.compareAtPrice ?? product.oldPrice;
  const priceOld = oldRaw != null ? Number(oldRaw) : null;
  const hasOldPrice = priceOld != null && Number.isFinite(priceOld) && priceOld > priceNow;
  const locale = isAr ? 'ar-EG' : 'en-US';
  // Arabic UI: keep Arabic currency label, but use English numerals for cleaner alignment.
  const numberLocale = isAr ? 'en-US' : locale;
  const priceParts = splitPriceParts(priceNow, numberLocale);

  const cartLineKey = cartItem?.cartKey || product._id;
  const atMaxStock = stockNumber != null && cartItem && cartItem.quantity >= stockNumber;

  const handleAdd = (e) => {
    e.preventDefault();
    e.stopPropagation();
    addItem(product, 1, false);
  };

  const handleIncrease = (e) => {
    e.preventDefault();
    e.stopPropagation();
    addItem(product, 1, false);
  };

  const handleDecrease = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!cartItem) return;
    updateQuantity(cartLineKey, cartItem.quantity - 1);
  };

  const handleFavorite = (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleFavorite(product._id, product);
  };

  return (
    <article
      className={[
        // No outer border/card background: info area sits on page background
        'group relative flex h-full flex-col overflow-visible rounded-xl border-0 bg-transparent shadow-none',
        // Keep hover affordance only on image container (below)
        compact ? 'min-w-[154px] max-w-[170px] shrink-0' : '',
        bumped ? 'ring-2 ring-primary-600 ring-offset-1' : '',
      ].join(' ')}
      dir={isAr ? 'rtl' : 'ltr'}
    >
      <Link
        to={product.slug ? `/products/${product.slug}` : '/products'}
        className="relative block bg-transparent"
        {...detailPrefetchHandlers}
      >
        <div className="relative mx-2 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.06)] transition-shadow duration-200 hover:shadow-[0_10px_22px_rgba(15,23,42,0.10)] sm:mx-2.5 sm:mt-2.5">
          <div className="relative h-[130px] w-full sm:h-[150px] lg:h-[190px]">
            <ProductImage
              src={imageSrc}
              alt={title}
              className="h-full w-full bg-white"
              imgClassName="h-full w-full object-contain p-3 transition-transform duration-300 group-hover:scale-[1.04] sm:p-4"
              // No inset box → avoids “double border” look
              placeholderClassName="bg-white"
            />
          </div>

          <div className="absolute end-2 top-2 z-10 flex flex-col items-end gap-1">
            {promotion && (
              <span className={`rounded-md px-2 py-1 text-[10px] font-extrabold leading-none shadow-md ${promotion.className}`}>
                {promotion.icon ? `${promotion.icon} ` : ''}{promotion.label}
              </span>
            )}
            {!promotion && discount > 0 && (
              <span className="rounded-md bg-red-600 px-2 py-1 text-[10px] font-extrabold uppercase leading-none text-white shadow-sm">
                OFF {discount}%
              </span>
            )}
            {badges.slice(0, 2).map((badge) => (
              <span key={badge.key} className={`rounded px-1.5 py-0.5 text-[9px] font-bold shadow-sm ${badge.color}`}>
                {badge.label}
              </span>
            ))}
          </div>

          {promotion?.showRibbon ? (
            <div className="absolute inset-x-0 bottom-0 z-[5] flex flex-col">
              <div className={`px-2 py-1.5 text-center text-[10px] font-bold leading-tight text-white shadow-sm ${
                promotion.type === 'second_percent_off'
                  ? 'bg-gradient-to-r from-amber-600/95 to-orange-600/95'
                  : 'bg-gradient-to-r from-violet-700/95 to-fuchsia-600/95'
              }`}>
                {promotion.type === 'second_percent_off' && promotion.secondPercentOff
                  ? (isAr
                    ? `القطعة الثانية ${formatPrice(calculateSecondPiecePrice(priceNow, promotion.secondPercentOff))} فقط (−${promotion.secondPercentOff}%)`
                    : `2nd item ${formatPrice(calculateSecondPiecePrice(priceNow, promotion.secondPercentOff))} only (−${promotion.secondPercentOff}%)`)
                  : (promotion.sublabel || (isAr ? '🎁 عرض خاص' : '🎁 Special offer'))}
              </div>
              <div className="relative h-10 w-full">
                <div className="absolute bottom-1.5 left-2 z-20">
                  <CardCartControl
                    cartItem={cartItem}
                    isAr={isAr}
                    outOfStock={outOfStock}
                    atMaxStock={atMaxStock}
                    onAdd={handleAdd}
                    onDecrease={handleDecrease}
                    onOpenCart={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      openDrawer();
                    }}
                    onIncrease={handleIncrease}
                  />
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="absolute bottom-2 left-2 z-20">
                <CardCartControl
                  cartItem={cartItem}
                  isAr={isAr}
                  outOfStock={outOfStock}
                  atMaxStock={atMaxStock}
                  onAdd={handleAdd}
                  onDecrease={handleDecrease}
                  onOpenCart={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    openDrawer();
                  }}
                  onIncrease={handleIncrease}
                />
              </div>
            </>
          )}

          <button
            type="button"
            onClick={handleFavorite}
            className={[
              'absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/95 shadow-sm ring-1 ring-slate-200',
              'transition-all duration-150 hover:scale-105 active:scale-95 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100',
              favorited ? 'text-red-500 sm:opacity-100' : 'text-slate-500 hover:text-red-500',
            ].join(' ')}
            aria-label={isAr ? 'المفضلة' : 'Favorite'}
          >
            <Heart className={`h-4 w-4 ${favorited ? 'fill-current' : ''}`} />
          </button>

          {(stockStatus.key === 'out' || lowStock) && (
            <span
              className={[
                'absolute bottom-2 right-2 z-10 rounded px-2 py-0.5 text-[10px] font-bold shadow-sm',
                stockStatus.key === 'out' ? 'bg-red-600 text-white' : 'bg-amber-500 text-white',
              ].join(' ')}
            >
              {stockStatus.label}
            </span>
          )}

          {outOfStock && <div className="absolute inset-0 bg-white/65 backdrop-blur-[1px]" aria-hidden />}

          {!compact && imageCount > 1 && (
            <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1">
              {Array.from({ length: Math.min(5, imageCount) }).map((_, i) => (
                <span key={i} className={`h-1.5 w-1.5 rounded-full ${i === 0 ? 'bg-slate-700' : 'bg-slate-300'}`} aria-hidden />
              ))}
            </div>
          )}
        </div>
      </Link>

      <div
        className={[
          'flex flex-col',
          // Keep all rows same width; align text instead of using items-end.
          'w-full',
          isAr ? 'text-right' : 'text-left',
          compact ? 'px-2 pb-2 pt-1.5' : 'px-2.5 pb-2.5 pt-2',
        ].join(' ')}
        dir={isAr ? 'rtl' : 'ltr'}
      >
        <Link
          to={product.slug ? `/products/${product.slug}` : '/products'}
          className="block w-full"
          {...detailPrefetchHandlers}
        >
          <h3
            className={[
              'w-full line-clamp-2 text-[14px] font-semibold leading-[1.35] text-slate-950',
              isAr ? 'text-right' : 'text-left',
            ].join(' ')}
          >
            {title}
          </h3>
          {displayRating > 0 && (
            <div className="mt-1">
              <StarRating rating={displayRating} reviewCount={reviewCount} compact={compact} />
            </div>
          )}
        </Link>

        {/* Compact 3-line stack: Name → Price → Delivery */}
        <div className={`${isAr ? 'text-right' : 'text-left'}`}>
          {promotion?.sublabel && promotion?.type !== 'second_percent_off' && discount === 0 && (
            <p className={`mt-0.5 text-[10px] font-semibold leading-tight text-violet-700 ${isAr ? 'text-right' : 'text-left'}`}>
              {promotion.sublabel}
            </p>
          )}
          {/* Price line — physical right (text-right), not logical text-end */}
          <div className="mt-1 w-full text-right">
            <div className="inline-flex items-end gap-2 tabular-nums" dir="ltr">
              {hasOldPrice && (
                <span className="inline-flex items-baseline text-[12px] font-medium leading-none text-slate-400 line-through">
                  {formatMoneyNumber(priceOld, numberLocale)} {currencyLabel}
                </span>
              )}

              <span className="inline-flex items-baseline gap-1 text-slate-950">
                <span className="text-[22px] font-extrabold leading-none tracking-tight">{priceParts.major}</span>
                {priceParts.minor && (
                  <span className="text-[11px] font-extrabold leading-none text-slate-900/90">
                    .{priceParts.minor}
                  </span>
                )}
                <span className="text-[12px] font-semibold leading-none text-slate-600">{currencyLabel}</span>
              </span>
            </div>
          </div>

          {/* Delivery line */}
          {!compact && deliveryTime && (
            <p
              className={[
                // Plain text (no flex) so RTL always starts from the right.
                'mt-0.5 w-full text-[11px] leading-tight text-slate-600',
                isAr ? 'text-right' : 'text-left',
              ].join(' ')}
              dir={isAr ? 'rtl' : 'ltr'}
            >
              <span className="line-clamp-1 min-w-0">{deliveryTime}</span>
            </p>
          )}

        </div>
      </div>
    </article>
  );
}
