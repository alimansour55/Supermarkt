import {
  AlertTriangle, Banknote, KeyRound, MapPinOff, PackageX, Phone, RotateCcw,
} from 'lucide-react';
import Button from '../../components/ui/Button';
import { formatPrice } from '../../utils/formatters';

const STEPS = [
  { key: 'assignedAt', ar: 'عُيّن', en: 'Assigned' },
  { key: 'acceptedAt', ar: 'قبل', en: 'Accepted' },
  { key: 'pickedUpAt', ar: 'استلم من الفرع', en: 'Picked up' },
  { key: 'enRouteAt', ar: 'في الطريق', en: 'On the way' },
  { key: 'arrivedAt', ar: 'وصل للعميل', en: 'Arrived' },
  { key: 'returnedAt', ar: 'أرجع للفرع', en: 'Returned to store' },
];

const fmtTime = (value, isAr) => new Date(value).toLocaleTimeString(isAr ? 'ar-EG' : 'en-GB', {
  hour: '2-digit', minute: '2-digit',
});

/** The driver's side of the delivery: timeline, pickup gaps, cash, geofence flags, and reattempt. */
export default function AdminDeliveryRunCard({
  order, isAr, canWrite, updating, onReattempt,
}) {
  const run = order?.delivery;
  const failed = order?.orderStatus === 'delivery_failed';
  if (!run && !failed) return null;

  const steps = STEPS.filter((s) => run?.[s.key]);
  const missing = (run?.missingItems || []).map((i) => order.items?.[i]).filter(Boolean);
  const attempts = run?.attempts || [];

  return (
    <div className="space-y-3 rounded-xl border border-border bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
        {isAr ? 'مسار التوصيل' : 'Delivery progress'}
      </p>

      {steps.length > 0 && (
        <ol className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
          {steps.map((s) => (
            <li key={s.key} className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-teal-500" aria-hidden />
              <span className="font-medium text-text">{isAr ? s.ar : s.en}</span>
              <span className="tabular-nums text-text-muted">{fmtTime(run[s.key], isAr)}</span>
            </li>
          ))}
        </ol>
      )}

      {missing.length > 0 && (
        <p className="flex items-start gap-2 rounded-lg bg-orange-50 px-3 py-2 text-xs text-orange-900">
          <PackageX className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            {isAr ? 'أصناف لم يستلمها المندوب: ' : 'Not picked up: '}
            {missing.map((item) => (isAr ? item.nameAr || item.nameEn : item.nameEn || item.nameAr)).join(isAr ? '، ' : ', ')}
          </span>
        </p>
      )}

      {run?.cashCollected != null && (
        <p className="flex items-center gap-2 text-xs text-text">
          <Banknote className="h-4 w-4 text-emerald-600" aria-hidden />
          {isAr ? 'استلم نقداً ' : 'Cash received '}
          <strong className="tabular-nums">{formatPrice(run.cashCollected)}</strong>
          {run.changeGiven > 0 && (
            <span className="text-text-muted">
              · {isAr ? 'باقي ' : 'change '}{formatPrice(run.changeGiven)}
            </span>
          )}
        </p>
      )}

      {run?.offsite && (
        <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <MapPinOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            {isAr ? 'سُلّم بعيداً عن العنوان' : 'Completed away from the address'}
            {run.offsite.distanceMeters != null && ` (${run.offsite.distanceMeters} ${isAr ? 'م' : 'm'})`}
            {run.offsite.reason && ` — ${run.offsite.reason}`}
          </span>
        </p>
      )}

      {run?.pinFailures > 0 && (
        <p className="flex items-center gap-2 text-xs text-red-700">
          <AlertTriangle className="h-4 w-4" aria-hidden />
          {isAr ? `محاولات كود خاطئة: ${run.pinFailures}` : `Wrong delivery codes entered: ${run.pinFailures}`}
        </p>
      )}

      {order.deliveryPin && order.orderStatus === 'out_for_delivery' && (
        <p className="flex items-center gap-2 text-xs text-text-muted">
          <KeyRound className="h-4 w-4" aria-hidden />
          {isAr ? 'كود الاستلام (للدعم فقط): ' : 'Delivery code (support only): '}
          <span className="font-mono font-semibold tracking-widest text-text" dir="ltr">{order.deliveryPin}</span>
        </p>
      )}

      {attempts.length > 0 && (
        <p className="flex items-center gap-2 text-xs text-text-muted">
          <Phone className="h-4 w-4" aria-hidden />
          {isAr ? `محاولات التواصل: ${attempts.length}` : `Contact attempts: ${attempts.length}`}
          <span className="tabular-nums">
            ({attempts.slice(-3).map((a) => fmtTime(a.at, isAr)).join(isAr ? '، ' : ', ')})
          </span>
        </p>
      )}

      {failed && canWrite && (
        <div className="border-t border-border pt-3">
          <Button
            type="button"
            size="sm"
            className="w-full bg-teal-600 hover:bg-teal-700"
            disabled={updating}
            onClick={() => {
              const ok = window.confirm(isAr
                ? 'إعادة محاولة التوصيل؟ سيعود الطلب إلى «قيد التجهيز» ويستلمه المندوب من جديد.'
                : 'Reattempt this delivery? The order goes back to "Preparing" and the driver picks it up again.');
              if (ok) onReattempt?.();
            }}
          >
            <RotateCcw className="h-4 w-4" aria-hidden />
            {isAr ? 'إعادة محاولة التوصيل' : 'Reattempt delivery'}
          </Button>
          <p className="mt-1.5 text-xs text-text-muted">
            {isAr
              ? 'لتغيير المندوب، غيّره أولاً ثم أعد المحاولة. لإلغاء الطلب استخدم «إلغاء الطلب».'
              : 'To use another driver, change the driver first. To give up, cancel the order instead.'}
          </p>
        </div>
      )}
    </div>
  );
}
