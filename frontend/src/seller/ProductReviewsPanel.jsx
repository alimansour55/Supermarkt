import { useCallback, useEffect, useState } from 'react';
import { Link } from '../app/router';
import { CornerDownLeft, Star } from 'lucide-react';
import Loader from '../components/ui/Loader';
import { useToast } from '../components/ui/Toast';
import { sellerApi } from '../services/sellerApi';
import { apiError } from './sellerLabels';
import { Card, EmptyState } from './ui';
import { fmtDate } from './sellerUtils';

function Stars({ value }) {
  return (
    <span className="inline-flex text-amber-500" aria-label={`${value} / 5`}>
      {[1, 2, 3, 4, 5].map((n) => <Star key={n} className={`h-4 w-4 ${n <= value ? 'fill-current' : 'text-slate-300'}`} aria-hidden />)}
    </span>
  );
}

/** Reviews of the seller's products, with a public reply ("Seller reply") under each. */
export default function ProductReviewsPanel({ isAr }) {
  const toast = useToast();
  const [rating, setRating] = useState(0);
  const [unreplied, setUnreplied] = useState(false);
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [replyFor, setReplyFor] = useState(null);
  const [text, setText] = useState('');

  const load = useCallback(() => {
    sellerApi.listProductReviews({ rating: rating || undefined, unreplied: unreplied ? 'true' : undefined, page, limit: 20 })
      .then(({ data: d }) => setData(d)).catch(() => setData({ data: [], distribution: [], pagination: { pages: 1 } }));
  }, [rating, unreplied, page]);
  useEffect(() => { load(); }, [load]);

  const send = async (row) => {
    try {
      await sellerApi.replyProductReview(row.productId, row.review._id, text);
      toast.success(text.trim() ? (isAr ? 'تم نشر ردك' : 'Reply published') : (isAr ? 'تم حذف الرد' : 'Reply removed'));
      setReplyFor(null);
      load();
    } catch (err) {
      toast.error(apiError(err, isAr ? 'تعذّر النشر' : 'Could not publish'));
    }
  };

  const total = (data?.distribution || []).reduce((n, d) => n + d.count, 0);

  return (
    <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <Card>
        <p className="text-sm text-slate-500">{isAr ? 'تقييمات منتجاتك' : 'Your product ratings'}</p>
        <p className="mt-1 text-xs text-slate-500">{isAr ? `${total} تقييم` : `${total} reviews`}</p>
        <ul className="mt-3 space-y-1.5">
          {(data?.distribution || []).map((d) => {
            const pct = total ? Math.round((d.count / total) * 100) : 0;
            return (
              <li key={d.rating}>
                <button type="button" onClick={() => { setPage(1); setRating(rating === d.rating ? 0 : d.rating); }} className={`flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-sm hover:bg-slate-50 ${rating === d.rating ? 'bg-indigo-50 ring-1 ring-indigo-200' : ''}`}>
                  <span className="w-8 text-start">{d.rating}★</span>
                  <span className="h-2 flex-1 rounded-full bg-slate-100"><span className="block h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} /></span>
                  <span className="w-8 text-end text-xs tabular-nums text-slate-500">{d.count}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <label className="mt-4 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={unreplied} onChange={(e) => { setPage(1); setUnreplied(e.target.checked); }} className="h-4 w-4 rounded" />
          {isAr ? 'بدون رد فقط' : 'Without a reply only'}
        </label>
      </Card>

      <Card title={isAr ? 'تقييمات المنتجات' : 'Product reviews'} bodyClassName="p-0">
        {!data ? <div className="p-8"><Loader size="lg" /></div> : data.data.length === 0 ? (
          <EmptyState icon={Star} title={isAr ? 'لا توجد تقييمات هنا' : 'No reviews here'} />
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.data.map((row) => (
              <li key={row.review._id} className="px-5 py-4">
                <div className="flex items-start gap-3">
                  {row.image ? <img src={row.image} alt="" className="h-10 w-10 rounded-lg object-cover" /> : <span className="h-10 w-10 rounded-lg bg-slate-100" />}
                  <div className="min-w-0 flex-1">
                    <Link to={`/seller-center/products/${row.productId}`} className="text-xs font-semibold text-indigo-700 hover:underline">{isAr ? row.nameAr : row.nameEn}</Link>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2">
                      <Stars value={row.review.rating} />
                      {row.review.verifiedPurchase && <span className="rounded bg-emerald-50 px-1.5 text-[11px] text-emerald-700">{isAr ? 'شراء مؤكد' : 'Verified purchase'}</span>}
                      <span className="text-xs text-slate-400">{fmtDate(row.review.createdAt, isAr)}</span>
                    </div>
                    {row.review.title && <p className="mt-1 font-semibold">{row.review.title}</p>}
                    {row.review.comment && <p className="mt-0.5 text-sm">{row.review.comment}</p>}
                    {row.review.reply?.message && replyFor !== row.review._id && (
                      <div className="mt-2 rounded-xl bg-slate-50 p-3 text-sm">
                        <p className="flex items-center gap-1 text-xs font-semibold text-slate-500"><CornerDownLeft className="h-3.5 w-3.5" />{row.review.reply.byRole === 'seller' ? (isAr ? 'ردك' : 'Your reply') : (isAr ? 'رد المتجر' : 'Store reply')}</p>
                        <p className="mt-1">{row.review.reply.message}</p>
                      </div>
                    )}
                    {replyFor === row.review._id ? (
                      <div className="mt-2 space-y-2">
                        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={2000} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder={isAr ? 'رد مهذب يظهر للجميع تحت التقييم…' : 'A polite reply everyone sees under the review…'} />
                        <div className="flex gap-2">
                          <button type="button" onClick={() => send(row)} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white">{isAr ? 'نشر' : 'Publish'}</button>
                          <button type="button" onClick={() => setReplyFor(null)} className="rounded-lg px-3 py-1.5 text-sm ring-1 ring-slate-200">{isAr ? 'إلغاء' : 'Cancel'}</button>
                        </div>
                      </div>
                    ) : (row.review.reply?.byRole !== 'staff' || !row.review.reply?.message) && (
                      <button type="button" onClick={() => { setReplyFor(row.review._id); setText(row.review.reply?.message || ''); }} className="mt-2 text-sm font-semibold text-indigo-700 hover:underline">
                        {row.review.reply?.message ? (isAr ? 'تعديل الرد' : 'Edit reply') : (isAr ? 'رد على التقييم' : 'Reply')}
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
        {data?.pagination?.pages > 1 && (
          <div className="flex items-center justify-center gap-2 border-t border-slate-100 p-3 text-sm">
            <button type="button" disabled={page <= 1} onClick={() => setPage((n) => n - 1)} className="rounded-lg px-3 py-1.5 ring-1 ring-slate-200 disabled:opacity-40">{isAr ? 'السابق' : 'Previous'}</button>
            <span>{page} / {data.pagination.pages}</span>
            <button type="button" disabled={page >= data.pagination.pages} onClick={() => setPage((n) => n + 1)} className="rounded-lg px-3 py-1.5 ring-1 ring-slate-200 disabled:opacity-40">{isAr ? 'التالي' : 'Next'}</button>
          </div>
        )}
      </Card>
    </div>
  );
}
