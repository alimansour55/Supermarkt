import { useEffect, useState } from 'react';
import { useNavigate } from '../app/router';
import { BadgePercent, CheckCircle2, Store, Truck, Wallet } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import Loader from '../components/ui/Loader';
import { marketplaceApi } from '../services/sellerApi';

const inputCls = 'w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100';

function Field({ label, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-sm font-medium text-text">{label}</span>
      {children}
    </label>
  );
}

export default function SellWithUsPage() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const { signInWithToken } = useAuth();
  const navigate = useNavigate();

  const [config, setConfig] = useState(null);
  const [form, setForm] = useState({
    nameAr: '', nameEn: '', contactName: '', email: '', phone: '', password: '',
    legalName: '', commercialRegisterNo: '', taxId: '', city: '', governorate: '', street: '', note: '',
    acceptTerms: false,
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    marketplaceApi.getConfig().then(({ data }) => setConfig(data.data)).catch(() => setConfig({ registrationOpen: false }));
  }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password.length < 8) {
      setError(isAr ? 'كلمة المرور 8 أحرف على الأقل' : 'Password must be at least 8 characters');
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await marketplaceApi.apply(form);
      await signInWithToken(data.token);
      navigate('/seller-center', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || (isAr ? 'تعذّر إرسال الطلب' : 'Could not submit your application'));
    } finally {
      setSubmitting(false);
    }
  };

  const perks = [
    { Icon: Store, ar: 'متجرك أمام آلاف العملاء', en: 'Your store in front of thousands of shoppers' },
    { Icon: Truck, ar: 'اشحن بنفسك أو دعنا نشحن عنك', en: 'Ship yourself or let us deliver for you' },
    { Icon: Wallet, ar: 'نحصّل المدفوعات ونحوّل أرباحك', en: 'We collect payments and transfer your earnings' },
    { Icon: BadgePercent, ar: config ? `عمولة تبدأ من ${config.defaultCommissionRate}% فقط عند البيع` : 'عمولة فقط عند البيع', en: config ? `Commission from ${config.defaultCommissionRate}% — only when you sell` : 'Commission only when you sell' },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <section className="mb-8 rounded-3xl bg-gradient-to-br from-indigo-700 to-indigo-900 p-6 text-white sm:p-10">
        <h1 className="text-3xl font-extrabold sm:text-4xl">{isAr ? 'بِع منتجاتك معنا' : 'Sell with us'}</h1>
        <p className="mt-2 max-w-2xl text-indigo-100">
          {isAr ? 'سجّل متجرك، أضف منتجاتك، وابدأ البيع بعد اعتماد فريقنا.' : 'Register your store, add your products, and start selling once our team approves you.'}
        </p>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {perks.map(({ Icon, ar, en }) => (
            <li key={en} className="flex items-center gap-3 rounded-2xl bg-white/10 p-3 text-sm">
              <Icon className="h-5 w-5 shrink-0" aria-hidden />
              {isAr ? ar : en}
            </li>
          ))}
        </ul>
      </section>

      {!config ? (
        <div className="flex min-h-[200px] items-center justify-center"><Loader size="lg" /></div>
      ) : !config.registrationOpen ? (
        <p className="rounded-2xl border border-border bg-white p-6 text-center text-text-muted">
          {isAr ? 'التسجيل كبائع مغلق حالياً. يرجى المحاولة لاحقاً.' : 'Seller registration is closed right now. Please check back later.'}
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-6 rounded-3xl border border-border bg-white p-5 shadow-sm sm:p-8" noValidate>
          {error && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{error}</p>}

          <div>
            <h2 className="mb-3 text-lg font-bold">{isAr ? 'المتجر' : 'Your store'}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={isAr ? 'اسم المتجر بالعربية *' : 'Store name (Arabic) *'}><input className={inputCls} value={form.nameAr} onChange={set('nameAr')} required /></Field>
              <Field label={isAr ? 'اسم المتجر بالإنجليزية *' : 'Store name (English) *'}><input className={inputCls} value={form.nameEn} onChange={set('nameEn')} dir="ltr" required /></Field>
            </div>
          </div>

          <div>
            <h2 className="mb-3 text-lg font-bold">{isAr ? 'بيانات الدخول والتواصل' : 'Sign-in & contact'}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={isAr ? 'اسم المسؤول *' : 'Contact name *'}><input className={inputCls} value={form.contactName} onChange={set('contactName')} required /></Field>
              <Field label={isAr ? 'رقم الهاتف *' : 'Phone *'}><input className={inputCls} value={form.phone} onChange={set('phone')} dir="ltr" inputMode="tel" placeholder="01xxxxxxxxx" required /></Field>
              <Field label={isAr ? 'البريد الإلكتروني *' : 'Email *'}><input type="email" className={inputCls} value={form.email} onChange={set('email')} dir="ltr" autoComplete="email" required /></Field>
              <Field label={isAr ? 'كلمة المرور (8 أحرف على الأقل) *' : 'Password (8+ characters) *'}><input type="password" className={inputCls} value={form.password} onChange={set('password')} dir="ltr" autoComplete="new-password" required /></Field>
            </div>
          </div>

          <div>
            <h2 className="mb-3 text-lg font-bold">{isAr ? 'البيانات القانونية والعنوان' : 'Business & address'}</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label={isAr ? 'الاسم القانوني' : 'Legal name'}><input className={inputCls} value={form.legalName} onChange={set('legalName')} /></Field>
              <Field label={isAr ? 'رقم السجل التجاري' : 'Commercial register no.'}><input className={inputCls} value={form.commercialRegisterNo} onChange={set('commercialRegisterNo')} dir="ltr" /></Field>
              <Field label={isAr ? 'الرقم الضريبي' : 'Tax ID'}><input className={inputCls} value={form.taxId} onChange={set('taxId')} dir="ltr" /></Field>
              <Field label={isAr ? 'المحافظة' : 'Governorate'}><input className={inputCls} value={form.governorate} onChange={set('governorate')} /></Field>
              <Field label={isAr ? 'المدينة *' : 'City *'}><input className={inputCls} value={form.city} onChange={set('city')} required /></Field>
              <Field label={isAr ? 'العنوان' : 'Street address'}><input className={inputCls} value={form.street} onChange={set('street')} /></Field>
              <Field label={isAr ? 'ماذا ستبيع؟' : 'What will you sell?'} className="sm:col-span-3">
                <textarea rows={3} className={inputCls} value={form.note} onChange={set('note')} />
              </Field>
            </div>
          </div>

          {(config.termsAr || config.termsEn) && (
            <details className="rounded-xl border border-border p-4 text-sm">
              <summary className="cursor-pointer font-semibold">{isAr ? 'شروط البيع' : 'Seller terms'}</summary>
              <p className="mt-2 whitespace-pre-line text-text-muted">{isAr ? config.termsAr || config.termsEn : config.termsEn || config.termsAr}</p>
            </details>
          )}

          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" checked={form.acceptTerms} onChange={set('acceptTerms')} className="mt-1 h-4 w-4" />
            <span>
              {isAr
                ? `أوافق على شروط البيع وعلى العمولة المطبقة، وأن الأرباح تُحوّل بعد ${config.payoutHoldDays} يوماً من التسليم.`
                : `I accept the seller terms and the applicable commission, and that earnings are paid ${config.payoutHoldDays} days after delivery.`}
            </span>
          </label>

          <button type="submit" disabled={submitting || !form.acceptTerms} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white shadow hover:bg-indigo-700 disabled:opacity-50 sm:w-auto">
            <CheckCircle2 className="h-5 w-5" aria-hidden />
            {submitting ? (isAr ? 'جاري الإرسال...' : 'Submitting...') : (isAr ? 'أرسل طلب التسجيل' : 'Submit application')}
          </button>
        </form>
      )}
    </div>
  );
}
