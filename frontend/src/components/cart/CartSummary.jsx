import { Link } from '../../app/router';
import { Fragment } from 'react';
import { Gift } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useCart } from '../../context/CartContext';
import { formatPrice } from '../../utils/formatters';
import DiscountCodeInput, { FreeDeliveryBar } from './DiscountCodeInput';
import Button from '../ui/Button';

export default function CartSummary({
  showDiscount = true,
  showCheckoutButton = true,
  onCheckout,
  compact = false,
  hidePromoBanner = false,
  hideFreeDeliveryBar = false,
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
    items,
    appliedCoupon,
    discountCode,
    cartPromoSummary,
  } = useCart();

  const displaySubtotal = totalsOverride?.subtotal ?? subtotal;
  const displayDeliveryFee = totalsOverride?.deliveryFee ?? deliveryFee;
  const displayDiscountAmount = totalsOverride?.discountAmount ?? discountAmount;
  const displayTotal = totalsOverride?.total ?? total;
  const displayCoupon = totalsOverride?.appliedCoupon ?? appliedCoupon;
  const displayDiscountCode = totalsOverride?.appliedCoupon?.code ?? discountCode;

  if (items.length === 0) return null;

  const rows = (
    <div className="space-y-2.5 text-sm tabular-nums">
      <div className="grid w-full grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2.5">
        <span className={`text-text-muted ${isAr ? 'text-right' : 'text-left'}`}>{language === 'ar' ? 'المجموع الفرعي' : 'Subtotal'}</span>
        <span className="text-right font-semibold text-slate-800">{formatPrice(displaySubtotal)}</span>

        <span className={`text-text-muted ${isAr ? 'text-right' : 'text-left'}`}>{language === 'ar' ? 'رسوم التوصيل' : 'Delivery Fee'}</span>
        <span className="text-right font-semibold text-slate-800">
          {displayDeliveryFee === 0 ? (
            <span className="text-emerald-600">{language === 'ar' ? 'مجاني' : 'Free'}</span>
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
            <span className="text-right font-semibold text-primary-600">
              {displayDiscountAmount > 0 ? `− ${formatPrice(displayDiscountAmount)}` : (language === 'ar' ? 'مُطبّق' : 'Applied')}
            </span>
          </>
        )}

        {!displayCoupon && displayDiscountAmount > 0 && (
          <>
            <span className="text-primary-600">{language === 'ar' ? 'الخصم' : 'Discount'}</span>
            <span className="text-right font-semibold text-primary-600">− {formatPrice(displayDiscountAmount)}</span>
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
  );

  const checkoutButton = showCheckoutButton && (
    onCheckout ? (
      <Button onClick={onCheckout} className="w-full" size="lg">{t.cart.checkout}</Button>
    ) : (
      <Link to="/checkout" className="block">
        <Button className="w-full" size="lg">{t.cart.checkout}</Button>
      </Link>
    )
  );

  if (compact) {
    return (
      <div className="space-y-3">
        {showDiscount && <DiscountCodeInput compact hideHint={hideCouponHint} />}

        {!hidePromoBanner && cartPromoSummary?.hasAnyOffer && (
          <div className="flex items-start gap-2 text-xs font-medium text-violet-700">
            <Gift className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <p className="leading-snug">
              {cartPromoSummary.summaryLabel || (isAr ? 'عروض نشطة على منتجاتك' : 'Active offers on your items')}
            </p>
          </div>
        )}

        {rows}

        <div className="flex items-center justify-between tabular-nums">
          <span className="text-sm font-bold text-slate-900">{t.cart.total}</span>
          <span className="text-lg font-extrabold text-primary-700">{formatPrice(totalOverride ?? displayTotal)}</span>
        </div>

        {footer}
        {checkoutButton}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="border-b border-slate-100 bg-slate-50/60 px-5 py-3 sm:px-6">
        <h2 className="text-sm font-bold text-slate-800">
          {isAr ? 'ملخص الطلب' : 'Order Summary'}
        </h2>
      </div>

      <div className="space-y-4 p-5 sm:p-6">
        {!hideFreeDeliveryBar && <FreeDeliveryBar />}

        {showDiscount && <DiscountCodeInput hideHint />}

        {rows}
      </div>

      <div className="rounded-b-2xl border-t border-slate-100 bg-white p-5 sm:p-6 lg:sticky lg:bottom-6">
        <div className="mb-4 flex items-center justify-between tabular-nums">
          <span className="text-base font-bold text-slate-900">{t.cart.total}</span>
          <span className="text-2xl font-extrabold text-primary-700">{formatPrice(totalOverride ?? displayTotal)}</span>
        </div>
        {footer}
        <div className="hidden lg:block">{checkoutButton}</div>
      </div>
    </div>
  );
}
