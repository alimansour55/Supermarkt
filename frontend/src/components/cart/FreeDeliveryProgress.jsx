import { Link } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { useCart } from '../../context/CartContext';
import { useLocation } from '../../context/LocationContext';
import { useStoreSettings } from '../../context/StoreSettingsContext';
import { getFreeDeliveryBannerContent, resolveFreeDeliveryMethods } from '../../utils/freeDelivery';
import { DELIVERY_METHODS } from '../../constants/deliveryOptions';

const VARIANT_STYLES = {
  progress: 'border-primary-100 bg-gradient-to-r from-primary-50 to-emerald-50',
  success: 'border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50',
  switch: 'border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50',
  coupon: 'border-violet-200 bg-gradient-to-r from-violet-50 to-purple-50',
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

  const content = (
    <div className={`rounded-xl border ${dense ? 'px-3 py-2' : 'px-3 py-2.5'} ${VARIANT_STYLES[banner.variant] || VARIANT_STYLES.progress} ${className}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className={`font-bold leading-tight ${dense ? 'text-xs' : 'text-sm'} ${banner.variant === 'switch' ? 'text-amber-950' : 'text-primary-900'}`}>
            {banner.title}
          </p>
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
          {!dense && (
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/70">
              <div
                className={`h-full rounded-full transition-all duration-500 ${banner.currentFree ? 'bg-emerald-600' : 'bg-primary-600'}`}
                style={{ width: `${banner.progress}%` }}
              />
            </div>
          )}
          {dense && banner.variant === 'progress' && !banner.currentFree && (
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/70">
              <div
                className="h-full rounded-full bg-primary-600 transition-all duration-500"
                style={{ width: `${banner.progress}%` }}
              />
            </div>
          )}
        </div>
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
    </div>
  );

  if (linkToCart && !hasItems) {
    return <Link to="/products" className="block">{content}</Link>;
  }

  return content;
}
