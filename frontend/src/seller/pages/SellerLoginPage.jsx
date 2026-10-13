import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from '../../app/router';
import { ArrowLeft, ArrowRight, KeyRound, Lock, Mail, ShieldCheck } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { authService } from '../../services/apiServices';
import Button from '../../components/ui/Button';
import Loader from '../../components/ui/Loader';
import SellerAuthFrame from '../layout/SellerAuthFrame';

const SELLER_ROLES = ['seller_owner', 'seller_staff'];
const fieldClass = 'w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 ps-10 pe-4 text-sm focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200';

export default function SellerLoginPage() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const { user, loading, isAuthenticated, sellerLogin, sellerVerifyCode } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.startsWith('/seller-center') ? location.state.from : '/seller-center';

  const [mode, setMode] = useState('login'); // login | code | forgot | sent
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [challenge, setChallenge] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const codeRef = useRef(null);

  useEffect(() => {
    if (!loading && isAuthenticated && SELLER_ROLES.includes(user?.role)) {
      navigate(from, { replace: true });
    }
  }, [loading, isAuthenticated, user, navigate, from]);

  useEffect(() => { if (mode === 'code') codeRef.current?.focus(); }, [mode]);

  const run = async (fn) => {
    setError('');
    setSubmitting(true);
    try {
      await fn();
    } catch (err) {
      setError(err.response?.data?.message || (isAr ? 'حدث خطأ، حاول مرة أخرى' : 'Something went wrong, try again'));
    } finally {
      setSubmitting(false);
    }
  };

  const signIn = (e) => {
    e.preventDefault();
    run(async () => {
      const data = await sellerLogin(email.trim().toLowerCase(), password);
      if (data.twoFactorRequired) {
        setChallenge(data.challenge);
        setSentTo(data.sentTo);
        setCode('');
        setMode('code');
        return;
      }
      navigate(from, { replace: true });
    });
  };

  const verify = (e) => {
    e.preventDefault();
    run(async () => {
      await sellerVerifyCode(challenge, code);
      navigate(from, { replace: true });
    });
  };

  const resend = () => run(async () => {
    const { data } = await authService.sellerResendCode({ challenge });
    setChallenge(data.challenge);
  });

  const forgot = (e) => {
    e.preventDefault();
    run(async () => {
      await authService.sellerForgotPassword({ email: email.trim().toLowerCase() });
      setMode('sent');
    });
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-900"><Loader size="lg" /></div>;
  }

  const Back = isAr ? ArrowRight : ArrowLeft;
  const backToLogin = (
    <button type="button" onClick={() => { setError(''); setMode('login'); }} className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-indigo-700 hover:underline">
      <Back className="h-4 w-4" />{isAr ? 'العودة لتسجيل الدخول' : 'Back to sign in'}
    </button>
  );
  const errorBox = error && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{error}</p>;

  if (mode === 'code') {
    return (
      <SellerAuthFrame isAr={isAr} icon={ShieldCheck} title={isAr ? 'التحقق بخطوتين' : '2-step verification'} subtitle={isAr ? `أرسلنا رمزاً من 6 أرقام إلى ${sentTo}` : `We emailed a 6-digit code to ${sentTo}`}>
        <form onSubmit={verify} className="space-y-4" noValidate>
          {errorBox}
          <input
            ref={codeRef}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="••••••"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 text-center font-mono text-2xl tracking-[0.6em] focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200"
            dir="ltr"
            aria-label={isAr ? 'رمز التحقق' : 'Verification code'}
          />
          <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700" disabled={submitting || code.length !== 6}>
            {submitting ? (isAr ? 'جاري التحقق...' : 'Checking...') : (isAr ? 'تأكيد' : 'Verify')}
          </Button>
          <div className="flex items-center justify-between text-sm">
            <button type="button" onClick={resend} disabled={submitting} className="font-semibold text-indigo-700 hover:underline disabled:opacity-50">{isAr ? 'إرسال رمز جديد' : 'Send a new code'}</button>
            <span className="text-xs text-slate-400">{isAr ? 'صالح 10 دقائق' : 'Valid for 10 minutes'}</span>
          </div>
        </form>
        {backToLogin}
      </SellerAuthFrame>
    );
  }

  if (mode === 'forgot' || mode === 'sent') {
    return (
      <SellerAuthFrame isAr={isAr} icon={KeyRound} title={isAr ? 'نسيت كلمة المرور؟' : 'Forgot your password?'} subtitle={isAr ? 'سنرسل لك رابطاً لتعيين كلمة مرور جديدة' : "We'll email you a link to set a new one"}>
        {mode === 'sent' ? (
          <p className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900">
            {isAr
              ? 'إذا كان هذا البريد مسجلاً كبائع، فستصلك رسالة خلال دقائق. الرابط صالح لمدة ساعة — تحقق من مجلد الرسائل غير المرغوب فيها أيضاً.'
              : "If this email has a seller account, you'll get a message in a few minutes. The link is valid for one hour — check your spam folder too."}
          </p>
        ) : (
          <form onSubmit={forgot} className="space-y-4" noValidate>
            {errorBox}
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-800">{isAr ? 'البريد الإلكتروني' : 'Email'}</span>
              <span className="relative block">
                <Mail className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={fieldClass} dir="ltr" autoComplete="username" required />
              </span>
            </label>
            <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700" disabled={submitting || !email}>
              {submitting ? (isAr ? 'جاري الإرسال...' : 'Sending...') : (isAr ? 'أرسل رابط إعادة التعيين' : 'Send reset link')}
            </Button>
          </form>
        )}
        {backToLogin}
      </SellerAuthFrame>
    );
  }

  return (
    <SellerAuthFrame
      isAr={isAr}
      title={isAr ? 'دخول مركز البائعين' : 'Seller Center sign in'}
      subtitle={isAr ? 'أدر منتجاتك وطلباتك ومدفوعاتك' : 'Manage your products, orders and payouts'}
      footer={(
        <>
          {isAr ? 'ليس لديك متجر بعد؟ ' : "Don't have a store yet? "}
          <Link to={`/${language}/sell-with-us`} className="font-semibold text-white hover:underline">{isAr ? 'سجّل كبائع' : 'Become a seller'}</Link>
        </>
      )}
    >
      <form onSubmit={signIn} className="space-y-4" noValidate>
        {errorBox}
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-800">{isAr ? 'البريد الإلكتروني' : 'Email'}</span>
          <span className="relative block">
            <Mail className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={fieldClass} dir="ltr" autoComplete="username" required />
          </span>
        </label>
        <label className="block">
          <span className="mb-1.5 flex items-center justify-between text-sm font-medium text-slate-800">
            {isAr ? 'كلمة المرور' : 'Password'}
            <button type="button" onClick={() => { setError(''); setMode('forgot'); }} className="text-xs font-semibold text-indigo-700 hover:underline">{isAr ? 'نسيت كلمة المرور؟' : 'Forgot password?'}</button>
          </span>
          <span className="relative block">
            <Lock className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={fieldClass} dir="ltr" autoComplete="current-password" required />
          </span>
        </label>
        <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700" disabled={submitting || !email || !password}>
          {submitting ? (isAr ? 'جاري الدخول...' : 'Signing in...') : (isAr ? 'دخول' : 'Sign in')}
        </Button>
      </form>
    </SellerAuthFrame>
  );
}
