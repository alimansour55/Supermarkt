import { useEffect, useState } from 'react';
import { useOutletContext } from '../../app/router';
import { Star, ShieldCheck, AlertTriangle, Gauge } from 'lucide-react';
import Loader from '../../components/ui/Loader';
import { sellerApi } from '../../services/sellerApi';

const HEALTH = {
  good: { ar: 'ممتاز', en: 'Good', tone: 'bg-emerald-100 text-emerald-800', Icon: ShieldCheck },
  fair: { ar: 'يحتاج انتباه', en: 'Needs attention', tone: 'bg-amber-100 text-amber-900', Icon: Gauge },
  at_risk: { ar: 'معرّض للإيقاف', en: 'At risk', tone: 'bg-red-100 text-red-800', Icon: AlertTriangle },
};

/** The seller's customer ratings and the performance metrics the marketplace watches. */
export default function SellerReviewsPage() {
  const { isAr } = useOutletContext();
  const [data, setData] = useState(null);

  useEffect(() => {
    sellerApi.getMyReviews({ limit: 50 }).then(({ data: d }) => setData(d)).catch(() => setData({ data: [], performance: null }));
  }, []);

  if (!data) return <div className="flex min-h-[40vh] items-center justify-center"><Loader size="lg" /></div>;
  const perf = data.performance;
  const health = HEALTH[perf?.health] || HEALTH.good;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{isAr ? 'التقييمات والأداء' : 'Ratings & performance'}</h1>

      {perf && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-bold">{isAr ? `أداؤك في آخر ${perf.days} يوماً` : `Your performance, last ${perf.days} days`}</h2>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${health.tone}`}>
              <health.Icon className="h-4 w-4" aria-hidden />{isAr ? health.ar : health.en}
            </span>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-sm text-slate-500">{isAr ? 'التقييم' : 'Rating'}</p>
              <p className="text-2xl font-extrabold">{perf.ratingCount ? perf.rating.toFixed(1) : '—'} <span className="text-sm font-normal text-slate-500">({perf.ratingCount})</span></p>
            </div>
            <div>
              <p className="text-sm text-slate-500">{isAr ? 'نسبة الإلغاء منك' : 'Cancellation rate'}</p>
              <p className={`text-2xl font-extrabold ${perf.cancelRate > 2.5 ? 'text-red-700' : ''}`}>{perf.cancelRate}%</p>
              <p className="text-xs text-slate-500">{isAr ? `${perf.sellerCancelled} من ${perf.shipments} شحنة · الهدف أقل من 2.5%` : `${perf.sellerCancelled} of ${perf.shipments} shipments · target under 2.5%`}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">{isAr ? 'الشحن المتأخر' : 'Late shipments'}</p>
              <p className={`text-2xl font-extrabold ${perf.lateShipRate > 4 ? 'text-red-700' : ''}`}>{perf.lateShipRate}%</p>
              <p className="text-xs text-slate-500">{isAr ? 'بعد مدة التجهيز التي حددتها · الهدف أقل من 4%' : 'Past your stated handling time · target under 4%'}</p>
            </div>
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <h2 className="border-b border-slate-100 px-5 py-3 font-bold">{isAr ? 'آراء العملاء' : 'Customer reviews'}</h2>
        {!data.data.length ? (
          <p className="p-5 text-sm text-slate-500">{isAr ? 'لا توجد تقييمات بعد. يقيّمك العملاء بعد استلام طلباتهم.' : 'No reviews yet. Customers rate you after their orders arrive.'}</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.data.map((r) => (
              <li key={r._id} className="px-5 py-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex text-amber-500">
                    {[1, 2, 3, 4, 5].map((n) => <Star key={n} className={`h-4 w-4 ${n <= r.rating ? 'fill-current' : ''}`} aria-hidden />)}
                  </span>
                  <span className="text-xs text-slate-500">{r.userName} · {new Date(r.createdAt).toLocaleDateString(isAr ? 'ar-EG' : 'en-GB')}</span>
                </div>
                {r.comment && <p className="mt-1 text-sm">{r.comment}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
