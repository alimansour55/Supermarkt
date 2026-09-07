import { useEffect, useState } from 'react';
import { MessageCircle, Printer, RotateCcw, XCircle, Package, Star, MapPin, Truck, CreditCard } from 'lucide-react';
import { adminApi } from '../adminApi';
import { PAYMENT_STATUSES, getPaymentStatus } from '../adminConstants';
import { getDeliveryFailureReason } from '../../constants/deliveryFailureReasons';
import OrderFlowSteps from '../../components/order/OrderFlowSteps';
import DeliveryFailureModal from './DeliveryFailureModal';
import OrderReturnsPanel from './OrderReturnsPanel';
import AdminDriverAssignmentSection from './AdminDriverAssignmentSection';
import OrderDeliveryLocationCard, { CustomerContactRow } from './OrderDeliveryLocationCard';
import DetailSection from './orders/DetailSection';
import { scrollToTop } from '../../utils/scrollToTop';
import PaymentStatusBadge from './PaymentStatusBadge';
import StatusBadge from './StatusBadge';
import OrderChat from '../../components/order/OrderChat';
import Loader from '../../components/ui/Loader';
import Button from '../../components/ui/Button';
import Textarea from '../../components/ui/Textarea';
import { formatPrice } from '../../utils/formatters';
import { printOrderInvoice } from '../utils/printOrderInvoice';
import EmptyState from './EmptyState';
import OrderPaymentProofPanel from './OrderPaymentProofPanel';
import { getPaymentMethodLabel } from '../../constants/paymentMethods';
import { useToast } from './index';

function deliveryLabel(method, isAr, order) {
  if (method === 'express') return isAr ? 'توصيل سريع' : 'Express';
  if (method === 'recurring') {
    const summary = isAr ? order?.recurringDelivery?.scheduleSummaryAr : order?.recurringDelivery?.scheduleSummaryEn;
    if (summary) return summary;
    const freq = order?.recurringDelivery?.frequency;
    const base = isAr ? 'توصيل دوري' : 'Recurring';
    if (!freq) return base;
    const map = { weekly: isAr ? 'أسبوعي' : 'Weekly', biweekly: isAr ? 'كل أسبوعين' : 'Biweekly', monthly: isAr ? 'شهري' : 'Monthly' };
    return `${base} · ${map[freq] || freq}`;
  }
  return isAr ? 'توصيل عادي' : 'Standard';
}

function paymentLabel(order, isAr, settings) {
  const pay = getPaymentStatus(order.paymentStatus);
  const method = getPaymentMethodLabel(order.paymentMethod, settings, isAr);
  return `${isAr ? pay.labelAr : pay.labelEn} (${method})`;
}

export default function OrderDetailPanel({
  order,
  loading,
  isAr,
  updating,
  drivers = [],
  highlightChat = false,
  onDismissChatHighlight,
  onPatch,
  onAction,
}) {
  const [adminNotes, setAdminNotes] = useState('');
  const [notesDirty, setNotesDirty] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [subItemIndex, setSubItemIndex] = useState('0');
  const [subProductId, setSubProductId] = useState('');
  const [subReason, setSubReason] = useState('');
  const [showCancel, setShowCancel] = useState(false);
  const [showRefund, setShowRefund] = useState(false);
  const [showSubstitution, setShowSubstitution] = useState(false);
  const [failureModalOpen, setFailureModalOpen] = useState(false);
  const [requestingReview, setRequestingReview] = useState(false);
  const toast = useToast();

  useEffect(() => {
    setAdminNotes(order?.adminNotes || '');
    setNotesDirty(false);
    setRefundAmount(order?.total ? String(order.total) : '');
    setShowCancel(false);
    setShowRefund(false);
    setShowSubstitution(false);
  }, [order?._id, order?.adminNotes, order?.total]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader size="md" />
      </div>
    );
  }

  if (!order) {
    return (
      <EmptyState
        icon={Package}
        title={isAr ? 'اختر طلباً' : 'Select an order'}
        description={isAr ? 'انقر على طلب من القائمة' : 'Click an order in the list'}
        className="border-0 bg-transparent py-12"
      />
    );
  }

  const currentStatus = order.orderStatus || order.status;

  const saveNotes = () => {
    onPatch({ adminNotes });
    setNotesDirty(false);
  };

  const requestReview = async () => {
    setRequestingReview(true);
    try {
      await adminApi.requestOrderReview(order._id);
      toast.success(isAr ? 'تم إرسال طلب التقييم للعميل' : 'Review request sent to customer');
    } catch (err) {
      toast.error(err?.response?.data?.message || (isAr ? 'تعذّر إرسال الطلب' : 'Could not send request'));
    } finally {
      setRequestingReview(false);
    }
  };


  return (
    <div className="space-y-5">
      {/* Hero header */}
      <header className="overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-white via-white to-primary-50/40 p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
              {isAr ? 'طلب رقم' : 'Order'}
            </p>
            <h2 className="mt-0.5 font-mono text-2xl font-bold tabular-nums tracking-tight text-text sm:text-[1.65rem]">
              #{order.orderNumber}
            </h2>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <StatusBadge status={currentStatus} language={isAr ? 'ar' : 'en'} variant="subtle" />
              <PaymentStatusBadge status={order.paymentStatus} language={isAr ? 'ar' : 'en'} variant="subtle" />
            </div>
            <time className="mt-2 block text-sm text-text-muted">
              {new Date(order.createdAt).toLocaleString(isAr ? 'ar-EG' : 'en-GB', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </time>
          </div>
          <div className="shrink-0 rounded-xl bg-white/80 px-4 py-3 text-end shadow-sm ring-1 ring-primary-100/80 backdrop-blur-sm">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-primary-600/80">
              {isAr ? 'الإجمالي' : 'Total'}
            </p>
            <p className="mt-0.5 text-xl font-bold tabular-nums text-primary-800 sm:text-2xl">
              {formatPrice(order.total)}
            </p>
          </div>
        </div>
      </header>

      {currentStatus === 'delivery_failed' && getDeliveryFailureReason(order, isAr) && (
        <div className="rounded-xl border border-red-200/80 bg-red-50/80 px-4 py-3 text-sm text-red-900">
          <p className="font-semibold">{isAr ? 'سبب فشل التسليم' : 'Delivery failure reason'}</p>
          <p className="mt-1 text-red-800">{getDeliveryFailureReason(order, isAr)}</p>
        </div>
      )}

      <DetailSection title={isAr ? 'حالة الطلب' : 'Order status'}>
        <p className="mb-3 text-xs text-text-muted">
          {isAr ? 'انقر على المرحلة لتحديث الحالة' : 'Tap a stage to update status'}
        </p>
        <OrderFlowSteps
          order={order}
          isAr={isAr}
          interactive
          updating={updating}
          onRequestDeliveryFailed={() => setFailureModalOpen(true)}
          onStatusChange={(status, extra = {}) => {
            scrollToTop();
            onPatch({ orderStatus: status, ...extra });
          }}
        />
        <DeliveryFailureModal
          open={failureModalOpen}
          isAr={isAr}
          updating={updating}
          onClose={() => setFailureModalOpen(false)}
          onConfirm={(extra) => {
            setFailureModalOpen(false);
            onPatch({ orderStatus: 'delivery_failed', ...extra });
          }}
        />
      </DetailSection>

      <DetailSection title={isAr ? 'العميل والتوصيل' : 'Customer & delivery'} icon={Truck}>
        <CustomerContactRow
          name={order.user?.name}
          phone={order.phone}
          alternatePhone={order.alternatePhone}
          isAr={isAr}
        />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="flex items-start gap-2 rounded-lg bg-slate-50/80 px-3 py-2.5 ring-1 ring-border/40">
            <CreditCard className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                {isAr ? 'الدفع' : 'Payment'}
              </p>
              <p className="mt-0.5 text-sm font-medium text-text">{paymentLabel(order, isAr, null)}</p>
            </div>
          </div>
          <div className="flex items-start gap-2 rounded-lg bg-slate-50/80 px-3 py-2.5 ring-1 ring-border/40">
            <Truck className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                {isAr ? 'نوع التوصيل' : 'Delivery type'}
              </p>
              <p className="mt-0.5 text-sm font-medium text-text">{deliveryLabel(order.deliveryMethod, isAr, order)}</p>
            </div>
          </div>
        </div>
        {order.shippingAddress && (
          <div className="mt-4">
            <OrderDeliveryLocationCard address={order.shippingAddress} isAr={isAr} />
          </div>
        )}
      </DetailSection>

      <OrderPaymentProofPanel
        order={order}
        isAr={isAr}
        updating={updating}
        onMarkPaid={() => onPatch?.({ paymentStatus: 'paid' })}
      />

      <DetailSection title={isAr ? 'المنتجات' : 'Items'} icon={Package} flush>
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs font-medium text-text-muted">
            <tr className="border-b border-border/60">
              <th className="px-4 py-2 text-start font-semibold">{isAr ? 'المنتج' : 'Item'}</th>
              <th className="px-3 py-2 text-center font-semibold">{isAr ? 'الكمية' : 'Qty'}</th>
              <th className="px-3 py-2 text-end font-semibold">{isAr ? 'السعر' : 'Price'}</th>
              <th className="px-4 py-2 text-end font-semibold">{isAr ? 'المجموع' : 'Total'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {order.items?.map((item, i) => (
              <tr key={i} className="hover:bg-slate-50/50">
                <td className="px-4 py-2.5 font-medium text-text">
                  {isAr ? item.nameAr || item.nameEn : item.nameEn || item.nameAr}
                </td>
                <td className="px-3 py-2.5 text-center text-text-muted">{item.quantity}</td>
                <td className="px-3 py-2.5 text-end tabular-nums text-text-muted">{formatPrice(item.price)}</td>
                <td className="px-4 py-2.5 text-end font-medium tabular-nums">{formatPrice(item.price * item.quantity)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-border/80 bg-slate-50/30 text-sm">
            <tr>
              <td colSpan={3} className="px-4 py-1.5 text-end text-text-muted">{isAr ? 'المجموع الفرعي' : 'Subtotal'}</td>
              <td className="px-4 py-1.5 text-end tabular-nums">{formatPrice(order.subtotal)}</td>
            </tr>
            {order.deliveryFee > 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-1.5 text-end text-text-muted">{isAr ? 'التوصيل' : 'Delivery'}</td>
                <td className="px-4 py-1.5 text-end tabular-nums">{formatPrice(order.deliveryFee)}</td>
              </tr>
            )}
            {order.discount > 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-1.5 text-end text-emerald-700">
                  {isAr ? 'خصم' : 'Discount'}
                  {order.couponCode ? ` (${order.couponCode})` : ''}
                </td>
                <td className="px-4 py-1.5 text-end tabular-nums text-emerald-700">-{formatPrice(order.discount)}</td>
              </tr>
            )}
            <tr>
              <td colSpan={3} className="px-4 py-2.5 text-end font-semibold text-text">{isAr ? 'الإجمالي' : 'Total'}</td>
              <td className="px-4 py-2.5 text-end text-base font-bold tabular-nums text-primary-700">{formatPrice(order.total)}</td>
            </tr>
          </tfoot>
        </table>
        </div>
      </DetailSection>

      <AdminDriverAssignmentSection
        order={order}
        drivers={drivers}
        isAr={isAr}
        updating={updating}
        onAssign={(driverId) => onAction?.('assignDriver', { driverId })}
      />

      {order.fulfillmentLocation && (
        <div className="flex items-start gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">
              {isAr ? 'يشحن من:' : 'Ships from:'}{' '}
              <strong>{order.fulfillmentLocation.name}</strong>
            </p>
            <p className="text-xs text-emerald-800/90">{order.fulfillmentLocation.address}</p>
          </div>
        </div>
      )}

      {order.notes && (
        <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <span className="font-medium">{isAr ? 'ملاحظة العميل:' : 'Customer note:'}</span>{' '}
          {order.notes}
        </div>
      )}

      {order.cancellationReason && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          {isAr ? 'سبب الإلغاء:' : 'Cancellation reason:'} {order.cancellationReason}
        </div>
      )}

      {order.refundAmount > 0 && (
        <div className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">
          {isAr ? 'مبلغ مسترد:' : 'Refunded:'} {formatPrice(order.refundAmount)}
          {order.refundReason ? ` — ${order.refundReason}` : ''}
        </div>
      )}

      <OrderReturnsPanel
        order={order}
        isAr={isAr}
        updating={updating}
        onRequestReturn={(payload) => onAction?.('return', payload)}
        onReviewReturn={(returnId, payload) => onAction?.('reviewReturn', { returnId, ...payload })}
        onFulfillmentChange={(returnId, fulfillmentStatus) =>
          onAction?.('returnFulfillment', { returnId, fulfillmentStatus })}
      />

      {order.substitutions?.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-sm">
          <p className="mb-2 font-semibold text-amber-900">{isAr ? 'اقتراحات بديلة' : 'Substitutions'}</p>
          {order.substitutions.map((sub) => (
            <div key={sub._id} className="border-t border-amber-200/80 py-2 first:border-0 first:pt-0">
              <span className="font-medium">{isAr ? sub.original?.nameAr : sub.original?.nameEn}</span>
              {' → '}
              <span className="text-primary-700">{isAr ? sub.replacement?.nameAr : sub.replacement?.nameEn}</span>
              <span className={`ms-2 text-xs font-bold ${sub.status === 'pending' ? 'text-amber-700' : sub.status === 'accepted' ? 'text-green-700' : 'text-red-600'}`}>
                ({sub.status})
              </span>
            </div>
          ))}
        </div>
      )}

      <DetailSection
        title={isAr ? 'محادثة الطلب' : 'Order chat'}
        icon={MessageCircle}
        className={highlightChat ? 'ring-2 ring-rose-400 ring-offset-2' : ''}
      >
        {highlightChat && (
          <div
            role="alert"
            className="mb-4 flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50/80 px-3 py-2.5 text-sm text-rose-900"
          >
            <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">
                {isAr ? 'رسالة جديدة — يرجى الرد' : 'New message — please reply'}
              </p>
            </div>
            <button
              type="button"
              onClick={onDismissChatHighlight}
              className="shrink-0 text-xs font-semibold text-rose-700 hover:underline"
            >
              {isAr ? 'تم' : 'OK'}
            </button>
          </div>
        )}
        <OrderChat
          messages={order.messages || []}
          isAr={isAr}
          sending={updating}
          showInternalToggle
          onSend={(payload) => {
            onDismissChatHighlight?.();
            onAction?.('message', payload);
          }}
        />
      </DetailSection>

      <div className="space-y-2">
        <Textarea
          label={isAr ? 'ملاحظات داخلية (الإدارة)' : 'Internal admin notes'}
          rows={3}
          value={adminNotes}
          onChange={(e) => {
            setAdminNotes(e.target.value);
            setNotesDirty(true);
          }}
          placeholder={isAr ? 'ملاحظات للفريق فقط...' : 'Notes for your team only...'}
        />
        {notesDirty && (
          <Button size="sm" disabled={updating} onClick={saveNotes}>
            {isAr ? 'حفظ الملاحظات' : 'Save notes'}
          </Button>
        )}
      </div>

      {showSubstitution && (
        <div className="rounded-xl border border-border bg-slate-50 p-3 space-y-2">
          <p className="text-sm font-semibold">{isAr ? 'اقتراح منتج بديل' : 'Suggest replacement'}</p>
          <select
            className="w-full rounded-lg border border-border px-2 py-1.5 text-sm"
            value={subItemIndex}
            onChange={(e) => setSubItemIndex(e.target.value)}
          >
            {order.items?.map((item, i) => (
              <option key={i} value={String(i)}>
                {isAr ? item.nameAr : item.nameEn}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={subProductId}
            onChange={(e) => setSubProductId(e.target.value)}
            placeholder={isAr ? 'معرّف المنتج البديل (Product ID)' : 'Replacement product ID'}
            className="w-full rounded-lg border border-border px-2 py-1.5 text-sm"
          />
          <input
            type="text"
            value={subReason}
            onChange={(e) => setSubReason(e.target.value)}
            placeholder={isAr ? 'السبب (اختياري)' : 'Reason (optional)'}
            className="w-full rounded-lg border border-border px-2 py-1.5 text-sm"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={updating || !subProductId.trim()}
              onClick={() => {
                onAction?.('substitution', {
                  itemIndex: Number(subItemIndex),
                  replacementProductId: subProductId.trim(),
                  reason: subReason,
                });
              }}
            >
              {isAr ? 'إرسال الاقتراح' : 'Send suggestion'}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setShowSubstitution(false)}>
              {isAr ? 'إلغاء' : 'Cancel'}
            </Button>
          </div>
        </div>
      )}

      {showCancel && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 space-y-2">
          <p className="text-sm font-semibold text-red-900">{isAr ? 'إلغاء الطلب' : 'Cancel order'}</p>
          <input
            type="text"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder={isAr ? 'سبب الإلغاء' : 'Cancellation reason'}
            className="w-full rounded-lg border border-border px-2 py-1.5 text-sm"
          />
          <div className="flex gap-2">
            <Button size="sm" variant="danger" disabled={updating} onClick={() => onAction?.('cancel', { reason: cancelReason })}>
              {isAr ? 'تأكيد الإلغاء' : 'Confirm cancel'}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setShowCancel(false)}>{isAr ? 'تراجع' : 'Back'}</Button>
          </div>
        </div>
      )}

      {showRefund && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-3 space-y-2">
          <p className="text-sm font-semibold text-green-900">{isAr ? 'استرداد المبلغ' : 'Process refund'}</p>
          <input
            type="number"
            value={refundAmount}
            onChange={(e) => setRefundAmount(e.target.value)}
            placeholder={isAr ? 'المبلغ' : 'Amount'}
            className="w-full rounded-lg border border-border px-2 py-1.5 text-sm"
          />
          <input
            type="text"
            value={refundReason}
            onChange={(e) => setRefundReason(e.target.value)}
            placeholder={isAr ? 'سبب الاسترداد' : 'Refund reason'}
            className="w-full rounded-lg border border-border px-2 py-1.5 text-sm"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={updating || order.paymentStatus !== 'paid'}
              onClick={() => onAction?.('refund', { amount: Number(refundAmount), reason: refundReason })}
            >
              {isAr ? 'تأكيد الاسترداد' : 'Confirm refund'}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setShowRefund(false)}>{isAr ? 'تراجع' : 'Back'}</Button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 rounded-2xl border border-border/60 bg-slate-50/60 p-3">
        <Button size="sm" variant="secondary" onClick={() => onAction?.('invoice')}>
          <Printer className="h-4 w-4" />
          {isAr ? 'تحميل PDF' : 'Download PDF'}
        </Button>
        <Button size="sm" variant="secondary" onClick={() => printOrderInvoice(order, isAr)}>
          <Printer className="h-4 w-4" />
          {isAr ? 'طباعة' : 'Print'}
        </Button>
        {order.paymentStatus === 'paid' && (
          <Button size="sm" variant="secondary" onClick={() => setShowRefund(true)} disabled={updating}>
            <RotateCcw className="h-4 w-4" />
            {isAr ? 'استرداد' : 'Refund'}
          </Button>
        )}
        {currentStatus === 'delivered' && (
          <Button size="sm" variant="secondary" onClick={requestReview} disabled={updating || requestingReview}>
            <Star className="h-4 w-4" />
            {isAr ? 'طلب تقييم' : 'Request review'}
          </Button>
        )}
        {!['cancelled', 'delivered', 'delivery_failed'].includes(currentStatus) && (
          <>
            <Button size="sm" variant="secondary" onClick={() => setShowSubstitution(true)} disabled={updating}>
              <Package className="h-4 w-4" />
              {isAr ? 'بديل' : 'Substitute'}
            </Button>
            <Button size="sm" variant="danger" onClick={() => setShowCancel(true)} disabled={updating}>
              <XCircle className="h-4 w-4" />
              {isAr ? 'إلغاء' : 'Cancel'}
            </Button>
          </>
        )}
      </div>

      <details className="rounded-xl border border-border bg-slate-50 text-sm">
        <summary className="cursor-pointer px-3 py-2 font-medium text-text-muted">
          {isAr ? 'إعدادات متقدمة' : 'Advanced'}
        </summary>
        <div className="space-y-3 border-t border-border px-3 py-3">
          <div>
            <label className="mb-1 block text-xs font-medium">{isAr ? 'حالة الطلب' : 'Order status'}</label>
            <select
              className="w-full rounded-lg border border-border px-2 py-1.5 text-sm"
              value={currentStatus}
              disabled={updating}
              onChange={(e) => {
                const next = e.target.value;
                if (next === 'delivery_failed') {
                  setFailureModalOpen(true);
                  return;
                }
                onPatch({ orderStatus: next });
              }}
            >
              {['pending', 'preparing', 'out_for_delivery', 'delivered', 'delivery_failed', 'cancelled', 'confirmed'].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">{isAr ? 'حالة الدفع' : 'Payment status'}</label>
            <select
              className="w-full rounded-lg border border-border px-2 py-1.5 text-sm"
              value={order.paymentStatus || 'pending'}
              disabled={updating}
              onChange={(e) => onPatch({ paymentStatus: e.target.value })}
            >
              {PAYMENT_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{isAr ? s.labelAr : s.labelEn}</option>
              ))}
            </select>
          </div>
        </div>
      </details>
    </div>
  );
}
