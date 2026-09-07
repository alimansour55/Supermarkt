import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Shield, Truck, UserPlus, Users, X } from 'lucide-react';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import PhoneInput from '../../components/ui/PhoneInput';
import { localToEgyptPhone, formatLocalPhoneDisplay } from '../../utils/phoneHelpers';
import { roleLabel } from '../adminPermissions';

const ACCOUNT_TYPES = [
  {
    value: 'user',
    icon: Users,
    hintEn: 'Shops on the store and logs in with SMS OTP.',
    hintAr: 'يتسوق من المتجر ويسجّل الدخول برمز SMS.',
  },
  {
    value: 'driver',
    icon: Truck,
    hintEn: 'Delivery driver — assign orders from admin. For the driver app, add login in Admin team.',
    hintAr: 'مندوب توصيل — عيّن الطلبات من لوحة التحكم. لتطبيق المندوب، أضف اسم مستخدم من فريق الإدارة.',
  },
];

export default function AddUserModal({
  open,
  isAr,
  saving,
  defaultRole = 'user',
  onClose,
  onSubmit,
}) {
  const [name, setName] = useState('');
  const [phoneLocal, setPhoneLocal] = useState('');
  const [role, setRole] = useState(defaultRole);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setName('');
    setPhoneLocal('');
    setRole(defaultRole === 'driver' ? 'driver' : 'user');
    setError('');
  }, [open, defaultRole]);

  if (!open) return null;

  const phonePreview = formatLocalPhoneDisplay(localToEgyptPhone(phoneLocal));

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    const trimmedName = name.trim();
    const phone = localToEgyptPhone(phoneLocal);
    if (!trimmedName) {
      setError(isAr ? 'الاسم مطلوب' : 'Name is required');
      return;
    }
    if (!phone || phone.length < 11) {
      setError(isAr ? 'أدخل رقم هاتف مصري صحيح' : 'Enter a valid Egyptian mobile number');
      return;
    }
    onSubmit({ name: trimmedName, phone, role });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/50 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-user-title"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-white shadow-xl"
      >
        <div className="flex items-start justify-between border-b border-border px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
              <UserPlus className="h-5 w-5" />
            </span>
            <div>
              <h2 id="add-user-title" className="text-lg font-bold text-text">
                {isAr ? 'إضافة مستخدم' : 'Add user'}
              </h2>
              <p className="mt-1 text-sm text-text-muted">
                {isAr
                  ? 'يُنشأ الحساب برقم الهاتف كما لو سجّل بنفسه — موثّق وجاهز للاستخدام.'
                  : 'Creates a verified phone account as if they signed up themselves.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg p-1.5 text-text-muted hover:bg-slate-100"
            aria-label={isAr ? 'إغلاق' : 'Close'}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-5">
          <div>
            <p className="mb-2 text-sm font-semibold text-text">
              {isAr ? 'نوع الحساب' : 'Account type'}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {ACCOUNT_TYPES.map(({ value, icon: Icon }) => {
                const active = role === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setRole(value)}
                    className={[
                      'flex items-start gap-3 rounded-xl border p-3 text-start transition-colors',
                      active
                        ? 'border-primary-400 bg-primary-50 ring-1 ring-primary-200'
                        : 'border-border bg-white hover:border-primary-200 hover:bg-slate-50',
                    ].join(' ')}
                  >
                    <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${active ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <span>
                      <span className="block text-sm font-bold text-text">
                        {roleLabel(value, isAr)}
                      </span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-text-muted">
                        {isAr
                          ? ACCOUNT_TYPES.find((t) => t.value === value)?.hintAr
                          : ACCOUNT_TYPES.find((t) => t.value === value)?.hintEn}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <Input
            label={isAr ? 'الاسم' : 'Full name'}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={role === 'driver'
              ? (isAr ? 'مثال: محمد علي' : 'e.g. Mohamed Ali')
              : (isAr ? 'مثال: أحمد محمد' : 'e.g. Ahmed Mohamed')}
            required
            autoComplete="name"
          />

          <div>
            <PhoneInput
              label={isAr ? 'رقم الهاتف' : 'Phone number'}
              value={phoneLocal}
              onChange={setPhoneLocal}
              required
            />
            {phonePreview && (
              <p className="mt-1.5 text-xs text-text-muted">
                {isAr ? 'سيُحفظ كـ' : 'Will be saved as'}{' '}
                <span dir="ltr" className="font-semibold text-text">{phonePreview}</span>
              </p>
            )}
          </div>

          {role === 'driver' && (
            <div className="flex gap-2.5 rounded-xl border border-amber-200 bg-amber-50/80 px-3.5 py-3 text-sm text-amber-950">
              <Shield className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
              <p className="leading-relaxed">
                {isAr ? (
                  <>
                    لتسجيل دخول المندوب في تطبيق التوصيل، أضف له اسم مستخدم وكلمة مرور من{' '}
                    <Link to="/admin/team" className="font-semibold text-primary-700 underline" onClick={onClose}>
                      فريق الإدارة
                    </Link>
                    .
                  </>
                ) : (
                  <>
                    For driver app login, set up username & password in{' '}
                    <Link to="/admin/team" className="font-semibold text-primary-700 underline" onClick={onClose}>
                      Admin team
                    </Link>
                    .
                  </>
                )}
              </p>
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-xs leading-relaxed text-text-muted">
            {role === 'driver'
              ? (isAr
                ? 'يُنشأ حساب مندوب برقم الهاتف — يمكن تعيين الطلبات له فوراً.'
                : 'Creates a driver profile with this phone — you can assign deliveries immediately.')
              : (isAr
                ? 'يمكن للعميل تسجيل الدخول فوراً برقم هاتفه ورمز SMS.'
                : 'The customer can sign in immediately with this phone and an SMS code.')}
          </div>

          {error && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {error}
            </p>
          )}

          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
              {isAr ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving
                ? (isAr ? 'جاري الإنشاء…' : 'Creating…')
                : (isAr ? `إنشاء ${roleLabel(role, true)}` : `Create ${roleLabel(role, false).toLowerCase()}`)}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
