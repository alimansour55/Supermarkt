import { Link, useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import PhoneAuthForm from '../components/auth/PhoneAuthForm';

export default function RegisterPage() {
  const { t, language } = useLanguage();
  const { sendOtp, verifyOtp, resendOtp } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="container-app flex min-h-[70vh] items-center justify-center py-12">
      <div className="w-full max-w-md rounded-2xl border border-border bg-white p-8 shadow-sm">
        <h1 className="mb-2 text-2xl font-bold text-text">{t.nav.register}</h1>
        <p className="mb-6 text-sm text-text-muted">
          {language === 'ar'
            ? 'الاسم ورقم الموبايل فقط — ثم رمز التحقق عبر SMS'
            : 'Just your name and mobile — then verify via SMS code'}
        </p>
        <PhoneAuthForm
          mode="register"
          onSendOtp={sendOtp}
          onVerifyOtp={verifyOtp}
          onResendOtp={resendOtp}
          onSuccess={() => navigate('/', { replace: true })}
        />
        <p className="mt-6 text-center text-sm text-text-muted">
          {language === 'ar' ? 'لديك حساب؟' : 'Already have an account?'}{' '}
          <Link to="/login" className="font-semibold text-primary-600 hover:text-primary-700">
            {t.nav.login}
          </Link>
        </p>
      </div>
    </div>
  );
}
