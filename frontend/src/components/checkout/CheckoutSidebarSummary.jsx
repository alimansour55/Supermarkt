import { Minus, Plus, Sparkles, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { useCart } from '../../context/CartContext';
import { useStoreSettings } from '../../context/StoreSettingsContext';
import { formatPrice } from '../../utils/formatters';
import { calculatePromotedLineTotal } from '../../utils/cartLinePricing';
import { isSecondItemPromo } from '../../utils/promotionDisplay';
import { pickProductImage } from '../../utils/imageHelpers';
import ProductImage from '../ui/ProductImage';
import DiscountCodeInput from '../cart/DiscountCodeInput';
import CheckoutPointsRedeem from './CheckoutPointsRedeem';
import CheckoutDeliveryMeta from './CheckoutDeliveryMeta';
import CheckoutTotalsBlock from './CheckoutTotalsBlock';
import CartPromoLine from '../cart/CartPromoLine';
import { getFreeDeliveryBannerContent, resolveFreeDeliveryMethods } from '../../utils/freeDelivery';
import { DELIVERY_METHODS } from '../../constants/deliveryOptions';

const BAR_VARIANTS = {
  progress: 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white',
  success: 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white',
  switch: 'bg-gradient-to-r from-amber-500 to-orange-500 text-white',
  coupon: 'bg-gradient-to-r from-violet-600 to-purple-600 text-white',
};

function CheckoutFreeDeliveryBar({
  language,
  subtotal,
  freeDeliveryRemaining,
  threshold,
  deliveryMethod,
  freeDeliveryMethods,
  freeDeliveryFromCoupon,
  bannerSettings,
  onSwitchMethod,
}) {
  const isAr = language === 'ar';
  const banner = getFreeDeliveryBannerContent({
    isAr,
    subtotal,
    threshold,
    freeDeliveryRemaining,
    freeDeliveryMethods,
    deliveryMethod,
    freeDeliveryFromCoupon,
    bannerSettings,
  });

  return (
    <div className={`overflow-hidden rounded-xl px-3 py-2.5 ${BAR_VARIANTS[banner.variant] || BAR_VARIANTS.progress}`}>
      <p className="text-sm font-bold leading-tight">{banner.title}</p>
      {banner.subtitle && (
        <p className="mt-0.5 text-xs leading-snug text-white/90">{banner.subtitle}</p>
      )}
      {banner.variant === 'switch' && banner.suggestMethods?.length > 0 && onSwitchMethod && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {banner.suggestMethods.map((method) => (
            <button
              key={method}
              type="button"
              onClick={() => onSwitchMethod(method)}
              className="rounded-md bg-white/25 px-2 py-0.5 text-[11px] font-bold hover:bg-white/35"
            >
              {isAr
                ? (DELIVERY_METHODS[method]?.labelAr?.replace('توصيل ', '') || method)
                : (DELIVERY_METHODS[method]?.labelEn?.replace(' Delivery', '') || method)}
            </button>
          ))}
        </div>
      )}
      {banner.variant === 'progress' && !banner.currentFree && (
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/25">
          <div
            className="h-full rounded-full bg-white transition-all duration-500"
            style={{ width: `${banner.progress}%` }}
          />
        </div>
      )}
    </div>
  );
}

function CheckoutPointsBadge({ language, pointsPreview, loyaltyEnabled }) {
  const isAr = language === 'ar';
  const earnPoints = pointsPreview?.earnPoints ?? 0;
  const earnCash = pointsPreview?.earnCash ?? 0;
  const showPoints = loyaltyEnabled && earnPoints > 0;

  if (!showPoints) return null;

  return (
    <div className="flex items-center gap-2 rounded-xl border border-amber-200/80 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
      <span aria-hidden>🎁</span>
      {isAr
        ? `+${earnPoints} نقطة (≈ ${formatPrice(earnCash)} استرداد)`
        : `+${earnPoints} pts (≈ ${formatPrice(earnCash)} cashback)`}
    </div>
  );
}

function CheckoutItemRow({ item, isAr, onUpdateQuantity, onRemove }) {
  const name = isAr ? item.name : (item.nameEn || item.name);
  const variant = isAr ? item.variantLabelAr : item.variantLabelEn;
  const key = item.cartKey || item.productId;
  const maxStock = item.availableStock;
  const atMaxStock = maxStock != null && item.quantity >= maxStock;
  const lineTotal = calculatePromotedLineTotal(item);

  return (
    <li className="rounded-xl border border-slate-200/80 bg-white p-2.5 shadow-sm">
      <div className="flex gap-2.5">
        <Link
          to={`/products/${item.slug || item.productId}`}
          className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-slate-100 bg-slate-50"
        >
          <ProductImage
            src={pickProductImage(item)}
            alt={name}
            className="h-full w-full"
            imgClassName="h-full w-full object-contain p-1"
            placeholderClassName="scale-75"
          />
        </Link>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-start justify-between gap-2">
            <Link
              to={`/products/${item.slug || item.productId}`}
              className="line-clamp-2 text-xs font-semibold leading-snug text-slate-900 hover:text-primary-700"
            >
              {name}
            </Link>
            <button
              type="button"
              onClick={() => onRemove(key)}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
              aria-label={isAr ? 'حذف' : 'Remove'}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>

          {variant && (
            <p className="mt-0.5 text-[10px] text-slate-500">{variant}</p>
          )}
          <CartPromoLine item={item} isAr={isAr} compact />

          <div className="mt-1.5 flex items-end justify-between gap-2">
            <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5">
              <button
                type="button"
                onClick={() => onUpdateQuantity(key, item.quantity - 1)}
                className="flex h-7 w-7 items-center justify-center rounded-md text-slate-600 hover:bg-white"
                aria-label={isAr ? 'تقليل' : 'Decrease'}
              >
                <Minus className="h-3 w-3" />
              </button>
              <span className="min-w-[1.75rem] text-center text-xs font-bold tabular-nums">{item.quantity}</span>
              <button
                type="button"
                onClick={() => onUpdateQuantity(key, item.quantity + 1)}
                disabled={atMaxStock}
                className="flex h-7 w-7 items-center justify-center rounded-md text-slate-600 hover:bg-white disabled:opacity-40"
                aria-label={isAr ? 'زيادة' : 'Increase'}
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>

            <div className="text-end">
              {!isSecondItemPromo(item) && (
                <p className="text-[10px] text-slate-500 tabular-nums">
                  {formatPrice(item.price)} × {item.quantity}
                </p>
              )}
              <p className="text-sm font-bold tabular-nums text-primary-700">{formatPrice(lineTotal)}</p>
            </div>
          </div>
        </div>
      </div>
    </li>
  );
}

export default function CheckoutSidebarSummary({
  language,
  checkoutQuote,
  pointsPreview,
  loyaltyEnabled,
  loyaltyRules,
  isAuthenticated,
  pointsToRedeem,
  onPointsToRedeemChange,
  deliveryMethod,
  location,
  form,
  selectedSlot,
  paymentMethod,
  paymentOptions,
  totalOverride,
  extraRows = [],
}) {
  const { t } = useLanguage();
  const { settings } = useStoreSettings();
  const {
    items,
    totalItems,
    cartPromoSummary,
    subtotal,
    deliveryFee,
    discountAmount,
    total,
    appliedCoupon,
    discountCode,
    updateQuantity,
    removeItem,
    setDeliveryMethod,
  } = useCart();

  const isAr = language === 'ar';
  const displaySubtotal = checkoutQuote?.subtotal ?? subtotal;
  const displayDeliveryFee = checkoutQuote?.deliveryFee ?? deliveryFee;
  const displayDiscountAmount = checkoutQuote?.discountAmount ?? discountAmount;
  const displayTotal = totalOverride ?? checkoutQuote?.total ?? total;
  const displayCoupon = checkoutQuote?.appliedCoupon ?? appliedCoupon;
  const displayDiscountCode = checkoutQuote?.appliedCoupon?.code ?? discountCode;
  const freeDeliveryRemaining = checkoutQuote?.freeDeliveryRemaining ?? 0;
  const freeDeliveryMethods = checkoutQuote?.freeDeliveryMethods
    ?? resolveFreeDeliveryMethods(location, {
      freeDeliveryEnabled: settings?.freeDeliveryEnabled !== false,
      freeDeliveryMethods: settings?.freeDeliveryMethods,
    });
  const threshold = location?.freeDeliveryThreshold ?? 500;
  const freeDeliveryFromCoupon = displayCoupon?.type === 'free_delivery';

  if (!items.length) return null;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-50 shadow-sm">
      <div className="border-b border-slate-200/80 bg-white p-4">
        <CheckoutFreeDeliveryBar
          language={language}
          subtotal={displaySubtotal}
          freeDeliveryRemaining={freeDeliveryRemaining}
          threshold={threshold}
          deliveryMethod={deliveryMethod}
          freeDeliveryMethods={freeDeliveryMethods}
          freeDeliveryFromCoupon={freeDeliveryFromCoupon}
          bannerSettings={settings?.freeDeliveryBanner}
          onSwitchMethod={setDeliveryMethod}
        />
      </div>

      <div className="space-y-4 p-4">
        <div>
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-900">
              {isAr ? 'منتجاتك' : 'Your items'}
            </h3>
            <span className="rounded-full bg-slate-200/80 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
              {cartPromoSummary?.hasQtyPromo
                ? cartPromoSummary.summaryLabel
                : (isAr ? `${totalItems} قطعة` : `${totalItems} items`)}
            </span>
          </div>

          {cartPromoSummary?.hasAnyOffer && (
            <p className="mb-2.5 flex items-center gap-1.5 rounded-lg border border-amber-200/80 bg-amber-50 px-2.5 py-1.5 text-[10px] font-semibold text-amber-950">
              <Sparkles className="h-3 w-3 shrink-0" aria-hidden />
              {cartPromoSummary.hasQtyPromo
                ? (isAr ? 'القطع المجانية مضمّنة في شحن طلبك' : 'Free promo items ship with your order')
                : (isAr ? 'العروض النشطة مُطبّقة' : 'Active offers applied')}
            </p>
          )}

          <ul className="max-h-[min(42vh,360px)] space-y-2 overflow-y-auto overscroll-contain pe-0.5 scrollbar-thin">
            {items.map((item) => (
              <CheckoutItemRow
                key={item.cartKey || item.productId}
                item={item}
                isAr={isAr}
                onUpdateQuantity={updateQuantity}
                onRemove={removeItem}
              />
            ))}
          </ul>
        </div>

        <DiscountCodeInput compact hideHint />

        <CheckoutPointsRedeem
          language={language}
          isAuthenticated={isAuthenticated}
          loyaltyEnabled={loyaltyEnabled}
          loyaltyRules={loyaltyRules}
          pointsToRedeem={pointsToRedeem}
          onPointsChange={onPointsToRedeemChange}
          pointsPreview={pointsPreview}
          quotedSubtotal={displaySubtotal}
          quotedDiscountAmount={displayDiscountAmount}
          quotedTotal={checkoutQuote?.total ?? total}
        />

        <CheckoutPointsBadge
          language={language}
          pointsPreview={pointsPreview}
          loyaltyEnabled={loyaltyEnabled}
        />
      </div>

      <div className="border-y border-slate-200/80 bg-white px-4 py-3.5">
        <CheckoutDeliveryMeta
          language={language}
          deliveryMethod={deliveryMethod}
          location={location}
          form={form}
          selectedSlot={selectedSlot}
          paymentMethod={paymentMethod}
          paymentOptions={paymentOptions}
        />
      </div>

      <div className="bg-white p-4">
        <CheckoutTotalsBlock
          language={language}
          totalLabel={t.cart.total}
          subtotal={displaySubtotal}
          deliveryFee={displayDeliveryFee}
          discountAmount={displayDiscountAmount}
          total={displayTotal}
          coupon={displayCoupon}
          discountCode={displayDiscountCode}
          extraRows={extraRows}
        />
      </div>
    </div>
  );
}
