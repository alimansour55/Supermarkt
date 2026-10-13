import { useEffect, useState } from 'react';
import { Link } from '../../app/router';
import { History, KeyRound, ShieldCheck, UserPlus } from 'lucide-react';
import { useToast } from '../../components/ui/Toast';
import { sellerApi } from '../../services/sellerApi';
import { SELLER_PERMISSIONS, apiError } from '../sellerLabels';
import PasswordStrength, { passwordIsStrong } from '../PasswordStrength';

const inputCls = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100';
const DEFAULT = ['products', 'orders', 'reports', 'store'];

function PermissionPicker({ value, onChange, isAr, compact = false }) {
  const toggle = (key) => onChange(value.includes(key) ? value.filter((k) => k !== key) : [...value, key]);
  return (
    <div className={`grid gap-2 ${compact ? 'sm:grid-cols-5' : 'sm:grid-cols-2 lg:grid-cols-3'}`}>
      {Object.entries(SELLER_PERMISSIONS).map(([key, p]) => (
        <label key={key} className={`flex cursor-pointer items-start gap-2 rounded-xl p-2.5 text-sm ring-1 ${value.includes(key) ? 'bg-indigo-50 ring-indigo-200' : 'bg-white ring-slate-200'}`}>
          <input type="checkbox" checked={value.includes(key)} onChange={() => toggle(key)} className="mt-0.5 h-4 w-4 rounded" />
          <span>
            <span className="block font-medium">{isAr ? p.ar : p.en}</span>
            {!compact && <span className="block text-xs text-slate-500">{isAr ? p.hintAr : p.hintEn}</span>}
          </span>
        </label>
      ))}
    </div>
  );
}

/** Owner-only: staff logins with per-area permissions. */
export default function TeamSettings({ isAr }) {
  const toast = useToast();
  const [team, setTeam] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', permissions: DEFAULT });
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(null); // { id, permissions }
  const [resetFor, setResetFor] = useState(null); // { id, password }

  const load = () => sellerApi.listTeam().then(({ data }) => setTeam(data.data || [])).catch(() => setTeam([]));
  useEffect(() => { load(); }, []);

  const update = async (id, body, done) => {
    try {
      await sellerApi.updateTeamMember(id, body);
      toast.success(done);
      setEditing(null);
      setResetFor(null);
      load();
    } catch (err) {
      toast.error(apiError(err, isAr ? 'تعذّر التحديث' : 'Update failed'));
    }
  };

  const add = async () => {
    setBusy(true);
    try {
      await sellerApi.addTeamMember(form);
      setForm({ name: '', email: '', password: '', permissions: DEFAULT });
      toast.success(isAr ? 'تمت إضافة الموظف' : 'Team member added');
      load();
    } catch (err) {
      toast.error(apiError(err, isAr ? 'تعذّرت الإضافة' : 'Could not add'));
    } finally {
      setBusy(false);
    }
  };

  const fmt = (d) => (d ? new Date(d).toLocaleString(isAr ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : (isAr ? 'لم يسجّل دخولاً بعد' : 'Never signed in'));

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
          <div>
            <h2 className="font-bold">{isAr ? 'فريق المتجر' : 'Store team'}</h2>
            <p className="text-sm text-slate-500">{isAr ? 'حدد لكل موظف الأقسام التي يمكنه الوصول إليها. البنك والفريق للمالك فقط.' : 'Choose what each staff login can reach. Bank details and the team stay owner-only.'}</p>
          </div>
          <Link to="/seller-center/activity" className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-700 hover:underline"><History className="h-4 w-4" />{isAr ? 'سجل النشاط' : 'Activity log'}</Link>
        </div>
        <ul className="divide-y divide-slate-100">
          {(team || []).map((m) => (
            <li key={m._id} className={`p-4 ${m.isActive === false ? 'bg-slate-50 opacity-70' : ''}`}>
              <div className="flex flex-wrap items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">{m.name.slice(0, 2).toUpperCase()}</span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-semibold">
                    {m.name}
                    <span className={`rounded-full px-2 py-0.5 text-[11px] ${m.role === 'seller_owner' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>{m.role === 'seller_owner' ? (isAr ? 'المالك' : 'Owner') : (isAr ? 'موظف' : 'Staff')}</span>
                    {m.twoFactorEnabled && <ShieldCheck className="h-4 w-4 text-emerald-600" aria-label="2FA" />}
                    {m.isActive === false && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] text-red-700">{isAr ? 'موقوف' : 'Deactivated'}</span>}
                  </p>
                  <p className="text-xs text-slate-500"><span dir="ltr">{m.email}</span> · {isAr ? 'آخر دخول: ' : 'Last sign-in: '}{fmt(m.lastLoginAt)}</p>
                  {m.role === 'seller_staff' && (
                    <p className="mt-1 flex flex-wrap gap-1">
                      {m.permissions.length === 0 && <span className="text-xs text-red-600">{isAr ? 'بدون صلاحيات' : 'No access'}</span>}
                      {m.permissions.map((p) => <span key={p} className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px]">{isAr ? SELLER_PERMISSIONS[p]?.ar : SELLER_PERMISSIONS[p]?.en}</span>)}
                    </p>
                  )}
                </div>
                {m.role === 'seller_staff' && (
                  <div className="flex flex-wrap gap-1.5">
                    <button type="button" onClick={() => setEditing({ id: m._id, permissions: m.permissions })} className="rounded-lg px-3 py-1.5 text-xs font-semibold ring-1 ring-slate-200 hover:bg-slate-50">{isAr ? 'الصلاحيات' : 'Permissions'}</button>
                    <button type="button" onClick={() => setResetFor({ id: m._id, password: '' })} className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold ring-1 ring-slate-200 hover:bg-slate-50"><KeyRound className="h-3.5 w-3.5" />{isAr ? 'كلمة مرور' : 'Password'}</button>
                    <button type="button" onClick={() => update(m._id, { isActive: m.isActive === false }, isAr ? 'تم' : 'Done')} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ring-1 ${m.isActive === false ? 'text-emerald-700 ring-emerald-200 hover:bg-emerald-50' : 'text-red-600 ring-red-200 hover:bg-red-50'}`}>
                      {m.isActive === false ? (isAr ? 'تفعيل' : 'Activate') : (isAr ? 'إيقاف' : 'Deactivate')}
                    </button>
                  </div>
                )}
              </div>
              {editing?.id === m._id && (
                <div className="mt-3 space-y-3 rounded-xl bg-slate-50 p-3">
                  <PermissionPicker value={editing.permissions} onChange={(permissions) => setEditing({ ...editing, permissions })} isAr={isAr} />
                  <div className="flex gap-2">
                    <button type="button" onClick={() => update(m._id, { permissions: editing.permissions }, isAr ? 'تم حفظ الصلاحيات' : 'Permissions saved')} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white">{isAr ? 'حفظ' : 'Save'}</button>
                    <button type="button" onClick={() => setEditing(null)} className="rounded-lg px-3 py-1.5 text-sm ring-1 ring-slate-200">{isAr ? 'إلغاء' : 'Cancel'}</button>
                  </div>
                </div>
              )}
              {resetFor?.id === m._id && (
                <div className="mt-3 rounded-xl bg-slate-50 p-3">
                  <div className="flex flex-wrap gap-2">
                    <input type="password" value={resetFor.password} onChange={(e) => setResetFor({ ...resetFor, password: e.target.value })} placeholder={isAr ? 'كلمة مرور جديدة' : 'New password'} className={`${inputCls} max-w-xs`} dir="ltr" autoComplete="new-password" />
                    <button type="button" disabled={!passwordIsStrong(resetFor.password)} onClick={() => update(m._id, { password: resetFor.password }, isAr ? 'تم تغيير كلمة المرور وتسجيل خروجه' : 'Password changed — they were signed out')} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">{isAr ? 'تعيين' : 'Set'}</button>
                    <button type="button" onClick={() => setResetFor(null)} className="rounded-lg px-3 py-1.5 text-sm ring-1 ring-slate-200">{isAr ? 'إلغاء' : 'Cancel'}</button>
                  </div>
                  <PasswordStrength value={resetFor.password} isAr={isAr} />
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 flex items-center gap-2 font-bold"><UserPlus className="h-5 w-5 text-indigo-600" />{isAr ? 'إضافة موظف' : 'Add a staff login'}</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <input className={inputCls} placeholder={isAr ? 'الاسم' : 'Name'} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <input className={inputCls} placeholder={isAr ? 'البريد الإلكتروني' : 'Email'} value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} dir="ltr" />
          <div>
            <input type="password" className={inputCls} placeholder={isAr ? 'كلمة المرور' : 'Password'} value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} dir="ltr" autoComplete="new-password" />
            {form.password && <PasswordStrength value={form.password} isAr={isAr} />}
          </div>
        </div>
        <p className="mb-2 mt-4 text-sm font-medium">{isAr ? 'ما الذي يمكنه الوصول إليه؟' : 'What can they access?'}</p>
        <PermissionPicker value={form.permissions} onChange={(permissions) => setForm((f) => ({ ...f, permissions }))} isAr={isAr} />
        <button type="button" disabled={busy || !form.name || !form.email || !passwordIsStrong(form.password)} onClick={add} className="mt-4 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
          {isAr ? 'إضافة موظف' : 'Add staff'}
        </button>
      </section>
    </div>
  );
}
