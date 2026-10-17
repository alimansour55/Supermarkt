import { useState } from 'react';
import { Mail, KeyRound } from 'lucide-react';
import Button from '../../../components/ui/Button';
import { useToast } from '../index';
import { adminApi } from '../../adminApi';
import { apiErrorText, fieldErrors } from '../../../seller/sellerLabels';
import SellerAccessResult from './SellerAccessResult';

const inputCls = 'w-full rounded-xl border border-border bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100';

const EMPTY = { nameAr: '', nameEn: '', contactName: '', email: '', phone: '', city: '', password: '', activate: true };

function Field({ label, hint, error, children }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium">{label}</span>
      {children}
      {error
        ? <span className="mt-1 block text-xs font-medium text-red-700" role="alert">{error}</span>
        : hint && <span className="mt-1 block text-xs text-text-muted">{hint}</span>}
    </label>
  );
}

/**
 * Staff onboarding. The default is an emailed invite — the seller picks their own password, so
 * staff never handle it. After creating, the panel shows the links to pass on.
 */
export default function CreateSellerPanel({ isAr, onCreated, onOpenSeller }) {
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [mode, setMode] = useState('invite');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(null);
  const [errors, setErrors] = useState({});
  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
    setErrors((er) => (er[k] ? { ...er, [k]: '' } : er));
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      const payload = { ...form, password: mode === 'password' ? form.password : '' };
      const { data } = await adminApi.createSeller(payload);
      toast.success(isAr ? 'تم إنشاء البائع' : 'Seller created');
      setDone({ seller: data.data, access: data.access });
      onCreated(data.data._id);
    } catch (err) {
      setErrors(fieldErrors(err, isAr));
      toast.error(apiErrorText(err, isAr ? 'تعذّر الإنشاء' : 'Could not create seller', isAr));
    } finally {
      setSaving(false);
    }
  };

  if (done) {
    const name = isAr ? done.seller.nameAr : done.seller.nameEn;
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-bold">{isAr ? `تم إنشاء ${name}` : `${name} is set up`}</h3>
          <p className="mt-1 text-sm text-text-muted">
            {done.seller.status === 'active'
              ? (isAr ? 'المتجر مفعّل. بمجرد أن يدخل البائع يمكنه إضافة منتجاته.' : 'The store is active. Once the seller signs in they can add products.')
              : (isAr ? 'المتجر قيد المراجعة. يمكن للبائع الدخول وإكمال بياناته، ولن تظهر منتجاته حتى تعتمده.' : 'The store is under review. The seller can sign in and finish their profile; nothing goes live until you approve it.')}
          </p>
        </div>
        <SellerAccessResult access={done.access} storeName={name} isAr={isAr} />
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => onOpenSeller(done.seller._id)}>{isAr ? 'فتح ملف البائع' : 'Open seller'}</Button>
          <Button type="button" variant="outline" onClick={() => { setForm(EMPTY); setDone(null); }}>{isAr ? 'إضافة بائع آخر' : 'Add another'}</Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <section className="space-y-3">
        <h3 className="text-sm font-bold text-text">{isAr ? 'المتجر' : 'Store'}</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={isAr ? 'اسم المتجر (عربي)' : 'Store name (Arabic)'} error={errors.nameAr}><input className={inputCls} value={form.nameAr} onChange={set('nameAr')} /></Field>
          <Field label={isAr ? 'اسم المتجر (إنجليزي) — اختياري' : 'Store name (English) — optional'} hint={isAr ? 'إن تركته فارغاً نستخدم الاسم العربي' : 'Left empty, the Arabic name is used'} error={errors.nameEn}><input className={inputCls} value={form.nameEn} onChange={set('nameEn')} dir="ltr" /></Field>
        </div>
        <Field label={isAr ? 'المدينة' : 'City'} error={errors.city}><input className={inputCls} value={form.city} onChange={set('city')} /></Field>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-bold text-text">{isAr ? 'المسؤول عن المتجر' : 'Store owner'}</h3>
        <Field label={isAr ? 'الاسم' : 'Name'} error={errors.contactName}><input className={inputCls} value={form.contactName} onChange={set('contactName')} /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={isAr ? 'البريد الإلكتروني' : 'Email'} hint={isAr ? 'يدخل به إلى مركز البائعين — يجب ألا يكون مستخدماً لحساب آخر' : 'Used to sign in to Seller Center — must not belong to another account'} error={errors.email}>
            <input type="email" className={inputCls} value={form.email} onChange={set('email')} dir="ltr" />
          </Field>
          <Field label={isAr ? 'الهاتف' : 'Phone'} error={errors.phone}><input type="tel" className={inputCls} value={form.phone} onChange={set('phone')} dir="ltr" /></Field>
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-bold text-text">{isAr ? 'كيف سيدخل البائع؟' : 'How will they sign in?'}</h3>
        {[
          { value: 'invite', Icon: Mail, title: isAr ? 'إرسال دعوة بالبريد (مستحسن)' : 'Email an invite (recommended)', hint: isAr ? 'يختار البائع كلمة المرور بنفسه. ستحصل أيضاً على رسالة جاهزة لواتساب.' : 'The seller chooses their own password. You also get a ready message for WhatsApp.' },
          { value: 'password', Icon: KeyRound, title: isAr ? 'تعيين كلمة مرور الآن' : 'Set a password now', hint: isAr ? 'أنت تختار كلمة المرور وترسلها للبائع بنفسك.' : 'You choose the password and pass it on yourself.' },
        ].map(({ value, Icon, title, hint }) => (
          <label key={value} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${mode === value ? 'border-primary-400 bg-primary-50/50 ring-1 ring-primary-100' : 'border-border bg-white'}`}>
            <input type="radio" name="access-mode" className="mt-1" checked={mode === value} onChange={() => setMode(value)} />
            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary-700" />
            <span>
              <span className="block text-sm font-semibold">{title}</span>
              <span className="block text-xs text-text-muted">{hint}</span>
            </span>
          </label>
        ))}
        {mode === 'password' && (
          <Field label={isAr ? 'كلمة المرور' : 'Password'} hint={isAr ? '8 أحرف على الأقل، حروف وأرقام' : 'At least 8 characters with letters and numbers'} error={errors.password}>
            <input type="password" autoComplete="new-password" className={inputCls} value={form.password} onChange={set('password')} dir="ltr" />
          </Field>
        )}
      </section>

      <label className="flex items-start gap-3 rounded-xl border border-border bg-white p-3 text-sm">
        <input type="checkbox" className="mt-1" checked={form.activate} onChange={set('activate')} />
        <span>
          <span className="block font-semibold">{isAr ? 'تفعيل المتجر مباشرة' : 'Activate right away'}</span>
          <span className="block text-xs text-text-muted">{isAr ? 'أوقف هذا الخيار إذا كنت تريد مراجعة مستنداته أولاً.' : 'Turn off if you want to check their documents first.'}</span>
        </span>
      </label>

      <Button type="submit" disabled={saving} className="w-full">{saving ? (isAr ? 'جارٍ الإنشاء…' : 'Creating…') : (isAr ? 'إنشاء البائع' : 'Create seller')}</Button>
    </form>
  );
}
