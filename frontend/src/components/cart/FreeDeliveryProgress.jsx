import { Link } from '../../app/router';
import { CheckCircle2, Sparkles, Truck } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useCart } from '../../context/CartContext';
import { useLocation } from '../../context/LocationContext';
import { useStoreSettings } from '../../context/StoreSettingsContext';
import { getFreeDeliveryBannerContent, resolveFreeDeliveryMethods } from '../../utils/freeDelivery';
import { DELIVERY_METHODS } from '../../constants/deliveryOptions';

const VARIANT_STYLES = {
  progress: 'bg-primary-50',
  success: 'bg-emerald-50',
  switch: 'bg-amber-50',
  coupon: 'bg-violet-50',
};

const VARIANT_ICON_BADGE = {
  progress: 'bg-primary-600 text-white',
  success: 'bg-emerald-600 text-white',
  switch: 'bg-amber-500 text-white',
  coupon: 'bg-violet-600 text-white',
};

const VARIANT_ICON = {
  progress: Truck,
  success: CheckCircle2,
  switch: Truck,
  coupon: Sparkles,
};

export default function FreeDeliveryProgress({ showWhenEmpty = false, linkToCart = false, dense = false, className = '' }) {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const { location } = useLocation();
  const { settings } = useStoreSettings();
  const {
    subtotal,
    totalItems,
    freeDeliveryRemaining,
    deliveryMethod,
    discountCode,
    appliedCoupon,
    setDeliveryMethod,
    openDrawer,
  } = useCart();

  const hasItems = totalItems > 0;
  if (!hasItems && !showWhenEmpty) return null;

  const threshold = location?.freeDeliveryThreshold ?? settings?.freeDeliveryThreshold ?? 500;
  const freeDeliveryMethods = resolveFreeDeliveryMethods(
    location,
    {
      freeDeliveryEnabled: settings?.freeDeliveryEnabled !== false,
      freeDeliveryMethods: settings?.freeDeliveryMethods,
    },
  );
  const freeDeliveryFromCoupon = appliedCoupon?.type === 'free_delivery'
    && (appliedCoupon?.code === discountCode || !discountCode);

  const banner = hasItems
    ? getFreeDeliveryBannerContent({
      isAr,
      subtotal,
      threshold,
      freeDeliveryRemaining,
      freeDeliveryMethods,
      deliveryMethod,
      freeDeliveryFromCoupon,
      bannerSettings: settings?.freeDeliveryBanner,
    })
    : {
      variant: 'progress',
      title: isAr ? `توصيل مجاني فوق ${threshold} ج.م` : `Free delivery over ${threshold} EGP`,
      subtitle: '',
      progress: 0,
      currentFree: false,
      suggestMethods: [],
    };

  const Icon = VARIANT_ICON[banner.variant] || Truck;
  const showBar = !dense || (banner.variant === 'progress' && !banner.currentFree);

  const content = (
    <div className={`rounded-2xl ${dense ? 'px-3 py-2.5' : 'px-4 py-3'} ${VARIANT_STYLES[banner.variant] || VARIANT_STYLES.progress} ${className}`}>
      <div className="flex items-center gap-2.5">
        <span
          className={`flex shrink-0 items-center justify-center rounded-full ${dense ? 'h-8 w-8' : 'h-9 w-9'} ${VARIANT_ICON_BADGE[banner.variant] || VARIANT_ICON_BADGE.progress}`}
        >
          <Icon className={dense ? 'h-4 w-4' : 'h-4.5 w-4.5'} strokeWidth={2.25} aria-hidden />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className={`font-bold leading-tight ${dense ? 'text-xs' : 'text-sm'} ${banner.variant === 'switch' ? 'text-amber-950' : 'text-primary-900'}`}>
              {banner.title}
            </p>
            {linkToCart && hasItems && (
              <button
                type="button"
                onClick={openDrawer}
                className="shrink-0 text-[11px] font-bold text-primary-700 hover:underline"
              >
                {isAr ? 'السلة' : 'Cart'}
              </button>
            )}
          </div>

          {banner.subtitle && !dense && (
            <p className="mt-0.5 text-xs leading-snug text-text-muted">{banner.subtitle}</p>
          )}

          {banner.variant === 'switch' && banner.suggestMethods?.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {banner.suggestMethods.map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setDeliveryMethod(method)}
                  className="rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900 hover:bg-amber-200"
                >
                  {isAr
                    ? (DELIVERY_METHODS[method]?.labelAr?.replace('توصيل ', '') || method)
                    : (DELIVERY_METHODS[method]?.labelEn?.replace(' Delivery', '') || method)}
                </button>
              ))}
            </div>
          )}

          {showBar && (
            <div className={`overflow-hidden rounded-full bg-white/70 ${dense ? 'mt-1.5 h-1.5' : 'mt-2 h-1.5'}`}>
              <div
                className={`h-full rounded-full transition-all duration-500 ${banner.currentFree ? 'bg-emerald-600' : 'bg-primary-600'}`}
                style={{ width: `${banner.progress}%` }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (linkToCart && !hasItems) {
    return <Link to="/products" className="block">{content}</Link>;
  }

  return content;
}
