import { useCallback, useEffect, useState } from 'react';
import {
  KeyRound, Plus, ShieldCheck, Truck, UserCog, Loader2,
} from 'lucide-react';
import { adminApi } from '../../adminApi';
import { useConfirm, useToast } from '..';
import { CopyButton } from '../StaffCredentialsCard';
import { formatDate } from '../../../utils/formatters';

function PortalCard({ isAr, icon: Icon, title, who, path, tone }) {
  const url = `${window.location.origin}${path}`;
  return (
    <div className={`rounded-2xl border p-4 ${tone}`}>
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/70">
          <Icon className="h-4 w-4" />
        </span>
        <h4 className="font-bold">{title}</h4>
      </div>
      <p className="mt-2 text-sm opacity-90">{who}</p>
      <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-white px-3 py-2">
        <code className="truncate text-xs text-text" dir="ltr">{url}</code>
        <CopyButton value={url} isAr={isAr} label={isAr ? 'نسخ الرابط' : 'Copy link'} />
      </div>
    </div>
  );
}

function DriverRow({ driver, isAr, onResetPassword, onOpen, onToggleActive, busy }) {
  const loginLink = `${window.location.origin}/driver/login?u=${encodeURIComponent(driver.username)}`;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-white p-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-100 font-bold text-teal-800">
        {(driver.name || '?').charAt(0).toUpperCase()}
      </span>
      <button type="button" onClick={() => onOpen(driver.id)} className="min-w-0 flex-1 text-start">
        <p className="truncate font-semibold text-text hover:underline">{driver.name}</p>
        <p className="truncate text-xs text-text-muted" dir="ltr">
          @{driver.username}{driver.phone ? ` · ${driver.phone}` : ''}
        </p>
      </button>

      <span
        className={[
          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
          driver.canSignIn ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600',
        ].join(' ')}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${driver.canSignIn ? 'bg-emerald-500' : 'bg-slate-400'}`} />
        {driver.canSignIn ? (isAr ? 'يمكنه الدخول' : 'Can sign in') : (isAr ? 'معطّل' : 'Disabled')}
      </span>

      <span className="hidden text-xs text-text-muted sm:block">
        {driver.lastLoginAt
          ? `${isAr ? 'آخر دخول ' : 'Last in '}${formatDate(driver.lastLoginAt, isAr ? 'ar-EG' : 'en-GB')}`
          : (isAr ? 'لم يدخل بعد' : 'Never signed in')}
      </span>

      <div className="flex items-center gap-1.5">
        <CopyButton value={loginLink} isAr={isAr} label={isAr ? 'نسخ رابط الدخول' : 'Copy login link'} />
        <button
          type="button"
          onClick={() => onResetPassword(driver)}
          disabled={busy}
          className="inline-flex items-center gap-1 rounded-lg border border-border bg-white px-2 py-1 text-xs font-medium text-text-muted hover:bg-slate-50 hover:text-text disabled:opacity-50"
        >
          <KeyRound className="h-3.5 w-3.5" />
          {isAr ? 'كلمة المرور' : 'Password'}
        </button>
        <button
          type="button"
          onClick={() => onToggleActive(driver)}
          disabled={busy}
          className="inline-flex items-center gap-1 rounded-lg border border-border bg-white px-2 py-1 text-xs font-medium text-text-muted hover:bg-slate-50 hover:text-text disabled:opacity-50"
        >
          {driver.canSignIn ? (isAr ? 'تعطيل' : 'Disable') : (isAr ? 'تفعيل' : 'Enable')}
        </button>
      </div>
    </div>
  );
}

export default function TeamAccessTab({ isAr, onResetPassword, onAddDriver, onOpenMember, refreshKey }) {
  const confirm = useConfirm();
  const toast = useToast();
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    adminApi.getStaffAccounts({ role: 'driver', limit: 100, sort: 'name', order: 'asc' })
      .then(({ data }) => setDrivers(data.data || []))
      .catch(() => setDrivers([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load, refreshKey]);

  const toggleActive = async (driver) => {
    const ok = await confirm({
      title: driver.canSignIn
        ? (isAr ? 'تعطيل المندوب' : 'Disable driver')
        : (isAr ? 'تفعيل المندوب' : 'Enable driver'),
      message: driver.canSignIn
        ? (isAr ? `سيتوقف ${driver.name} عن تسجيل الدخول لتطبيق المندوب.` : `${driver.name} will no longer be able to sign in to the driver app.`)
        : (isAr ? `سيتمكن ${driver.name} من تسجيل الدخول مجدداً.` : `${driver.name} will be able to sign in again.`),
      confirmLabel: driver.canSignIn ? (isAr ? 'تعطيل' : 'Disable') : (isAr ? 'تفعيل' : 'Enable'),
      cancelLabel: isAr ? 'إلغاء' : 'Cancel',
      variant: driver.canSignIn ? 'danger' : 'primary',
    });
    if (!ok) return;
    setBusyId(driver.id);
    try {
      await adminApi.updateStaffAccount(driver.id, { isActive: !driver.canSignIn });
      toast.success(isAr ? 'تم التحديث' : 'Updated');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || (isAr ? 'حدث خطأ' : 'Error'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2">
        <PortalCard
          isAr={isAr}
          icon={UserCog}
          title={isAr ? 'لوحة التحكم' : 'Admin panel'}
          who={isAr ? 'مالك النظام، مسؤول المتجر، التشغيل' : 'Owner, Store admin, Operations'}
          path="/admin/login"
          tone="border-orange-200 bg-orange-50 text-orange-900"
        />
        <PortalCard
          isAr={isAr}
          icon={Truck}
          title={isAr ? 'تطبيق المندوب' : 'Driver app'}
          who={isAr ? 'مناديب التوصيل فقط' : 'Delivery drivers only'}
          path="/driver/login"
          tone="border-teal-200 bg-teal-50 text-teal-900"
        />
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-bold text-text">
              <Truck className="h-4 w-4 text-teal-700" />
              {isAr ? 'مناديب التوصيل' : 'Delivery drivers'}
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-text-muted">
                {drivers.length}
              </span>
            </h3>
            <p className="mt-1 text-xs text-text-muted">
              {isAr
                ? 'كل مندوب يدخل باسم المستخدم وكلمة المرور من رابط تطبيق المندوب.'
                : 'Each driver signs in with a username and password at the driver app link.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onAddDriver}
            className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-teal-700"
          >
            <Plus className="h-4 w-4" />
            {isAr ? 'مندوب جديد' : 'Add driver'}
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-10 text-text-muted">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : drivers.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-slate-50/60 px-4 py-8 text-center">
            <Truck className="mx-auto mb-2 h-8 w-8 text-slate-400" />
            <p className="font-medium text-text">{isAr ? 'لا يوجد مناديب بعد' : 'No drivers yet'}</p>
            <p className="mt-1 text-xs text-text-muted">
              {isAr ? 'أنشئ حساب مندوب ليدخل من تطبيق المندوب.' : 'Create a driver account so they can sign in to the driver app.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {drivers.map((driver) => (
              <DriverRow
                key={driver.id}
                driver={driver}
                isAr={isAr}
                busy={busyId === driver.id}
                onResetPassword={onResetPassword}
                onOpen={onOpenMember}
                onToggleActive={toggleActive}
              />
            ))}
          </div>
        )}
      </section>

      <p className="flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-xs text-sky-900">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
        {isAr
          ? 'شارك البيانات عبر قناة خاصة (واتساب مباشر، رسالة شخصية). تُعرض كلمة المرور مرة واحدة فقط عند الإنشاء أو إعادة التعيين.'
          : 'Share credentials over a private channel (direct message). The password is shown only once — at creation or reset.'}
      </p>
    </div>
  );
}
