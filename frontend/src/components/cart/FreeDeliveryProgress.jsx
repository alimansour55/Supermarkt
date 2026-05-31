import { Link } from 'react-router-dom';
import { Truck } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useCart } from '../../context/CartContext';
import { FREE_DELIVERY_THRESHOLD } from '../../utils/cartCalculations';

/**
 * Progress toward free delivery (500 EGP threshold).
 * @param {boolean} showWhenEmpty - show message when cart is empty
 * @param {boolean} linkToCart - wrap with link to open cart flow
 */
export default function FreeDeliveryProgress({ showWhenEmpty = false, linkToCart = false, className = '' }) {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const {
    subtotal,
    totalItems,
    freeDeliveryRemaining,
    qualifiesForFreeDelivery,
    deliveryMethod,
    openDrawer,
  } = useCart();

  const hasItems = totalItems > 0;
  if (!hasItems && !showWhenEmpty) return null;

  const progress = hasItems
    ? Math.min(100, (subtotal / FREE_DELIVERY_THRESHOLD) * 100)
    : 0;

  const unlocked = qualifiesForFreeDelivery && deliveryMethod === 'scheduled' && hasItems;

  const content = (
    <div className={`rounded-xl border border-primary-100 bg-gradient-to-r from-primary-50 to-emerald-50 px-4 py-3 ${className}`}>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-600 text-white">
          <Truck className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          {unlocked ? (
            <p className="text-sm font-semibold text-primary-800">
              {isAr ? 'مبروك! التوصيل مجاني على طلبك' : 'Free delivery unlocked on your order!'}
            </p>
          ) : hasItems ? (
            <p className="text-sm font-semibold text-primary-900">
              {isAr
                ? `أضف ${freeDeliveryRemaining.toFixed(0)} ج.م للتوصيل المجاني`
                : `Add ${freeDeliveryRemaining.toFixed(0)} EGP more for free delivery`}
            </p>
          ) : (
            <p className="text-sm font-semibold text-primary-900">
              {isAr
                ? `توصيل مجاني للطلبات فوق ${FREE_DELIVERY_THRESHOLD} ج.م`
                : `Free delivery on orders over ${FREE_DELIVERY_THRESHOLD} EGP`}
            </p>
          )}
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-primary-100">
            <div
              className="h-full rounded-full bg-primary-600 transition-all duration-500"
              style={{ width: `${unlocked ? 100 : progress}%` }}
            />
          </div>
          {hasItems && !unlocked && (
            <p className="mt-1 text-xs text-text-muted">
              {isAr ? `المجموع: ${subtotal.toFixed(0)} ج.م` : `Subtotal: ${subtotal.toFixed(0)} EGP`}
            </p>
          )}
        </div>
        {linkToCart && hasItems && (
          <button
            type="button"
            onClick={openDrawer}
            className="shrink-0 text-xs font-bold text-primary-700 hover:underline"
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
