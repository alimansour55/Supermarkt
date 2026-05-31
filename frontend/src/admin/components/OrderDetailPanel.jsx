import { useEffect, useState } from 'react';
import { ChevronDown, Printer, RotateCcw } from 'lucide-react';
import {
  ORDER_QUICK_ACTIONS,
  PAYMENT_STATUSES,
  getPaymentStatus,
  getPrimaryOrderAction,
} from '../adminConstants';
import OrderTimeline from './OrderTimeline';
import PaymentStatusBadge from './PaymentStatusBadge';
import Loader from '../../components/ui/Loader';
import Button from '../../components/ui/Button';
import Textarea from '../../components/ui/Textarea';
import { formatPrice } from '../../utils/formatters';
import { printOrderInvoice } from '../utils/printOrderInvoice';
import EmptyState from './EmptyState';

function formatAddress(addr, isAr) {
  if (!addr) return '';
  const parts = [
    addr.street,
    addr.building,
    addr.floor && (isAr ? `دور ${addr.floor}` : `Floor ${addr.floor}`),
    addr.area,
    addr.governorate || addr.city,
  ].filter(Boolean);
  return parts.join(isAr ? '، ' : ', ');
}

function deliveryLabel(method, isAr) {
  if (method === 'express') return isAr ? 'توصيل سريع' : 'Express';
  return isAr ? 'توصيل عادي' : 'Standard';
}

function paymentLabel(order, isAr) {
  const pay = getPaymentStatus(order.paymentStatus);
  const method = order.paymentMethod === 'stripe' ? 'Stripe' : (isAr ? 'عند الاستلام' : 'COD');
  return `${isAr ? pay.labelAr : pay.labelEn} (${method})`;
}

export default function OrderDetailPanel({
  order,
  loading,
  isAr,
  updating,
  onPatch,
}) {
  const [adminNotes, setAdminNotes] = useState('');
  const [notesDirty, setNotesDirty] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setAdminNotes(order?.adminNotes || '');
    setNotesDirty(false);
  }, [order?._id, order?.adminNotes]);

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
        title={isAr ? 'اختر طلباً' : 'Select an order'}
        description={isAr ? 'انقر على طلب من القائمة' : 'Click an order in the list'}
        className="border-0 bg-transparent py-12"
      />
    );
  }

  const currentStatus = order.orderStatus || order.status;
  const primaryAction = getPrimaryOrderAction(currentStatus);
  const quickActions = ORDER_QUICK_ACTIONS.filter((a) => a.status !== currentStatus);

  const handleQuickStatus = (status) => {
    setMenuOpen(false);
    onPatch({ orderStatus: status });
  };

  const saveNotes = () => {
    onPatch({ adminNotes });
    setNotesDirty(false);
  };

  const customerLine = [
    order.user?.name,
    formatAddress(order.shippingAddress, isAr),
    order.phone,
  ].filter(Boolean).join(' · ');

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
        <div>
          <h2 className="text-lg font-bold text-text">{order.orderNumber}</h2>
          <p className="mt-0.5 text-xs text-text-muted">
            {new Date(order.createdAt).toLocaleString(isAr ? 'ar-EG' : 'en-GB', {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          </p>
        </div>
        <div className="relative">
          <div className="inline-flex overflow-hidden rounded-xl border border-border bg-white text-sm font-semibold text-text shadow-sm">
            <button
              type="button"
              disabled={updating || !quickActions.length}
              onClick={() => primaryAction && handleQuickStatus(primaryAction.status)}
              className="px-3 py-2 hover:bg-slate-50 disabled:opacity-50"
            >
              {primaryAction
                ? (isAr ? primaryAction.labelAr : primaryAction.labelEn)
                : (isAr ? 'تحديث الحالة' : 'Update status')}
            </button>
            <button
              type="button"
              disabled={updating || quickActions.length <= 1}
              onClick={() => setMenuOpen((o) => !o)}
              className="border-s border-border px-2 py-2 hover:bg-slate-50 disabled:opacity-40"
              aria-label={isAr ? 'المزيد' : 'More actions'}
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>
          {menuOpen && quickActions.length > 0 && (
            <>
              <button
                type="button"
                className="fixed inset-0 z-10"
                aria-label="Close"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute end-0 z-20 mt-1 min-w-[12rem] rounded-xl border border-border bg-white py-1 shadow-lg">
                {quickActions.map((action) => (
                  <button
                    key={action.status}
                    type="button"
                    className="block w-full px-3 py-2 text-start text-sm hover:bg-slate-50"
                    onClick={() => handleQuickStatus(action.status)}
                  >
                    {isAr ? action.labelAr : action.labelEn}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <p className="text-sm leading-relaxed text-text">
        <span className="font-medium">{isAr ? 'العميل' : 'Customer'}</span>
        {' · '}
        <span className="text-text-muted">{customerLine}</span>
      </p>

      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs font-medium uppercase tracking-wide text-text-muted">
            <tr>
              <th className="px-3 py-2 text-start">{isAr ? 'المنتج' : 'Item'}</th>
              <th className="px-3 py-2 text-center">{isAr ? 'الكمية' : 'Qty'}</th>
              <th className="px-3 py-2 text-end">{isAr ? 'السعر' : 'Price'}</th>
              <th className="px-3 py-2 text-end">{isAr ? 'المجموع' : 'Total'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {order.items?.map((item, i) => (
              <tr key={i}>
                <td className="px-3 py-2.5 font-medium">
                  {isAr ? item.nameAr || item.nameEn : item.nameEn || item.nameAr}
                </td>
                <td className="px-3 py-2.5 text-center text-text-muted">{item.quantity}</td>
                <td className="px-3 py-2.5 text-end text-text-muted">{formatPrice(item.price)}</td>
                <td className="px-3 py-2.5 text-end font-medium">{formatPrice(item.price * item.quantity)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-border bg-slate-50/80 text-sm">
            <tr>
              <td colSpan={3} className="px-3 py-1.5 text-end text-text-muted">{isAr ? 'المجموع الفرعي' : 'Subtotal'}</td>
              <td className="px-3 py-1.5 text-end">{formatPrice(order.subtotal)}</td>
            </tr>
            {order.deliveryFee > 0 && (
              <tr>
                <td colSpan={3} className="px-3 py-1.5 text-end text-text-muted">{isAr ? 'التوصيل' : 'Delivery'}</td>
                <td className="px-3 py-1.5 text-end">{formatPrice(order.deliveryFee)}</td>
              </tr>
            )}
            {order.discount > 0 && (
              <tr>
                <td colSpan={3} className="px-3 py-1.5 text-end text-green-700">
                  {isAr ? 'خصم' : 'Discount'}
                  {order.couponCode ? ` (${order.couponCode})` : ''}
                </td>
                <td className="px-3 py-1.5 text-end text-green-700">-{formatPrice(order.discount)}</td>
              </tr>
            )}
            <tr>
              <td colSpan={3} className="px-3 py-2 text-end font-semibold">{isAr ? 'الإجمالي' : 'Total'}</td>
              <td className="px-3 py-2 text-end font-bold text-primary-700">{formatPrice(order.total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium text-text">{isAr ? 'الدفع:' : 'Payment:'}</span>
        <PaymentStatusBadge status={order.paymentStatus} language={isAr ? 'ar' : 'en'} />
        <span className="text-text-muted">{paymentLabel(order, isAr)}</span>
        <span className="text-slate-300">|</span>
        <span className="font-medium text-text">{isAr ? 'التوصيل:' : 'Delivery:'}</span>
        <span className="text-text-muted">{deliveryLabel(order.deliveryMethod, isAr)}</span>
      </div>

      {order.notes && (
        <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <span className="font-medium">{isAr ? 'ملاحظة العميل:' : 'Customer note:'}</span>{' '}
          {order.notes}
        </div>
      )}

      <div>
        <p className="mb-3 text-sm font-medium text-text">{isAr ? 'مسار الطلب' : 'Order timeline'}</p>
        <OrderTimeline order={order} isAr={isAr} />
      </div>

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

      <div className="flex flex-wrap gap-2 border-t border-border pt-4">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => printOrderInvoice(order, isAr)}
        >
          <Printer className="h-4 w-4" />
          {isAr ? 'طباعة الفاتورة' : 'Print invoice'}
        </Button>
        <Button size="sm" variant="secondary" disabled title={isAr ? 'قريباً' : 'Coming soon'}>
          <RotateCcw className="h-4 w-4 opacity-50" />
          {isAr ? 'استرداد (قريباً)' : 'Refund (soon)'}
        </Button>
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
              onChange={(e) => onPatch({ orderStatus: e.target.value })}
            >
              {['pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'].map((s) => (
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
