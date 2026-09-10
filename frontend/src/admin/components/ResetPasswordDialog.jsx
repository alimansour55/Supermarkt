import { useEffect, useState } from 'react';
import { KeyRound, RefreshCw } from 'lucide-react';
import Button from '../../components/ui/Button';
import { adminApi } from '../adminApi';
import { useToast } from '.';
import StaffCredentialsCard from './StaffCredentialsCard';

/**
 * Reset (regenerate) a team member's password. Auto-generates a strong password
 * server-side and reveals it once. "Generate again" rolls a fresh one.
 *
 * @param {{ account: { id, name, username, isDriver?, portal?, loginPath? } | null,
 *           open: boolean, onClose: () => void, isAr: boolean, onDone?: () => void }} props
 */
export default function ResetPasswordDialog({ account, open, onClose, isAr, onDone }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!open) {
      setResult(null);
      setBusy(false);
    }
  }, [open]);

  if (!open || !account) return null;

  const run = async () => {
    setBusy(true);
    try {
      const { data } = await adminApi.resetStaffPassword(account.id);
      setResult(data.credentials);
    } catch (err) {
      toast.error(err.response?.data?.message || (isAr ? 'تعذّر إعادة تعيين كلمة المرور' : 'Could not reset the password'));
    } finally {
      setBusy(false);
    }
  };

  const finish = () => {
    onClose();
    if (result) onDone?.();
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        aria-label={isAr ? 'إغلاق' : 'Close'}
        onClick={finish}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-md rounded-2xl border border-border bg-white p-6 shadow-xl"
      >
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-orange-100 text-orange-600">
          <KeyRound className="h-5 w-5" />
        </div>
        <h3 className="text-lg font-bold text-text">
          {isAr ? 'إعادة تعيين كلمة المرور' : 'Reset password'}
        </h3>
        <p className="mt-1 text-sm text-text-muted">
          {result
            ? (isAr
              ? `تم إنشاء كلمة مرور جديدة لـ ${account.name}. سيتوقف الدخول بكلمة المرور القديمة فوراً.`
              : `A new password was generated for ${account.name}. The old password stops working immediately.`)
            : (isAr
              ? `سيتم إنشاء كلمة مرور قوية جديدة لـ @${account.username}. لن تتأثر الطلبات أو الصلاحيات أو السجل.`
              : `A new strong password will be generated for @${account.username}. Orders, permissions and history are unaffected.`)}
        </p>

        {result && (
          <div className="mt-4">
            <StaffCredentialsCard
              username={result.username}
              password={result.password}
              portal={result.portal}
              loginPath={result.loginPath}
              isAr={isAr}
            />
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3">
          {!result ? (
            <>
              <Button variant="secondary" onClick={finish} disabled={busy}>
                {isAr ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button onClick={run} loading={busy}>
                {isAr ? 'إنشاء كلمة مرور جديدة' : 'Generate new password'}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={run} loading={busy}>
                <RefreshCw className="h-4 w-4" />
                {isAr ? 'إنشاء أخرى' : 'Generate again'}
              </Button>
              <Button onClick={finish}>
                {isAr ? 'تم' : 'Done'}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
