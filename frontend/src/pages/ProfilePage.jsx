import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/apiServices';
import Input from '../components/ui/Input';
import PhoneInput from '../components/ui/PhoneInput';
import Button from '../components/ui/Button';
import { parseLocalPhone } from '../utils/phoneHelpers';

export default function ProfilePage() {
  const { t, language } = useLanguage();
  const { user, logout, refreshUser } = useAuth();
  const [form, setForm] = useState({ name: user?.name || '' });
  useEffect(() => {
    if (user?.name) setForm({ name: user.name });
  }, [user?.name]);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      await authService.updateProfile({ name: form.name.trim() });
      await refreshUser();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      setError(
        language === 'ar'
          ? (msg || 'فشل حفظ التغييرات')
          : (msg || 'Failed to save changes'),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container-app py-8">
      <h1 className="mb-8 text-2xl font-bold md:text-3xl">{t.nav.account}</h1>

      <div className="grid gap-8 lg:grid-cols-4">
        <aside className="space-y-1">
          {[
            { labelAr: 'الملف الشخصي', labelEn: 'Profile', active: true },
            { to: '/orders', labelAr: 'طلباتي', labelEn: 'My Orders' },
            { labelAr: 'العناوين', labelEn: 'Addresses' },
            { labelAr: 'الإعدادات', labelEn: 'Settings' },
          ].map((item) => (
            item.to ? (
              <Link key={item.labelEn} to={item.to} className="block rounded-xl px-4 py-2.5 text-sm font-medium text-text hover:bg-white">
                {language === 'ar' ? item.labelAr : item.labelEn}
              </Link>
            ) : (
              <span key={item.labelEn} className={`block rounded-xl px-4 py-2.5 text-sm font-medium ${item.active ? 'bg-white text-primary-700 shadow-sm' : 'text-text hover:bg-white'}`}>
                {language === 'ar' ? item.labelAr : item.labelEn}
              </span>
            )
          ))}
          <button type="button" onClick={logout} className="block w-full rounded-xl px-4 py-2.5 text-start text-sm font-medium text-red-600 hover:bg-red-50">
            {t.nav.logout}
          </button>
        </aside>

        <div className="lg:col-span-3">
          <div className="rounded-2xl border border-border bg-white p-6">
            <div className="mb-6 flex items-center gap-4">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-100 text-2xl font-bold text-primary-700">
                {user?.name?.charAt(0) || '?'}
              </span>
              <div>
                <h2 className="text-lg font-bold">{user?.name}</h2>
                <p className="text-sm text-text-muted">{user?.phoneDisplay || user?.phone}</p>
                {user?.isPhoneVerified && (
                  <span className="text-xs text-primary-600">
                    ✓ {language === 'ar' ? 'موثّق عبر SMS' : 'SMS verified'}
                  </span>
                )}
              </div>
            </div>

            <form onSubmit={handleSave} className="space-y-4 max-w-lg">
              <Input label={t.auth.name} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <PhoneInput
                label={language === 'ar' ? 'رقم الموبايل' : 'Mobile number'}
                value={parseLocalPhone(user?.phoneDisplay || user?.phone || '')}
                onChange={() => {}}
                disabled
              />
              <p className="text-xs text-text-muted">
                {language === 'ar'
                  ? 'تسجيل الدخول محمي برمز SMS (MFA)'
                  : 'Sign-in protected with SMS code (MFA)'}
              </p>
              {error && <p className="text-sm text-red-600">{error}</p>}
              {saved && <p className="text-sm text-primary-600">{language === 'ar' ? 'تم الحفظ!' : 'Saved!'}</p>}
              <Button type="submit" disabled={saving}>{saving ? (language === 'ar' ? 'جاري الحفظ...' : 'Saving...') : (language === 'ar' ? 'حفظ التغييرات' : 'Save Changes')}</Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
