import { useEffect, useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useCart } from '../context/CartContext';
import { paymentService } from '../services/apiServices';
import Loader from '../components/ui/Loader';
import Button from '../components/ui/Button';

export default function PaymentPage() {
  const { language } = useLanguage();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { clearCart } = useCart();
  const orderId = params.get('orderId');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!orderId) {
      navigate('/cart');
      return;
    }

    paymentService.createCheckoutSession(orderId)
      .then(({ data }) => {
        if (data.alreadyPaid) {
          clearCart();
          navigate('/payment/success', {
            state: { orderNumber: data.orderNumber, total: data.total },
          });
          return;
        }

        if (data.url) {
          window.location.href = data.url;
          return;
        }

        throw new Error('No checkout URL returned');
      })
      .catch((err) => {
        setError(err.response?.data?.message || err.message || 'Payment setup failed');
        setLoading(false);
      });
  }, [orderId, navigate, clearCart]);

  if (loading && !error) {
    return (
      <div className="container-app flex min-h-[50vh] flex-col items-center justify-center gap-4">
        <Loader size="lg" />
        <p className="text-sm text-text-muted">
          {language === 'ar' ? 'جاري تحويلك إلى صفحة الدفع الآمنة...' : 'Redirecting to secure payment...'}
        </p>
      </div>
    );
  }

  return (
    <div className="container-app py-20 text-center">
      <p className="text-red-600">{error}</p>
      <div className="mt-4 flex flex-col items-center gap-3">
        {orderId && (
          <Link to={`/payment?orderId=${orderId}`}>
            <Button>{language === 'ar' ? 'إعادة المحاولة' : 'Try Again'}</Button>
          </Link>
        )}
        <Link to="/checkout">
          <Button variant="secondary">{language === 'ar' ? 'العودة للدفع' : 'Back to Checkout'}</Button>
        </Link>
      </div>
    </div>
  );
}
