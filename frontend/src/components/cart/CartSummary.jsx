import { Link } from 'react-router-dom';
import { Fragment } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { useCart } from '../../context/CartContext';
import { formatPrice } from '../../utils/formatters';
import DiscountCodeInput, { FreeDeliveryBar } from './DiscountCodeInput';
import Button from '../ui/Button';
import DeliveryMethodSelector from '../checkout/DeliveryMethodSelector';
import { useLocation } from '../../context/LocationContext';

export default function CartSummary({
  showDiscount = true,
  showDeliverySelector = false,
  showCheckoutButton = true,
  onCheckout,
  compact = false,
  hidePromoBanner = false,
  extraRows = [],
  totalOverride = null,
  totalsOverride = null,
  footer = null,
  hideCouponHint = false,
}) {
  const { t, language } = useLanguage();
  const isAr = language === 'ar';
  const {
    subtotal,
    deliveryFee,
    discountAmount,
    total,
    deliveryMethod,
    setDeliveryMethod,
    items,
    appliedCoupon,
    discountCode,
    cartPromoSummary,
  } = useCart();
  const { location } = useLocation();

  const displaySubtotal = totalsOverride?.subtotal ?? subtotal;
  const displayDeliveryFee = totalsOverride?.deliveryFee ?? deliveryFee;
  const displayDiscountAmount = totalsOverride?.discountAmount ?? discountAmount;
  const displayTotal = totalsOverride?.total ?? total;
  const displayCoupon = totalsOverride?.appliedCoupon ?? appliedCoupon;
  const displayDiscountCode = totalsOverride?.appliedCoupon?.code ?? discountCode;

  if (items.length === 0) return null;

  return (
    <div className={`${compact ? 'space-y-3' : 'space-y-4 rounded-2xl border border-border bg-white p-6'}`}>
      {!compact && <FreeDeliveryBar />}

      {showDeliverySelector && (
        <div className="space-y-2">
          <p className="text-sm font-semibold">{language === 'ar' ? 'طريقة التوصيل' : 'Delivery Method'}</p>
          <DeliveryMethodSelector
            compact
            showScheduleFields={false}
            deliveryMethod={deliveryMethod}
            onDeliveryMethodChange={setDeliveryMethod}
            form={{ scheduledDate: '', scheduledTime: '', recurringFrequency: 'weekly' }}
            onFormChange={() => {}}
            timeSlots={location?.timeSlots || []}
            language={language}
            subtotal={displaySubtotal}
            freeDeliveryThreshold={location?.freeDeliveryThreshold ?? 500}
            scheduledFee={location?.scheduledFee ?? 29.99}
            expressFee={location?.expressFee ?? 49.99}
            expressAvailable={location?.expressAvailable !== false}
            scheduledAvailable={location?.scheduledAvailable !== false}
          />
          <p className="text-[11px] text-text-muted">
            {language === 'ar'
              ? 'اختر اليوم والموعد في خطوة إتمام الشراء'
              : 'Pick date and time slot at checkout'}
          </p>
        </div>
      )}

      {showDiscount && <DiscountCodeInput compact={compact} hideHint={hideCouponHint} />}

      {!hidePromoBanner && cartPromoSummary?.hasAnyOffer && (
        <div className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-900">
          🎁 {cartPromoSummary.summaryLabel || (isAr ? 'عروض نشطة على منتجاتك' : 'Active offers on your items')}
          {cartPromoSummary.hasQtyPromo && (
            <p className="mt-1 font-normal text-violet-800/90">
              {isAr ? 'السعر للقطع المدفوعة فقط — الهدايا تُشحن مع طلبك.' : 'Price is for paid items only — gifts ship with your order.'}
            </p>
          )}
        </div>
      )}

      <div className={`space-y-2 tabular-nums ${compact ? 'text-sm' : 'text-sm'}`}>
        <div className="grid w-full grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1.5">
          <span className={`text-text-muted ${isAr ? 'text-right' : 'text-left'}`}>{language === 'ar' ? 'المجموع الفرعي' : 'Subtotal'}</span>
          <span className="text-right font-medium">{formatPrice(displaySubtotal)}</span>

          <span className={`text-text-muted ${isAr ? 'text-right' : 'text-left'}`}>{language === 'ar' ? 'رسوم التوصيل' : 'Delivery Fee'}</span>
          <span className="text-right font-medium">
            {displayDeliveryFee === 0 ? (
              <span className="text-primary-600">{language === 'ar' ? 'مجاني' : 'Free'}</span>
            ) : (
              formatPrice(displayDeliveryFee)
            )}
          </span>

          {displayCoupon && (
            <>
              <span className="text-primary-600">
                {language === 'ar' ? 'الخصم' : 'Discount'}
                {' '}
                ({displayDiscountCode})
              </span>
              <span className="text-right font-medium text-primary-600">
                {displayDiscountAmount > 0 ? `− ${formatPrice(displayDiscountAmount)}` : (language === 'ar' ? 'مُطبّق' : 'Applied')}
              </span>
            </>
          )}

          {!displayCoupon && displayDiscountAmount > 0 && (
            <>
              <span className="text-primary-600">{language === 'ar' ? 'الخصم' : 'Discount'}</span>
              <span className="text-right font-medium text-primary-600">− {formatPrice(displayDiscountAmount)}</span>
            </>
          )}

          {displayCoupon?.type === 'free_delivery' && displayDeliveryFee === 0 && (
            <>
              <span className="text-xs text-primary-600">{language === 'ar' ? 'توصيل مجاني من الكوبون' : 'Free delivery from coupon'}</span>
              <span className="text-right text-xs font-medium text-primary-600">{language === 'ar' ? '✓' : '✓'}</span>
            </>
          )}

          {extraRows.map((row) => (
            <Fragment key={row.label}>
              <span className={row.className || ''}>{row.label}</span>
              <span className={`text-right font-medium ${row.className || ''}`}>{row.value}</span>
            </Fragment>
          ))}
        </div>
      </div>

      <div className={`grid w-full grid-cols-[1fr_auto] items-center gap-x-4 border-t border-slate-200 pt-3 font-bold tabular-nums ${compact ? 'text-base' : 'text-lg'}`}>
        <span className="text-slate-900">{t.cart.total}</span>
        <span className="text-primary-700">{formatPrice(totalOverride ?? displayTotal)}</span>
      </div>

      {footer && (
        <div className="border-t border-border pt-4">
          {footer}
        </div>
      )}

      {showCheckoutButton && (
        onCheckout ? (
          <Button onClick={onCheckout} className="w-full" size="lg">{t.cart.checkout}</Button>
        ) : (
          <Link to="/checkout" className="block">
            <Button className="w-full" size="lg">{t.cart.checkout}</Button>
          </Link>
        )
      )}
    </div>
  );
}
