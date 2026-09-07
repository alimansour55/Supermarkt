import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { authService, loyaltyService } from '../services/apiServices';
import Input from '../components/ui/Input';
import PhoneInput from '../components/ui/PhoneInput';
import Button from '../components/ui/Button';
import { parseLocalPhone } from '../utils/phoneHelpers';
import LoyaltyPointsPanel from '../components/account/LoyaltyPointsPanel';
import { AccountPageLayout } from '../components/account/AccountSidebar';

export default function ProfilePage() {
  const { t, language } = useLanguage();
  const isAr = language === 'ar';
  const { user, refreshUser } = useAuth();
  const [form, setForm] = useState({ name: user?.name || '' });
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loyalty, setLoyalty] = useState(null);

  useEffect(() => {
    if (user?.name) setForm({ name: user.name });
  }, [user?.name]);

  useEffect(() => {
    let mounted = true;
    loyaltyService.getMe(language)
      .then(({ data }) => {
        if (mounted) setLoyalty(data);
      })
      .catch(() => {
        if (mounted) setLoyalty(null);
      });
    return () => {
      mounted = false;
    };
  }, [language]);

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
      setError(isAr ? (msg || 'Failed to save changes') : (msg || 'Failed to save changes'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AccountPageLayout title={t.nav.account}>
      <div className="space-y-6">
        <LoyaltyPointsPanel isAr={isAr} loyalty={loyalty} user={user} />

        <section className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-white p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-violet-100 p-2.5 text-violet-700">
                <RefreshCw className="h-5 w-5" aria-hidden />
              </div>
              <div>
                <h2 className="text-lg font-bold text-text">{isAr ? 'التوصيل الدوري' : 'Recurring delivery'}</h2>
                <p className="mt-1 text-sm text-text-muted">
                  {isAr
                    ? 'عدّل جدولك أو أوقف أو احذف اشتراك التوصيل المتكرر.'
                    : 'Edit, pause, or delete your repeat delivery subscription.'}
                </p>
              </div>
            </div>
            <Link
              to="/recurring-deliveries"
              className="inline-flex rounded-xl bg-violet-600 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-violet-700"
            >
              {isAr ? 'إدارة التوصيل الدوري' : 'Manage recurring delivery'}
            </Link>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-white p-6">
          <div className="mb-6 flex items-center gap-4">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-100 text-2xl font-bold text-primary-700">
              {user?.name?.charAt(0) || '?'}
            </span>
            <div>
              <h2 className="text-lg font-bold">{user?.name}</h2>
              <p className="text-sm text-text-muted">{user?.phoneDisplay || user?.phone}</p>
              {user?.isPhoneVerified && (
                <span className="text-xs text-primary-600">
                  {isAr ? 'موثق عبر SMS' : 'SMS verified'}
                </span>
              )}
            </div>
          </div>

          <form onSubmit={handleSave} className="max-w-lg space-y-4">
            <Input label={t.auth.name} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <PhoneInput
              label={isAr ? 'رقم الموبايل' : 'Mobile number'}
              value={parseLocalPhone(user?.phoneDisplay || user?.phone || '')}
              onChange={() => {}}
              disabled
            />
            <p className="text-xs text-text-muted">
              {isAr ? 'تسجيل الدخول محمي برمز SMS' : 'Sign-in protected with SMS code (MFA)'}
            </p>
            {error && <p className="text-sm text-red-600">{error}</p>}
            {saved && <p className="text-sm text-primary-600">{isAr ? 'تم الحفظ!' : 'Saved!'}</p>}
            <Button type="submit" disabled={saving}>
              {saving ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'حفظ التغييرات' : 'Save Changes')}
            </Button>
          </form>
        </section>
      </div>
    </AccountPageLayout>
  );
}
