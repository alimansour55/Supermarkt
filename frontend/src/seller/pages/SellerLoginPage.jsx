import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from '../../app/router';
import { Lock, Mail, Store } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/ui/Button';
import Loader from '../../components/ui/Loader';

const SELLER_ROLES = ['seller_owner', 'seller_staff'];

export default function SellerLoginPage() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const { user, loading, isAuthenticated, sellerLogin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.startsWith('/seller-center') ? location.state.from : '/seller-center';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && isAuthenticated && SELLER_ROLES.includes(user?.role)) {
      navigate(from, { replace: true });
    }
  }, [loading, isAuthenticated, user, navigate, from]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await sellerLogin(email.trim().toLowerCase(), password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || (isAr ? 'فشل تسجيل الدخول' : 'Sign in failed'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-900"><Loader size="lg" /></div>;
  }

  const fieldClass = 'w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 ps-10 pe-4 text-sm focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200';

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 px-4 py-12" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-indigo-700">
            <Store className="h-6 w-6" aria-hidden />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">{isAr ? 'دخول مركز البائعين' : 'Seller Center sign in'}</h1>
            <p className="text-sm text-slate-500">{isAr ? 'أدر منتجاتك وطلباتك ومدفوعاتك' : 'Manage your products, orders and payouts'}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {error && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{error}</p>
          )}
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-800">{isAr ? 'البريد الإلكتروني' : 'Email'}</span>
            <span className="relative block">
              <Mail className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={fieldClass} dir="ltr" autoComplete="username" required />
            </span>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-800">{isAr ? 'كلمة المرور' : 'Password'}</span>
            <span className="relative block">
              <Lock className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={fieldClass} dir="ltr" autoComplete="current-password" required />
            </span>
          </label>
          <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700" disabled={submitting || !email || !password}>
            {submitting ? (isAr ? 'جاري الدخول...' : 'Signing in...') : (isAr ? 'دخول' : 'Sign in')}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          {isAr ? 'ليس لديك متجر بعد؟ ' : "Don't have a store yet? "}
          <Link to={`/${language}/sell-with-us`} className="font-semibold text-indigo-700 hover:underline">
            {isAr ? 'سجّل كبائع' : 'Become a seller'}
          </Link>
        </p>
      </div>
    </div>
  );
}
