import { useState } from 'react';
import {
  Crown, History, KeyRound, LockOpen, LogOut, MessageCircle, Pencil, Power, ShieldOff, Trash2, UserPlus, Wand2,
} from 'lucide-react';
import Button from '../../../components/ui/Button';
import { CopyButton, useConfirm, useToast } from '../index';
import { adminApi } from '../../adminApi';
import { SELLER_PERMISSIONS, apiError } from '../../../seller/sellerLabels';
import { formatDate, formatRelativeTime } from '../../../utils/formatters';
import {
  LOGIN_BADGES, deviceLabel, generateTempPassword, isStrongSellerPassword, loginBadges, sellerLoginUrl, tempPasswordMessage,
} from '../../utils/sellerAdmin';
import SellerAccessResult from './SellerAccessResult';

const inputCls = 'w-full rounded-xl border border-border bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100';
const ALL_PERMS = Object.keys(SELLER_PERMISSIONS);

function PermissionPicker({ value, onChange, isAr }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {ALL_PERMS.map((p) => (
        <label key={p} className="flex items-start gap-2 rounded-lg border border-border p-2 text-sm">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={value.includes(p)}
            onChange={() => onChange(value.includes(p) ? value.filter((x) => x !== p) : [...value, p])}
          />
          <span>
            <span className="block font-medium">{isAr ? SELLER_PERMISSIONS[p].ar : SELLER_PERMISSIONS[p].en}</span>
            <span className="block text-xs text-text-muted">{isAr ? SELLER_PERMISSIONS[p].hintAr : SELLER_PERMISSIONS[p].hintEn}</span>
          </span>
        </label>
      ))}
    </div>
  );
}

/** Staff type (or generate) a temporary password; the seller must replace it at next sign-in. */
function TempPasswordForm({ user, seller, isAr, onDone, onCancel }) {
  const toast = useToast();
  const [password, setPassword] = useState(() => generateTempPassword());
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState('');
  const loginUrl = sellerLoginUrl(typeof window !== 'undefined' ? window.location.origin : '');

  const save = async () => {
    setBusy(true);
    try {
      const { data } = await adminApi.setSellerLoginPassword(seller._id, user._id, { password, mustChange: true });
      setSaved(password);
      onDone(data.data, { keepOpen: true });
      toast.success(isAr ? 'تم تعيين كلمة المرور المؤقتة' : 'Temporary password set');
    } catch (err) {
      toast.error(apiError(err, isAr ? 'تعذّر الحفظ' : 'Could not save'));
    } finally {
      setBusy(false);
    }
  };

  if (saved) {
    const message = tempPasswordMessage({ storeName: isAr ? seller.nameAr : seller.nameEn, email: user.email, password: saved, loginUrl });
    return (
      <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 text-sm">
        <p className="text-emerald-900">
          {isAr
            ? 'تم. أرسل كلمة المرور للبائع بنفسك (لا نرسلها بالبريد). سيختار كلمة جديدة بعد الدخول، وتم تسجيل خروجه من كل الأجهزة.'
            : 'Done. Share the password with the seller yourself (we never email it). They choose a new one right after signing in; all their devices were signed out.'}
        </p>
        <div className="flex items-center gap-1 rounded-lg border border-border bg-white px-2 py-1">
          <code dir="ltr" className="min-w-0 flex-1 text-base font-semibold tracking-wider">{saved}</code>
          <CopyButton value={saved} isAr={isAr} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => navigator.clipboard.writeText(message).then(() => toast.success(isAr ? 'تم نسخ الرسالة' : 'Message copied'), () => {})}>
            <MessageCircle className="h-4 w-4" />{isAr ? 'نسخ رسالة لواتساب' : 'Copy WhatsApp message'}
          </Button>
          <Button size="sm" variant="ghost" onClick={onCancel}>{isAr ? 'إغلاق' : 'Close'}</Button>
        </div>
      </div>
    );
  }

  const ok = isStrongSellerPassword(password);
  return (
    <div className="space-y-3 rounded-xl border border-border bg-slate-50 p-3">
      <label className="block text-sm">
        <span className="mb-1 block font-medium">{isAr ? 'كلمة مرور مؤقتة' : 'Temporary password'}</span>
        <div className="flex gap-2">
          <input dir="ltr" className={`${inputCls} font-mono`} value={password} onChange={(e) => setPassword(e.target.value.trim())} autoComplete="off" />
          <Button size="sm" variant="outline" className="shrink-0 gap-1" onClick={() => setPassword(generateTempPassword())} aria-label={isAr ? 'توليد كلمة جديدة' : 'Generate another'}>
            <Wand2 className="h-4 w-4" />
          </Button>
        </div>
        {!ok && <span className="mt-1 block text-xs text-red-700">{isAr ? '٨ أحرف على الأقل، فيها حروف وأرقام.' : 'At least 8 characters with letters and numbers.'}</span>}
      </label>
      <p className="text-xs text-text-muted">
        {isAr
          ? 'يُسجَّل خروج البائع من كل الأجهزة، ويُفتح الحساب إن كان مقفولاً، ويصله بريد بأن كلمة المرور تغيّرت.'
          : 'Signs the seller out everywhere, unlocks the login if locked, and emails them that the password changed.'}
      </p>
      <div className="flex gap-2">
        <Button size="sm" disabled={!ok || busy} onClick={save}>{busy ? (isAr ? 'جارٍ الحفظ…' : 'Saving…') : (isAr ? 'تعيين كلمة المرور' : 'Set password')}</Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>{isAr ? 'إلغاء' : 'Cancel'}</Button>
      </div>
    </div>
  );
}

function EditLoginForm({ user, seller, isAr, onDone, onCancel }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: user.name || '', email: user.email || '', permissions: user.permissions || [] });
  const [busy, setBusy] = useState(false);
  const isOwner = user.role === 'seller_owner';

  const save = async () => {
    setBusy(true);
    try {
      const payload = { name: form.name, email: form.email };
      if (!isOwner) payload.permissions = form.permissions;
      const { data } = await adminApi.updateSellerLogin(seller._id, user._id, payload);
      toast.success(isAr ? 'تم الحفظ' : 'Saved');
      onDone(data.data);
    } catch (err) {
      toast.error(apiError(err, isAr ? 'تعذّر الحفظ' : 'Could not save'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-border bg-slate-50 p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{isAr ? 'الاسم' : 'Name'}</span>
          <input className={inputCls} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{isAr ? 'البريد الذي يدخل به' : 'Sign-in email'}</span>
          <input dir="ltr" type="email" className={inputCls} value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
        </label>
      </div>
      {form.email.trim().toLowerCase() !== user.email && (
        <p className="text-xs text-amber-800">{isAr ? 'سيصل تنبيه للبريد القديم والجديد.' : 'Both the old and the new address get a notice.'}</p>
      )}
      {isOwner ? (
        <p className="text-xs text-text-muted">{isAr ? 'المالك له كل الصلاحيات دائماً.' : 'The owner always has full access.'}</p>
      ) : (
        <div>
          <p className="mb-2 text-sm font-medium">{isAr ? 'ما يستطيع فعله' : 'What they can do'}</p>
          <PermissionPicker value={form.permissions} onChange={(permissions) => setForm((f) => ({ ...f, permissions }))} isAr={isAr} />
        </div>
      )}
      <div className="flex gap-2">
        <Button size="sm" disabled={busy || form.name.trim().length < 2} onClick={save}>{busy ? (isAr ? 'جارٍ الحفظ…' : 'Saving…') : (isAr ? 'حفظ' : 'Save')}</Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>{isAr ? 'إلغاء' : 'Cancel'}</Button>
      </div>
    </div>
  );
}

function AddLoginForm({ seller, isAr, onDone, onCancel }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: '', email: '', mode: 'invite', password: generateTempPassword(), permissions: ['products', 'orders', 'reports', 'store'] });
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      const { data } = await adminApi.addSellerLogin(seller._id, {
        name: form.name,
        email: form.email,
        permissions: form.permissions,
        ...(form.mode === 'password' ? { password: form.password } : {}),
      });
      toast.success(isAr ? 'تمت إضافة الحساب' : 'Login added');
      onDone(data.data, { access: data.access, userId: data.userId, password: form.mode === 'password' ? form.password : '' });
    } catch (err) {
      toast.error(apiError(err, isAr ? 'تعذّر الإضافة' : 'Could not add'));
    } finally {
      setBusy(false);
    }
  };

  const valid = form.name.trim().length >= 2 && /\S+@\S+\.\S+/.test(form.email) && (form.mode === 'invite' || isStrongSellerPassword(form.password));
  return (
    <div className="space-y-3 rounded-xl border border-primary-200 bg-primary-50/40 p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{isAr ? 'الاسم' : 'Name'}</span>
          <input className={inputCls} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{isAr ? 'البريد' : 'Email'}</span>
          <input dir="ltr" type="email" className={inputCls} value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
        </label>
      </div>
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input type="radio" checked={form.mode === 'invite'} onChange={() => setForm((f) => ({ ...f, mode: 'invite' }))} />
          {isAr ? 'إرسال دعوة بالبريد (يختار كلمة المرور بنفسه)' : 'Email an invite (they choose a password)'}
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" checked={form.mode === 'password'} onChange={() => setForm((f) => ({ ...f, mode: 'password' }))} />
          {isAr ? 'كلمة مرور مؤقتة أعطيها له' : 'A temporary password I give them'}
        </label>
      </div>
      {form.mode === 'password' && (
        <div className="flex gap-2">
          <input dir="ltr" className={`${inputCls} font-mono`} value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value.trim() }))} />
          <Button size="sm" variant="outline" className="shrink-0" onClick={() => setForm((f) => ({ ...f, password: generateTempPassword() }))}><Wand2 className="h-4 w-4" /></Button>
        </div>
      )}
      {(seller.team || []).some((u) => u.role === 'seller_owner') && (
        <div>
          <p className="mb-2 text-sm font-medium">{isAr ? 'ما يستطيع فعله' : 'What they can do'}</p>
          <PermissionPicker value={form.permissions} onChange={(permissions) => setForm((f) => ({ ...f, permissions }))} isAr={isAr} />
        </div>
      )}
      <div className="flex gap-2">
        <Button size="sm" disabled={!valid || busy} onClick={save}>{busy ? (isAr ? 'جارٍ الإضافة…' : 'Adding…') : (isAr ? 'إضافة' : 'Add login')}</Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>{isAr ? 'إلغاء' : 'Cancel'}</Button>
      </div>
    </div>
  );
}

/** Logins tab: everything support needs for a seller's sign-in, without ever seeing a password. */
export default function SellerAccessSection({ seller, isAr, canWrite, onTeamChange }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [team, setTeam] = useState(seller.team || []);
  const [busyId, setBusyId] = useState('');
  const [open, setOpen] = useState({ id: '', mode: '' }); // mode: password | edit | history
  const [adding, setAdding] = useState(false);
  const [result, setResult] = useState(null);
  const loginUrl = sellerLoginUrl(typeof window !== 'undefined' ? window.location.origin : '');
  const storeName = isAr ? seller.nameAr : seller.nameEn;
  const sorted = [...team].sort((a, b) => (a.role === 'seller_owner' ? -1 : b.role === 'seller_owner' ? 1 : 0));

  const applyTeam = (rows) => { setTeam(rows); onTeamChange?.(rows); };

  const act = async (user, key, fn, { ok, ask } = {}) => {
    if (ask && !(await confirm({ cancelLabel: isAr ? 'إلغاء' : 'Cancel', ...ask }))) return;
    setBusyId(`${user._id}:${key}`);
    try {
      const { data } = await fn();
      if (Array.isArray(data.data)) applyTeam(data.data);
      if (key === 'link') setResult({ userId: user._id, access: data.data });
      if (ok) toast.success(ok);
    } catch (err) {
      toast.error(apiError(err, isAr ? 'تعذّر التنفيذ' : 'Could not do that'));
    } finally {
      setBusyId('');
    }
  };

  const toggle = (id, mode) => setOpen((o) => (o.id === id && o.mode === mode ? { id: '', mode: '' } : { id, mode }));
  const btn = (user, key, Icon, label, onClick, extra = '') => (
    <Button type="button" size="sm" variant="outline" disabled={busyId === `${user._id}:${key}`} onClick={onClick} className={`gap-1.5 ${extra}`}>
      <Icon className="h-4 w-4" />{label}
    </Button>
  );

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-border bg-white p-4">
        <h3 className="font-bold">{isAr ? 'رابط الدخول' : 'Sign-in link'}</h3>
        <p className="mt-1 text-sm text-text-muted">
          {isAr ? 'يدخل البائع وفريقه من هذا الرابط بالبريد وكلمة المرور.' : 'The seller and their team sign in here with email and password.'}
        </p>
        <div className="mt-3 flex items-center gap-1 rounded-lg bg-slate-50 px-2 py-1">
          <code dir="ltr" className="min-w-0 flex-1 truncate text-xs">{loginUrl}</code>
          <CopyButton value={loginUrl} isAr={isAr} />
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-bold">{isAr ? 'حسابات الدخول' : 'Logins'} <span className="text-sm font-normal text-text-muted">({team.length})</span></h3>
          {canWrite && !adding && (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setAdding(true)}><UserPlus className="h-4 w-4" />{isAr ? 'إضافة حساب' : 'Add login'}</Button>
          )}
        </div>

        {adding && (
          <div className="mb-3">
            <AddLoginForm
              seller={{ ...seller, team }}
              isAr={isAr}
              onCancel={() => setAdding(false)}
              onDone={(rows, extra) => {
                applyTeam(rows);
                setAdding(false);
                if (extra.password) setResult({ userId: extra.userId, temp: extra.password });
                else setResult({ userId: extra.userId, access: extra.access });
              }}
            />
          </div>
        )}

        {!sorted.length ? (
          <p className="text-sm text-text-muted">{isAr ? 'لا توجد حسابات دخول لهذا البائع. أضف حساباً للمالك.' : 'This seller has no logins. Add one for the owner.'}</p>
        ) : (
          <ul className="space-y-3">
            {sorted.map((u) => {
              const badges = loginBadges(u);
              const active = u.isActive !== false;
              const isOwner = u.role === 'seller_owner';
              const locked = badges.includes('locked');
              return (
                <li key={u._id} className="rounded-xl border border-border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 font-semibold">
                        {u.name}
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${isOwner ? 'bg-primary-50 text-primary-800' : 'bg-slate-100 text-slate-700'}`}>
                          {isOwner ? (isAr ? 'المالك' : 'Owner') : (isAr ? 'موظف' : 'Staff')}
                        </span>
                        {badges.map((b) => (
                          <span key={b} className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${LOGIN_BADGES[b].tone}`}>{isAr ? LOGIN_BADGES[b].ar : LOGIN_BADGES[b].en}</span>
                        ))}
                      </p>
                      <p dir="ltr" className="text-start text-xs text-text-muted">{u.email}</p>
                      <p className="mt-1 text-xs text-text-muted">
                        {u.lastLoginAt ? `${isAr ? 'آخر دخول' : 'Last sign-in'}: ${formatRelativeTime(u.lastLoginAt, isAr)}` : (isAr ? 'لم يدخل بعد' : 'Has not signed in yet')}
                        {locked && ` · ${isAr ? 'مقفول حتى' : 'Locked until'} ${new Date(u.lockedUntil).toLocaleTimeString(isAr ? 'ar-EG' : 'en-GB', { hour: '2-digit', minute: '2-digit' })}`}
                        {!locked && u.failedLoginCount > 0 && ` · ${isAr ? 'محاولات خاطئة' : 'Wrong passwords'}: ${u.failedLoginCount}`}
                      </p>
                      {!isOwner && (u.permissions || []).length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {u.permissions.map((p) => <span key={p} className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px]">{isAr ? SELLER_PERMISSIONS[p]?.ar : SELLER_PERMISSIONS[p]?.en}</span>)}
                        </div>
                      )}
                    </div>
                  </div>

                  {canWrite && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {active && btn(u, 'password', KeyRound, isAr ? 'تعيين كلمة مرور مؤقتة' : 'Set temporary password', () => toggle(u._id, 'password'))}
                      {active && btn(u, 'link', MessageCircle, u.lastLoginAt ? (isAr ? 'إرسال رابط تغيير كلمة المرور' : 'Email reset link') : (isAr ? 'إعادة إرسال الدعوة' : 'Resend invite'), () => act(u, 'link', () => adminApi.sendSellerAccess(seller._id, { userId: u._id })))}
                      {locked && btn(u, 'unlock', LockOpen, isAr ? 'فتح القفل' : 'Unlock', () => act(u, 'unlock', () => adminApi.updateSellerLogin(seller._id, u._id, { unlock: true }), { ok: isAr ? 'تم فتح الحساب' : 'Unlocked' }))}
                      {active && btn(u, 'signout', LogOut, isAr ? 'تسجيل خروج من كل الأجهزة' : 'Sign out everywhere', () => act(u, 'signout', () => adminApi.signOutSellerLogin(seller._id, u._id), {
                        ok: isAr ? 'تم تسجيل الخروج' : 'Signed out',
                        ask: { title: isAr ? `تسجيل خروج ${u.name}؟` : `Sign ${u.name} out?`, message: isAr ? 'سيحتاج للدخول من جديد على كل أجهزته.' : 'They will need to sign in again on every device.', confirmLabel: isAr ? 'تسجيل الخروج' : 'Sign out', variant: 'primary' },
                      }))}
                      {u.twoFactorEnabled && btn(u, '2fa', ShieldOff, isAr ? 'إيقاف التحقق بخطوتين' : 'Turn off 2-step', () => act(u, '2fa', () => adminApi.updateSellerLogin(seller._id, u._id, { twoFactorEnabled: false }), {
                        ok: isAr ? 'تم إيقاف التحقق بخطوتين' : '2-step verification turned off',
                        ask: { title: isAr ? 'إيقاف التحقق بخطوتين؟' : 'Turn off 2-step verification?', message: isAr ? 'استخدمه فقط إذا فقد البائع الوصول لبريده. سيصله تنبيه.' : 'Only when the seller lost access to their email. They will be notified.', confirmLabel: isAr ? 'إيقاف' : 'Turn off' },
                      }))}
                      {btn(u, 'edit', Pencil, isAr ? 'تعديل' : 'Edit', () => toggle(u._id, 'edit'))}
                      {(u.loginHistory || []).length > 0 && btn(u, 'history', History, isAr ? 'سجل الدخول' : 'Sign-in history', () => toggle(u._id, 'history'))}
                      {!isOwner && active && btn(u, 'owner', Crown, isAr ? 'جعله المالك' : 'Make owner', () => act(u, 'owner', () => adminApi.transferSellerOwner(seller._id, u._id), {
                        ok: isAr ? 'تم نقل الملكية' : 'Owner changed',
                        ask: { title: isAr ? `جعل ${u.name} المالك؟` : `Make ${u.name} the owner?`, message: isAr ? 'يحصل على كل الصلاحيات ويرى بيانات البنك. يبقى المالك الحالي موظفاً بكل الصلاحيات.' : 'They get full access including bank details. The current owner stays on as staff with every permission.', confirmLabel: isAr ? 'نقل الملكية' : 'Transfer', variant: 'primary' },
                      }))}
                      {btn(u, 'active', Power, active ? (isAr ? 'إيقاف الدخول' : 'Turn off') : (isAr ? 'تشغيل الدخول' : 'Turn on'), () => act(u, 'active', () => adminApi.updateSellerLogin(seller._id, u._id, { isActive: !active }), {
                        ok: active ? (isAr ? 'تم إيقاف الحساب' : 'Login turned off') : (isAr ? 'تم تشغيل الحساب' : 'Login turned on'),
                        ask: active ? { title: isAr ? `إيقاف دخول ${u.name}؟` : `Turn off ${u.name}?`, message: isAr ? 'لن يستطيع الدخول ويُسجَّل خروجه فوراً. يمكنك تشغيله لاحقاً.' : 'They cannot sign in and are signed out now. You can turn it back on later.', confirmLabel: isAr ? 'إيقاف' : 'Turn off' } : undefined,
                      }), active ? 'text-red-700' : '')}
                      {!isOwner && btn(u, 'remove', Trash2, isAr ? 'حذف' : 'Remove', () => act(u, 'remove', () => adminApi.removeSellerLogin(seller._id, u._id), {
                        ok: isAr ? 'تم حذف الحساب' : 'Login removed',
                        ask: { title: isAr ? `حذف حساب ${u.name}؟` : `Remove ${u.name}?`, message: isAr ? 'يُحذف حساب الدخول نهائياً. يبقى سجل ما فعله.' : 'The login is deleted for good. Their activity history stays.', confirmLabel: isAr ? 'حذف' : 'Remove' },
                      }), 'text-red-700')}
                    </div>
                  )}

                  {open.id === u._id && open.mode === 'password' && (
                    <div className="mt-3"><TempPasswordForm user={u} seller={seller} isAr={isAr} onDone={(rows) => applyTeam(rows)} onCancel={() => toggle(u._id, 'password')} /></div>
                  )}
                  {open.id === u._id && open.mode === 'edit' && (
                    <div className="mt-3"><EditLoginForm user={u} seller={seller} isAr={isAr} onDone={(rows) => { applyTeam(rows); toggle(u._id, 'edit'); }} onCancel={() => toggle(u._id, 'edit')} /></div>
                  )}
                  {open.id === u._id && open.mode === 'history' && (
                    <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-border text-xs">
                      {(u.loginHistory || []).map((h, i) => (
                        <li key={i} className="flex flex-wrap justify-between gap-2 px-3 py-2">
                          <span>{formatDate(h.at, isAr ? 'ar-EG' : 'en-GB')} · {new Date(h.at).toLocaleTimeString(isAr ? 'ar-EG' : 'en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                          <span className="text-text-muted">{deviceLabel(h.userAgent)}</span>
                          <span dir="ltr" className="font-mono text-text-muted">{h.ip || '—'}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {result?.userId === u._id && result.access && <div className="mt-3"><SellerAccessResult access={result.access} storeName={storeName} isAr={isAr} /></div>}
                  {result?.userId === u._id && result.temp && (
                    <div className="mt-3 flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-sm">
                      <span className="text-emerald-900">{isAr ? 'كلمة المرور المؤقتة:' : 'Temporary password:'}</span>
                      <code dir="ltr" className="min-w-0 flex-1 font-semibold">{result.temp}</code>
                      <CopyButton value={result.temp} isAr={isAr} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-3 text-xs text-text-muted">
          {isAr
            ? 'لا نعرض كلمات المرور المحفوظة أبداً. كل تغيير يُسجَّل ويصل البائع تنبيه به. بعد ١٠ كلمات مرور خاطئة يُقفل الدخول ١٥ دقيقة.'
            : 'Saved passwords are never shown. Every change is logged and the seller is notified. After 10 wrong passwords, sign-in locks for 15 minutes.'}
        </p>
      </section>
    </div>
  );
}
