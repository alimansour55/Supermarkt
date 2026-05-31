import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import PhoneAuthForm from '../../components/auth/PhoneAuthForm';
import { APP_NAME, APP_NAME_EN } from '../../utils/constants';
import { isStaffRole } from '../adminPermissions';
import Loader from '../../components/ui/Loader';

export default function AdminLoginPage() {
  const { language } = useLanguage();
  const { user, loading, isAuthenticated, sendOtp, verifyOtp, resendOtp, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || '/admin';
  const isAr = language === 'ar';
  const sessionExpired = location.state?.reason === 'session';

  useEffect(() => {
    if (!loading && isAuthenticated && isStaffRole(user?.role)) {
      navigate(from, { replace: true });
    }
  }, [loading, isAuthenticated, user, navigate, from]);

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
          <p className="text-2xl font-bold text-primary-400">{isAr ? APP_NAME : APP_NAME_EN}</p>
          <h1 className="mt-2 text-xl font-semibold text-white">
            {isAr ? 'تسجيل دخول الإدارة' : 'Admin Login'}
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            {isAr ? 'رقم الموبايل + رمز SMS (MFA)' : 'Mobile number + SMS code (MFA)'}
          </p>
        </div>

        {sessionExpired && (
          <p className="mb-4 rounded-lg bg-amber-900/40 px-3 py-2 text-center text-sm text-amber-200">
            {isAr ? 'انتهت الجلسة — سجّل الدخول مرة أخرى' : 'Session expired — please sign in again'}
          </p>
        )}

        <PhoneAuthForm
          mode="login"
          variant="dark"
          showDemoFill
          requireAdmin
          onSendOtp={sendOtp}
          onVerifyOtp={verifyOtp}
          onResendOtp={resendOtp}
          onLogout={logout}
          onSuccess={() => navigate(from, { replace: true })}
        />

        <p className="mt-4 text-center text-xs text-slate-400">
          {isAr
            ? '1) اضغط الزر التجريبي  2) إرسال رمز SMS  3) الرمز يظهر في الصفحة'
            : '1) Click demo button  2) Send SMS code  3) Code appears on screen'}
        </p>
        <p className="mt-2 text-center text-xs text-slate-500">
          {isAr
            ? 'أول مرة؟ من مجلد المشروع: npm run seed'
            : 'First time? From project root run: npm run seed'}
        </p>
      </div>
    </div>
  );
}
