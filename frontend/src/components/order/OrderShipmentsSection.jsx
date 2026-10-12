import { useState } from 'react';
import { Package, Star, Truck } from 'lucide-react';
import { marketplaceApi } from '../../services/sellerApi';

const STATUS = {
  pending: { ar: 'بانتظار تأكيد البائع', en: 'Waiting for the seller', tone: 'bg-amber-100 text-amber-900' },
  confirmed: { ar: 'قيد التجهيز', en: 'Preparing', tone: 'bg-sky-100 text-sky-800' },
  packed: { ar: 'جاهزة للشحن', en: 'Packed', tone: 'bg-sky-100 text-sky-800' },
  shipped: { ar: 'في الطريق', en: 'On the way', tone: 'bg-violet-100 text-violet-800' },
  delivered: { ar: 'تم التسليم', en: 'Delivered', tone: 'bg-emerald-100 text-emerald-800' },
  cancelled: { ar: 'ملغاة', en: 'Cancelled', tone: 'bg-red-100 text-red-800' },
  returned: { ar: 'مرتجعة', en: 'Returned', tone: 'bg-slate-200 text-slate-700' },
};

/** One-time 1–5 star rating of a seller after its shipment arrived. */
function RateSeller({ order, shipment, isAr }) {
  const [rating, setRating] = useState(shipment.myRating || 0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [saved, setSaved] = useState(Boolean(shipment.myRating));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const name = isAr ? shipment.seller.nameAr || shipment.seller.nameEn : shipment.seller.nameEn || shipment.seller.nameAr;

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      await marketplaceApi.rateShipment(order._id, shipment._id, { rating, comment });
      setSaved(true);
    } catch (err) {
      setError(err.response?.data?.message || (isAr ? 'تعذّر إرسال التقييم' : 'Could not send your rating'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 rounded-lg bg-amber-50/60 p-3">
      <p className="text-sm font-semibold">{saved ? (isAr ? 'شكراً لتقييمك' : 'Thanks for your rating') : (isAr ? `قيّم البائع ${name}` : `Rate seller ${name}`)}</p>
      <div className="mt-1 flex items-center gap-1" role="radiogroup" aria-label={isAr ? 'التقييم' : 'Rating'}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            disabled={saved}
            onClick={() => setRating(n)}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            className="p-0.5 text-amber-500 disabled:cursor-default"
            aria-label={`${n}`}
            aria-checked={rating === n}
            role="radio"
          >
            <Star className={`h-6 w-6 ${n <= (hover || rating) ? 'fill-current' : ''}`} />
          </button>
        ))}
      </div>
      {!saved && rating > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={1000}
            placeholder={isAr ? 'تعليق (اختياري)' : 'Comment (optional)'}
            className="min-w-[180px] flex-1 rounded-lg border border-border bg-white px-3 py-1.5 text-sm"
          />
          <button type="button" disabled={busy} onClick={submit} className="rounded-lg bg-primary-600 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
            {isAr ? 'إرسال' : 'Submit'}
          </button>
        </div>
      )}
      {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
    </div>
  );
}

/**
 * Marketplace order: each seller part is a separate shipment with its own status and tracking.
 * Store-delivered seller items travel with the store's own delivery, so only seller-shipped
 * shipments get their own card here; the rest are labelled on the item lines.
 */
export default function OrderShipmentsSection({ order, isAr }) {
  const shipments = (order.shipments || []).filter((s) => s.fulfilledBy === 'seller');
  // Store-delivered seller items: still rate their seller once delivered.
  const storeDeliveredToRate = (order.shipments || []).filter((s) => s.fulfilledBy === 'store' && s.status === 'delivered');
  if (!shipments.length && !storeDeliveredToRate.length) return null;
  if (!shipments.length) {
    return (
      <section className="mt-6 rounded-2xl border border-border bg-white p-5 sm:p-6">
        <h2 className="mb-1 text-lg font-bold">{isAr ? 'قيّم البائعين' : 'Rate your sellers'}</h2>
        {storeDeliveredToRate.map((s) => <RateSeller key={s._id} order={order} shipment={s} isAr={isAr} />)}
      </section>
    );
  }

  const fmtDate = (d) => (d ? new Date(d).toLocaleDateString(isAr ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'short' }) : '');

  return (
    <section className="mt-6 rounded-2xl border border-border bg-white p-5 sm:p-6">
      <h2 className="mb-1 text-lg font-bold">{isAr ? 'شحنات البائعين' : 'Seller shipments'}</h2>
      <p className="mb-4 text-sm text-text-muted">
        {isAr ? 'تصلك هذه المنتجات في شحنات منفصلة من البائعين مباشرة.' : 'These items arrive separately, shipped directly by their sellers.'}
      </p>
      <ul className="space-y-3">
        {shipments.map((s) => {
          const status = STATUS[s.status] || STATUS.pending;
          const lines = s.itemIndexes.map((i) => order.items?.[i]).filter(Boolean);
          return (
            <li key={s._id} className="rounded-xl border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-2 font-semibold">
                  <Package className="h-4 w-4 text-slate-500" aria-hidden />
                  {isAr ? s.seller.nameAr || s.seller.nameEn : s.seller.nameEn || s.seller.nameAr}
                  <span className="text-xs font-normal text-text-muted" dir="ltr">{s.shipmentNumber}</span>
                </p>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${status.tone}`}>{isAr ? status.ar : status.en}</span>
              </div>
              <p className="mt-2 text-sm text-text-muted">
                {lines.map((it) => `${isAr ? it.nameAr : it.nameEn || it.nameAr} × ${it.quantity}`).join('، ')}
              </p>
              {(s.trackingNumber || s.shippedAt) && s.status !== 'cancelled' && (
                <p className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                  <Truck className="h-4 w-4 text-slate-500" aria-hidden />
                  {s.carrier && <span className="font-medium">{s.carrier}</span>}
                  {s.trackingNumber && <span dir="ltr" className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs">{s.trackingNumber}</span>}
                  {s.shippedAt && <span className="text-text-muted">{isAr ? `شُحنت ${fmtDate(s.shippedAt)}` : `shipped ${fmtDate(s.shippedAt)}`}</span>}
                </p>
              )}
              {s.status === 'delivered' && s.deliveredAt && (
                <p className="mt-1 text-sm text-emerald-700">{isAr ? `سُلّمت ${fmtDate(s.deliveredAt)}` : `Delivered ${fmtDate(s.deliveredAt)}`}</p>
              )}
              {s.status === 'delivered' && <RateSeller order={order} shipment={s} isAr={isAr} />}
              {s.status === 'cancelled' && (
                <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
                  {isAr ? 'ألغى البائع هذه الشحنة' : 'The seller cancelled this shipment'}
                  {s.cancelReason ? ` — ${s.cancelReason}` : ''}
                  {'. '}
                  {isAr ? 'لن تُحاسب على هذه المنتجات.' : "You won't be charged for these items."}
                </p>
              )}
            </li>
          );
        })}
      </ul>
      {storeDeliveredToRate.map((s) => <RateSeller key={s._id} order={order} shipment={s} isAr={isAr} />)}
    </section>
  );
}
