import { useEffect, useState } from 'react';
import { Link } from '../../../app/router';
import { adminApi } from '../../adminApi';
import { FULFILLMENT, SHIPMENT_STATUS, label } from '../../../seller/sellerLabels';
import StatusBadge from '../../../seller/StatusBadge';
import { formatDate, formatPrice } from '../../../utils/formatters';

const PARCEL_FILTERS = [
  ['', 'الكل', 'All'],
  ['open', 'مفتوحة', 'Open'],
  ['delivered', 'تم التسليم', 'Delivered'],
  ['cancelled', 'ملغاة', 'Cancelled'],
];
const RETURN_STATUS = {
  pending: { ar: 'ينتظر القرار', en: 'Waiting', tone: 'bg-amber-50 text-amber-800' },
  approved: { ar: 'مقبول', en: 'Approved', tone: 'bg-emerald-50 text-emerald-700' },
  rejected: { ar: 'مرفوض', en: 'Rejected', tone: 'bg-slate-100 text-slate-600' },
};

/** One seller's parcels and returns inside its panel. */
export default function SellerOrdersTab({ sellerId, isAr, canSeeOrders }) {
  const [view, setView] = useState('parcels');
  const [status, setStatus] = useState('');
  const [parcels, setParcels] = useState(null);
  const [returns, setReturns] = useState(null);

  useEffect(() => {
    if (view !== 'parcels') return undefined;
    let alive = true;
    adminApi.listSellerShipments({ seller: sellerId, status: status || undefined, limit: 30 })
      .then(({ data }) => { if (alive) setParcels(data); })
      .catch(() => { if (alive) setParcels({ data: [] }); });
    return () => { alive = false; };
  }, [view, status, sellerId]);

  useEffect(() => {
    if (view !== 'returns' || returns) return undefined;
    let alive = true;
    adminApi.getSellerReturns(sellerId)
      .then(({ data }) => { if (alive) setReturns(data); })
      .catch(() => { if (alive) setReturns({ data: [], counts: {} }); });
    return () => { alive = false; };
  }, [view, returns, sellerId]);

  if (!canSeeOrders) return <p className="text-sm text-text-muted">{isAr ? 'ليست لديك صلاحية عرض الطلبات.' : 'You do not have access to orders.'}</p>;

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {[['parcels', 'الشحنات', 'Parcels'], ['returns', 'المرتجعات', 'Returns']].map(([id, ar, en]) => (
          <button key={id} type="button" onClick={() => setView(id)} className={`rounded-xl px-3 py-1.5 text-sm ${view === id ? 'bg-primary-600 font-semibold text-white' : 'bg-slate-100 text-text'}`}>{isAr ? ar : en}</button>
        ))}
      </div>

      {view === 'parcels' && (
        <>
          <div className="flex flex-wrap gap-1.5">
            {PARCEL_FILTERS.map(([id, ar, en]) => (
              <button key={id || 'all'} type="button" onClick={() => setStatus(id)} className={`rounded-full border px-3 py-1 text-xs ${status === id ? 'border-primary-500 bg-primary-50 font-semibold text-primary-800' : 'border-border text-text-muted'}`}>{isAr ? ar : en}</button>
            ))}
          </div>
          {!parcels ? <div className="h-32 animate-pulse rounded-2xl bg-slate-100" /> : !parcels.data.length ? (
            <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-text-muted">{isAr ? 'لا توجد شحنات.' : 'No parcels.'}</p>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-2xl border border-border bg-white">
              {parcels.data.map((s) => (
                <li key={s._id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-semibold" dir="ltr">{s.shipmentNumber}</p>
                    <p className="text-xs text-text-muted">
                      {formatDate(s.createdAt, isAr ? 'ar-EG' : 'en-GB')} · {label(FULFILLMENT, s.fulfilledBy, isAr)} · {(s.items || []).reduce((n, i) => n + (i.quantity || 0), 0)} {isAr ? 'قطعة' : 'items'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{formatPrice(s.subtotal)}</span>
                    <StatusBadge map={SHIPMENT_STATUS} value={s.status} isAr={isAr} />
                    {s.orderId && <Link to={`/admin/orders?order=${s.orderId}`} className="text-xs font-semibold text-primary-700 hover:underline" dir="ltr">{s.orderNumber}</Link>}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <Link to={`/admin/seller-shipments?seller=${sellerId}`} className="block text-center text-sm font-semibold text-primary-700 hover:underline">{isAr ? 'كل شحنات البائع' : 'All parcels for this seller'}</Link>
        </>
      )}

      {view === 'returns' && (!returns ? <div className="h-32 animate-pulse rounded-2xl bg-slate-100" /> : !returns.data.length ? (
        <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-text-muted">{isAr ? 'لا توجد مرتجعات.' : 'No returns.'}</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-2xl border border-border bg-white">
          {returns.data.map((r) => (
            <li key={r._id} className="p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="min-w-0 truncate font-semibold">{isAr ? r.nameAr || r.nameEn : r.nameEn || r.nameAr} × {r.quantity}</p>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${RETURN_STATUS[r.status]?.tone || ''}`}>{isAr ? RETURN_STATUS[r.status]?.ar : RETURN_STATUS[r.status]?.en}</span>
              </div>
              <p className="text-xs text-text-muted">
                {formatDate(r.requestedAt, isAr ? 'ar-EG' : 'en-GB')} · <span dir="ltr">{r.orderNumber}</span> · {isAr ? r.reasonAr || r.reasonEn : r.reasonEn || r.reasonAr}
              </p>
              {r.sellerNote && <p className="mt-1 rounded-lg bg-slate-50 px-2 py-1 text-xs">{isAr ? 'ملاحظة البائع: ' : 'Seller note: '}{r.sellerNote}</p>}
              <Link to={`/admin/orders?order=${r.orderId}`} className="mt-1 inline-block text-xs font-semibold text-primary-700 hover:underline">{isAr ? 'فتح الطلب' : 'Open order'}</Link>
            </li>
          ))}
        </ul>
      ))}
    </div>
  );
}
