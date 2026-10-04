import { Package, Truck } from 'lucide-react';

const STATUS = {
  pending: { ar: 'بانتظار تأكيد البائع', en: 'Waiting for the seller', tone: 'bg-amber-100 text-amber-900' },
  confirmed: { ar: 'قيد التجهيز', en: 'Preparing', tone: 'bg-sky-100 text-sky-800' },
  packed: { ar: 'جاهزة للشحن', en: 'Packed', tone: 'bg-sky-100 text-sky-800' },
  shipped: { ar: 'في الطريق', en: 'On the way', tone: 'bg-violet-100 text-violet-800' },
  delivered: { ar: 'تم التسليم', en: 'Delivered', tone: 'bg-emerald-100 text-emerald-800' },
  cancelled: { ar: 'ملغاة', en: 'Cancelled', tone: 'bg-red-100 text-red-800' },
  returned: { ar: 'مرتجعة', en: 'Returned', tone: 'bg-slate-200 text-slate-700' },
};

/**
 * Marketplace order: each seller part is a separate shipment with its own status and tracking.
 * Store-delivered seller items travel with the store's own delivery, so only seller-shipped
 * shipments get their own card here; the rest are labelled on the item lines.
 */
export default function OrderShipmentsSection({ order, isAr }) {
  const shipments = (order.shipments || []).filter((s) => s.fulfilledBy === 'seller');
  if (!shipments.length) return null;

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
    </section>
  );
}
