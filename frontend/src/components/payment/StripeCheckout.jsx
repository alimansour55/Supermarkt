import { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { useCart } from '../../context/CartContext';
import { paymentService } from '../../services/apiServices';
import Button from '../ui/Button';
import Loader from '../ui/Loader';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');

function StripeForm({ orderId, orderNumber, total }) {
  const stripe = useStripe();
  const elements = useElements();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { clearCart } = useCart();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handlePay = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setLoading(true);
    setError('');

    const { error: submitError } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    });

    if (submitError) {
      setError(submitError.message);
      setLoading(false);
      return;
    }

    try {
      await paymentService.confirm(orderId);
      clearCart();
      navigate('/payment/success', { state: { orderNumber, total, stripe: true } });
    } catch {
      navigate('/payment/failed', { state: { orderId } });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handlePay} className="space-y-6">
      <PaymentElement />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" className="w-full" size="lg" disabled={!stripe || loading}>
        {loading ? <Loader size="sm" /> : (language === 'ar' ? 'ادفع الآن' : 'Pay Now')}
      </Button>
    </form>
  );
}

export default function StripeCheckout({ orderId, orderNumber, total, clientSecret }) {
  const { language } = useLanguage();

  if (!clientSecret) {
    return (
      <div className="py-8 text-center text-text-muted">
        {language === 'ar' ? 'Stripe غير مُعد — استخدم COD' : 'Stripe not configured — use COD'}
      </div>
    );
  }

  const options = { clientSecret, appearance: { theme: 'stripe', variables: { colorPrimary: '#059669' } } };

  return (
    <Elements stripe={stripePromise} options={options}>
      <StripeForm orderId={orderId} orderNumber={orderNumber} total={total} />
    </Elements>
  );
}
