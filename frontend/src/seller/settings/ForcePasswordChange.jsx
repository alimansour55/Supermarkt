import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { useToast } from '../../components/ui/Toast';
import { useAuth } from '../../context/AuthContext';
import { sellerApi } from '../../services/sellerApi';
import { apiError } from '../sellerLabels';
import PasswordStrength, { passwordIsStrong } from '../PasswordStrength';

const inputCls = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100';

/**
 * Shown instead of every Seller Center page while the login still uses a temporary password
 * that store staff set — the seller picks their own before doing anything else.
 */
export default function ForcePasswordChange({ isAr, onDone }) {
  const toast = useToast();
  const { replaceToken } = useAuth();
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const ok = pw.currentPassword && passwordIsStrong(pw.newPassword) && pw.newPassword === pw.confirm;

  const submit = async (e) => {
    e.preventDefault();
    if (!ok) return;
    setBusy(true);
    try {
      const { data } = await sellerApi.changePassword({ currentPassword: pw.currentPassword, newPassword: pw.newPassword });
      replaceToken(data.token);
      toast.success(isAr ? 'تم حفظ كلمة المرور الجديدة' : 'Your new password is saved');
      onDone();
    } catch (err) {
      toast.error(apiError(err, isAr ? 'تعذّر الحفظ' : 'Could not save'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700"><KeyRound className="h-5 w-5" /></span>
      <h1 className="text-xl font-bold">{isAr ? 'اختر كلمة مرور جديدة' : 'Choose a new password'}</h1>
      <p className="mt-1 text-sm text-slate-500">
        {isAr
          ? 'دخلت بكلمة مرور مؤقتة من فريق المتجر. اختر كلمة مرور خاصة بك للمتابعة.'
          : 'You signed in with a temporary password from the store team. Choose your own to continue.'}
      </p>
      <form onSubmit={submit} className="mt-4 space-y-3">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{isAr ? 'كلمة المرور المؤقتة' : 'Temporary password'}</span>
          <input type="password" autoComplete="current-password" className={inputCls} value={pw.currentPassword} onChange={(e) => setPw((p) => ({ ...p, currentPassword: e.target.value }))} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{isAr ? 'كلمة المرور الجديدة' : 'New password'}</span>
          <input type="password" autoComplete="new-password" className={inputCls} value={pw.newPassword} onChange={(e) => setPw((p) => ({ ...p, newPassword: e.target.value }))} />
        </label>
        <PasswordStrength value={pw.newPassword} isAr={isAr} />
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{isAr ? 'تأكيد كلمة المرور' : 'Confirm password'}</span>
          <input type="password" autoComplete="new-password" className={inputCls} value={pw.confirm} onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))} />
          {pw.confirm && pw.confirm !== pw.newPassword && <span className="mt-1 block text-xs text-red-600">{isAr ? 'غير متطابقة' : 'Does not match'}</span>}
        </label>
        <button type="submit" disabled={!ok || busy} className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
          {busy ? (isAr ? 'جارٍ الحفظ…' : 'Saving…') : (isAr ? 'حفظ والمتابعة' : 'Save and continue')}
        </button>
      </form>
    </div>
  );
}
