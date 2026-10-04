import { useEffect, useState } from 'react';
import { Link, useOutletContext, useParams } from '../../app/router';
import { ArrowLeft, ArrowRight, Banknote, MapPin, Phone, Printer, Truck } from 'lucide-react';
import Loader from '../../components/ui/Loader';
import { useToast } from '../../components/ui/Toast';
import { sellerApi } from '../../services/sellerApi';
import { formatPrice } from '../../utils/formatters';
import { FULFILLMENT, SHIPMENT_STATUS, apiError, label } from '../sellerLabels';
import StatusBadge from '../StatusBadge';

const inputCls = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100';

function fmtDate(value, isAr) {
  return value ? new Date(value).toLocaleString(isAr ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
}

function formatAddress(a) {
  if (!a) return '';
  return [a.street, a.building && `#${a.building}`, a.floor && `floor ${a.floor}`, a.area, a.city, a.governorate].filter(Boolean).join(', ');
}

export default function SellerOrderDetailPage() {
  const { id } = useParams();
  const { isAr } = useOutletContext();
  const toast = useToast();
  const [shipment, setShipment] = useState(null);
  const [busy, setBusy] = useState(false);
  const [carrier, setCarrier] = useState('');
  const [tracking, setTracking] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [showCancel, setShowCancel] = useState(false);

  useEffect(() => {
    sellerApi.getShipment(id)
      .then(({ data }) => {
        setShipment(data.data);
        setCarrier(data.data.carrier || '');
        setTracking(data.data.trackingNumber || '');
      })
      .catch(() => toast.error(isAr ? 'الطلب غير موجود' : 'Order not found'));
  }, [id, isAr, toast]);

  const move = async (status, extra = {}) => {
    setBusy(true);
    try {
      const { data } = await sellerApi.updateShipmentStatus(id, { status, ...extra });
      setShipment(data.data);
      setShowCancel(false);
      toast.success(isAr ? 'تم تحديث الحالة' : 'Status updated');
    } catch (err) {
      toast.error(apiError(err, isAr ? 'تعذّر التحديث' : 'Update failed'));
    } finally {
      setBusy(false);
    }
  };

  if (!shipment) return <div className="flex min-h-[40vh] items-center justify-center"><Loader size="lg" /></div>;

  const s = shipment;
  const sellerShips = s.fulfilledBy === 'seller';
  const Back = isAr ? ArrowRight : ArrowLeft;
  const canCancel = sellerShips && ['pending', 'confirmed', 'packed'].includes(s.status);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <Link to="/seller-center/orders" className="rounded-lg p-2 ring-1 ring-slate-200 hover:bg-white" aria-label={isAr ? 'رجوع' : 'Back'}><Back className="h-4 w-4" /></Link>
        <h1 className="text-2xl font-bold" dir="ltr">{s.shipmentNumber}</h1>
        <StatusBadge map={SHIPMENT_STATUS} value={s.status} isAr={isAr} />
        <span className="text-sm text-slate-500">{label(FULFILLMENT, s.fulfilledBy, isAr)}</span>
        {sellerShips && s.customer && (
          <button type="button" onClick={() => window.print()} className="ms-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold ring-1 ring-slate-200 hover:bg-white">
            <Printer className="h-4 w-4" />{isAr ? 'طباعة بوليصة التعبئة' : 'Print packing slip'}
          </button>
        )}
      </div>

      {!sellerShips && (
        <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
          {isAr
            ? 'يتولى المتجر توصيل هذه المنتجات للعميل. تتبع حالتها هنا، وتُحتسب أرباحك عند التسليم.'
            : 'The store delivers these items to the customer. Follow the status here — your earnings post on delivery.'}
        </div>
      )}

      {sellerShips && s.status !== 'cancelled' && s.status !== 'delivered' && (
        <section className="rounded-2xl border border-indigo-200 bg-indigo-50/50 p-5 print:hidden">
          <h2 className="mb-3 font-bold">{isAr ? 'الخطوة التالية' : 'Next step'}</h2>
          {s.status === 'pending' && (
            <button type="button" disabled={busy} onClick={() => move('confirmed')} className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
              {isAr ? 'تأكيد الطلب والبدء في التجهيز' : 'Confirm & start preparing'}
            </button>
          )}
          {['confirmed', 'packed'].includes(s.status) && (
            <div className="space-y-3">
              {s.status === 'confirmed' && (
                <button type="button" disabled={busy} onClick={() => move('packed')} className="rounded-xl px-4 py-2 text-sm font-semibold ring-1 ring-indigo-300 hover:bg-white disabled:opacity-50">
                  {isAr ? 'تم التغليف' : 'Mark packed'}
                </button>
              )}
              <div className="grid gap-3 sm:grid-cols-3">
                <input className={inputCls} placeholder={isAr ? 'شركة الشحن (اختياري)' : 'Carrier (optional)'} value={carrier} onChange={(e) => setCarrier(e.target.value)} />
                <input className={inputCls} placeholder={isAr ? 'رقم التتبع (اختياري)' : 'Tracking number (optional)'} value={tracking} onChange={(e) => setTracking(e.target.value)} dir="ltr" />
                <button type="button" disabled={busy} onClick={() => move('shipped', { carrier, trackingNumber: tracking })} className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
                  <Truck className="h-4 w-4" />{isAr ? 'تم الشحن' : 'Mark shipped'}
                </button>
              </div>
            </div>
          )}
          {s.status === 'shipped' && (
            <button type="button" disabled={busy} onClick={() => move('delivered')} className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
              {isAr ? 'تم التسليم للعميل' : 'Mark delivered'}
            </button>
          )}
          {canCancel && !showCancel && (
            <button type="button" onClick={() => setShowCancel(true)} className="mt-3 block text-sm font-semibold text-red-700 hover:underline">
              {isAr ? 'لا أستطيع تنفيذ هذا الطلب' : "I can't fulfil this order"}
            </button>
          )}
          {showCancel && (
            <div className="mt-3 space-y-2 rounded-xl border border-red-200 bg-white p-3">
              <p className="text-sm text-red-800">{isAr ? 'سيُلغى هذا الجزء ويُرد للعميل مبلغه. يؤثر الإلغاء على تقييم متجرك.' : 'This part is cancelled and the customer is refunded. Cancellations affect your store rating.'}</p>
              <input className={inputCls} placeholder={isAr ? 'السبب (يظهر للعميل)' : 'Reason (shown to the customer)'} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
              <div className="flex gap-2">
                <button type="button" disabled={busy || !cancelReason.trim()} onClick={() => move('cancelled', { note: cancelReason })} className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">{isAr ? 'إلغاء الشحنة' : 'Cancel shipment'}</button>
                <button type="button" onClick={() => setShowCancel(false)} className="rounded-lg px-3 py-1.5 text-sm ring-1 ring-slate-200">{isAr ? 'رجوع' : 'Back'}</button>
              </div>
            </div>
          )}
        </section>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <h2 className="mb-3 font-bold">{isAr ? 'المنتجات' : 'Items'}</h2>
          <ul className="divide-y divide-slate-100">
            {s.items.map((it) => (
              <li key={it.itemIndex} className="flex items-center gap-3 py-3">
                {typeof it.image === 'string' && it.image.startsWith('http')
                  ? <img src={it.image} alt="" className="h-12 w-12 rounded-lg object-cover ring-1 ring-slate-200" />
                  : <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 text-xl">{it.image || '🛍️'}</span>}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{isAr ? it.nameAr : it.nameEn || it.nameAr}</p>
                  <p className="text-xs text-slate-500" dir="ltr">{it.sku}{(isAr ? it.variantLabelAr : it.variantLabelEn) ? ` · ${isAr ? it.variantLabelAr : it.variantLabelEn}` : ''}</p>
                </div>
                <p className="text-sm">{formatPrice(it.price)} × {it.quantity}</p>
                <p className="w-24 text-end font-semibold">{formatPrice(it.lineTotal)}</p>
              </li>
            ))}
          </ul>
          <dl className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-sm">
            <div className="flex justify-between"><dt className="text-slate-500">{isAr ? 'قيمة المنتجات' : 'Items total'}</dt><dd>{formatPrice(s.subtotal)}</dd></div>
            {s.deliveryFee > 0 && <div className="flex justify-between"><dt className="text-slate-500">{isAr ? 'رسوم التوصيل (لك)' : 'Delivery fee (yours)'}</dt><dd>{formatPrice(s.deliveryFee)}</dd></div>}
            <div className="flex justify-between"><dt className="text-slate-500">{isAr ? 'العمولة' : 'Commission'}</dt><dd>− {formatPrice(s.commissionTotal)}</dd></div>
            {s.fulfillmentFee > 0 && <div className="flex justify-between"><dt className="text-slate-500">{isAr ? 'رسوم شحن المتجر' : 'Store fulfillment fee'}</dt><dd>− {formatPrice(s.fulfillmentFee)}</dd></div>}
            <div className="flex justify-between border-t border-slate-100 pt-1 font-bold"><dt>{isAr ? 'صافي ربحك' : 'Your net'}</dt><dd>{formatPrice(s.sellerNet)}</dd></div>
          </dl>
        </section>

        <div className="space-y-5">
          {s.customer && (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-3 font-bold">{isAr ? 'التوصيل إلى' : 'Deliver to'}</h2>
              <p className="font-semibold">{s.customer.name}</p>
              <p className="mt-2 flex items-start gap-2 text-sm"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />{formatAddress(s.customer.address)}</p>
              <p className="mt-2 flex items-center gap-2 text-sm" dir="ltr"><Phone className="h-4 w-4 text-slate-400" /><a href={`tel:${s.customer.phone}`} className="text-indigo-700">{s.customer.phone}</a></p>
              {s.customer.alternatePhone && <p className="mt-1 text-sm" dir="ltr">{s.customer.alternatePhone}</p>}
              {s.customer.notes && <p className="mt-2 rounded-lg bg-amber-50 p-2 text-sm text-amber-900">{s.customer.notes}</p>}
              {s.collectOnDelivery > 0 && (
                <p className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 p-2 text-sm font-semibold text-emerald-800">
                  <Banknote className="h-4 w-4" />{isAr ? `حصّل من العميل ${formatPrice(s.collectOnDelivery)}` : `Collect ${formatPrice(s.collectOnDelivery)} from the customer`}
                </p>
              )}
            </section>
          )}
          {sellerShips && !s.customer && ['delivered', 'cancelled', 'returned'].includes(s.status) && (
            <p className="rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-500">
              {isAr ? 'تُخفى بيانات العميل بعد إغلاق الشحنة لحماية خصوصيته.' : 'Customer details are hidden once the shipment is closed, to protect their privacy.'}
            </p>
          )}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 font-bold">{isAr ? 'السجل' : 'History'}</h2>
            <ol className="space-y-2 text-sm">
              {s.statusHistory.map((h, i) => (
                <li key={i} className="flex justify-between gap-3">
                  <span>{label(SHIPMENT_STATUS, h.status, isAr)}</span>
                  <span className="text-xs text-slate-500">{fmtDate(h.changedAt, isAr)}</span>
                </li>
              ))}
            </ol>
            {s.trackingNumber && <p className="mt-3 text-sm">{s.carrier} <span dir="ltr" className="font-mono">{s.trackingNumber}</span></p>}
            {s.cancelReason && <p className="mt-3 rounded-lg bg-red-50 p-2 text-sm text-red-800">{s.cancelReason}</p>}
          </section>
        </div>
      </div>
    </div>
  );
}
