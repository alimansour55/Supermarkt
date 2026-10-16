import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from '../../app/router';
import { useLanguage } from '../../context/LanguageContext';
import { adminApi } from '../adminApi';
import Button from '../../components/ui/Button';
import Loader from '../../components/ui/Loader';
import { PageHeader, useToast } from '../components';
import { apiError } from '../../seller/sellerLabels';

const inputCls = 'w-full rounded-xl border border-border bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100';

function Toggle({ label, hint, checked, onChange }) {
  return (
    <label className="flex items-start gap-3 rounded-xl border border-border p-3 text-sm">
      <input type="checkbox" className="mt-0.5 h-4 w-4" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        <span className="block font-medium">{label}</span>
        {hint && <span className="block text-xs text-text-muted">{hint}</span>}
      </span>
    </label>
  );
}

/** Marketplace on/off, seller registration, listing review and seller terms. Money lives on /admin/seller-fees. */
export default function MarketplaceSettingsPage() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const toast = useToast();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    adminApi.getMarketplaceSettings()
      .then(({ data }) => setForm(data.data))
      .catch(() => toast.error(isAr ? 'تعذّر التحميل' : 'Could not load settings'));
  }, [isAr, toast]);

  if (!form) return <div className="flex min-h-[200px] items-center justify-center"><Loader size="lg" /></div>;

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const Chevron = isAr ? ChevronLeft : ChevronRight;

  const save = async () => {
    setSaving(true);
    try {
      await adminApi.updateMarketplaceSettings({
        enabled: form.enabled,
        registrationOpen: form.registrationOpen,
        reviewContentEdits: form.reviewContentEdits,
        termsAr: form.termsAr,
        termsEn: form.termsEn,
      });
      toast.success(isAr ? 'تم حفظ إعدادات السوق' : 'Marketplace settings saved');
    } catch (err) {
      toast.error(apiError(err, isAr ? 'تعذّر الحفظ' : 'Save failed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        description={isAr ? 'تشغيل السوق، تسجيل البائعين، مراجعة منتجاتهم وشروط البيع.' : 'Turning the marketplace on, seller sign-ups, checking seller products and the seller terms.'}
        action={<Button disabled={saving} onClick={save}>{saving ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'حفظ' : 'Save')}</Button>}
      />

      <section className="grid gap-3 rounded-2xl border border-border bg-white p-5 shadow-sm md:grid-cols-3">
        <Toggle label={isAr ? 'تفعيل السوق' : 'Marketplace enabled'} hint={isAr ? 'عند الإيقاف تتوقف طلبات التسجيل الجديدة' : 'When off, no new seller applications'} checked={form.enabled} onChange={set('enabled')} />
        <Toggle label={isAr ? 'التسجيل مفتوح' : 'Registration open'} hint={isAr ? 'صفحة "بِع معنا" تقبل طلبات جديدة' : '"Sell with us" accepts new applications'} checked={form.registrationOpen} onChange={set('registrationOpen')} />
        <Toggle label={isAr ? 'مراجعة تعديلات المنتجات المعروضة' : 'Review edits to live listings'} hint={isAr ? 'الاسم والوصف والصور تنتظر الاعتماد؛ السعر والمخزون فوراً' : 'Name, description and images wait for approval; price and stock apply at once'} checked={form.reviewContentEdits} onChange={set('reviewContentEdits')} />
      </section>

      <Link to="/admin/seller-fees" className="flex items-center justify-between gap-3 rounded-2xl border border-primary-200 bg-primary-50/50 p-5 shadow-sm hover:bg-primary-50">
        <span>
          <span className="block font-bold">{isAr ? 'العمولات والرسوم والتحويلات' : 'Commission, fees & payouts'}</span>
          <span className="block text-sm text-text-muted">{isAr ? 'العمولة، الباقات، قواعد العروض، رسوم الدفع، الضريبة، وجدول تحويل أرباح البائعين — في صفحة واحدة.' : 'Commission, plans, offer rules, payment fees, VAT and the seller payout schedule — all on one page.'}</span>
        </span>
        <Chevron className="h-5 w-5 shrink-0 text-primary-700" />
      </Link>

      <section className="rounded-2xl border border-border bg-white p-5 shadow-sm">
        <h2 className="mb-4 font-bold">{isAr ? 'شروط البيع' : 'Seller terms'}</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm"><span className="mb-1 block font-medium">{isAr ? 'بالعربية' : 'Arabic'}</span><textarea rows={8} className={inputCls} value={form.termsAr || ''} onChange={(e) => set('termsAr')(e.target.value)} dir="rtl" /></label>
          <label className="block text-sm"><span className="mb-1 block font-medium">{isAr ? 'بالإنجليزية' : 'English'}</span><textarea rows={8} className={inputCls} value={form.termsEn || ''} onChange={(e) => set('termsEn')(e.target.value)} dir="ltr" /></label>
        </div>
      </section>
    </div>
  );
}
