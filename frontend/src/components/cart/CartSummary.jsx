import { Link } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { useCart } from '../../context/CartContext';
import { formatPrice } from '../../utils/formatters';
import DiscountCodeInput, { FreeDeliveryBar } from './DiscountCodeInput';
import Button from '../ui/Button';

export default function CartSummary({
  showDiscount = true,
  showDeliverySelector = false,
  showCheckoutButton = true,
  onCheckout,
  compact = false,
}) {
  const { t, language } = useLanguage();
  const {
    subtotal,
    deliveryFee,
    discountAmount,
    total,
    deliveryMethod,
    setDeliveryMethod,
    items,
  } = useCart();

  if (items.length === 0) return null;

  return (
    <div className={`space-y-4 ${compact ? '' : 'rounded-2xl border border-border bg-white p-6'}`}>
      {!compact && <FreeDeliveryBar />}

      {showDeliverySelector && (
        <div className="space-y-2">
          <p className="text-sm font-semibold">{language === 'ar' ? 'طريقة التوصيل' : 'Delivery Method'}</p>
          <label className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm transition-colors ${deliveryMethod === 'scheduled' ? 'border-primary-500 bg-primary-50' : 'border-border'}`}>
            <input type="radio" name="deliveryMethod" checked={deliveryMethod === 'scheduled'} onChange={() => setDeliveryMethod('scheduled')} />
            <div>
              <p className="font-medium">{language === 'ar' ? 'توصيل مجدول' : 'Scheduled Delivery'}</p>
              <p className="text-xs text-text-muted">{language === 'ar' ? 'خلال 4-6 ساعات' : 'Within 4-6 hours'}</p>
            </div>
          </label>
          <label className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm transition-colors ${deliveryMethod === 'express' ? 'border-primary-500 bg-primary-50' : 'border-border'}`}>
            <input type="radio" name="deliveryMethod" checked={deliveryMethod === 'express'} onChange={() => setDeliveryMethod('express')} />
            <div>
              <p className="font-medium">{language === 'ar' ? 'توصيل سريع' : 'Express Delivery'}</p>
              <p className="text-xs text-text-muted">{language === 'ar' ? 'خلال ساعتين' : 'Within 2 hours'}</p>
            </div>
          </label>
        </div>
      )}

      {showDiscount && <DiscountCodeInput compact={compact} />}

      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-text-muted">{language === 'ar' ? 'المجموع الفرعي' : 'Subtotal'}</span>
          <span className="font-medium">{formatPrice(subtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-muted">{language === 'ar' ? 'رسوم التوصيل' : 'Delivery Fee'}</span>
          <span className="font-medium">
            {deliveryFee === 0 ? (
              <span className="text-primary-600">{language === 'ar' ? 'مجاني' : 'Free'}</span>
            ) : (
              formatPrice(deliveryFee)
            )}
          </span>
        </div>
        {discountAmount > 0 && (
          <div className="flex justify-between text-primary-600">
            <span>{language === 'ar' ? 'الخصم' : 'Discount'}</span>
            <span className="font-medium">− {formatPrice(discountAmount)}</span>
          </div>
        )}
      </div>

      <div className="flex justify-between border-t border-border pt-3 text-lg font-bold">
        <span>{t.cart.total}</span>
        <span className="text-primary-700">{formatPrice(total)}</span>
      </div>

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
