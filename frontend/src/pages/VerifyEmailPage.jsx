import { useState, useEffect } from 'react';
import { Link, useParams, useLocation } from '../app/router';
import { useLanguage } from '../context/LanguageContext';
import { authService } from '../services/apiServices';
import Button from '../components/ui/Button';
import Loader from '../components/ui/Loader';

export default function VerifyEmailPage() {
  const { token } = useParams();
  const location = useLocation();
  const { language } = useLanguage();
  const email = location.state?.email;
  const [status, setStatus] = useState(token ? 'verifying' : 'pending');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) return;
    authService.verifyEmail(token)
      .then(({ data }) => { setStatus('success'); setMessage(data.message); })
      .catch((err) => { setStatus('error'); setMessage(err.response?.data?.message || 'Verification failed'); });
  }, [token]);

  const handleResend = async () => {
    if (!email) return;
    setStatus('resending');
    try {
      const { data } = await authService.resendVerification(email);
      setStatus('resent');
      setMessage(data.message);
    } catch (err) {
      setStatus('error');
      setMessage(err.response?.data?.message || 'Failed to resend');
    }
  };

  return (
    <div className="container-app flex min-h-[60vh] items-center justify-center py-12">
      <div className="w-full max-w-md rounded-2xl border border-border bg-white p-8 text-center shadow-sm">
        {status === 'verifying' && (
          <>
            <Loader size="lg" className="mb-4" />
            <p>{language === 'ar' ? 'جاري التحقق من بريدك...' : 'Verifying your email...'}</p>
          </>
        )}
        {status === 'pending' && (
          <>
            <span className="text-5xl">✉️</span>
            <h1 className="mt-4 text-xl font-bold">{language === 'ar' ? 'تحقق من بريدك الإلكتروني' : 'Check Your Email'}</h1>
            <p className="mt-2 text-sm text-text-muted">
              {language === 'ar' ? 'أرسلنا رابط التحقق إلى' : 'We sent a verification link to'}{' '}
              <strong>{email || 'your email'}</strong>
            </p>
            {email && (
              <Button onClick={handleResend} className="mt-6" variant="secondary">
                {language === 'ar' ? 'إعادة إرسال الرابط' : 'Resend Link'}
              </Button>
            )}
          </>
        )}
        {status === 'success' && (
          <>
            <span className="text-5xl">✅</span>
            <h1 className="mt-4 text-xl font-bold text-primary-700">{language === 'ar' ? 'تم التحقق بنجاح!' : 'Email Verified!'}</h1>
            <p className="mt-2 text-sm text-text-muted">{message}</p>
            <Link to="/login"><Button className="mt-6">{language === 'ar' ? 'تسجيل الدخول' : 'Login'}</Button></Link>
          </>
        )}
        {(status === 'error' || status === 'resent') && (
          <>
            <span className="text-5xl">{status === 'error' ? '❌' : '📧'}</span>
            <p className="mt-4 text-sm">{message}</p>
            <Link to="/login"><Button className="mt-6" variant="secondary">{language === 'ar' ? 'العودة لتسجيل الدخول' : 'Back to Login'}</Button></Link>
          </>
        )}
      </div>
    </div>
  );
}
