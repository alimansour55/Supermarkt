import { Link } from 'react-router-dom';
import {
  ChevronRight,
  ExternalLink,
  MessageCircle,
  Phone,
  RotateCcw,
} from 'lucide-react';
import OrderChat from '../../../components/order/OrderChat';
import StatusBadge from '../StatusBadge';
import PaymentStatusBadge from '../PaymentStatusBadge';
import Loader from '../../../components/ui/Loader';
import { formatPrice } from '../../../utils/formatters';
import { useLanguage } from '../../../context/LanguageContext';

const QUICK_REPLIES_AR = [
  'شكراً لتواصلك، سنرد عليك قريباً.',
  'تم استلام رسالتك وجاري المراجعة.',
  'نعتذر عن التأخير، نعمل على حل الأمر.',
];

const QUICK_REPLIES_EN = [
  'Thanks for reaching out. We will reply shortly.',
  'We received your message and are reviewing it.',
  'Sorry for the delay. We are working on it.',
];

export default function OrderChatThreadPanel({
  order,
  loading,
  isAr,
  updating,
  highlightChat,
  onDismissChatHighlight,
  onSendMessage,
  onBack,
  showBack,
}) {
  const { language } = useLanguage();

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center bg-slate-50/50">
        <Loader size="md" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center bg-gradient-to-b from-slate-50 to-white px-8 text-center">
        <span className="flex h-20 w-20 items-center justify-center rounded-full bg-primary-50 text-primary-500">
          <MessageCircle className="h-10 w-10" strokeWidth={1.5} />
        </span>
        <h3 className="mt-5 text-lg font-bold text-text">
          {isAr ? 'مركز محادثات الطلبات' : 'Order chat inbox'}
        </h3>
        <p className="mt-2 max-w-sm text-sm text-text-muted">
          {isAr
            ? 'اختر محادثة من القائمة للرد على العميل، أو افتح الطلب الكامل لإدارة الحالة والمرتجعات.'
            : 'Select a conversation to reply, or open the full order to manage status and returns.'}
        </p>
      </div>
    );
  }

  const customerName = order.user?.name || '—';
  const phone = order.phone || order.user?.phone;
  const pendingReturns = (order.returns || []).filter((r) => r.status === 'pending').length;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white">
      <header className="shrink-0 border-b border-border bg-white px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-start gap-3">
          {showBack && (
            <button
              type="button"
              onClick={onBack}
              className="rounded-lg border border-border p-2 text-text-muted hover:bg-slate-50 lg:hidden"
              aria-label={isAr ? 'رجوع' : 'Back'}
            >
              <ChevronRight className={`h-5 w-5 ${isAr ? '' : 'rotate-180'}`} />
            </button>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold text-text">{order.orderNumber}</h2>
              <StatusBadge status={order.orderStatus || order.status} language={language} />
              <PaymentStatusBadge status={order.paymentStatus} language={language} />
            </div>
            <p className="mt-0.5 font-medium text-text">{customerName}</p>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-text-muted">
              {phone && (
                <a href={`tel:${phone}`} className="inline-flex items-center gap-1 hover:text-primary-700">
                  <Phone className="h-3.5 w-3.5" />
                  <span dir="ltr">{phone}</span>
                </a>
              )}
              <span>{isAr ? 'الإجمالي:' : 'Total:'} {formatPrice(order.total)}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to={`/admin/orders?order=${order._id}`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-primary-700"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {isAr ? 'إدارة الطلب' : 'Manage order'}
            </Link>
            {pendingReturns > 0 && (
              <Link
                to={`/admin/returns`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {isAr ? `${pendingReturns} مرتجع` : `${pendingReturns} return(s)`}
              </Link>
            )}
          </div>
        </div>
      </header>

      {highlightChat && (
        <div
          role="alert"
          className="mx-4 mt-3 flex items-center gap-3 rounded-xl border border-rose-300 bg-rose-50 px-4 py-2.5 text-sm text-rose-900 sm:mx-5"
        >
          <MessageCircle className="h-4 w-4 shrink-0" />
          <p className="flex-1 font-semibold">
            {isAr ? 'رسالة جديدة من العميل — يرجى الرد' : 'New customer message — please reply'}
          </p>
          <button
            type="button"
            onClick={onDismissChatHighlight}
            className="rounded-lg px-2 py-1 text-xs font-bold hover:bg-rose-100"
          >
            {isAr ? 'تم' : 'OK'}
          </button>
        </div>
      )}

      <OrderChat
        variant="inbox"
        messages={order.messages || []}
        isAr={isAr}
        sending={updating}
        showInternalToggle
        quickReplies={isAr ? QUICK_REPLIES_AR : QUICK_REPLIES_EN}
        placeholder={isAr ? 'اكتب رداً للعميل...' : 'Reply to the customer...'}
        className="min-h-0 flex-1"
        onSend={(payload) => {
          onDismissChatHighlight?.();
          onSendMessage?.(payload);
        }}
      />
    </div>
  );
}
