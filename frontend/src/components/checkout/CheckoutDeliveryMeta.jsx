import { CreditCard, MapPin, Truck } from 'lucide-react';
import { DELIVERY_METHODS, RECURRING_FREQUENCIES } from '../../constants/deliveryOptions';

function formatScheduleDate(dateStr, isAr) {
  if (!dateStr) return null;
  try {
    const d = new Date(`${dateStr}T12:00:00`);
    return d.toLocaleDateString(isAr ? 'ar-EG' : 'en-EG', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  } catch {
    return dateStr;
  }
}

function MetaLine({ icon: Icon, label, value, iconClass }) {
  return (
    <div className="flex items-start gap-2.5 text-start">
      <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 ${iconClass}`}>
        <Icon className="h-3.5 w-3.5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label.replace(/: $/, '')}</p>
        <p className="mt-0.5 text-sm font-medium leading-snug text-slate-900">{value}</p>
      </div>
    </div>
  );
}

export default function CheckoutDeliveryMeta({
  language = 'ar',
  deliveryMethod,
  location,
  form,
  selectedSlot,
  paymentMethod,
  paymentOptions = [],
}) {
  const isAr = language === 'ar';
  const methodMeta = DELIVERY_METHODS[deliveryMethod] || DELIVERY_METHODS.scheduled;
  const payment = paymentOptions.find((m) => m.id === paymentMethod);
  const paymentLabel = payment
    ? (isAr ? payment.labelAr : payment.labelEn)
    : (paymentMethod === 'cod'
      ? (isAr ? 'الدفع عند الاستلام' : 'Cash on delivery')
      : (isAr ? 'دفع أونلاين' : 'Online payment'));

  const zoneName = location
    ? (isAr ? location.nameAr : location.nameEn)
    : (isAr ? '—' : '—');

  let deliveryValue = isAr ? methodMeta.labelAr : methodMeta.labelEn;

  if (deliveryMethod === 'scheduled' || deliveryMethod === 'recurring') {
    const dateLabel = formatScheduleDate(form?.scheduledDate, isAr);
    const slotLabel = selectedSlot
      ? (isAr ? selectedSlot.labelAr : selectedSlot.labelEn)
      : null;
    const schedule = [dateLabel, slotLabel].filter(Boolean).join(isAr ? ' · ' : ' · ');
    if (schedule) deliveryValue = schedule;
  } else if (deliveryMethod === 'express') {
    deliveryValue = location?.estimatedExpress || (isAr ? methodMeta.etaAr : methodMeta.etaEn);
  }

  if (deliveryMethod === 'recurring') {
    const freq = RECURRING_FREQUENCIES.find((f) => f.value === form?.recurringFrequency);
    if (freq) {
      deliveryValue = `${isAr ? freq.labelAr : freq.labelEn} · ${deliveryValue}`;
    }
  }

  const deliveryPrefix = isAr ? 'التوصيل: ' : 'Delivery: ';
  const areaPrefix = isAr ? 'المنطقة: ' : 'Area: ';
  const paymentPrefix = isAr ? 'الدفع: ' : 'Payment: ';

  return (
    <div className="space-y-3">
      <MetaLine
        icon={Truck}
        iconClass="text-emerald-700"
        label={deliveryPrefix}
        value={deliveryValue}
      />
      <MetaLine
        icon={MapPin}
        iconClass="text-sky-700"
        label={areaPrefix}
        value={zoneName}
      />
      <MetaLine
        icon={CreditCard}
        iconClass="text-violet-700"
        label={paymentPrefix}
        value={paymentLabel}
      />
    </div>
  );
}
