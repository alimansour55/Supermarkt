import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { authService } from '../services/apiServices';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import Loader from '../components/ui/Loader';

export default function ForgotPasswordPage() {
  const { t, language } = useLanguage();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await authService.forgotPassword(email);
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.message || t.common.error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container-app flex min-h-[60vh] items-center justify-center py-12">
      <div className="w-full max-w-md rounded-2xl border border-border bg-white p-8 shadow-sm">
        <h1 className="mb-2 text-2xl font-bold">{language === 'ar' ? 'نسيت كلمة المرور' : 'Forgot Password'}</h1>
        <p className="mb-6 text-sm text-text-muted">
          {language === 'ar' ? 'أدخل بريدك وسنرسل لك رابط إعادة التعيين' : 'Enter your email and we will send a reset link'}
        </p>
        {sent ? (
          <div className="text-center">
            <span className="text-4xl">📧</span>
            <p className="mt-4 text-sm text-primary-600">
              {language === 'ar' ? 'تم إرسال رابط إعادة التعيين!' : 'Reset link sent!'}
            </p>
            <Link to="/login" className="mt-4 inline-block text-sm font-semibold text-primary-600">{t.nav.login}</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input label={t.auth.email} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader size="sm" /> : (language === 'ar' ? 'إرسال الرابط' : 'Send Reset Link')}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
