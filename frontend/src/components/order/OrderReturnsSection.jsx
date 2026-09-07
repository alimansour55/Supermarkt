import { useState } from 'react';
import { Package, RotateCcw } from 'lucide-react';
import Button from '../ui/Button';
import { formatPrice, formatDate } from '../../utils/formatters';
import {
  RETURN_WINDOW_DAYS,
  getReturnReasonLabel,
  getReturnStatusLabel,
} from '../../constants/orderReturnReasons';
import ReturnRequestForm from './ReturnRequestForm';
import ReturnPickupDetails from './ReturnPickupDetails';
import ReturnProgressLine from './ReturnProgressLine';
import { getReturnFlowLabel } from '../../constants/returnFlow';
import { scrollToSection } from '../../utils/scrollToTop';

export default function OrderReturnsSection({
  order,
  isAr,
  submitting,
  onRequestReturn,
}) {
  const [open, setOpen] = useState(false);

  const returns = order.returns || [];
  const returnable = order.returnableQuantities || [];
  const status = order.orderStatus || order.status;

  const returnWindowOpen = (() => {
    if (typeof order.returnWindowOpen === 'boolean') return order.returnWindowOpen;
    const deadline = order.returnDeadline ? new Date(order.returnDeadline).getTime() : NaN;
    if (!Number.isNaN(deadline)) return Date.now() <= deadline;
    const deliveredAt = order.deliveredAt ? new Date(order.deliveredAt).getTime() : NaN;
    if (!Number.isNaN(deliveredAt)) {
      return Date.now() <= deliveredAt + RETURN_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    }
    return false;
  })();

  const canRequest = returnWindowOpen && status === 'delivered';
  const hasReturnable = returnable.some((q) => q > 0);
  const blockedByRejection = order.returnBlockedByRejection
    || order.items?.map((_, i) =>
      returns.some((r) => r.status === 'rejected' && r.itemIndex === i),
    );
  const hasRejectedBlocking = blockedByRejection?.some(Boolean);

  if (status !== 'delivered' && !returns.length) return null;

  const handleOpenForm = () => {
    setOpen(true);
    requestAnimationFrame(() => scrollToSection('order-returns-section', 'smooth'));
  };

  const handleSubmit = async (payload) => {
    await onRequestReturn?.(payload);
    setOpen(false);
  };

  return (
    <section
      id="order-returns-section"
      className="scroll-mt-[5.5rem] rounded-2xl border border-border bg-white p-5 sm:p-6 md:scroll-mt-28"
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <RotateCcw className="h-5 w-5 text-primary-600" />
            {isAr ? 'إرجاع منتج' : 'Return a product'}
          </h2>
          <p className="mt-1 text-sm text-text-muted">
            {canRequest
              ? (isAr
                ? `يمكنك طلب إرجاع خلال ${RETURN_WINDOW_DAYS} أيام من التسليم — مع اختيار موعد الإرجاع`
                : `Request a return within ${RETURN_WINDOW_DAYS} days of delivery — schedule your return time`)
              : (isAr
                ? 'انتهت مدة طلب الإرجاع (٣ أيام من تاريخ التسليم)'
                : 'Return window ended (3 days from delivery date)')}
          </p>
          {order.returnDeadline && canRequest && (
            <p className="mt-1 text-xs font-medium text-amber-700">
              {isAr ? 'آخر موعد لطلب الإرجاع: ' : 'Request deadline: '}
              {formatDate(order.returnDeadline, isAr ? 'ar-EG' : 'en-GB')}
            </p>
          )}
        </div>
        {canRequest && hasReturnable && !open && (
          <Button size="sm" variant="secondary" onClick={handleOpenForm}>
            <Package className="h-4 w-4" />
            {isAr ? 'طلب إرجاع' : 'Request return'}
          </Button>
        )}
      </div>

      {canRequest && !hasReturnable && hasRejectedBlocking && (
        <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {isAr
            ? 'لا يمكن تقديم طلب إرجاع جديد لمنتج تم رفض إرجاعه مسبقاً. للمساعدة تواصل معنا عبر رسائل الطلب.'
            : 'You cannot submit a new return for a product whose return was already rejected. Contact us via order messages if you need help.'}
        </p>
      )}

      {returns.length > 0 && (
        <div className="mb-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            {isAr ? 'طلباتك السابقة' : 'Your return requests'}
          </p>
          {returns.map((ret) => (
            <div
              key={ret._id}
              className={[
                'rounded-xl border px-4 py-3 text-sm',
                ret.status === 'approved' ? 'border-green-200 bg-green-50' : '',
                ret.status === 'rejected' ? 'border-red-200 bg-red-50' : '',
                ret.status === 'pending' ? 'border-amber-200 bg-amber-50' : '',
              ].join(' ')}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-text">
                  {isAr ? ret.nameAr : ret.nameEn || ret.nameAr}
                  {' × '}
                  {ret.quantity}
                </p>
                <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-bold text-text-muted">
                  {ret.status === 'approved'
                    ? getReturnFlowLabel(ret, isAr)
                    : getReturnStatusLabel(ret.status, isAr)}
                </span>
              </div>
              <p className="mt-1 text-text-muted">
                {isAr ? 'السبب: ' : 'Reason: '}
                {getReturnReasonLabel(ret, isAr)}
              </p>
              <ReturnPickupDetails ret={ret} isAr={isAr} />
              {ret.status !== 'rejected' && (
                <ReturnProgressLine returnItem={ret} isAr={isAr} compact />
              )}
              {ret.status === 'approved' && (
                <p className="mt-2 text-xs font-medium text-green-800">
                  {isAr
                    ? 'تمت الموافقة — يرجى الالتزام بالموعد أعلاه. سيتم استرداد المبلغ بعد استلام المنتج.'
                    : 'Approved — please follow the schedule above. Refund is processed after we receive the product.'}
                </p>
              )}
              {ret.refundAmount > 0 && ret.status === 'approved' && (
                <p className="mt-1 font-semibold text-green-800">
                  {isAr ? 'مبلغ مسترد: ' : 'Refund: '}
                  {formatPrice(ret.refundAmount)}
                </p>
              )}
              {ret.adminNote && ret.status === 'rejected' && (
                <p className="mt-2 rounded-lg border border-red-200 bg-red-50/80 px-3 py-2 text-sm text-red-900">
                  <span className="font-bold">{isAr ? 'سبب الرفض: ' : 'Rejection reason: '}</span>
                  {ret.adminNote}
                </p>
              )}
              {ret.status === 'rejected' && (
                <p className="mt-2 text-xs font-medium text-red-800/90">
                  {isAr
                    ? 'لا يمكنك تقديم طلب إرجاع آخر لنفس المنتج في هذا الطلب.'
                    : 'You cannot submit another return request for this product on this order.'}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {open && canRequest && (
        <ReturnRequestForm
          order={order}
          isAr={isAr}
          returnable={returnable}
          submitting={submitting}
          onSubmit={handleSubmit}
          onCancel={() => setOpen(false)}
        />
      )}
    </section>
  );
}
