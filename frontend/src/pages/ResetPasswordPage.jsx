import { useState } from 'react';
import { Link, useParams, useNavigate } from '../app/router';
import { useLanguage } from '../context/LanguageContext';
import { authService } from '../services/apiServices';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import Loader from '../components/ui/Loader';

export default function ResetPasswordPage() {
  const { token } = useParams();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [form, setForm] = useState({ password: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      setError(language === 'ar' ? 'كلمات المرور غير متطابقة' : 'Passwords do not match');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await authService.resetPassword(token, form.password);
      navigate('/login');
    } catch (err) {
      setError(err.response?.data?.message || 'Reset failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container-app flex min-h-[60vh] items-center justify-center py-12">
      <div className="w-full max-w-md rounded-2xl border border-border bg-white p-8 shadow-sm">
        <h1 className="mb-2 text-2xl font-bold">{language === 'ar' ? 'إعادة تعيين كلمة المرور' : 'Reset Password'}</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label={language === 'ar' ? 'كلمة المرور الجديدة' : 'New Password'} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} />
          <Input label={language === 'ar' ? 'تأكيد كلمة المرور' : 'Confirm Password'} type="password" value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} required />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading || !token}>
            {loading ? <Loader size="sm" /> : (language === 'ar' ? 'حفظ كلمة المرور' : 'Save Password')}
          </Button>
        </form>
        {!token && <p className="mt-4 text-center text-sm text-red-500">{language === 'ar' ? 'رابط غير صالح' : 'Invalid reset link'}</p>}
        <Link to="/login" className="mt-4 block text-center text-sm text-primary-600">{language === 'ar' ? 'العودة لتسجيل الدخول' : 'Back to Login'}</Link>
      </div>
    </div>
  );
}
