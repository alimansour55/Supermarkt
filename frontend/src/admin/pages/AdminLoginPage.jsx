import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Lock, User, ShieldCheck } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { useStoreSettings } from '../../context/StoreSettingsContext';
import { APP_NAME, APP_NAME_EN } from '../../utils/constants';
import { isStaffRole } from '../adminPermissions';
import Loader from '../../components/ui/Loader';
import Button from '../../components/ui/Button';

const ADMIN_LOGIN_ERRORS = {
  ar: {
    'Invalid username or password': 'اسم المستخدم أو كلمة المرور غير صحيحة',
    'Username is required': 'اسم المستخدم مطلوب',
    'Password is required': 'كلمة المرور مطلوبة',
    'Invalid verification code': 'رمز التحقق غير صحيح',
    'A valid 6-digit verification code is required': 'أدخل رمز التحقق المكوّن من 6 أرقام',
    'Verification code expired. Request a new one.': 'انتهت صلاحية الرمز — اطلب رمزاً جديداً',
    'Too many failed attempts. Request a new code.': 'محاولات خاطئة كثيرة — اطلب رمزاً جديداً',
    'Sign-in expired. Please enter your password again.': 'انتهت مهلة الدخول — أدخل كلمة المرور مرة أخرى',
    'Two-step verification is required. Ask a super admin to add a phone number to your account.': 'التحقق بخطوتين مطلوب — اطلب من المدير العام إضافة رقم هاتف لحسابك',
    'This account does not have a password set': 'هذا الحساب لا يملك كلمة مرور',
  },
};

function mapAdminLoginError(message, isAr) {
  if (!isAr || !message) return message;
  return ADMIN_LOGIN_ERRORS.ar[message] || message;
}

export default function AdminLoginPage() {
  const { language } = useLanguage();
  const { user, loading, isAuthenticated, adminLogin, verifyAdminMfa, resendAdminMfa } = useAuth();
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
  /** Step 2 — SMS code after a correct password */
  const [mfa, setMfa] = useState(null); // { token, phoneDisplay }
  const [code, setCode] = useState('');
  const [info, setInfo] = useState('');

  useEffect(() => {
    if (!loading && isAuthenticated && isStaffRole(user?.role)) {
      navigate(from, { replace: true });
    }
  }, [loading, isAuthenticated, user, navigate, from]);

  const showError = (err) => {
    if (!err.response) {
      setError(
        isAr
          ? 'لا يمكن الاتصال بالخادم — تأكد أن backend يعمل على المنفذ 5001'
          : 'Cannot reach server — ensure backend is running on port 5001',
      );
      return;
    }
    const msg = err.response?.data?.message;
    if (mfa && msg === 'Sign-in expired. Please enter your password again.') {
      setMfa(null);
      setCode('');
    }
    setError(mapAdminLoginError(msg, isAr) || (isAr ? 'فشل تسجيل الدخول' : 'Sign in failed'));
  };

  const applyMfaChallenge = (data, mfaToken) => {
    setMfa({ token: mfaToken, phoneDisplay: data.phoneDisplay });
    setCode(import.meta.env.DEV && data.devOtp ? data.devOtp : '');
    setInfo(
      isAr
        ? `أرسلنا رمز تحقق إلى ${data.phoneDisplay}`
        : `We sent a verification code to ${data.phoneDisplay}`,
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const data = await adminLogin(username.trim().toLowerCase(), password.trim());
      if (data.mfaRequired) {
        applyMfaChallenge(data, data.mfaToken);
        return;
      }
      navigate(from, { replace: true });
    } catch (err) {
      showError(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await verifyAdminMfa(mfa.token, code.trim());
      navigate(from, { replace: true });
    } catch (err) {
      showError(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setSubmitting(true);
    try {
      const data = await resendAdminMfa(mfa.token, language);
      applyMfaChallenge(data, mfa.token);
    } catch (err) {
      showError(err);
    } finally {
      setSubmitting(false);
    }
  };

  const cancelMfa = () => {
    setMfa(null);
    setCode('');
    setInfo('');
    setError('');
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
            {mfa
              ? (isAr ? 'التحقق بخطوتين' : 'Two-step verification')
              : (isAr ? 'أدخل اسم المستخدم وكلمة المرور' : 'Enter your username and password')}
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

        {mfa ? (
          <form onSubmit={handleVerify} className="space-y-4">
            {info && (
              <p className="flex items-center justify-center gap-2 rounded-lg bg-primary-900/30 px-3 py-2 text-center text-sm text-primary-200">
                <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden />
                <span dir="auto">{info}</span>
              </p>
            )}
            <div>
              <label htmlFor="admin-otp" className="mb-1.5 block text-sm font-medium text-slate-300">
                {isAr ? 'رمز التحقق' : 'Verification code'}
              </label>
              <input
                id="admin-otp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="••••••"
                dir="ltr"
                autoFocus
                className="w-full rounded-xl border border-slate-600 bg-slate-900 px-4 py-3 text-center font-mono text-2xl tracking-[0.5em] text-white placeholder:text-slate-600 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
                required
              />
            </div>

            {error && (
              <p className="rounded-lg bg-red-900/40 px-3 py-2 text-center text-sm text-red-200">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" size="lg" disabled={submitting || code.length !== 6}>
              {submitting
                ? (isAr ? 'جاري التحقق...' : 'Verifying...')
                : (isAr ? 'تأكيد' : 'Verify')}
            </Button>

            <div className="flex items-center justify-between text-sm">
              <button type="button" className="text-slate-400 hover:text-slate-200" onClick={cancelMfa} disabled={submitting}>
                {isAr ? 'رجوع' : 'Back'}
              </button>
              <button type="button" className="font-medium text-primary-400 hover:text-primary-300 disabled:opacity-50" onClick={handleResend} disabled={submitting}>
                {isAr ? 'إرسال رمز جديد' : 'Resend code'}
              </button>
            </div>
          </form>
        ) : (
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
                required
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

          <Button type="submit" className="w-full" size="lg" disabled={submitting || !username.trim() || !password.trim()}>
            {submitting
              ? (isAr ? 'جاري الدخول...' : 'Signing in...')
              : (isAr ? 'دخول' : 'Sign in')}
          </Button>
        </form>
        )}

        {import.meta.env.DEV && (
          <p className="mt-4 text-center text-xs text-slate-500">
            {isAr
              ? 'التطوير: superadmin / admin123 — رمز التحقق يظهر تلقائياً'
              : 'Dev: superadmin / admin123 — the verification code is filled in automatically'}
          </p>
        )}
      </div>
    </div>
  );
}
