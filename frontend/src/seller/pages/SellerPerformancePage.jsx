import { useEffect, useState } from 'react';
import { Link, useOutletContext } from '../../app/router';
import { CheckCircle2, Clock, Gauge, Lightbulb, Star, XCircle } from 'lucide-react';
import Loader from '../../components/ui/Loader';
import { sellerApi } from '../../services/sellerApi';
import { ACCOUNT_HEALTH } from '../sellerLabels';
import { Card, PageHeader } from '../ui';

/** One metric vs its target, like Seller Central's account health tiles. */
function Metric({ icon: Icon, title, value, suffix = '%', target, good, detail, isAr, explain }) {
  return (
    <article className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-slate-700"><Icon className="h-4 w-4 text-slate-400" aria-hidden />{title}</p>
        {good
          ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" />{isAr ? 'جيد' : 'Good'}</span>
          : <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700"><XCircle className="h-3.5 w-3.5" />{isAr ? 'فوق الحد' : 'Above target'}</span>}
      </div>
      <p className={`mt-3 text-3xl font-extrabold tabular-nums ${good ? '' : 'text-red-700'}`}>{value}{suffix}</p>
      <p className="text-xs text-slate-500">{target}</p>
      {detail && <p className="mt-2 text-xs text-slate-500">{detail}</p>}
      <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-600">{explain}</p>
    </article>
  );
}

export default function SellerPerformancePage() {
  const { isAr, seller } = useOutletContext();
  const [perf, setPerf] = useState(null);

  useEffect(() => {
    sellerApi.getMyReviews({ limit: 1 }).then(({ data }) => setPerf(data.performance || {})).catch(() => setPerf({}));
  }, []);

  if (!perf) return <div className="flex min-h-[40vh] items-center justify-center"><Loader size="lg" /></div>;
  const health = ACCOUNT_HEALTH[perf.health] || ACCOUNT_HEALTH.good;
  const ratingGood = !(perf.ratingCount >= 5 && perf.rating < 3.5);

  const tips = [
    perf.cancelRate > 2.5 && { ar: 'حدّث المخزون فور نفاده حتى لا تُضطر لإلغاء طلبات. استخدم صفحة "إدارة المخزون".', en: 'Update stock as soon as you sell out so you never have to cancel. Use "Manage inventory".', to: '/seller-center/inventory?stock=low' },
    perf.lateShipRate > 4 && { ar: `أكّد واشحن الطلبات خلال ${seller.handlingDays} يوم، أو زِد مدة التجهيز في بيانات المتجر.`, en: `Confirm and ship within ${seller.handlingDays} day(s), or raise your handling time in Store profile.`, to: '/seller-center/orders?status=pending' },
    !ratingGood && { ar: 'راجع تعليقات العملاء منخفضة التقييم وحسّن التغليف ودقة الأوصاف.', en: 'Read your low-rated feedback and improve packing and listing accuracy.', to: '/seller-center/reviews?rating=1' },
  ].filter(Boolean);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Gauge}
        title={isAr ? 'صحة الحساب' : 'Account health'}
        description={isAr
          ? `نراقب هذه المؤشرات لآخر ${perf.days || 90} يوماً على الطلبات التي تشحنها بنفسك. البقاء ضمن الأهداف يحمي متجرك من الإيقاف.`
          : `We track these over the last ${perf.days || 90} days on orders you ship yourself. Staying within the targets keeps your store in good standing.`}
      />

      <section className={`flex flex-wrap items-center gap-4 rounded-2xl p-5 ring-1 ${health.tone}`}>
        <health.Icon className="h-10 w-10" aria-hidden />
        <div>
          <p className="text-sm opacity-80">{isAr ? 'حالة حسابك' : 'Your account status'}</p>
          <p className="text-2xl font-extrabold">{isAr ? health.ar : health.en}</p>
        </div>
        <p className="ms-auto max-w-md text-sm opacity-90">
          {perf.health === 'good'
            ? (isAr ? 'رائع! استمر على هذا الأداء.' : 'Great work — keep it up.')
            : perf.health === 'fair'
              ? (isAr ? 'بعض المؤشرات تقترب من الحد. اتبع النصائح بالأسفل.' : 'Some metrics are close to the limit. Follow the tips below.')
              : (isAr ? 'متجرك معرّض للإيقاف. عالج المؤشرات الحمراء فوراً.' : 'Your store may be suspended. Fix the red metrics now.')}
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Metric
          icon={XCircle}
          isAr={isAr}
          title={isAr ? 'معدل الإلغاء من البائع' : 'Seller cancellation rate'}
          value={perf.cancelRate ?? 0}
          good={(perf.cancelRate ?? 0) <= 2.5}
          target={isAr ? 'الهدف: أقل من 2.5%' : 'Target: under 2.5%'}
          detail={isAr ? `${perf.sellerCancelled || 0} ملغاة من ${perf.shipments || 0} طلب` : `${perf.sellerCancelled || 0} cancelled of ${perf.shipments || 0} orders`}
          explain={isAr ? 'الطلبات التي ألغيتها أنت قبل الشحن — غالباً بسبب نفاد المخزون.' : 'Orders you cancelled before shipping — usually because of stock-outs.'}
        />
        <Metric
          icon={Clock}
          isAr={isAr}
          title={isAr ? 'معدل الشحن المتأخر' : 'Late shipment rate'}
          value={perf.lateShipRate ?? 0}
          good={(perf.lateShipRate ?? 0) <= 4}
          target={isAr ? 'الهدف: أقل من 4%' : 'Target: under 4%'}
          detail={isAr ? `${perf.lateShipments || 0} شحنة متأخرة` : `${perf.lateShipments || 0} late shipments`}
          explain={isAr ? `الطلبات التي شُحنت بعد مدة التجهيز (${seller.handlingDays} يوم + يوم سماح).` : `Orders shipped after your handling time (${seller.handlingDays} day(s) + 1 day grace).`}
        />
        <Metric
          icon={Star}
          isAr={isAr}
          suffix=""
          title={isAr ? 'تقييم العملاء' : 'Customer rating'}
          value={perf.ratingCount ? perf.rating.toFixed(1) : '—'}
          good={ratingGood}
          target={isAr ? 'الهدف: 3.5 أو أكثر' : 'Target: 3.5 or higher'}
          detail={isAr ? `${perf.ratingCount || 0} تقييم` : `${perf.ratingCount || 0} ratings`}
          explain={isAr ? 'متوسط تقييم العملاء لك بعد الاستلام. يُحتسب بعد 5 تقييمات.' : 'Average buyer rating after delivery. Counts once you have 5 ratings.'}
        />
      </section>

      <Card title={<span className="flex items-center gap-2"><Lightbulb className="h-4 w-4 text-amber-500" />{isAr ? 'نصائح لتحسين أدائك' : 'How to improve'}</span>}>
        {tips.length === 0 ? (
          <p className="text-sm text-slate-600">{isAr ? 'لا توجد ملاحظات — كل المؤشرات ضمن الأهداف.' : 'Nothing to fix — every metric is within target.'}</p>
        ) : (
          <ul className="space-y-2">
            {tips.map((tip) => (
              <li key={tip.to}>
                <Link to={tip.to} className="block rounded-xl bg-amber-50 p-3 text-sm text-amber-950 hover:bg-amber-100">{isAr ? tip.ar : tip.en}</Link>
              </li>
            ))}
          </ul>
        )}
        <ul className="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
          <li>• {isAr ? 'أكّد الطلبات الجديدة في نفس اليوم.' : 'Confirm new orders the same day.'}</li>
          <li>• {isAr ? 'أضف رقم التتبع عند الشحن.' : 'Add a tracking number when you ship.'}</li>
          <li>• {isAr ? 'اجعل المخزون مطابقاً للواقع دائماً.' : 'Keep stock matching what you actually have.'}</li>
          <li>• {isAr ? 'استخدم صوراً ووصفاً دقيقاً لتقليل المرتجعات.' : 'Accurate photos and descriptions reduce returns.'}</li>
        </ul>
      </Card>
    </div>
  );
}
