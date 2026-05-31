import { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import Input from '../ui/Input';
import PhoneInput from '../ui/PhoneInput';
import Button from '../ui/Button';
import Loader from '../ui/Loader';
import { localToEgyptPhone, formatLocalPhoneDisplay } from '../../utils/phoneHelpers';
import { isStaffRole } from '../../admin/adminPermissions';

const RESEND_SECONDS = 60;
const DEMO_ADMIN_LOCAL = '1012345678';
const DEMO_SHOPPER_LOCAL = '1098765432';

/**
 * Shared phone + SMS OTP flow for login and registration.
 */
export default function PhoneAuthForm({
  mode = 'login',
  onSendOtp,
  onVerifyOtp,
  onResendOtp,
  onSuccess,
  requireAdmin = false,
  onLogout,
  variant = 'light',
  showDemoFill = false,
  showDemoShopperFill = false,
}) {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const isRegister = mode === 'register';
  const isDev = import.meta.env.DEV;

  const [step, setStep] = useState('phone');
  const [form, setForm] = useState({ name: '', phoneLocal: '', phone: '', code: '' });
  const [phoneDisplay, setPhoneDisplay] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [devOtp, setDevOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (countdown <= 0) return undefined;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const applyOtpResponse = (data, phoneLocal) => {
    const otp = data.devOtp || '';
    setDevOtp(otp);
    setPhoneDisplay(data.phoneDisplay || formatLocalPhoneDisplay(phoneLocal));
    setStep('otp');
    setCountdown(RESEND_SECONDS);
    setForm((f) => ({
      ...f,
      phone: data.phone || localToEgyptPhone(phoneLocal),
      code: isDev && otp ? otp : f.code,
    }));
    setInfo(
      otp
        ? (isAr ? 'رمز التحقق جاهز — معروض بالأسفل' : 'Code ready — shown below')
        : (isAr
          ? `تم الإرسال إلى ${data.phoneDisplay || formatLocalPhoneDisplay(phoneLocal)}`
          : `Sent to ${data.phoneDisplay || formatLocalPhoneDisplay(phoneLocal)}`),
    );
  };

  const formatApiError = (err) => {
    if (!err.response) {
      return isAr
        ? 'لا يمكن الاتصال بالخادم. شغّل: npm run dev'
        : 'Cannot reach server. Run: npm run dev';
    }
    return err.response?.data?.message || (isAr ? 'حدث خطأ' : 'Something went wrong');
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setError('');

    if (form.phoneLocal.length < 10) {
      setError(isAr ? 'أدخل 10 أرقام (مثال: 1012345678)' : 'Enter 10 digits (e.g. 1012345678)');
      return;
    }

    setInfo('');
    setLoading(true);
    try {
      const data = await onSendOtp({
        phone: localToEgyptPhone(form.phoneLocal),
        lang: language,
        ...(isRegister ? { name: form.name } : {}),
      });
      applyOtpResponse(data, form.phoneLocal);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await onVerifyOtp({ phone: form.phone, code: form.code });
      if (requireAdmin && !isStaffRole(data.user?.role)) {
        if (onLogout) await onLogout();
        setStep('phone');
        setForm({ name: '', phoneLocal: '', phone: '', code: '' });
        setDevOtp('');
        setError(
          isAr
            ? 'هذا الحساب ليس حساب إدارة. شغّل npm run seed لإنشاء حساب المسؤول (1012345678).'
            : 'This account is not staff. Run npm run seed to create the admin user (1012345678).',
        );
        return;
      }
      onSuccess?.(data);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    setError('');
    setLoading(true);
    try {
      const data = await onResendOtp({ phone: form.phone, lang: language });
      applyOtpResponse(data, form.phoneLocal);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const isDark = variant === 'dark';
  const mutedClass = isDark ? 'text-slate-400' : 'text-text-muted';
  const labelClass = isDark ? 'text-slate-200' : undefined;

  const DevOtpBox = () => devOtp ? (
    <div className="rounded-xl border-4 border-amber-400 bg-amber-100 px-4 py-4 text-center shadow-lg">
      <p className="text-sm font-bold text-amber-900">
        {isAr ? '🔧 رمز الدخول (وضع التطوير)' : '🔧 Your login code (dev mode)'}
      </p>
      <p className="my-2 font-mono text-4xl font-black tracking-widest text-amber-950">{devOtp}</p>
      <p className="text-xs text-amber-800">
        {isAr ? 'انسخ الرمز أعلاه أو اضغط تأكيد الدخول مباشرة' : 'Copy the code above or click Verify'}
      </p>
    </div>
  ) : null;

  if (step === 'otp') {
    return (
      <form onSubmit={handleVerify} className="space-y-4">
        <DevOtpBox />
        <p className={`text-sm ${mutedClass}`}>
          {isAr ? `الرمز لـ ${phoneDisplay}` : `Code for ${phoneDisplay}`}
        </p>
        <Input
          label={isAr ? 'رمز التحقق (SMS)' : 'SMS verification code'}
          labelClassName={labelClass}
          inputClassName={isDark ? 'border-slate-600 bg-slate-900 text-white' : ''}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          maxLength={6}
          value={form.code}
          onChange={(e) => setForm({ ...form, code: e.target.value.replace(/\D/g, '').slice(0, 6) })}
          required
          placeholder="000000"
        />
        {info && <p className="text-sm text-primary-600">{info}</p>}
        {error && (
          <p className={`rounded-lg px-3 py-2 text-sm ${isDark ? 'bg-red-900/40 text-red-200' : 'bg-red-50 text-red-600'}`}>
            {error}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={loading || form.code.length !== 6}>
          {loading ? <Loader size="sm" /> : (isAr ? 'تأكيد الدخول' : 'Verify & sign in')}
        </Button>
        <div className="flex items-center justify-between text-sm">
          <button type="button" className={`${mutedClass} hover:text-primary-600`} onClick={() => { setStep('phone'); setError(''); }}>
            {isAr ? '← تغيير الرقم' : '← Change number'}
          </button>
          <button type="button" className="font-medium text-primary-600 disabled:opacity-50" disabled={countdown > 0 || loading} onClick={handleResend}>
            {countdown > 0 ? `${countdown}s` : (isAr ? 'إرسال رمز جديد' : 'Resend')}
          </button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={handleSendOtp} className="space-y-4">
      {isRegister && (
        <Input
          label={isAr ? 'الاسم' : 'Full name'}
          name="name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
          autoComplete="name"
          labelClassName={labelClass}
        />
      )}
      <PhoneInput
        label={isAr ? 'رقم الموبايل' : 'Mobile number'}
        name="phone"
        value={form.phoneLocal}
        onChange={(phoneLocal) => setForm({ ...form, phoneLocal })}
        required
        labelClassName={labelClass}
      />
      {showDemoFill && (
        <button
          type="button"
          className="w-full rounded-lg border border-dashed border-primary-400 px-3 py-2 text-sm text-primary-600 hover:bg-primary-50"
          onClick={() => setForm((f) => ({ ...f, phoneLocal: DEMO_ADMIN_LOCAL }))}
        >
          {isAr ? 'استخدام رقم الإدارة التجريبي: 1012345678' : 'Use demo admin number: 1012345678'}
        </button>
      )}
      {showDemoShopperFill && (
        <button
          type="button"
          className="w-full rounded-lg border border-dashed border-emerald-400 px-3 py-2 text-sm text-emerald-700 hover:bg-emerald-50"
          onClick={() => setForm((f) => ({ ...f, phoneLocal: DEMO_SHOPPER_LOCAL }))}
        >
          {isAr ? 'حساب تجريبي للتسوق: 1098765432' : 'Use demo shopper: 1098765432'}
        </button>
      )}
      {form.phoneLocal.length > 0 && form.phoneLocal.length < 10 && (
        <p className={`text-xs ${mutedClass}`}>
          {isAr ? `${form.phoneLocal.length}/10 — أكمل الرقم لتفعيل الزر` : `${form.phoneLocal.length}/10 — complete to enable button`}
        </p>
      )}
      {error && (
        <p className={`rounded-lg px-3 py-2 text-sm ${isDark ? 'bg-red-900/40 text-red-200' : 'bg-red-50 text-red-600'}`}>
          {error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={loading || form.phoneLocal.length < 10}>
        {loading ? <Loader size="sm" /> : (isAr ? 'إرسال رمز SMS' : 'Send SMS code')}
      </Button>
      <p className={`text-center text-xs ${mutedClass}`}>
        {isAr ? '🇪🇬 أدخل 10 أرقام بجانب +20 (بدون 0)' : '🇪🇬 Enter 10 digits next to +20 (no leading 0)'}
      </p>
    </form>
  );
}
