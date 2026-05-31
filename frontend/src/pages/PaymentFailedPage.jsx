import { Link, useSearchParams } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import Button from '../components/ui/Button';

export default function PaymentFailedPage() {
  const { language } = useLanguage();
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('order_id');

  return (
    <div className="container-app flex min-h-[60vh] items-center justify-center py-12">
      <div className="w-full max-w-md rounded-2xl border border-border bg-white p-8 text-center shadow-sm">
        <span className="text-6xl">❌</span>
        <h1 className="mt-4 text-2xl font-bold text-red-600">
          {language === 'ar' ? 'فشل الدفع' : 'Payment Failed'}
        </h1>
        <p className="mt-2 text-sm text-text-muted">
          {language === 'ar'
            ? 'تم إلغاء الدفع أو فشل. لم يتم خصم أي مبلغ. يمكنك المحاولة مرة أخرى.'
            : 'Payment was cancelled or failed. You were not charged. You can try again.'}
        </p>
        <div className="mt-6 flex flex-col gap-3">
          {orderId ? (
            <Link to={`/payment?orderId=${orderId}`}>
              <Button className="w-full">{language === 'ar' ? 'حاول مرة أخرى' : 'Try Again'}</Button>
            </Link>
          ) : (
            <Link to="/checkout">
              <Button className="w-full">{language === 'ar' ? 'حاول مرة أخرى' : 'Try Again'}</Button>
            </Link>
          )}
          <Link to="/orders">
            <Button variant="secondary" className="w-full">{language === 'ar' ? 'طلباتي' : 'My Orders'}</Button>
          </Link>
          <Link to="/cart">
            <Button variant="secondary" className="w-full">{language === 'ar' ? 'العودة للسلة' : 'Back to Cart'}</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
