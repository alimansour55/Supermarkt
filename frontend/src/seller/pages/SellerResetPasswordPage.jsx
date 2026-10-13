import { useState } from 'react';
import { Link, useNavigate, useParams } from '../../app/router';
import { KeyRound, Lock } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/ui/Button';
import SellerAuthFrame from '../layout/SellerAuthFrame';
import PasswordStrength, { passwordIsStrong } from '../PasswordStrength';

/** Landing page of the emailed reset link: choose a new password, then go straight in. */
export default function SellerResetPasswordPage() {
  const { token } = useParams();
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const { sellerResetPassword } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (password !== confirm) return setError(isAr ? 'كلمتا المرور غير متطابقتين' : "Passwords don't match");
    setError('');
    setSubmitting(true);
    try {
      await sellerResetPassword(token, password);
      navigate('/seller-center', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || (isAr ? 'تعذّر تعيين كلمة المرور' : 'Could not set the password'));
    } finally {
      setSubmitting(false);
    }
    return undefined;
  };

  const field = 'w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 ps-10 pe-4 text-sm focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200';

  return (
    <SellerAuthFrame isAr={isAr} icon={KeyRound} title={isAr ? 'كلمة مرور جديدة' : 'Choose a new password'} subtitle={isAr ? 'ستُسجَّل خارج كل الأجهزة الأخرى' : "You'll be signed out of every other device"}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{error}</p>}
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-800">{isAr ? 'كلمة المرور الجديدة' : 'New password'}</span>
          <span className="relative block">
            <Lock className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={field} dir="ltr" autoComplete="new-password" />
          </span>
          <PasswordStrength value={password} isAr={isAr} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-800">{isAr ? 'تأكيد كلمة المرور' : 'Confirm password'}</span>
          <span className="relative block">
            <Lock className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={field} dir="ltr" autoComplete="new-password" />
          </span>
        </label>
        <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700" disabled={submitting || !passwordIsStrong(password) || !confirm}>
          {submitting ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'حفظ وتسجيل الدخول' : 'Save and sign in')}
        </Button>
      </form>
      <Link to="/seller-center/login" className="mt-4 block text-center text-sm font-semibold text-indigo-700 hover:underline">{isAr ? 'العودة لتسجيل الدخول' : 'Back to sign in'}</Link>
    </SellerAuthFrame>
  );
}
