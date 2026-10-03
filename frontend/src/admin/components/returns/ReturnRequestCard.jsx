import { useState } from 'react';
import { Link } from 'react-router-dom';
import ReturnRejectForm from './ReturnRejectForm';
import ReturnRejectedEditPanel from './ReturnRejectedEditPanel';
import {
  Calendar,
  Check,
  Mail,
  Package,
  Phone,
  RotateCcw,
  X,
} from 'lucide-react';
import ProductImage from '../../../components/ui/ProductImage';
import Button from '../../../components/ui/Button';
import { formatPrice, formatDate } from '../../../utils/formatters';
import { getReturnReasonLabel, getReturnStatusLabel } from '../../../constants/orderReturnReasons';
import ReturnProgressLine from '../../../components/order/ReturnProgressLine';
import ReturnFlowSteps from '../../../components/order/ReturnFlowSteps';
import { getReturnFlowLabel } from '../../../constants/returnFlow';
import {
  getItemConditionLabel,
  getPickupSlotLabel,
  getReturnMethodLabel,
} from '../../../constants/returnPickup';

const STATUS_STYLES = {
  pending: 'border-amber-300 bg-amber-50/90 ring-amber-200',
  approved: 'border-green-300 bg-green-50/90 ring-green-200',
  rejected: 'border-red-300 bg-red-50/90 ring-red-200',
};

function InfoBlock({ label, children, className = '' }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">{label}</p>
      <div className="mt-0.5 text-xs leading-snug text-text">{children}</div>
    </div>
  );
}

export default function ReturnRequestCard({
  row,
  isAr,
  updating,
  highlighted,
  reviewNote,
  onReviewNoteChange,
  onApprove,
  onReject,
  onRejectedAction,
  onFulfillmentChange,
}) {
  const [rejectOpen, setRejectOpen] = useState(false);
  const [editRejectedOpen, setEditRejectedOpen] = useState(false);
  const statusStyle = STATUS_STYLES[row.status] || STATUS_STYLES.pending;
  const lineTotal = row.lineTotal ?? (row.price * row.quantity);
  const hasPickup = Boolean(row.pickupDate || row.pickupSlotId);
  const pickupDateLabel = row.pickupDate
    ? formatDate(row.pickupDate, isAr ? 'ar-EG' : 'en-GB')
    : '—';

  return (
    <article
      className={[
        'rounded-xl border p-2.5 shadow-sm transition sm:p-3',
        statusStyle,
        highlighted ? 'ring-2 ring-primary-300' : 'ring-1',
      ].join(' ')}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-border bg-white">
            <ProductImage
              src={row.image}
              alt=""
              className="h-full w-full"
              imgClassName="h-full w-full object-contain p-0.5"
            />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-text">
              {isAr ? row.nameAr : row.nameEn || row.nameAr}
            </p>
            <p className="text-xs text-text-muted">
              {isAr ? 'الكمية: ' : 'Qty: '}
              {row.quantity}
              {' · '}
              {formatPrice(lineTotal)}
            </p>
            <Link
              to={`/admin/orders?order=${row.orderId}`}
              className="inline-flex items-center gap-0.5 text-xs font-semibold text-primary-700 hover:underline"
            >
              <Package className="h-3 w-3" />
              {row.orderNumber}
            </Link>
          </div>
        </div>
        <span
          className={[
            'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
            row.status === 'pending' ? 'bg-amber-200 text-amber-900' : '',
            row.status === 'approved' ? 'bg-green-200 text-green-900' : '',
            row.status === 'rejected' ? 'bg-red-200 text-red-900' : '',
          ].join(' ')}
        >
          {row.status === 'approved'
            ? getReturnFlowLabel(row, isAr)
            : getReturnStatusLabel(row.status, isAr)}
        </span>
      </div>

      <div className="mt-2 grid gap-x-3 gap-y-2 border-t border-black/5 pt-2 sm:grid-cols-2 lg:grid-cols-3">
        <InfoBlock label={isAr ? 'العميل' : 'Customer'}>
          <p className="font-medium">
            {row.customerName && row.customerName !== row.customerPhone
              ? row.customerName
              : (isAr ? 'عميل زائر' : 'Guest customer')}
          </p>
          {row.customerPhone && (
            <p className="flex items-center gap-0.5 text-text-muted" dir="ltr">
              <Phone className="h-3 w-3" />
              {row.customerPhone}
            </p>
          )}
          {row.contactPhone && row.contactPhone !== row.customerPhone && (
            <p className="flex items-center gap-0.5 text-text-muted" dir="ltr">
              <Phone className="h-3 w-3" />
              {row.contactPhone}
            </p>
          )}
          {row.customerEmail && (
            <p className="flex items-center gap-0.5 truncate text-text-muted">
              <Mail className="h-3 w-3 shrink-0" />
              {row.customerEmail}
            </p>
          )}
        </InfoBlock>

        <InfoBlock label={isAr ? 'السبب' : 'Reason'}>
          <p className="font-medium">{getReturnReasonLabel(row, isAr)}</p>
          {row.customerNote && (
            <p className="text-text-muted">{row.customerNote}</p>
          )}
        </InfoBlock>

        <InfoBlock label={isAr ? 'تاريخ الطلب' : 'Requested'}>
          <p className="flex items-center gap-0.5 font-medium">
            <Calendar className="h-3 w-3" />
            {formatDate(row.requestedAt || row.createdAt, isAr ? 'ar-EG' : 'en-GB')}
          </p>
          {row.requestedByRole === 'customer' && (
            <p className="text-amber-800">
              {isAr ? 'طلب من العميل' : 'Customer-initiated'}
            </p>
          )}
        </InfoBlock>

        {hasPickup && (
          <>
            <InfoBlock label={isAr ? 'طريقة الإرجاع' : 'Return method'}>
              <p className="font-medium">{getReturnMethodLabel(row.returnMethod, isAr)}</p>
              {getPickupSlotLabel(row, isAr) && (
                <p className="text-text-muted">{getPickupSlotLabel(row, isAr)}</p>
              )}
            </InfoBlock>

            <InfoBlock label={isAr ? 'حالة المنتج' : 'Product condition'}>
              <p className="font-medium">{getItemConditionLabel(row, isAr)}</p>
            </InfoBlock>

            <InfoBlock label={isAr ? 'تاريخ الإرجاع' : 'Return date'}>
              <p className="font-medium">{pickupDateLabel}</p>
            </InfoBlock>
          </>
        )}
      </div>

      {row.status === 'pending' && (
        <ReturnProgressLine returnItem={row} isAr={isAr} compact />
      )}

      {row.status === 'approved' && (
        <div className="mt-2">
          <ReturnFlowSteps
            returnItem={row}
            isAr={isAr}
            updating={updating}
            onFulfillmentChange={onFulfillmentChange}
            compact
          />
        </div>
      )}

      {row.orderStatus === 'returned' && row.status === 'approved' && (
        <p className="mt-1.5 rounded-md bg-teal-100 px-2 py-1 text-[11px] font-semibold text-teal-900">
          {isAr ? 'تم تحديث حالة الطلب إلى: تم الاسترجاع' : 'Order status synced: Returned'}
        </p>
      )}

      {row.status === 'approved' && row.refundAmount > 0 && (
        <p className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-green-100 px-2 py-0.5 text-xs font-bold text-green-900">
          <RotateCcw className="h-3 w-3" />
          {isAr ? 'مسترد: ' : 'Refunded: '}
          {formatPrice(row.refundAmount)}
        </p>
      )}

      {row.status === 'pending' && (
        <div className="mt-2 space-y-2 rounded-lg border border-amber-200 bg-white p-2">
          {!rejectOpen && (
            <>
              <input
                type="text"
                value={reviewNote}
                onChange={(e) => onReviewNoteChange(e.target.value)}
                placeholder={
                  isAr
                    ? 'ملاحظة للعميل عند الموافقة (اختياري)'
                    : 'Note to customer on approval (optional)'
                }
                className="w-full rounded-md border border-border px-2 py-1.5 text-xs"
              />
              <div className="flex flex-wrap gap-1.5">
                <Button size="sm" disabled={updating} onClick={onApprove}>
                  <Check className="h-3.5 w-3.5" />
                  {isAr ? 'موافقة وتأكيد الموعد' : 'Approve & confirm'}
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  disabled={updating}
                  onClick={() => setRejectOpen(true)}
                >
                  <X className="h-3.5 w-3.5" />
                  {isAr ? 'رفض الطلب' : 'Reject'}
                </Button>
              </div>
            </>
          )}

          {rejectOpen && (
            <ReturnRejectForm
              isAr={isAr}
              note={reviewNote}
              onNoteChange={onReviewNoteChange}
              updating={updating}
              onCancel={() => setRejectOpen(false)}
              onConfirm={() => {
                onReject();
                setRejectOpen(false);
              }}
            />
          )}
        </div>
      )}

      {row.status === 'rejected' && (
        <div className="mt-2 space-y-1.5">
          {row.adminNote && (
            <div className="rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-900">
              <span className="font-bold">{isAr ? 'سبب الرفض: ' : 'Rejection reason: '}</span>
              {row.adminNote}
            </div>
          )}
          {!editRejectedOpen ? (
            <Button
              size="sm"
              variant="secondary"
              disabled={updating}
              onClick={() => {
                onReviewNoteChange(row.adminNote || '');
                setEditRejectedOpen(true);
              }}
            >
              {isAr ? 'تعديل القرار' : 'Edit decision'}
            </Button>
          ) : (
            <ReturnRejectedEditPanel
              isAr={isAr}
              note={reviewNote}
              onNoteChange={onReviewNoteChange}
              updating={updating}
              onCancel={() => setEditRejectedOpen(false)}
              onSaveRejectReason={() => {
                onRejectedAction?.('reject');
                setEditRejectedOpen(false);
              }}
              onApproveInstead={() => {
                onRejectedAction?.('approve');
                setEditRejectedOpen(false);
              }}
              onReopen={() => {
                onRejectedAction?.('reopen');
                setEditRejectedOpen(false);
              }}
            />
          )}
        </div>
      )}

      {row.adminNote && row.status === 'approved' && (
        <p className="mt-1.5 rounded-md bg-white/80 px-2 py-1 text-xs text-text-muted">
          <span className="font-semibold">{isAr ? 'ملاحظة الإدارة: ' : 'Admin note: '}</span>
          {row.adminNote}
        </p>
      )}
    </article>
  );
}
