import { useEffect, useState } from 'react';
import { Link } from '../../app/router';
import { MessageCircleQuestion, Send, Store } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

/** Questions & answers on a marketplace seller's product: answered questions + "ask the seller". */
export default function ProductQuestionsSection({ product, isAr }) {
  const { isAuthenticated } = useAuth();
  const [items, setItems] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const [question, setQuestion] = useState('');
  const [state, setState] = useState({ busy: false, sent: false, error: '' });
  const sellerName = isAr ? product.soldBy?.nameAr : product.soldBy?.nameEn;

  useEffect(() => {
    let cancelled = false;
    api.get('/product-questions', { params: { product: product._id, limit: 20 } })
      .then(({ data }) => { if (!cancelled) setItems(data.data || []); })
      .catch(() => { if (!cancelled) setItems([]); });
    return () => { cancelled = true; };
  }, [product._id]);

  const ask = async (e) => {
    e.preventDefault();
    setState({ busy: true, sent: false, error: '' });
    try {
      await api.post('/product-questions', { product: product._id, question });
      setQuestion('');
      setState({ busy: false, sent: true, error: '' });
    } catch (err) {
      setState({ busy: false, sent: false, error: err.response?.data?.message || (isAr ? 'تعذّر إرسال السؤال' : 'Could not send your question') });
    }
  };

  const shown = showAll ? items : (items || []).slice(0, 4);

  return (
    <section id="product-questions" className="mt-14 scroll-mt-[5.5rem] md:scroll-mt-28">
      <h2 className="mb-5 flex items-center gap-2 text-xl font-bold">
        <MessageCircleQuestion className="h-6 w-6 text-primary-600" aria-hidden />
        {isAr ? 'أسئلة وأجوبة' : 'Questions & answers'}
      </h2>
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <form onSubmit={ask} className="h-fit rounded-2xl border border-border bg-white p-5">
          <p className="font-semibold">{isAr ? 'لديك سؤال عن المنتج؟' : 'Have a question?'}</p>
          <p className="mt-1 text-sm text-text-muted">{isAr ? `اسأل ${sellerName || 'البائع'} مباشرة — تظهر الإجابة هنا للجميع.` : `Ask ${sellerName || 'the seller'} directly — the answer shows here for everyone.`}</p>
          {isAuthenticated ? (
            <>
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder={isAr ? 'مثال: هل المنتج طبيعي 100%؟' : 'e.g. Is it 100% natural?'}
                className="mt-3 w-full rounded-xl border border-border px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
              />
              {state.error && <p className="mt-2 text-sm text-red-600">{state.error}</p>}
              {state.sent && <p className="mt-2 rounded-lg bg-primary-50 p-2 text-sm text-primary-800">{isAr ? 'تم إرسال سؤالك — سيصلك الرد هنا قريباً.' : 'Question sent — the answer will appear here soon.'}</p>}
              <button type="submit" disabled={state.busy || question.trim().length < 5} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                <Send className="h-4 w-4" />{isAr ? 'أرسل السؤال' : 'Ask'}
              </button>
            </>
          ) : (
            <p className="mt-3 text-sm">
              <Link to="/login" className="font-semibold text-primary-600">{isAr ? 'سجّل الدخول' : 'Sign in'}</Link>
              {isAr ? ' لتسأل البائع.' : ' to ask the seller.'}
            </p>
          )}
        </form>

        <div className="space-y-3">
          {items === null ? null : items.length === 0 ? (
            <div className="rounded-2xl border border-border bg-white p-5 text-sm text-text-muted">{isAr ? 'لا توجد أسئلة بعد — كن أول من يسأل.' : 'No questions yet — be the first to ask.'}</div>
          ) : shown.map((q) => (
            <article key={q._id} className="rounded-2xl border border-border bg-white p-5">
              <p className="font-semibold"><span className="text-primary-700">{isAr ? 'س: ' : 'Q: '}</span>{q.question}</p>
              <div className="mt-3 flex gap-2 text-sm">
                <span className="font-bold text-text-muted">{isAr ? 'ج:' : 'A:'}</span>
                <div>
                  <p className="whitespace-pre-line leading-6">{q.answer}</p>
                  <p className="mt-1 flex items-center gap-1 text-xs text-text-muted"><Store className="h-3.5 w-3.5" />{sellerName}{q.answeredAt ? ` · ${new Date(q.answeredAt).toLocaleDateString(isAr ? 'ar-EG-u-nu-latn' : 'en-GB')}` : ''}</p>
                </div>
              </div>
            </article>
          ))}
          {items?.length > 4 && !showAll && (
            <button type="button" onClick={() => setShowAll(true)} className="text-sm font-semibold text-primary-700 hover:underline">{isAr ? `عرض كل الأسئلة (${items.length})` : `Show all ${items.length} questions`}</button>
          )}
        </div>
      </div>
    </section>
  );
}
