import { useCallback, useEffect, useRef, useState } from 'react';
import { useOutletContext } from '../../app/router';
import { AlertTriangle, Bot, Mail, Send } from 'lucide-react';
import { useToast } from '../../components/ui/Toast';
import { sellerApi } from '../../services/sellerApi';
import { apiError } from '../sellerLabels';
import { PageHeader } from '../ui';
import { fmtDateTime } from '../sellerUtils';

const REASONS = {
  late_shipping: ['تأخير الشحن', 'Late shipping'],
  cancellations: ['إلغاء الطلبات', 'Cancelled orders'],
  quality: ['جودة المنتجات', 'Product quality'],
  counterfeit: ['منتجات مقلدة', 'Counterfeit items'],
  policy: ['مخالفة السياسات', 'Policy breach'],
  customer_service: ['خدمة العملاء', 'Customer service'],
  other: ['أخرى', 'Other'],
};

/** Messages, warnings and health notices from the store team — and the seller's replies. */
export default function SellerMessagesPage() {
  const { isAr, refreshSummary } = useOutletContext();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);

  const load = useCallback(() => sellerApi.getMessages()
    .then(({ data: d }) => { setData(d.data); refreshSummary?.(); })
    .catch(() => setData({ messages: [], strikes: 0 })), [refreshSummary]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'nearest' }); }, [data?.messages?.length]);

  const send = async (e) => {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    try {
      const { data: d } = await sellerApi.replyMessage({ body });
      setData(d.data);
      setBody('');
    } catch (err) {
      toast.error(apiError(err, isAr ? 'تعذّر الإرسال' : 'Could not send'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        icon={Mail}
        title={isAr ? 'رسائل المتجر' : 'Messages from the store'}
        description={isAr ? 'رسائل فريق المتجر وأي إنذارات بخصوص حسابك. يمكنك الرد هنا.' : 'Messages from the store team and any warnings about your account. Reply here.'}
      />

      {data && (
        <div className={`mb-4 flex items-start gap-2 rounded-2xl border p-4 text-sm ${data.strikes ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-slate-200 bg-white text-slate-600'}`}>
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            {isAr
              ? `الإنذارات الحالية: ${data.strikes} من ${data.maxStrikes} خلال آخر ${data.strikeWindowDays} يوماً.`
              : `Current strikes: ${data.strikes} of ${data.maxStrikes} in the last ${data.strikeWindowDays} days.`}
            {data.autoSuspend && (isAr ? ' عند بلوغ الحد يتم إيقاف المتجر تلقائياً.' : ' Reaching the limit suspends the store automatically.')}
          </p>
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <ol className="max-h-[60vh] space-y-3 overflow-y-auto p-4">
          {!data ? (
            <li className="h-24 animate-pulse rounded-xl bg-slate-100" />
          ) : !data.messages.length ? (
            <li className="py-10 text-center text-sm text-slate-500">{isAr ? 'لا توجد رسائل بعد. اكتب لنا إذا احتجت أي مساعدة.' : 'No messages yet. Write to us if you need anything.'}</li>
          ) : data.messages.map((m) => {
            const mine = m.from === 'seller';
            const warning = m.kind === 'warning';
            const notice = m.kind === 'notice';
            return (
              <li key={m._id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${warning ? 'border border-amber-300 bg-amber-50' : notice ? 'border border-violet-200 bg-violet-50' : mine ? 'bg-indigo-600 text-white' : 'bg-slate-100'}`}>
                  <p className={`mb-1 flex flex-wrap items-center gap-1.5 text-[11px] ${mine ? 'text-white/80' : 'text-slate-500'}`}>
                    {notice && <Bot className="h-3.5 w-3.5" />}
                    <span className="font-semibold">{mine ? m.authorName : notice ? (isAr ? 'صحة الحساب' : 'Account health') : (isAr ? 'فريق المتجر' : 'Store team')}</span>
                    <span>{fmtDateTime(m.createdAt, isAr)}</span>
                    {warning && (
                      <span className={`rounded-full px-1.5 font-semibold ${m.strike && !m.withdrawnAt ? 'bg-red-100 text-red-700' : 'bg-slate-200 text-slate-600'}`}>
                        {m.strike ? (m.withdrawnAt ? (isAr ? 'إنذار مسحوب' : 'Strike withdrawn') : (isAr ? 'إنذار رسمي' : 'Formal warning')) : (isAr ? 'تنبيه' : 'Notice')}
                        {m.reason && ` · ${(REASONS[m.reason] || [m.reason, m.reason])[isAr ? 0 : 1]}`}
                      </span>
                    )}
                    {mine && m.readByStore && <span>✓ {isAr ? 'قرأها المتجر' : 'Seen by the store'}</span>}
                  </p>
                  <p className="whitespace-pre-wrap" dir="auto">{m.body}</p>
                </div>
              </li>
            );
          })}
          <li ref={endRef} />
        </ol>
        <form onSubmit={send} className="flex items-end gap-2 border-t border-slate-200 p-3">
          <textarea
            rows={2}
            className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            placeholder={isAr ? 'اكتب ردك…' : 'Write a reply…'}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <button type="submit" disabled={busy || !body.trim()} className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
            <Send className="h-4 w-4" />{isAr ? 'إرسال' : 'Send'}
          </button>
        </form>
      </section>
    </div>
  );
}
