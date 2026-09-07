import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, Truck, User } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/ui/Button';
import Loader from '../../components/ui/Loader';

export default function DriverLoginPage() {
  const { language } = useLanguage();
  const { user, loading, isAuthenticated, driverLogin } = useAuth();
  const navigate = useNavigate();
  const isAr = language === 'ar';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && isAuthenticated && user?.role === 'driver') {
      navigate('/driver', { replace: true });
    }
  }, [loading, isAuthenticated, user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await driverLogin(username.trim().toLowerCase(), password);
      navigate('/driver', { replace: true });
    } catch (err) {
      const msg = err.response?.data?.message;
      setError(
        msg
          || (isAr ? 'فشل تسجيل الدخول' : 'Sign in failed'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900">
        <Loader size="lg" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-teal-950 px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white p-6 shadow-2xl sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-100 text-teal-700">
            <Truck className="h-6 w-6" aria-hidden />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text">
              {isAr ? 'دخول مندوب التوصيل' : 'Driver sign in'}
            </h1>
            <p className="text-sm text-text-muted">
              {isAr ? 'الطلبات المعيّنة لك والتوصيل المباشر' : 'Your assigned deliveries & live GPS'}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {error && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
              {error}
            </p>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-medium text-text">
              {isAr ? 'اسم المستخدم' : 'Username'}
            </label>
            <div className="relative">
              <User className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-xl border border-border bg-slate-50 py-2.5 ps-10 pe-4 text-sm focus:border-teal-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-200"
                dir="ltr"
                autoComplete="username"
                required
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-text">
              {isAr ? 'كلمة المرور' : 'Password'}
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-border bg-slate-50 py-2.5 ps-10 pe-4 text-sm focus:border-teal-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-200"
                dir="ltr"
                autoComplete="current-password"
                required
              />
            </div>
          </div>

          <Button type="submit" className="w-full bg-teal-600 hover:bg-teal-700" disabled={submitting}>
            {submitting ? (isAr ? 'جاري الدخول...' : 'Signing in...') : (isAr ? 'دخول' : 'Sign in')}
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-text-muted">
          {isAr ? 'يمكنك أيضاً الدخول برقم الهاتف من ' : 'You can also sign in with phone at '}
          <Link to="/login" className="font-medium text-teal-700 hover:underline">
            {isAr ? 'تسجيل الدخول' : 'customer login'}
          </Link>
        </p>
      </div>
    </div>
  );
}
