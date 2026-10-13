import { useCallback, useEffect, useState } from 'react';
import { useOutletContext, useSearchParams } from '../../app/router';
import { Eye, EyeOff, MessageCircleQuestion, Send } from 'lucide-react';
import Loader from '../../components/ui/Loader';
import { useToast } from '../../components/ui/Toast';
import { sellerApi } from '../../services/sellerApi';
import { apiError } from '../sellerLabels';
import { EmptyState, PageHeader, Segmented } from '../ui';
import { fmtDateTime } from '../sellerUtils';

/** Customer questions on the seller's products — answer them; answers show on the product page. */
export default function SellerQuestionsPage() {
  const { isAr, refreshSummary } = useOutletContext();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const state = searchParams.get('state') || 'unanswered';
  const [data, setData] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [busy, setBusy] = useState('');

  const load = useCallback(() => {
    sellerApi.listQuestions({ state }).then(({ data: d }) => setData(d)).catch(() => setData({ data: [], unanswered: 0 }));
  }, [state]);
  useEffect(() => { load(); }, [load]);

  const answer = async (q) => {
    setBusy(q._id);
    try {
      await sellerApi.answerQuestion(q._id, drafts[q._id] ?? q.answer);
      toast.success(isAr ? 'تم نشر الإجابة' : 'Answer published');
      setDrafts((d) => ({ ...d, [q._id]: undefined }));
      load();
      refreshSummary?.();
    } catch (err) {
      toast.error(apiError(err, isAr ? 'تعذّر النشر' : 'Could not publish'));
    } finally {
      setBusy('');
    }
  };

  const visibility = async (q, hidden) => {
    try {
      await sellerApi.setQuestionVisibility(q._id, hidden);
      load();
      refreshSummary?.();
    } catch (err) {
      toast.error(apiError(err, isAr ? 'تعذّر التحديث' : 'Update failed'));
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        icon={MessageCircleQuestion}
        title={isAr ? 'أسئلة العملاء' : 'Customer questions'}
        description={isAr ? 'أجب عن أسئلة العملاء على منتجاتك. الإجابات تظهر للجميع في صفحة المنتج وتزيد المبيعات.' : 'Answer questions about your products. Answers show to everyone on the product page and help sales.'}
      />
      <div className="mb-4">
        <Segmented
          options={[
            { value: 'unanswered', label: isAr ? `بدون إجابة (${data?.unanswered ?? '…'})` : `Unanswered (${data?.unanswered ?? '…'})` },
            { value: 'answered', label: isAr ? 'تمت الإجابة' : 'Answered' },
            { value: 'hidden', label: isAr ? 'مخفية' : 'Hidden' },
          ]}
          value={state}
          onChange={(v) => { setData(null); setSearchParams({ state: v }); }}
        />
      </div>

      {!data ? <div className="flex min-h-[200px] items-center justify-center"><Loader size="lg" /></div> : data.data.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white"><EmptyState icon={MessageCircleQuestion} title={state === 'unanswered' ? (isAr ? 'لا توجد أسئلة بانتظارك' : 'No questions waiting') : (isAr ? 'لا شيء هنا' : 'Nothing here')} /></div>
      ) : (
        <ul className="space-y-3">
          {data.data.map((q) => {
            const draft = drafts[q._id] ?? q.answer;
            return (
              <li key={q._id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  {q.product?.image ? <img src={q.product.image} alt="" className="h-12 w-12 rounded-lg object-cover ring-1 ring-slate-200" /> : <span className="h-12 w-12 rounded-lg bg-slate-100" />}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-slate-500">{q.product ? (isAr ? q.product.nameAr : q.product.nameEn) : ''} · {q.userName || (isAr ? 'عميل' : 'Customer')} · {fmtDateTime(q.createdAt, isAr)}</p>
                    <p className="mt-1 font-semibold">{isAr ? 'س: ' : 'Q: '}{q.question}</p>
                  </div>
                  <button type="button" onClick={() => visibility(q, q.status !== 'hidden')} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" title={q.status === 'hidden' ? (isAr ? 'إظهار' : 'Show') : (isAr ? 'إخفاء (سبام / غير مناسب)' : 'Hide (spam / off-topic)')}>
                    {q.status === 'hidden' ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </button>
                </div>
                <div className="mt-3 flex gap-2 ps-[3.75rem]">
                  <textarea
                    value={draft}
                    onChange={(e) => setDrafts((d) => ({ ...d, [q._id]: e.target.value }))}
                    rows={2}
                    maxLength={1500}
                    placeholder={isAr ? 'اكتب إجابة واضحة ومختصرة…' : 'Write a clear, short answer…'}
                    className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  />
                  <button type="button" disabled={busy === q._id || !draft?.trim() || draft === q.answer} onClick={() => answer(q)} className="inline-flex h-fit items-center gap-1.5 self-end rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                    <Send className="h-4 w-4" />{q.answer ? (isAr ? 'تحديث' : 'Update') : (isAr ? 'نشر' : 'Publish')}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
