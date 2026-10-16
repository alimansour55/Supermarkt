import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Bot, Send, Undo2 } from 'lucide-react';
import { Link } from '../../../app/router';
import Button from '../../../components/ui/Button';
import { useConfirm, useToast } from '../index';
import { adminApi } from '../../adminApi';
import { apiError } from '../../../seller/sellerLabels';
import { formatDate } from '../../../utils/formatters';

const WARNING_REASONS = {
  late_shipping: ['تأخير الشحن', 'Late shipping'],
  cancellations: ['إلغاء الطلبات', 'Cancelled orders'],
  quality: ['جودة المنتجات', 'Product quality'],
  counterfeit: ['منتجات مقلدة', 'Counterfeit items'],
  policy: ['مخالفة السياسات', 'Policy breach'],
  customer_service: ['خدمة العملاء', 'Customer service'],
  other: ['أخرى', 'Other'],
};

const when = (d, isAr) => `${formatDate(d, isAr ? 'ar-EG' : 'en-GB')} · ${new Date(d).toLocaleTimeString(isAr ? 'ar-EG' : 'en-GB', { hour: '2-digit', minute: '2-digit' })}`;

/**
 * The store ↔ seller conversation: messages, formal warnings (optionally a strike) and automatic
 * health notices, with the seller's replies. Everything stays on record.
 */
export default function SellerMessagesTab({ seller, isAr, canWrite, onSuspended, onRead }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [data, setData] = useState(null);
  const [form, setForm] = useState({ body: '', kind: 'message', strike: true, reason: 'late_shipping', email: true });
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);
  // Kept in a ref so a new callback from the parent never re-fetches the thread.
  const onReadRef = useRef(onRead);
  useEffect(() => { onReadRef.current = onRead; }, [onRead]);

  const load = useCallback(() => adminApi.getSellerMessages(seller._id)
    .then(({ data: d }) => { setData(d.data); onReadRef.current?.(); })
    .catch(() => setData({ messages: [], strikes: 0, enforcement: {} })), [seller._id]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'nearest' }); }, [data?.messages?.length]);

  const send = async () => {
    const warning = form.kind === 'warning';
    if (warning && form.strike) {
      const e = data?.enforcement || {};
      const next = (data?.strikes || 0) + 1;
      const ok = await confirm({
        title: isAr ? 'إرسال إنذار رسمي؟' : 'Send a formal warning?',
        message: isAr
          ? `سيصبح لدى البائع ${next} من ${e.maxStrikes} إنذارات خلال ${e.strikeWindowDays} يوماً.${e.autoSuspend && next >= e.maxStrikes ? ' سيتم إيقاف المتجر تلقائياً.' : ''}`
          : `The seller will have ${next} of ${e.maxStrikes} strikes in ${e.strikeWindowDays} days.${e.autoSuspend && next >= e.maxStrikes ? ' The store will be suspended automatically.' : ''}`,
        confirmLabel: isAr ? 'إرسال الإنذار' : 'Send warning',
        cancelLabel: isAr ? 'إلغاء' : 'Cancel',
      });
      if (!ok) return;
    }
    setBusy(true);
    try {
      const { data: d } = await adminApi.postSellerMessage(seller._id, {
        body: form.body, kind: form.kind, strike: warning && form.strike, reason: warning ? form.reason : '', email: form.email,
      });
      setData(d.data);
      setForm((f) => ({ ...f, body: '' }));
      toast.success(isAr ? 'تم الإرسال' : 'Sent');
      if (d.suspended) {
        toast.error(isAr ? 'تم إيقاف المتجر تلقائياً لبلوغ حد الإنذارات' : 'Store suspended automatically — strike limit reached');
        onSuspended?.();
      }
    } catch (err) {
      toast.error(apiError(err, isAr ? 'تعذّر الإرسال' : 'Could not send'));
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async (m) => {
    const ok = await confirm({
      title: isAr ? 'سحب هذا الإنذار؟' : 'Withdraw this strike?',
      message: isAr ? 'يبقى ظاهراً في المحادثة لكنه لا يُحتسب.' : 'It stays in the conversation but no longer counts.',
      confirmLabel: isAr ? 'سحب' : 'Withdraw',
      cancelLabel: isAr ? 'إلغاء' : 'Cancel',
      variant: 'primary',
    });
    if (!ok) return;
    try {
      const { data: d } = await adminApi.withdrawSellerStrike(seller._id, m._id);
      setData(d.data);
    } catch (err) {
      toast.error(apiError(err, isAr ? 'تعذّر التنفيذ' : 'Could not do that'));
    }
  };

  if (!data) return <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />;
  const e = data.enforcement || {};

  return (
    <div className="space-y-3">
      <div className={`flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm ${data.strikes ? 'bg-amber-50 text-amber-900' : 'bg-slate-50 text-text-muted'}`}>
        <span className="flex items-center gap-1.5">
          <AlertTriangle className="h-4 w-4" />
          {isAr ? `الإنذارات: ${data.strikes} من ${e.maxStrikes} خلال ${e.strikeWindowDays} يوماً` : `Strikes: ${data.strikes} of ${e.maxStrikes} in ${e.strikeWindowDays} days`}
          {' · '}{e.autoSuspend ? (isAr ? 'إيقاف تلقائي مفعّل' : 'auto-suspend on') : (isAr ? 'بدون إيقاف تلقائي' : 'no auto-suspend')}
        </span>
        <Link to="/admin/marketplace-settings" className="text-xs font-semibold underline">{isAr ? 'قواعد الإنذارات' : 'Warning rules'}</Link>
      </div>

      <ol className="max-h-[50vh] space-y-2 overflow-y-auto rounded-2xl border border-border bg-slate-50/60 p-3">
        {!data.messages.length && <li className="py-6 text-center text-sm text-text-muted">{isAr ? 'لا توجد رسائل بعد.' : 'No messages yet.'}</li>}
        {data.messages.map((m) => {
          const mine = m.from !== 'seller';
          const warning = m.kind === 'warning';
          const notice = m.kind === 'notice';
          return (
            <li key={m._id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${warning ? 'border border-amber-300 bg-amber-50' : notice ? 'border border-violet-200 bg-violet-50' : mine ? 'bg-primary-600 text-white' : 'border border-border bg-white'}`}>
                <p className={`mb-1 flex flex-wrap items-center gap-1.5 text-[11px] ${mine && !warning && !notice ? 'text-white/80' : 'text-text-muted'}`}>
                  {notice && <Bot className="h-3.5 w-3.5" />}
                  <span className="font-semibold">{m.from === 'seller' ? `${m.authorName || (isAr ? 'البائع' : 'Seller')}` : notice ? (isAr ? 'صحة الحساب (تلقائي)' : 'Account health (automatic)') : m.authorName || (isAr ? 'فريق المتجر' : 'Store team')}</span>
                  <span>{when(m.createdAt, isAr)}</span>
                  {warning && (
                    <span className={`rounded-full px-1.5 font-semibold ${m.strike && !m.withdrawnAt ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
                      {m.strike ? (m.withdrawnAt ? (isAr ? 'إنذار مسحوب' : 'strike withdrawn') : (isAr ? 'إنذار' : 'strike')) : (isAr ? 'تنبيه' : 'warning')}
                      {m.reason && ` · ${(WARNING_REASONS[m.reason] || [m.reason, m.reason])[isAr ? 0 : 1]}`}
                    </span>
                  )}
                  {mine && m.sellerReadAt && <span>✓ {isAr ? 'قرأها' : 'read'}</span>}
                </p>
                <p className="whitespace-pre-wrap" dir="auto">{m.body}</p>
                {canWrite && warning && m.strike && !m.withdrawnAt && (
                  <button type="button" onClick={() => withdraw(m)} className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 hover:underline"><Undo2 className="h-3 w-3" />{isAr ? 'سحب الإنذار' : 'Withdraw strike'}</button>
                )}
              </div>
            </li>
          );
        })}
        <li ref={endRef} />
      </ol>

      {canWrite && (
        <div className="space-y-2 rounded-2xl border border-border bg-white p-3">
          <div className="flex flex-wrap gap-3 text-sm">
            <label className="flex items-center gap-1.5"><input type="radio" checked={form.kind === 'message'} onChange={() => setForm((f) => ({ ...f, kind: 'message' }))} />{isAr ? 'رسالة' : 'Message'}</label>
            <label className="flex items-center gap-1.5"><input type="radio" checked={form.kind === 'warning'} onChange={() => setForm((f) => ({ ...f, kind: 'warning' }))} />{isAr ? 'إنذار / تنبيه رسمي' : 'Formal warning'}</label>
          </div>
          {form.kind === 'warning' && (
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <select className="rounded-lg border border-border px-2 py-1" value={form.reason} onChange={(ev) => setForm((f) => ({ ...f, reason: ev.target.value }))}>
                {Object.entries(WARNING_REASONS).map(([k, [ar, en]]) => <option key={k} value={k}>{isAr ? ar : en}</option>)}
              </select>
              <label className="flex items-center gap-1.5"><input type="checkbox" checked={form.strike} onChange={(ev) => setForm((f) => ({ ...f, strike: ev.target.checked }))} />{isAr ? 'يُحتسب إنذاراً (Strike)' : 'Counts as a strike'}</label>
            </div>
          )}
          <textarea rows={3} className="w-full rounded-xl border border-border px-3 py-2 text-sm" placeholder={isAr ? 'اكتب رسالتك للبائع…' : 'Write to the seller…'} value={form.body} onChange={(ev) => setForm((f) => ({ ...f, body: ev.target.value }))} />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="flex items-center gap-1.5 text-xs text-text-muted"><input type="checkbox" checked={form.email} onChange={(ev) => setForm((f) => ({ ...f, email: ev.target.checked }))} />{isAr ? 'إرسال نسخة بالبريد أيضاً' : 'Also send by email'}</label>
            <Button size="sm" disabled={busy || !form.body.trim()} onClick={send} className="gap-1.5"><Send className="h-4 w-4" />{isAr ? 'إرسال' : 'Send'}</Button>
          </div>
        </div>
      )}
    </div>
  );
}
