import { useEffect, useState } from 'react';
import { Link, useLocation, useSearchParams } from '../app/router';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { paymentService } from '../services/apiServices';
import { formatPrice } from '../utils/formatters';
import { formatOrderNumber } from '../utils/orderNumber';
import Button from '../components/ui/Button';
import Loader from '../components/ui/Loader';

export default function PaymentSuccessPage() {
  const { language } = useLanguage();
  const { refreshUser } = useAuth();
  const { state } = useLocation();
  const [searchParams] = useSearchParams();
  const { clearCart } = useCart();

  const sessionId = searchParams.get('session_id');
  const orderId = searchParams.get('order_id');

  const [loading, setLoading] = useState(Boolean(sessionId && orderId));
  const [error, setError] = useState('');
  const [order, setOrder] = useState(null);

  useEffect(() => {
    if (!sessionId || !orderId) return;

    paymentService.verifySession(sessionId, orderId)
      .then(({ data }) => {
        if (data.success && data.order) {
          setOrder(data.order);
          clearCart();
          refreshUser?.();
        } else {
          setError(data.message || (language === 'ar' ? 'لم يكتمل الدفع' : 'Payment not completed'));
        }
      })
      .catch((err) => {
        setError(err.response?.data?.message || (language === 'ar' ? 'تعذر التحقق من الدفع' : 'Could not verify payment'));
      })
      .finally(() => setLoading(false));
  }, [sessionId, orderId, clearCart, language, refreshUser]);

  const orderNumber = order?.orderNumber || state?.orderNumber || 'MP-000000';
  const total = order?.total ?? state?.total ?? 0;
  const pointsEarned = order?.pointsEarned ?? state?.pointsEarned ?? 0;
  const cod = state?.cod && !sessionId;

  if (loading) {
    return (
      <div className="container-app flex min-h-[60vh] items-center justify-center">
        <Loader size="lg" />
      </div>
    );
  }

  if (error && sessionId) {
    return (
      <div className="container-app flex min-h-[60vh] items-center justify-center py-12">
        <div className="w-full max-w-md rounded-2xl border border-border bg-white p-8 text-center shadow-sm">
          <span className="text-6xl">⚠️</span>
          <h1 className="mt-4 text-xl font-bold text-amber-700">
            {language === 'ar' ? 'جاري معالجة الدفع' : 'Payment Processing'}
          </h1>
          <p className="mt-2 text-sm text-text-muted">{error}</p>
          <p className="mt-2 text-xs text-text-muted">
            {language === 'ar'
              ? 'إذا تم خصم المبلغ، سيظهر الطلب في "طلباتي" قريباً.'
              : 'If you were charged, your order will appear in My Orders shortly.'}
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <Link to="/orders"><Button className="w-full">{language === 'ar' ? 'طلباتي' : 'My Orders'}</Button></Link>
            {orderId && (
              <Link to={`/payment?orderId=${orderId}`}>
                <Button variant="secondary" className="w-full">{language === 'ar' ? 'إعادة الدفع' : 'Pay Again'}</Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container-app flex min-h-[60vh] items-center justify-center py-12">
      <div className="w-full max-w-md rounded-2xl border border-border bg-white p-8 text-center shadow-sm">
        <span className="text-6xl">✅</span>
        <h1 className="mt-4 text-2xl font-bold text-primary-700">
          {language === 'ar' ? 'تم الطلب بنجاح!' : 'Order Placed Successfully!'}
        </h1>
        <p className="mt-2 text-sm text-text-muted">
          {cod
            ? (language === 'ar' ? 'سيتم الدفع عند الاستلام' : 'Pay on delivery')
            : (language === 'ar' ? 'تم الدفع بنجاح' : 'Payment successful')}
        </p>
        <div className="mt-6 rounded-xl bg-surface p-4 text-sm">
          <p><span className="text-text-muted">{language === 'ar' ? 'رقم الطلب:' : 'Order #:'}</span> <strong className="font-mono tabular-nums">{formatOrderNumber(orderNumber)}</strong></p>
          {total > 0 && <p className="mt-1"><span className="text-text-muted">{language === 'ar' ? 'الإجمالي:' : 'Total:'}</span> <strong>{formatPrice(total)}</strong></p>}
          {pointsEarned > 0 && (
            <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-amber-900">
              {language === 'ar'
                ? `🎁 +${pointsEarned} نقطة استرداد نقدي (1%) — راجع «نقاطي»`
                : `🎁 +${pointsEarned} cashback points (1%) — see My Points`}
            </p>
          )}
        </div>
        <div className="mt-6 flex flex-col gap-3">
          <Link to="/orders"><Button className="w-full">{language === 'ar' ? 'طلباتي' : 'My Orders'}</Button></Link>
          {pointsEarned > 0 && (
            <Link to="/my-points"><Button variant="secondary" className="w-full">{language === 'ar' ? 'نقاطي' : 'My Points'}</Button></Link>
          )}
          <Link to="/"><Button variant="secondary" className="w-full">{language === 'ar' ? 'متابعة التسوق' : 'Continue Shopping'}</Button></Link>
        </div>
      </div>
    </div>
  );
}
