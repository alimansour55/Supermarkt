import { useState } from 'react';
import { Link } from '../../app/router';
import { ExternalLink, RotateCcw } from 'lucide-react';
import Button from '../../components/ui/Button';
import ReturnRequestForm from '../../components/order/ReturnRequestForm';
import ReturnRequestCard from './returns/ReturnRequestCard';
import { scrollToTop } from '../../utils/scrollToTop';

export default function OrderReturnsPanel({
  order,
  isAr,
  updating,
  onRequestReturn,
  onReviewReturn,
  onFulfillmentChange,
}) {
  const [showForm, setShowForm] = useState(false);
  const [reviewNotes, setReviewNotes] = useState({});

  const returns = order.returns || [];
  const returnable = order.returnableQuantities || [];
  const canManageReturns = ['delivered', 'returned'].includes(order.orderStatus);
  const pendingCount = returns.filter((r) => r.status === 'pending').length;

  if (!canManageReturns && !returns.length) return null;

  const handleAdminReturn = async (payload) => {
    await onRequestReturn?.({ ...payload, autoApprove: true });
    setShowForm(false);
    scrollToTop('smooth');
  };

  return (
    <div className="space-y-4 rounded-xl border border-border bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="flex items-center gap-2 text-sm font-bold text-text">
            <RotateCcw className="h-4 w-4 text-primary-600" />
            {isAr ? 'مرتجعات المنتجات' : 'Product returns'}
          </p>
          {pendingCount > 0 && (
            <p className="mt-0.5 text-xs text-amber-700">
              {isAr ? `${pendingCount} بانتظار المراجعة` : `${pendingCount} awaiting review`}
            </p>
          )}
          {order.orderStatus === 'returned' && (
            <p className="mt-0.5 text-xs font-medium text-teal-800">
              {isAr ? 'حالة الطلب: تم الاسترجاع' : 'Order status: Returned'}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/admin/returns"
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary-700 hover:underline"
            onClick={() => scrollToTop()}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {isAr ? 'كل المرتجعات' : 'All returns'}
          </Link>
          {canManageReturns && (
            <Button size="sm" variant="secondary" onClick={() => setShowForm((v) => !v)}>
              {showForm ? (isAr ? 'إغلاق' : 'Close') : (isAr ? 'تسجيل إرجاع' : 'Record return')}
            </Button>
          )}
        </div>
      </div>

      {returns.length === 0 && !showForm && (
        <p className="text-sm text-text-muted">
          {isAr ? 'لا توجد طلبات إرجاع بعد' : 'No return requests yet'}
        </p>
      )}

      {returns.map((ret) => {
        const row = {
          ...ret,
          orderId: order._id,
          orderNumber: order.orderNumber,
          customerName: order.user?.name || order.phone,
          customerPhone: order.phone,
          customerEmail: order.user?.email,
          orderStatus: order.orderStatus,
        };
        const rowId = String(ret._id);

        return (
          <ReturnRequestCard
            key={rowId}
            row={row}
            isAr={isAr}
            updating={updating}
            reviewNote={reviewNotes[rowId] || ''}
            onReviewNoteChange={(v) => setReviewNotes((prev) => ({ ...prev, [rowId]: v }))}
            onApprove={() => onReviewReturn?.(rowId, {
              action: 'approve',
              adminNote: reviewNotes[rowId],
            })}
            onReject={() => onReviewReturn?.(rowId, {
              action: 'reject',
              adminNote: reviewNotes[rowId],
            })}
            onRejectedAction={(action) => onReviewReturn?.(rowId, {
              action,
              adminNote: reviewNotes[rowId],
              fromRejected: true,
            })}
            onFulfillmentChange={(status) => onFulfillmentChange?.(rowId, status)}
          />
        );
      })}

      {showForm && canManageReturns && (
        <div className="border-t border-border pt-4">
          <p className="mb-3 text-xs font-semibold text-text-muted">
            {isAr ? 'تسجيل إرجاع من الإدارة (يُوافق تلقائياً)' : 'Admin return (auto-approved)'}
          </p>
          <ReturnRequestForm
            order={order}
            isAr={isAr}
            returnable={returnable}
            submitting={updating}
            onSubmit={handleAdminReturn}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}
    </div>
  );
}
