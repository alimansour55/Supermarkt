import { useState } from 'react';
import { Globe, Shield, User } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/apiServices';
import { AccountPageLayout } from '../components/account/AccountSidebar';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import PhoneInput from '../components/ui/PhoneInput';
import { parseLocalPhone } from '../utils/phoneHelpers';

export default function AccountSettingsPage() {
  const { language, toggleLanguage, t } = useLanguage();
  const isAr = language === 'ar';
  const { user, refreshUser } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const handleSaveName = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      await authService.updateProfile({ name: name.trim(), email: email.trim() });
      await refreshUser();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err.response?.data?.message || (isAr ? 'تعذر حفظ التغييرات' : 'Could not save changes'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AccountPageLayout title={isAr ? 'الإعدادات' : 'Settings'}>
      <div className="space-y-6">
        <section className="rounded-2xl border border-border bg-white p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-xl bg-primary-100 p-2.5 text-primary-700">
              <User className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <h2 className="text-lg font-bold text-text">{isAr ? 'الملف الشخصي' : 'Profile'}</h2>
              <p className="text-sm text-text-muted">{isAr ? 'تحديث اسم العرض في حسابك' : 'Update your display name'}</p>
            </div>
          </div>
          <form onSubmit={handleSaveName} className="max-w-lg space-y-4">
            <Input label={t.auth.name} value={name} onChange={(e) => setName(e.target.value)} />
            <Input
              type="email"
              label={isAr ? 'البريد الإلكتروني' : 'Email'}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={isAr ? 'name@example.com' : 'name@example.com'}
              dir="ltr"
            />
            <PhoneInput
              label={isAr ? 'رقم الموبايل' : 'Mobile number'}
              value={parseLocalPhone(user?.phoneDisplay || user?.phone || '')}
              onChange={() => {}}
              disabled
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            {saved && <p className="text-sm text-primary-600">{isAr ? 'تم الحفظ!' : 'Saved!'}</p>}
            <Button type="submit" disabled={saving}>
              {saving ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'حفظ التغييرات' : 'Save changes')}
            </Button>
          </form>
        </section>

        <section className="rounded-2xl border border-border bg-white p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-xl bg-slate-100 p-2.5 text-slate-700">
              <Globe className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <h2 className="text-lg font-bold text-text">{isAr ? 'اللغة' : 'Language'}</h2>
              <p className="text-sm text-text-muted">{isAr ? 'اختر لغة واجهة المتجر' : 'Choose store language'}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={isAr ? 'primary' : 'secondary'}
              onClick={() => { if (!isAr) toggleLanguage(); }}
            >
              العربية
            </Button>
            <Button
              type="button"
              variant={!isAr ? 'primary' : 'secondary'}
              onClick={() => { if (isAr) toggleLanguage(); }}
            >
              English
            </Button>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-white p-6">
          <div className="mb-2 flex items-center gap-3">
            <div className="rounded-xl bg-emerald-100 p-2.5 text-emerald-700">
              <Shield className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <h2 className="text-lg font-bold text-text">{isAr ? 'الأمان' : 'Security'}</h2>
              <p className="text-sm text-text-muted">
                {isAr ? 'تسجيل الدخول محمي برمز SMS' : 'Sign-in protected with SMS code'}
              </p>
            </div>
          </div>
          {user?.isPhoneVerified && (
            <p className="mt-2 text-sm text-primary-600">
              {isAr ? '✓ رقم الموبايل موثّق' : '✓ Phone number verified'}
            </p>
          )}
        </section>
      </div>
    </AccountPageLayout>
  );
}
