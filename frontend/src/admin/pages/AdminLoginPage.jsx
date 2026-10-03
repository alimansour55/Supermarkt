import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Lock, User } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { useStoreSettings } from '../../context/StoreSettingsContext';
import { APP_NAME, APP_NAME_EN } from '../../utils/constants';
import { isStaffRole } from '../adminPermissions';
import Loader from '../../components/ui/Loader';
import Button from '../../components/ui/Button';

const ADMIN_LOGIN_ERRORS = {
  ar: {
    'Invalid admin password': 'كلمة المرور غير صحيحة',
    'Invalid username or password': 'اسم المستخدم أو كلمة المرور غير صحيحة',
    'Admin password login is not configured on the server': 'تسجيل دخول الإدارة غير مُعد على الخادم',
    'No admin account found. Run npm run seed from the project root.': 'لا يوجد حساب إدارة. شغّل npm run seed في مجلد backend',
    'Password is required': 'كلمة المرور مطلوبة',
    'This account does not have a password set': 'هذا الحساب لا يملك كلمة مرور',
  },
};

function mapAdminLoginError(message, isAr) {
  if (!isAr || !message) return message;
  return ADMIN_LOGIN_ERRORS.ar[message] || message;
}

export default function AdminLoginPage() {
  const { language } = useLanguage();
  const { user, loading, isAuthenticated, adminLogin } = useAuth();
  const { settings } = useStoreSettings();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || '/admin';
  const isAr = language === 'ar';
  const storeName = isAr
    ? (settings?.storeNameAr || APP_NAME)
    : (settings?.storeNameEn || APP_NAME_EN);
  const sessionExpired = location.state?.reason === 'session';
  const staffRequired = location.state?.reason === 'staff_required';
  const customerSignedIn = staffRequired && isAuthenticated && user && !isStaffRole(user?.role);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && isAuthenticated && isStaffRole(user?.role)) {
      navigate(from, { replace: true });
    }
  }, [loading, isAuthenticated, user, navigate, from]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const trimmedUser = username.trim().toLowerCase();
      const trimmedPass = password.trim();
      if (trimmedUser) {
        await adminLogin(trimmedUser, trimmedPass);
      } else {
        await adminLogin(trimmedPass);
      }
      navigate(from, { replace: true });
    } catch (err) {
      if (!err.response) {
        setError(
          isAr
            ? 'لا يمكن الاتصال بالخادم — تأكد أن backend يعمل على المنفذ 5001'
            : 'Cannot reach server — ensure backend is running on port 5001',
        );
      } else {
        const msg = err.response?.data?.message;
        setError(mapAdminLoginError(msg, isAr) || (isAr ? 'فشل تسجيل الدخول' : 'Sign in failed'));
      }
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
    <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-800 p-8 shadow-2xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-600/20 text-primary-400">
            <Lock className="h-7 w-7" aria-hidden />
          </div>
          <p className="text-2xl font-bold text-primary-400">{storeName}</p>
          <h1 className="mt-2 text-xl font-semibold text-white">
            {isAr ? 'تسجيل دخول الإدارة' : 'Admin Login'}
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            {isAr ? 'أدخل اسم المستخدم وكلمة المرور' : 'Enter your username and password'}
          </p>
        </div>

        {sessionExpired && (
          <p className="mb-4 rounded-lg bg-amber-900/40 px-3 py-2 text-center text-sm text-amber-200">
            {isAr ? 'انتهت الجلسة — سجّل الدخول مرة أخرى' : 'Session expired — please sign in again'}
          </p>
        )}

        {customerSignedIn && (
          <p className="mb-4 rounded-lg bg-slate-700/80 px-3 py-2 text-center text-sm text-slate-200">
            {isAr
              ? `أنت مسجّل الدخول${user?.name ? ` باسم ${user.name}` : ''} كعميل. سجّل دخول الإدارة بحساب الفريق.`
              : `You are signed in as a customer${user?.name ? ` (${user.name})` : ''}. Sign in with your team account.`}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="admin-username" className="mb-1.5 block text-sm font-medium text-slate-300">
              {isAr ? 'اسم المستخدم' : 'Username'}
            </label>
            <div className="relative">
              <User className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                id="admin-username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={isAr ? 'مثال: ahmed.ops' : 'e.g. ahmed.ops'}
                dir="ltr"
                className="w-full rounded-xl border border-slate-600 bg-slate-900 py-3 ps-10 pe-4 text-white placeholder:text-slate-500 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
              />
            </div>
          </div>

          <div>
            <label htmlFor="admin-password" className="mb-1.5 block text-sm font-medium text-slate-300">
              {isAr ? 'كلمة المرور' : 'Password'}
            </label>
            <input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isAr ? 'كلمة المرور' : 'Password'}
              className="w-full rounded-xl border border-slate-600 bg-slate-900 px-4 py-3 text-white placeholder:text-slate-500 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
              required
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-900/40 px-3 py-2 text-center text-sm text-red-200">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" size="lg" disabled={submitting || !password.trim()}>
            {submitting
              ? (isAr ? 'جاري الدخول...' : 'Signing in...')
              : (isAr ? 'دخول' : 'Sign in')}
          </Button>
        </form>

        {import.meta.env.DEV && (
          <p className="mt-4 text-center text-xs text-slate-500">
            {isAr
              ? 'التطوير: superadmin / admin123 — أو اترك اسم المستخدم فارغاً لكلمة المرور المشتركة'
              : 'Dev: superadmin / admin123 — or leave username empty for shared password'}
          </p>
        )}
      </div>
    </div>
  );
}
