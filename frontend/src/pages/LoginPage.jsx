import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import PhoneAuthForm from '../components/auth/PhoneAuthForm';
import { healthService } from '../services/apiServices';
import { isMobileLanAccess } from '../utils/mobileAccess';

export default function LoginPage() {
  const { t, language } = useLanguage();
  const { sendOtp, verifyOtp, resendOtp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || '/';
  const isAr = language === 'ar';
  const [apiDown, setApiDown] = useState(false);
  const [apiOk, setApiOk] = useState(false);

  useEffect(() => {
    let active = true;
    healthService.check()
      .then(() => {
        if (!active) return;
        setApiDown(false);
        setApiOk(true);
      })
      .catch(() => {
        if (!active) return;
        setApiDown(true);
        setApiOk(false);
      });
    return () => { active = false; };
  }, []);

  return (
    <div className="container-app flex min-h-[70vh] items-center justify-center px-4 py-12 pb-24 md:pb-12">
      <div className="w-full max-w-md rounded-2xl border border-border bg-white p-6 shadow-sm sm:p-8">
        <h1 className="mb-2 text-2xl font-bold text-text">{t.nav.login}</h1>
        {apiDown && (
          <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {isAr
              ? isMobileLanAccess()
                ? 'الخادم غير متصل من الموبايل. افتح الرابط الذي يظهر في الطرفية (http://192.168.x.x:5173) وتأكد أن npm run dev يعمل على الكمبيوتر.'
                : 'الخادم غير متصل. من مجلد المشروع شغّل: npm run dev (Backend + Frontend معاً).'
              : isMobileLanAccess()
                ? 'Server unreachable from your phone. Open the LAN URL from the terminal (http://192.168.x.x:5173) and run npm run dev on your PC.'
                : 'API server is offline. From the project root run: npm run dev (starts backend + frontend).'}
          </p>
        )}
        {import.meta.env.DEV && isMobileLanAccess() && apiOk && (
          <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
            {isAr
              ? `متصل بالخادم ✓ — استخدم 1098765432 ثم الرمز الظاهر بالأصفر.`
              : `Server connected ✓ — use 1098765432, then the yellow OTP box.`}
          </p>
        )}
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
          onSuccess={(data) => {
            if (data?.user?.role === 'driver') {
              navigate('/driver', { replace: true });
              return;
            }
            navigate(from, { replace: true });
          }}
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
