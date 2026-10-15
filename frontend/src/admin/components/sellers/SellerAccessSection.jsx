import { useState } from 'react';
import { KeyRound, ShieldCheck } from 'lucide-react';
import Button from '../../../components/ui/Button';
import { CopyButton, useToast } from '../index';
import { adminApi } from '../../adminApi';
import { apiError } from '../../../seller/sellerLabels';
import { formatRelativeTime } from '../../../utils/formatters';
import { sellerLoginUrl } from '../../utils/sellerAdmin';
import SellerAccessResult from './SellerAccessResult';

/** Logins tab: who can sign in for this seller, and a one-click way to (re)send access. */
export default function SellerAccessSection({ seller, isAr, canWrite }) {
  const toast = useToast();
  const [busyId, setBusyId] = useState('');
  const [result, setResult] = useState(null);
  const loginUrl = sellerLoginUrl(typeof window !== 'undefined' ? window.location.origin : '');
  const team = [...(seller.team || [])].sort((a, b) => (a.role === 'seller_owner' ? -1 : b.role === 'seller_owner' ? 1 : 0));
  const storeName = isAr ? seller.nameAr : seller.nameEn;

  const send = async (user) => {
    setBusyId(user._id);
    try {
      const { data } = await adminApi.sendSellerAccess(seller._id, { userId: user._id });
      setResult({ userId: user._id, access: data.data });
    } catch (err) {
      toast.error(apiError(err, isAr ? 'تعذّر الإرسال' : 'Could not send'));
    } finally {
      setBusyId('');
    }
  };

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
        <h3 className="mb-3 font-bold">{isAr ? 'حسابات الدخول' : 'Logins'}</h3>
        {!team.length ? (
          <p className="text-sm text-text-muted">{isAr ? 'لا توجد حسابات دخول لهذا البائع.' : 'This seller has no logins.'}</p>
        ) : (
          <ul className="space-y-3">
            {team.map((u) => (
              <li key={u._id} className="rounded-xl border border-border p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-semibold">
                      {u.name}
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${u.role === 'seller_owner' ? 'bg-primary-50 text-primary-800' : 'bg-slate-100 text-slate-700'}`}>
                        {u.role === 'seller_owner' ? (isAr ? 'المالك' : 'Owner') : (isAr ? 'موظف' : 'Staff')}
                      </span>
                      {u.isActive === false && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">{isAr ? 'موقوف' : 'Turned off'}</span>}
                      {u.twoFactorEnabled && <ShieldCheck className="h-4 w-4 text-emerald-600" aria-label={isAr ? 'التحقق بخطوتين مفعّل' : '2-step verification on'} />}
                    </p>
                    <p dir="ltr" className="text-start text-xs text-text-muted">{u.email}</p>
                    <p className="mt-1 text-xs text-text-muted">
                      {u.lastLoginAt
                        ? `${isAr ? 'آخر دخول' : 'Last sign-in'}: ${formatRelativeTime(u.lastLoginAt, isAr)}`
                        : <span className="font-medium text-amber-700">{isAr ? 'لم يدخل بعد' : 'Has not signed in yet'}</span>}
                    </p>
                  </div>
                  {canWrite && u.isActive !== false && (
                    <Button type="button" size="sm" variant="outline" disabled={busyId === u._id} onClick={() => send(u)} className="gap-1.5">
                      <KeyRound className="h-4 w-4" />
                      {u.lastLoginAt ? (isAr ? 'إرسال رابط تغيير كلمة المرور' : 'Send password reset link') : (isAr ? 'إعادة إرسال الدعوة' : 'Resend invite')}
                    </Button>
                  )}
                </div>
                {result?.userId === u._id && <div className="mt-3"><SellerAccessResult access={result.access} storeName={storeName} isAr={isAr} /></div>}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-text-muted">
          {isAr
            ? 'لا نعرض كلمات المرور أبداً. الرابط يسمح للبائع باختيار كلمة مرور جديدة ويُلغي أي رابط سابق.'
            : 'Passwords are never shown. The link lets the seller choose a new password and cancels any earlier link.'}
        </p>
      </section>
    </div>
  );
}
