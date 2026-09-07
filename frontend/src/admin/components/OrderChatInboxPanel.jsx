import { Link } from 'react-router-dom';
import { ExternalLink, MessageCircle } from 'lucide-react';
import OrderChat from '../../components/order/OrderChat';
import StatusBadge from './StatusBadge';
import Loader from '../../components/ui/Loader';
import EmptyState from './EmptyState';
import { useLanguage } from '../../context/LanguageContext';

export default function OrderChatInboxPanel({
  order,
  loading,
  isAr,
  updating,
  highlightChat = false,
  onDismissChatHighlight,
  onSendMessage,
}) {
  const { language } = useLanguage();

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
        title={isAr ? 'اختر محادثة' : 'Select a conversation'}
        description={isAr ? 'اختر طلباً من القائمة لعرض الرسائل' : 'Pick an order from the list to view messages'}
        className="border-0 bg-transparent py-12"
      />
    );
  }

  const customerName = order.user?.name || order.phone;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
        <div>
          <p className="text-lg font-bold text-text">{order.orderNumber}</p>
          <p className="mt-0.5 text-sm text-text-muted">{customerName}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={order.orderStatus || order.status} language={language} />
          <Link
            to={`/admin/orders?order=${order._id}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-primary-700 transition-colors hover:bg-primary-50"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {isAr ? 'فتح الطلب' : 'Open order'}
          </Link>
        </div>
      </div>

      {highlightChat && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border-2 border-rose-400 bg-rose-50 px-4 py-3 text-sm text-rose-900"
        >
          <MessageCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="font-bold">
              {isAr ? 'رسالة جديدة — يرجى الرد' : 'New message — please reply'}
            </p>
          </div>
          <button
            type="button"
            onClick={onDismissChatHighlight}
            className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100"
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
        placeholder={isAr ? 'ردّ على العميل...' : 'Reply to customer...'}
        onSend={(payload) => {
          onDismissChatHighlight?.();
          onSendMessage?.(payload);
        }}
      />
    </div>
  );
}
