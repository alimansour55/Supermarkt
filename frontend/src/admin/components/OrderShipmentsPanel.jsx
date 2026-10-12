import { useState } from 'react';
import { Store } from 'lucide-react';
import DetailSection from './orders/DetailSection';
import Button from '../../components/ui/Button';
import { formatPrice } from '../../utils/formatters';
import { FULFILLMENT, SHIPMENT_STATUS, label } from '../../seller/sellerLabels';
import StatusBadge from '../../seller/StatusBadge';

const REFUND_LABEL = {
  reduced_cod: { ar: 'خُصم من مبلغ التحصيل', en: 'Deducted from cash to collect' },
  wallet: { ar: 'أُعيد للمحفظة', en: 'Returned to wallet' },
  gateway: { ar: 'استُرد عبر بوابة الدفع', en: 'Refunded via gateway' },
  mixed: { ar: 'استُرد (عدة طرق)', en: 'Refunded (several methods)' },
  manual_required: { ar: 'يحتاج استرداداً يدوياً', en: 'Needs a manual refund' },
};

function ShipmentRow({ shipment, order, isAr, canWrite, updating, onOverride }) {
  const [next, setNext] = useState('');
  const [note, setNote] = useState('');
  const lines = shipment.itemIndexes.map((i) => order.items?.[i]).filter(Boolean);
  const refund = shipment.refund?.status && shipment.refund.status !== 'none' ? shipment.refund : null;

  const submit = () => {
    if (!next) return;
    if (next === 'cancelled' && !note.trim()) return;
    onOverride(shipment._id, { status: next, note });
    setNext('');
    setNote('');
  };

  return (
    <li className="space-y-2 px-5 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-semibold">{isAr ? shipment.seller.nameAr : shipment.seller.nameEn}</p>
        <span className="text-xs text-text-muted" dir="ltr">{shipment.shipmentNumber}</span>
        <StatusBadge map={SHIPMENT_STATUS} value={shipment.status} isAr={isAr} />
        <span className="text-xs text-text-muted">{label(FULFILLMENT, shipment.fulfilledBy, isAr)}</span>
      </div>
      <p className="text-sm text-text-muted">
        {lines.map((it) => `${isAr ? it.nameAr : it.nameEn || it.nameAr} × ${it.quantity}`).join('، ')}
      </p>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs tabular-nums">
        <span>{isAr ? 'القيمة' : 'Value'}: {formatPrice(shipment.subtotal)}</span>
        {shipment.deliveryFee > 0 && <span>{isAr ? 'توصيل البائع' : 'Seller delivery'}: {formatPrice(shipment.deliveryFee)}</span>}
        <span>{isAr ? 'العمولة' : 'Commission'}: {formatPrice(shipment.commissionTotal)}</span>
        {shipment.fulfillmentFee > 0 && <span>{isAr ? 'رسوم الشحن' : 'Fulfillment fee'}: {formatPrice(shipment.fulfillmentFee)}</span>}
        <span className="font-semibold">{isAr ? 'صافي البائع' : 'Seller net'}: {formatPrice(shipment.sellerNet)}</span>
      </div>
      {shipment.trackingNumber && (
        <p className="text-xs">{shipment.carrier} <span dir="ltr" className="font-mono">{shipment.trackingNumber}</span></p>
      )}
      {shipment.cancelReason && <p className="text-xs text-red-700">{isAr ? 'سبب الإلغاء: ' : 'Cancel reason: '}{shipment.cancelReason}</p>}
      {refund && (
        <p className={`rounded-lg px-2 py-1 text-xs ${refund.status === 'manual_required' ? 'bg-red-50 text-red-800' : 'bg-emerald-50 text-emerald-800'}`}>
          {formatPrice(refund.amount)} — {label(REFUND_LABEL, refund.status, isAr)}{refund.note ? ` (${refund.note})` : ''}
        </p>
      )}
      {canWrite && !['delivered', 'cancelled', 'returned'].includes(shipment.status) && shipment.fulfilledBy === 'seller' && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <select value={next} onChange={(e) => setNext(e.target.value)} className="rounded-lg border border-border px-2 py-1 text-xs">
            <option value="">{isAr ? 'تعديل الحالة (إداري)…' : 'Override status…'}</option>
            {['confirmed', 'packed', 'shipped', 'delivered', 'cancelled'].filter((s) => s !== shipment.status).map((s) => (
              <option key={s} value={s}>{label(SHIPMENT_STATUS, s, isAr)}</option>
            ))}
          </select>
          {next && (
            <>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={next === 'cancelled' ? (isAr ? 'السبب (مطلوب)' : 'Reason (required)') : (isAr ? 'ملاحظة' : 'Note')}
                className="min-w-[160px] flex-1 rounded-lg border border-border px-2 py-1 text-xs"
              />
              <Button size="sm" disabled={updating || (next === 'cancelled' && !note.trim())} onClick={submit}>
                {isAr ? 'تطبيق' : 'Apply'}
              </Button>
            </>
          )}
        </div>
      )}
    </li>
  );
}

/** Staff view of a marketplace order's seller shipments, with a status override. */
export default function OrderShipmentsPanel({ order, isAr, canWrite, updating, onOverride }) {
  if (!order?.shipments?.length) return null;
  return (
    <DetailSection title={isAr ? 'شحنات البائعين' : 'Seller shipments'} icon={Store} flush>
      <ul className="divide-y divide-border/40">
        {order.shipments.map((s) => (
          <ShipmentRow key={s._id} shipment={s} order={order} isAr={isAr} canWrite={canWrite} updating={updating} onOverride={onOverride} />
        ))}
      </ul>
    </DetailSection>
  );
}
