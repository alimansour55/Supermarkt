import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
export default function TrackOrderPage() {
  const { language } = useLanguage();
  const { isAuthenticated } = useAuth();
  const isAr = language === 'ar';

  return (
    <div className="container-app py-8 max-w-2xl">
      <h1 className="mb-4 text-2xl font-bold md:text-3xl">{isAr ? 'تتبع الطلب' : 'Track Order'}</h1>
      <p className="mb-8 text-text-muted">
        {isAr
          ? 'اعرض حالة طلباتك وتفاصيل التوصيل من حسابك.'
          : 'View your order status and delivery details from your account.'}
      </p>
      <div className="rounded-2xl border border-border bg-white p-6 space-y-4">
        {isAuthenticated ? (
          <>
            <p className="text-sm text-text">
              {isAr ? 'انتقل إلى طلباتي لعرض كل الطلبات وفتح تفاصيل أي طلب.' : 'Go to My Orders to see all orders and open any order for full details.'}
            </p>
            <Link to="/orders" className="inline-flex items-center justify-center rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700">
              {isAr ? 'طلباتي' : 'My Orders'}
            </Link>
          </>
        ) : (
          <>
            <p className="text-sm text-text">
              {isAr
                ? 'سجّل الدخول برقم هاتفك لعرض طلباتك. رقم الطلب يظهر في رسالة التأكيد (مثل MP-20250101-0001).'
                : 'Sign in with your phone to view orders. Your order number is in the confirmation (e.g. MP-20250101-0001).'}
            </p>
            <Link to="/login" className="inline-flex items-center justify-center rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700">
              {isAr ? 'تسجيل الدخول' : 'Sign In'}
            </Link>
          </>
        )}
        <p className="text-xs text-text-muted pt-2 border-t border-border">
          {isAr ? 'تحتاج مساعدة؟ ' : 'Need help? '}
          <Link to="/contact" className="text-primary-600 hover:underline">{isAr ? 'اتصل بنا' : 'Contact us'}</Link>
        </p>
      </div>
    </div>
  );
}
