import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from '../app/router';
import { Check, Copy } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { paymentService } from '../services/apiServices';
import { formatPrice } from '../utils/formatters';
import { formatOrderNumber } from '../utils/orderNumber';
import Button from '../components/ui/Button';
import Loader from '../components/ui/Loader';

/** How long to keep polling a card/wallet payment before showing "still processing". */
const PAYMOB_POLL_MS = 3000;
const PAYMOB_POLL_LIMIT = 30;
const FAWRY_POLL_MS = 15000;

/**
 * Landing page after a Paymob hosted checkout, and the Fawry "pay with this reference"
 * page. The server is the source of truth: this page polls /payment/status, which also
 * asks the gateway directly if a callback hasn't arrived yet.
 */
export default function PaymentResultPage() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const { refreshUser } = useAuth();
  const { clearCart } = useCart();
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('order_id');

  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [polls, setPolls] = useState(0);
  const [retrying, setRetrying] = useState(false);
  const [copied, setCopied] = useState(false);
  const paidHandled = useRef(false);

  const load = useCallback(async () => {
    if (!orderId) return;
    try {
      const { data: res } = await paymentService.status(orderId);
      setData(res);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || (isAr ? 'تعذر التحقق من حالة الدفع' : 'Could not check the payment status'));
    } finally {
      setPolls((n) => n + 1);
    }
  }, [orderId, isAr]);

  useEffect(() => { load(); }, [load]);

  const status = data?.order?.paymentStatus;
  const isFawry = data?.payment?.provider === 'fawry';

  useEffect(() => {
    if (status !== 'pending') return undefined;
    if (!isFawry && polls >= PAYMOB_POLL_LIMIT) return undefined;
    const timer = setTimeout(load, isFawry ? FAWRY_POLL_MS : PAYMOB_POLL_MS);
    return () => clearTimeout(timer);
  }, [status, isFawry, polls, load]);

  useEffect(() => {
    if (status === 'paid' && !paidHandled.current) {
      paidHandled.current = true;
      clearCart();
      refreshUser?.();
    }
  }, [status, clearCart, refreshUser]);

  const retry = async () => {
    setRetrying(true);
    try {
      const { data: pay } = await paymentService.start(orderId, language);
      if (pay.action === 'redirect' && pay.url) {
        window.location.href = pay.url;
        return;
      }
      await load();
    } catch (err) {
      setError(err.response?.data?.message || (isAr ? 'تعذر بدء الدفع' : 'Could not start the payment'));
    }
    setRetrying(false);
  };

  const copyReference = async () => {
    try {
      await navigator.clipboard.writeText(data.payment.fawryReferenceNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked — the number is on screen */ }
  };

  if (!orderId) {
    return (
      <Shell icon="⚠️" title={isAr ? 'طلب غير معروف' : 'Unknown order'}>
        <Actions isAr={isAr} />
      </Shell>
    );
  }

  if (!data && !error) {
    return (
      <div className="container-app flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <Loader size="lg" />
        <p className="text-sm text-text-muted">{isAr ? 'جاري التحقق من الدفع...' : 'Checking your payment...'}</p>
      </div>
    );
  }

  const order = data?.order;
  const summary = order && (
    <div className="mt-6 rounded-xl bg-surface p-4 text-sm">
      <p>
        <span className="text-text-muted">{isAr ? 'رقم الطلب:' : 'Order #:'}</span>{' '}
        <strong className="font-mono tabular-nums">{formatOrderNumber(order.orderNumber)}</strong>
      </p>
      <p className="mt-1">
        <span className="text-text-muted">{isAr ? 'الإجمالي:' : 'Total:'}</span> <strong>{formatPrice(order.total)}</strong>
      </p>
    </div>
  );

  if (status === 'paid') {
    return (
      <Shell icon="✅" title={isAr ? 'تم الدفع بنجاح!' : 'Payment successful!'} tone="success">
        <p className="mt-2 text-sm text-text-muted">
          {isAr ? 'استلمنا الدفع وطلبك قيد التجهيز.' : 'We received your payment and your order is being prepared.'}
        </p>
        {summary}
        {order.pointsEarned > 0 && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {isAr ? `🎁 +${order.pointsEarned} نقطة — راجع «نقاطي»` : `🎁 +${order.pointsEarned} points — see My Points`}
          </p>
        )}
        <Actions isAr={isAr} orderId={orderId} />
      </Shell>
    );
  }

  if (status === 'pending' && isFawry && data.payment.fawryReferenceNumber) {
    const expires = data.payment.expiresAt ? new Date(data.payment.expiresAt) : null;
    return (
      <Shell icon="🧾" title={isAr ? 'ادفع في فوري' : 'Pay at Fawry'}>
        <p className="mt-2 text-sm text-text-muted">
          {isAr
            ? 'ادفع المبلغ في أي منفذ فوري أو من تطبيق myFawry باستخدام الرقم المرجعي:'
            : 'Pay at any Fawry outlet or in the myFawry app using this reference number:'}
        </p>
        <button
          type="button"
          onClick={copyReference}
          className="mx-auto mt-4 flex items-center gap-3 rounded-2xl border-2 border-dashed border-primary-300 bg-primary-50 px-6 py-4"
          aria-label={isAr ? 'نسخ الرقم المرجعي' : 'Copy reference number'}
        >
          <span dir="ltr" className="font-mono text-3xl font-bold tracking-widest text-primary-800 tabular-nums">
            {data.payment.fawryReferenceNumber}
          </span>
          {copied ? <Check className="h-5 w-5 text-green-600" /> : <Copy className="h-5 w-5 text-primary-600" />}
        </button>
        <p className="mt-3 text-base font-bold">{formatPrice(order.total)}</p>
        {expires && (
          <p className="mt-1 text-xs text-text-muted">
            {isAr ? 'صالح حتى ' : 'Valid until '}
            {expires.toLocaleString(isAr ? 'ar-EG' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
          </p>
        )}
        <p className="mt-4 text-xs text-text-muted">
          {isAr
            ? 'سنبدأ تجهيز طلبك فور تأكيد الدفع — ستتحدث هذه الصفحة تلقائياً.'
            : 'We start preparing your order as soon as the payment is confirmed — this page updates automatically.'}
        </p>
        {summary}
        <Actions isAr={isAr} orderId={orderId} />
      </Shell>
    );
  }

  if (status === 'pending') {
    const gaveUp = polls >= PAYMOB_POLL_LIMIT;
    return (
      <Shell icon={gaveUp ? '⏳' : null} title={isAr ? 'جاري تأكيد الدفع' : 'Confirming your payment'}>
        {!gaveUp && <div className="mt-4 flex justify-center"><Loader size="md" /></div>}
        <p className="mt-3 text-sm text-text-muted">
          {gaveUp
            ? (isAr
              ? 'لم يصلنا تأكيد الدفع بعد. إذا تم خصم المبلغ فسيتأكد طلبك تلقائياً خلال دقائق.'
              : "We haven't received the confirmation yet. If you were charged, your order will be confirmed automatically within minutes.")
            : (isAr ? 'لحظات من فضلك...' : 'Just a moment...')}
        </p>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        {summary}
        <div className="mt-6 flex flex-col gap-3">
          {gaveUp && (
            <Button className="w-full" onClick={() => { setPolls(0); load(); }}>
              {isAr ? 'تحقق مرة أخرى' : 'Check again'}
            </Button>
          )}
          <Button variant="secondary" className="w-full" onClick={retry} loading={retrying}>
            {isAr ? 'لم أدفع — أعد المحاولة' : "I didn't pay — try again"}
          </Button>
          <Link to="/orders"><Button variant="secondary" className="w-full">{isAr ? 'طلباتي' : 'My Orders'}</Button></Link>
        </div>
      </Shell>
    );
  }

  // failed, or an error with no data
  return (
    <Shell icon="❌" title={isAr ? 'لم يكتمل الدفع' : 'Payment not completed'} tone="error">
      <p className="mt-2 text-sm text-text-muted">
        {isAr
          ? 'تم إلغاء الدفع أو رفضه، ولم يُخصم أي مبلغ. طلبك محفوظ ويمكنك الدفع مرة أخرى.'
          : 'The payment was cancelled or declined and you were not charged. Your order is saved — you can pay again.'}
      </p>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {summary}
      <div className="mt-6 flex flex-col gap-3">
        {order && order.orderStatus !== 'cancelled' && (
          <Button className="w-full" onClick={retry} loading={retrying}>{isAr ? 'ادفع مرة أخرى' : 'Pay again'}</Button>
        )}
        <Link to={`/orders/${orderId}`}>
          <Button variant="secondary" className="w-full">{isAr ? 'عرض الطلب' : 'View order'}</Button>
        </Link>
      </div>
    </Shell>
  );
}

function Shell({ icon, title, tone, children }) {
  const titleClass = tone === 'success' ? 'text-primary-700' : tone === 'error' ? 'text-red-600' : 'text-slate-900';
  return (
    <div className="container-app flex min-h-[60vh] items-center justify-center py-12">
      <div className="w-full max-w-md rounded-2xl border border-border bg-white p-8 text-center shadow-sm">
        {icon && <span className="text-6xl" aria-hidden="true">{icon}</span>}
        <h1 className={`mt-4 text-2xl font-bold ${titleClass}`}>{title}</h1>
        {children}
      </div>
    </div>
  );
}

function Actions({ isAr, orderId }) {
  return (
    <div className="mt-6 flex flex-col gap-3">
      {orderId && (
        <Link to={`/orders/${orderId}`}><Button className="w-full">{isAr ? 'عرض الطلب' : 'View order'}</Button></Link>
      )}
      <Link to="/"><Button variant="secondary" className="w-full">{isAr ? 'متابعة التسوق' : 'Continue shopping'}</Button></Link>
    </div>
  );
}
