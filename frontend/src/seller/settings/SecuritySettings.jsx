import { useEffect, useState } from 'react';
import { KeyRound, LogOut, Monitor, ShieldCheck, Smartphone } from 'lucide-react';
import { useToast } from '../../components/ui/Toast';
import { useAuth } from '../../context/AuthContext';
import { sellerApi } from '../../services/sellerApi';
import { apiError } from '../sellerLabels';
import PasswordStrength, { passwordIsStrong } from '../PasswordStrength';
import { PageSkeleton } from '../ui';

const inputCls = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100';

/** A short device name from a user agent ("Chrome on Windows"). */
function device(ua = '') {
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  const os = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
  return { label: os ? `${browser} · ${os}` : browser, mobile: /Android|iPhone|iPad|Mobile/.test(ua) };
}

/** Every seller login (owner or staff) manages its own password, 2-step sign-in and sessions here. */
export default function SecuritySettings({ isAr }) {
  const toast = useToast();
  const { replaceToken } = useAuth();
  const [data, setData] = useState(null);
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [twoFaPassword, setTwoFaPassword] = useState('');
  const [askTwoFa, setAskTwoFa] = useState(false);
  const [busy, setBusy] = useState('');

  const load = () => sellerApi.getSecurity().then(({ data: d }) => setData(d.data)).catch(() => setData({ loginHistory: [] }));
  useEffect(() => { load(); }, []);

  const run = async (key, fn) => {
    setBusy(key);
    try {
      await fn();
    } catch (err) {
      toast.error(apiError(err, isAr ? 'تعذّر الحفظ' : 'Could not save'));
    } finally {
      setBusy('');
    }
  };

  const changePassword = (e) => {
    e.preventDefault();
    if (pw.newPassword !== pw.confirm) return toast.error(isAr ? 'كلمتا المرور غير متطابقتين' : "Passwords don't match");
    return run('pw', async () => {
      const { data: res } = await sellerApi.changePassword({ currentPassword: pw.currentPassword, newPassword: pw.newPassword });
      replaceToken(res.token);
      setPw({ currentPassword: '', newPassword: '', confirm: '' });
      toast.success(isAr ? 'تم تغيير كلمة المرور وتسجيل الخروج من الأجهزة الأخرى' : 'Password changed — other devices were signed out');
    });
  };

  const toggleTwoFa = (e) => {
    e.preventDefault();
    run('2fa', async () => {
      const { data: res } = await sellerApi.setTwoFactor({ enabled: !data.twoFactorEnabled, currentPassword: twoFaPassword });
      setData((d) => ({ ...d, twoFactorEnabled: res.data.twoFactorEnabled }));
      setAskTwoFa(false);
      setTwoFaPassword('');
      toast.success(res.data.twoFactorEnabled ? (isAr ? 'تم تفعيل التحقق بخطوتين' : '2-step verification is on') : (isAr ? 'تم إيقاف التحقق بخطوتين' : '2-step verification is off'));
    });
  };

  const signOutAll = () => {
    if (!window.confirm(isAr ? 'تسجيل الخروج من كل الأجهزة الأخرى؟' : 'Sign out of every other device?')) return;
    run('all', async () => {
      const { data: res } = await sellerApi.signOutEverywhere();
      replaceToken(res.token);
      toast.success(isAr ? 'تم تسجيل الخروج من كل الأجهزة الأخرى' : 'Signed out of all other devices');
      load();
    });
  };

  if (!data) return <PageSkeleton />;

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-1 flex items-center gap-2 font-bold"><KeyRound className="h-5 w-5 text-indigo-600" />{isAr ? 'تغيير كلمة المرور' : 'Change password'}</h2>
        <p className="mb-4 text-sm text-slate-500">{isAr ? 'سيتم تسجيل خروجك من كل الأجهزة الأخرى.' : "You'll be signed out of every other device."}</p>
        <form onSubmit={changePassword} className="space-y-3">
          <input type="password" className={inputCls} placeholder={isAr ? 'كلمة المرور الحالية' : 'Current password'} value={pw.currentPassword} onChange={(e) => setPw((p) => ({ ...p, currentPassword: e.target.value }))} dir="ltr" autoComplete="current-password" />
          <div>
            <input type="password" className={inputCls} placeholder={isAr ? 'كلمة المرور الجديدة' : 'New password'} value={pw.newPassword} onChange={(e) => setPw((p) => ({ ...p, newPassword: e.target.value }))} dir="ltr" autoComplete="new-password" />
            {pw.newPassword && <PasswordStrength value={pw.newPassword} isAr={isAr} />}
          </div>
          <input type="password" className={inputCls} placeholder={isAr ? 'تأكيد كلمة المرور الجديدة' : 'Confirm new password'} value={pw.confirm} onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))} dir="ltr" autoComplete="new-password" />
          <button type="submit" disabled={busy === 'pw' || !pw.currentPassword || !passwordIsStrong(pw.newPassword) || !pw.confirm} className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
            {isAr ? 'تغيير كلمة المرور' : 'Change password'}
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-1 flex items-center gap-2 font-bold"><ShieldCheck className="h-5 w-5 text-emerald-600" />{isAr ? 'التحقق بخطوتين' : '2-step verification'}</h2>
        <p className="mb-4 text-sm text-slate-500">
          {isAr ? `عند كل تسجيل دخول نرسل رمزاً إلى ${data.email}. يحمي حسابك حتى لو عرف أحد كلمة المرور.` : `Every sign-in asks for a code we email to ${data.email}. It protects you even if someone knows your password.`}
        </p>
        <div className={`mb-4 flex items-center justify-between rounded-xl p-3 text-sm ring-1 ${data.twoFactorEnabled ? 'bg-emerald-50 ring-emerald-200' : 'bg-amber-50 ring-amber-200'}`}>
          <span className="font-semibold">{data.twoFactorEnabled ? (isAr ? 'مُفعّل ✓' : 'On ✓') : (isAr ? 'غير مُفعّل — ننصح بتفعيله' : 'Off — we recommend turning it on')}</span>
          {!askTwoFa && (
            <button type="button" onClick={() => setAskTwoFa(true)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${data.twoFactorEnabled ? 'ring-1 ring-slate-300 hover:bg-white' : 'bg-emerald-600 text-white'}`}>
              {data.twoFactorEnabled ? (isAr ? 'إيقاف' : 'Turn off') : (isAr ? 'تفعيل' : 'Turn on')}
            </button>
          )}
        </div>
        {askTwoFa && (
          <form onSubmit={toggleTwoFa} className="flex flex-wrap gap-2">
            <input type="password" className={`${inputCls} max-w-xs`} placeholder={isAr ? 'أكّد بكلمة المرور الحالية' : 'Confirm with your password'} value={twoFaPassword} onChange={(e) => setTwoFaPassword(e.target.value)} dir="ltr" autoComplete="current-password" />
            <button type="submit" disabled={busy === '2fa' || !twoFaPassword} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{isAr ? 'تأكيد' : 'Confirm'}</button>
            <button type="button" onClick={() => setAskTwoFa(false)} className="rounded-xl px-3 py-2 text-sm ring-1 ring-slate-200">{isAr ? 'إلغاء' : 'Cancel'}</button>
          </form>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-bold">{isAr ? 'آخر عمليات تسجيل الدخول' : 'Recent sign-ins'}</h2>
            <p className="text-sm text-slate-500">{isAr ? 'نرسل لك بريداً عند كل تسجيل دخول جديد. لا تعرف أحدها؟ غيّر كلمة المرور.' : "We email you on every new sign-in. Don't recognise one? Change your password."}</p>
          </div>
          <button type="button" disabled={busy === 'all'} onClick={signOutAll} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-red-600 ring-1 ring-red-200 hover:bg-red-50 disabled:opacity-50">
            <LogOut className="h-4 w-4" />{isAr ? 'تسجيل الخروج من كل الأجهزة الأخرى' : 'Sign out of all other devices'}
          </button>
        </div>
        {data.loginHistory.length === 0 ? <p className="text-sm text-slate-500">—</p> : (
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {data.loginHistory.map((h, i) => {
              const d = device(h.userAgent);
              const Icon = d.mobile ? Smartphone : Monitor;
              return (
                <li key={`${h.at}-${i}`} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
                  <Icon className="h-4 w-4 text-slate-400" aria-hidden />
                  <span className="font-medium">{d.label}</span>
                  <span className="text-xs text-slate-500" dir="ltr">{h.ip || '—'}</span>
                  {i === 0 && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">{isAr ? 'الأحدث' : 'Latest'}</span>}
                  <span className="ms-auto text-xs text-slate-500">{new Date(h.at).toLocaleString(isAr ? 'ar-EG-u-nu-latn' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
