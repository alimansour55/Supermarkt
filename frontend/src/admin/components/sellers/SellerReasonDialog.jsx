import { useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import Button from '../../../components/ui/Button';
import { SELLER_REASON_PRESETS } from '../../utils/sellerAdmin';

/**
 * Asks why a seller is being rejected or suspended. The reason is shown to the seller, so the
 * dialog offers common wording to pick from and keeps the text editable. Mount it fresh
 * (keyed by status) for each request so the text starts empty.
 */
export default function SellerReasonDialog({ open, status, sellerName, isAr, busy, onCancel, onConfirm }) {
  const [reason, setReason] = useState('');
  const fieldRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const t = setTimeout(() => fieldRef.current?.focus(), 50);
    const onKey = (e) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => { clearTimeout(t); window.removeEventListener('keydown', onKey); };
  }, [open, onCancel]);

  if (!open) return null;
  const suspend = status === 'suspended';
  const presets = SELLER_REASON_PRESETS[status] || [];
  const title = suspend
    ? (isAr ? `إيقاف متجر ${sellerName}` : `Suspend ${sellerName}`)
    : (isAr ? `رفض طلب ${sellerName}` : `Reject ${sellerName}`);
  const effect = suspend
    ? (isAr ? 'ستختفي منتجات البائع من المتجر فوراً حتى إعادة التفعيل. يمكنه الدخول لكن لا يستطيع البيع.' : 'Their products disappear from the store right away until you reactivate them. They can still sign in but cannot sell.')
    : (isAr ? 'سيرى البائع السبب في مركز البائعين ويمكنه تعديل بياناته وإعادة التقديم.' : 'The seller sees this reason in Seller Center and can fix their details and apply again.');

  const submit = (e) => {
    e.preventDefault();
    if (reason.trim()) onConfirm(reason.trim());
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" aria-label={isAr ? 'إغلاق' : 'Close'} onClick={onCancel} />
      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="seller-reason-title"
        className="relative w-full max-w-lg rounded-2xl border border-border bg-white p-6 shadow-xl"
      >
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-red-100 text-red-600">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <h3 id="seller-reason-title" className="text-lg font-bold text-text">{title}</h3>
        <p className="mt-1 text-sm text-text-muted">{effect}</p>

        {presets.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {presets.map((p) => {
              const text = isAr ? p.ar : p.en;
              return (
                <button
                  key={p.en}
                  type="button"
                  onClick={() => setReason(text)}
                  className={`rounded-full px-3 py-1 text-xs font-medium ring-1 transition-colors ${reason === text ? 'bg-primary-50 text-primary-800 ring-primary-300' : 'bg-white text-text ring-border hover:bg-slate-50'}`}
                >
                  {text}
                </button>
              );
            })}
          </div>
        )}

        <label className="mt-4 block text-sm">
          <span className="mb-1 block font-medium">{isAr ? 'السبب (يظهر للبائع)' : 'Reason (the seller sees this)'}</span>
          <textarea
            ref={fieldRef}
            rows={3}
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
          />
        </label>

        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>{isAr ? 'إلغاء' : 'Cancel'}</Button>
          <Button type="submit" variant="danger" disabled={busy || !reason.trim()}>
            {suspend ? (isAr ? 'إيقاف المتجر' : 'Suspend store') : (isAr ? 'رفض الطلب' : 'Reject application')}
          </Button>
        </div>
      </form>
    </div>
  );
}
