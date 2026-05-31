import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useCart } from '../context/CartContext';
import { useLocation } from '../context/LocationContext';
import { useAuth } from '../context/AuthContext';
import { formatPrice } from '../utils/formatters';
import { orderService, paymentService } from '../services/apiServices';
import Input from '../components/ui/Input';
import PhoneInput from '../components/ui/PhoneInput';
import Button from '../components/ui/Button';
import Loader from '../components/ui/Loader';
import CartSummary from '../components/cart/CartSummary';
import { localToEgyptPhone, parseLocalPhone } from '../utils/phoneHelpers';

export default function CheckoutPage() {
  const { t, language } = useLanguage();
  const {
    items,
    subtotal,
    deliveryFee,
    discountAmount,
    total,
    discountCode,
    deliveryMethod,
    clearCart,
    setDeliveryMethod,
  } = useCart();
  const { location } = useLocation();
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cod');
  const [form, setForm] = useState({
    street: '',
    building: '',
    floor: '',
    phoneLocal: parseLocalPhone(user?.phoneDisplay || user?.phone || ''),
    notes: '',
    scheduledDate: '',
    scheduledTime: 'morning',
  });

  if (items.length === 0) {
    return (
      <div className="container-app py-20 text-center">
        <p>{t.cart.empty}</p>
        <Link to="/products" className="mt-4 inline-block text-primary-600">
          {language === 'ar' ? 'تسوق الآن' : 'Shop Now'}
        </Link>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!isAuthenticated) {
      navigate('/login', { state: { from: '/checkout' } });
      return;
    }

    setLoading(true);
    try {
      const fullStreet = [form.street, form.building, form.floor].filter(Boolean).join(', ');
      const scheduledDate = deliveryMethod === 'scheduled' && form.scheduledDate
        ? new Date(`${form.scheduledDate}T${form.scheduledTime === 'morning' ? '10:00' : '18:00'}:00`)
        : undefined;

      const { data } = await orderService.create({
        items,
        shippingAddress: {
          street: fullStreet,
          governorate: language === 'ar' ? location.nameAr : location.nameEn,
        },
        area: language === 'ar' ? location.nameAr : location.nameEn,
        phone: localToEgyptPhone(form.phoneLocal),
        notes: form.notes,
        paymentMethod,
        deliveryMethod,
        scheduledDate,
        discountCode,
      });

      if (paymentMethod === 'stripe') {
        const { data: paymentData } = await paymentService.createCheckoutSession(data.order.id);
        if (paymentData.url) {
          clearCart();
          window.location.href = paymentData.url;
          return;
        }
        navigate(`/payment?orderId=${data.order.id}`);
      } else {
        clearCart();
        navigate('/payment/success', {
          state: {
            orderNumber: data.order.orderNumber,
            total: data.order.total,
            cod: true,
          },
        });
      }
    } catch (err) {
      setError(err.response?.data?.message || t.common.error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container-app py-8">
      <nav className="mb-6 text-sm text-text-muted">
        <Link to="/" className="hover:text-primary-600">{language === 'ar' ? 'الرئيسية' : 'Home'}</Link>
        {' / '}
        <Link to="/cart" className="hover:text-primary-600">{t.nav.cart}</Link>
        {' / '}
        <span>{language === 'ar' ? 'إتمام الشراء' : 'Checkout'}</span>
      </nav>

      <h1 className="mb-8 text-2xl font-bold md:text-3xl">
        {language === 'ar' ? 'إتمام الشراء' : 'Checkout'}
      </h1>

      {!isAuthenticated && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
          {language === 'ar' ? 'يجب تسجيل الدخول لإتمام الطلب.' : 'Please login to complete your order.'}{' '}
          <Link to="/login" state={{ from: '/checkout' }} className="font-semibold text-primary-600">
            {t.nav.login}
          </Link>
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Address */}
          <section className="rounded-2xl border border-border bg-white p-6">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
              📍 {language === 'ar' ? 'عنوان التوصيل' : 'Delivery Address'}
            </h2>
            <p className="mb-4 rounded-xl bg-primary-50 px-4 py-2 text-sm font-medium text-primary-700">
              {language === 'ar' ? location.nameAr : location.nameEn}
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Input
                  label={language === 'ar' ? 'الشارع' : 'Street'}
                  value={form.street}
                  onChange={(e) => setForm({ ...form, street: e.target.value })}
                  required
                />
              </div>
              <Input
                label={language === 'ar' ? 'رقم العمارة' : 'Building No.'}
                value={form.building}
                onChange={(e) => setForm({ ...form, building: e.target.value })}
              />
              <Input
                label={language === 'ar' ? 'الدور / الشقة' : 'Floor / Apt'}
                value={form.floor}
                onChange={(e) => setForm({ ...form, floor: e.target.value })}
              />
              <div className="sm:col-span-2">
                <PhoneInput
                  label={language === 'ar' ? 'رقم الهاتف' : 'Phone Number'}
                  value={form.phoneLocal}
                  onChange={(phoneLocal) => setForm({ ...form, phoneLocal })}
                  required
                />
              </div>
            </div>
          </section>

          {/* Delivery method */}
          <section className="rounded-2xl border border-border bg-white p-6">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
              🚚 {language === 'ar' ? 'طريقة التوصيل' : 'Delivery Method'}
            </h2>
            <div className="space-y-3">
              <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${deliveryMethod === 'scheduled' ? 'border-primary-500 bg-primary-50' : 'border-border hover:border-primary-200'}`}>
                <input
                  type="radio"
                  name="deliveryMethodCheckout"
                  checked={deliveryMethod === 'scheduled'}
                  onChange={() => setDeliveryMethod('scheduled')}
                  className="mt-1"
                />
                <div className="flex-1">
                  <p className="font-semibold">{language === 'ar' ? 'توصيل مجدول' : 'Scheduled Delivery'}</p>
                  <p className="mt-0.5 text-sm text-text-muted">
                    {language === 'ar' ? 'اختر موعد التوصيل — خلال 4-6 ساعات' : 'Choose delivery slot — within 4-6 hours'}
                  </p>
                  {deliveryMethod === 'scheduled' && (
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <input
                        type="date"
                        value={form.scheduledDate}
                        min={new Date().toISOString().split('T')[0]}
                        onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })}
                        className="rounded-xl border border-border px-3 py-2 text-sm"
                        required
                      />
                      <select
                        value={form.scheduledTime}
                        onChange={(e) => setForm({ ...form, scheduledTime: e.target.value })}
                        className="rounded-xl border border-border px-3 py-2 text-sm"
                      >
                        <option value="morning">{language === 'ar' ? 'صباحاً (9-12)' : 'Morning (9-12)'}</option>
                        <option value="afternoon">{language === 'ar' ? 'مساءً (2-6)' : 'Afternoon (2-6)'}</option>
                        <option value="evening">{language === 'ar' ? 'ليلاً (6-9)' : 'Evening (6-9)'}</option>
                      </select>
                    </div>
                  )}
                </div>
                <span className="shrink-0 text-sm font-medium text-primary-600">
                  {subtotal >= 500 ? (language === 'ar' ? 'مجاني' : 'Free') : formatPrice(29.99)}
                </span>
              </label>

              <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${deliveryMethod === 'express' ? 'border-primary-500 bg-primary-50' : 'border-border hover:border-primary-200'}`}>
                <input
                  type="radio"
                  name="deliveryMethodCheckout"
                  checked={deliveryMethod === 'express'}
                  onChange={() => setDeliveryMethod('express')}
                  className="mt-1"
                />
                <div className="flex-1">
                  <p className="font-semibold">{language === 'ar' ? 'توصيل سريع' : 'Express Delivery'}</p>
                  <p className="mt-0.5 text-sm text-text-muted">
                    {language === 'ar' ? 'توصيل خلال ساعتين' : 'Delivery within 2 hours'}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-medium">{formatPrice(49.99)}</span>
              </label>
            </div>
            <p className="mt-3 text-xs text-text-muted">
              {language === 'ar' ? '* غيّر طريقة التوصيل من صفحة السلة' : '* Change delivery method from cart page'}
            </p>
          </section>

          {/* Payment */}
          <section className="rounded-2xl border border-border bg-white p-6">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
              💳 {language === 'ar' ? 'طريقة الدفع' : 'Payment Method'}
            </h2>
            <div className="space-y-3">
              <label className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition-colors ${paymentMethod === 'stripe' ? 'border-primary-500 bg-primary-50' : 'border-border'}`}>
                <input type="radio" name="payment" value="stripe" checked={paymentMethod === 'stripe'} onChange={() => setPaymentMethod('stripe')} />
                <div>
                  <p className="font-semibold">{language === 'ar' ? 'دفع أونلاين (Stripe)' : 'Online Payment (Stripe)'}</p>
                  <p className="text-xs text-text-muted">{language === 'ar' ? 'فيزا / مastercard / Meeza' : 'Visa / Mastercard / Meeza'}</p>
                </div>
              </label>
              <label className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition-colors ${paymentMethod === 'cod' ? 'border-primary-500 bg-primary-50' : 'border-border'}`}>
                <input type="radio" name="payment" value="cod" checked={paymentMethod === 'cod'} onChange={() => setPaymentMethod('cod')} />
                <div>
                  <p className="font-semibold">{language === 'ar' ? 'الدفع عند الاستلام' : 'Cash on Delivery'}</p>
                  <p className="text-xs text-text-muted">{language === 'ar' ? 'ادفع نقداً أو بالبطاقة للمندوب' : 'Pay cash or card to delivery agent'}</p>
                </div>
              </label>
            </div>
          </section>

          {/* Notes */}
          <section className="rounded-2xl border border-border bg-white p-6">
            <h2 className="mb-4 font-bold">{language === 'ar' ? 'ملاحظات الطلب' : 'Order Notes'}</h2>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
              placeholder={language === 'ar' ? 'تعليمات إضافية للتوصيل...' : 'Additional delivery instructions...'}
              className="w-full rounded-xl border border-border px-4 py-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
            />
          </section>

          {/* Items preview */}
          <section className="rounded-2xl border border-border bg-white p-6">
            <h2 className="mb-4 font-bold">
              {language === 'ar' ? 'المنتجات' : 'Items'} ({items.length})
            </h2>
            <div className="divide-y divide-border">
              {items.map((item) => (
                <div key={item.productId} className="flex justify-between py-3 text-sm">
                  <span className="flex items-center gap-2">
                    <span>{item.emoji}</span>
                    {language === 'ar' ? item.name : item.nameEn} × {item.quantity}
                  </span>
                  <span className="font-medium">{formatPrice(item.price * item.quantity)}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="h-fit lg:sticky lg:top-36">
          <CartSummary showDiscount showCheckoutButton={false} />
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          <Button type="submit" className="mt-4 w-full" size="lg" disabled={loading}>
            {loading ? <Loader size="sm" /> : (language === 'ar' ? 'تأكيد الطلب' : 'Confirm Order')}
          </Button>
          <p className="mt-3 text-center text-xs text-text-muted">
            {language === 'ar' ? 'بالتأكيد أنت توافق على الشروط والأحكام' : 'By confirming you agree to terms & conditions'}
          </p>
        </div>
      </form>
    </div>
  );
}
