import { useEffect, useState } from 'react';
import { Link, useOutletContext, useSearchParams } from '../../app/router';
import { MessageSquare, Star } from 'lucide-react';
import Loader from '../../components/ui/Loader';
import { sellerApi } from '../../services/sellerApi';
import { Card, EmptyState, PageHeader, Segmented } from '../ui';
import ProductReviewsPanel from '../ProductReviewsPanel';

function Stars({ value, size = 'h-4 w-4' }) {
  return (
    <span className="inline-flex text-amber-500" aria-label={`${value} / 5`}>
      {[1, 2, 3, 4, 5].map((n) => <Star key={n} className={`${size} ${n <= Math.round(value) ? 'fill-current' : 'text-slate-300'}`} aria-hidden />)}
    </span>
  );
}

/** Customer feedback: rating summary with a star breakdown and a filterable list. */
export default function SellerReviewsPage() {
  const { isAr } = useOutletContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const rating = Number(searchParams.get('rating')) || 0;
  const tab = searchParams.get('tab') === 'products' ? 'products' : 'store';
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);

  useEffect(() => {
    sellerApi.getMyReviews({ limit: 20, page, rating: rating || undefined })
      .then(({ data: d }) => setData(d))
      .catch(() => setData({ data: [], distribution: [], performance: null, pagination: { pages: 1 } }));
  }, [page, rating]);

  if (!data) return <div className="flex min-h-[40vh] items-center justify-center"><Loader size="lg" /></div>;
  const perf = data.performance || {};
  const total = (data.distribution || []).reduce((n, d) => n + d.count, 0);
  const pick = (r) => { setPage(1); setSearchParams(r && r !== rating ? { rating: String(r) } : {}); };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={MessageSquare}
        title={isAr ? 'تقييمات العملاء' : 'Customer feedback'}
        description={isAr ? 'يقيّمك العملاء بعد استلام طلباتهم. التقييم يظهر في صفحة متجرك ويؤثر على صحة حسابك.' : 'Customers rate you after delivery. Your rating shows on your store page and counts toward account health.'}
        actions={<Link to="/seller-center/performance" className="text-sm font-semibold text-indigo-700 hover:underline">{isAr ? 'صحة الحساب ←' : 'Account health →'}</Link>}
      />
      <Segmented
        options={[{ value: 'store', label: isAr ? 'تقييم المتجر' : 'Store feedback' }, { value: 'products', label: isAr ? 'تقييمات المنتجات' : 'Product reviews' }]}
        value={tab}
        onChange={(v) => setSearchParams(v === 'products' ? { tab: 'products' } : {})}
      />
      {tab === 'products' ? <ProductReviewsPanel isAr={isAr} /> : (

      <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <Card>
          <p className="text-sm text-slate-500">{isAr ? 'متوسط التقييم' : 'Average rating'}</p>
          <p className="mt-1 text-4xl font-extrabold">{perf.ratingCount ? perf.rating.toFixed(1) : '—'}</p>
          <Stars value={perf.rating || 0} size="h-5 w-5" />
          <p className="mt-1 text-xs text-slate-500">{isAr ? `${total} تقييم` : `${total} ratings`}</p>
          <ul className="mt-4 space-y-1.5">
            {(data.distribution || []).map((d) => {
              const pct = total ? Math.round((d.count / total) * 100) : 0;
              return (
                <li key={d.rating}>
                  <button type="button" onClick={() => pick(d.rating)} className={`flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-sm hover:bg-slate-50 ${rating === d.rating ? 'bg-indigo-50 ring-1 ring-indigo-200' : ''}`}>
                    <span className="w-8 text-start">{d.rating}★</span>
                    <span className="h-2 flex-1 rounded-full bg-slate-100"><span className="block h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} /></span>
                    <span className="w-9 text-end text-xs tabular-nums text-slate-500">{pct}%</span>
                  </button>
                </li>
              );
            })}
          </ul>
          {rating > 0 && <button type="button" onClick={() => pick(0)} className="mt-3 text-xs font-semibold text-indigo-700 hover:underline">{isAr ? 'عرض كل التقييمات' : 'Show all ratings'}</button>}
        </Card>

        <Card title={rating ? (isAr ? `تقييمات ${rating} نجوم` : `${rating}-star feedback`) : (isAr ? 'أحدث التقييمات' : 'Latest feedback')} bodyClassName="p-0">
          {!data.data.length ? (
            <EmptyState icon={Star} title={isAr ? 'لا توجد تقييمات هنا بعد' : 'No feedback here yet'} text={isAr ? 'يقيّمك العملاء بعد استلام طلباتهم.' : 'Customers rate you after their orders arrive.'} />
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.data.map((r) => (
                <li key={r._id} className="px-5 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Stars value={r.rating} />
                    <span className="text-xs text-slate-500">{r.userName} · {new Date(r.createdAt).toLocaleDateString(isAr ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  </div>
                  {r.comment ? <p className="mt-1.5 text-sm">{r.comment}</p> : <p className="mt-1.5 text-xs text-slate-400">{isAr ? 'بدون تعليق' : 'No comment'}</p>}
                </li>
              ))}
            </ul>
          )}
          {data.pagination?.pages > 1 && (
            <div className="flex items-center justify-center gap-2 border-t border-slate-100 p-3 text-sm">
              <button type="button" disabled={page <= 1} onClick={() => setPage((n) => n - 1)} className="rounded-lg px-3 py-1.5 ring-1 ring-slate-200 disabled:opacity-40">{isAr ? 'السابق' : 'Previous'}</button>
              <span>{page} / {data.pagination.pages}</span>
              <button type="button" disabled={page >= data.pagination.pages} onClick={() => setPage((n) => n + 1)} className="rounded-lg px-3 py-1.5 ring-1 ring-slate-200 disabled:opacity-40">{isAr ? 'التالي' : 'Next'}</button>
            </div>
          )}
        </Card>
      </div>
      )}
    </div>
  );
}
