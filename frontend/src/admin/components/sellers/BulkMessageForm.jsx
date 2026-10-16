import { useState } from 'react';
import Button from '../../../components/ui/Button';
import { useToast } from '../index';
import { adminApi } from '../../adminApi';
import { apiError } from '../../../seller/sellerLabels';

/** One message (or warning) to many sellers — each gets it in Seller Center → Store messages. */
export default function BulkMessageForm({ sellers, isAr, onDone, onCancel }) {
  const toast = useToast();
  const [form, setForm] = useState({ body: '', kind: 'message', email: true });
  const [busy, setBusy] = useState(false);

  const send = async () => {
    setBusy(true);
    try {
      const { data } = await adminApi.bulkSellerMessage({ sellerIds: sellers.map((s) => s._id), body: form.body, kind: form.kind, email: form.email });
      toast.success(isAr ? `أُرسلت إلى ${data.data.sent} بائع` : `Sent to ${data.data.sent} seller(s)`);
      onDone?.();
      onCancel();
    } catch (err) {
      toast.error(apiError(err, isAr ? 'تعذّر الإرسال' : 'Could not send'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 text-sm">
      <p className="rounded-xl bg-slate-50 p-3">
        {isAr ? `إلى ${sellers.length} بائع: ` : `To ${sellers.length} seller(s): `}
        <span className="text-text-muted">{sellers.slice(0, 5).map((s) => (isAr ? s.nameAr : s.nameEn)).join('، ')}{sellers.length > 5 ? '…' : ''}</span>
      </p>
      <div className="flex gap-4">
        <label className="flex items-center gap-1.5"><input type="radio" checked={form.kind === 'message'} onChange={() => setForm((f) => ({ ...f, kind: 'message' }))} />{isAr ? 'رسالة' : 'Message'}</label>
        <label className="flex items-center gap-1.5"><input type="radio" checked={form.kind === 'warning'} onChange={() => setForm((f) => ({ ...f, kind: 'warning' }))} />{isAr ? 'تنبيه رسمي (بدون إنذار)' : 'Formal notice (no strike)'}</label>
      </div>
      <textarea rows={5} className="w-full rounded-xl border border-border px-3 py-2" placeholder={isAr ? 'نص الرسالة…' : 'Message text…'} value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} />
      <label className="flex items-center gap-1.5 text-xs text-text-muted"><input type="checkbox" checked={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.checked }))} />{isAr ? 'إرسال نسخة بالبريد أيضاً' : 'Also send by email'}</label>
      <div className="flex gap-2">
        <Button size="sm" disabled={busy || !form.body.trim()} onClick={send}>{busy ? (isAr ? 'جارٍ الإرسال…' : 'Sending…') : (isAr ? 'إرسال' : 'Send')}</Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>{isAr ? 'إلغاء' : 'Cancel'}</Button>
      </div>
    </div>
  );
}
