import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import PhoneAuthForm from '../components/auth/PhoneAuthForm';

export default function LoginPage() {
  const { t, language } = useLanguage();
  const { sendOtp, verifyOtp, resendOtp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || '/';

  return (
    <div className="container-app flex min-h-[70vh] items-center justify-center py-12">
      <div className="w-full max-w-md rounded-2xl border border-border bg-white p-8 shadow-sm">
        <h1 className="mb-2 text-2xl font-bold text-text">{t.nav.login}</h1>
        <p className="mb-6 text-sm text-text-muted">
          {language === 'ar'
            ? 'أدخل رقم موبايلك — سنرسل رمز تحقق عبر SMS'
            : 'Enter your mobile number — we will send an SMS verification code'}
        </p>
        <PhoneAuthForm
          mode="login"
          onSendOtp={sendOtp}
          onVerifyOtp={verifyOtp}
          onResendOtp={resendOtp}
          onSuccess={() => navigate(from, { replace: true })}
          showDemoShopperFill={import.meta.env.DEV}
        />
        {import.meta.env.DEV && (
          <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-xs text-text-muted">
            {language === 'ar'
              ? 'تجريبي: 1098765432 → أضف منتجات → السلة → الدفع (COD). رمز SMS يظهر في الصفحة.'
              : 'Demo: 1098765432 → add items → cart → checkout (cash on delivery). SMS code appears on screen.'}
          </p>
        )}
        <p className="mt-6 text-center text-sm text-text-muted">
          {language === 'ar' ? 'ليس لديك حساب؟' : 'New here?'}{' '}
          <Link to="/register" className="font-semibold text-primary-600 hover:text-primary-700">
            {t.nav.register}
          </Link>
        </p>
      </div>
    </div>
  );
}
