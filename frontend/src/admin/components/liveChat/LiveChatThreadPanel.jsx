import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  History,
  MessageCircle,
  PauseCircle,
  Phone,
  RotateCcw,
  Star,
  UserCheck,
} from 'lucide-react';
import OrderChat from '../../../components/order/OrderChat';
import Loader from '../../../components/ui/Loader';
import { buildWhatsAppLink, normalizePhoneTel } from '../../../utils/contactInfo';
import { adminApi } from '../../adminApi';

const STATUS_BADGE = {
  queued: { cls: 'bg-amber-100 text-amber-800', ar: 'في الانتظار', en: 'Waiting' },
  active: { cls: 'bg-emerald-100 text-emerald-800', ar: 'نشطة', en: 'Active' },
  pending: { cls: 'bg-sky-100 text-sky-800', ar: 'معلّقة', en: 'Pending' },
  closed: { cls: 'bg-slate-200 text-slate-600', ar: 'مغلقة', en: 'Closed' },
};

export function RatingStars({ score, className = 'h-3.5 w-3.5' }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${score}/5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`${className} ${n <= score ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`}
        />
      ))}
    </span>
  );
}

function CustomerHistory({ userId, currentId, isAr, onSelect }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(null);

  useEffect(() => {
    setOpen(false);
    setItems(null);
  }, [userId]);

  useEffect(() => {
    if (!open || items !== null || !userId) return;
    adminApi.getLiveChatHistoryForUser(userId)
      .then(({ data }) => setItems(data.data || []))
      .catch(() => setItems([]));
  }, [open, items, userId]);

  if (!userId) return null;
  const past = (items || []).filter((item) => item._id !== currentId);

  return (
    <div className="shrink-0 border-b border-border bg-slate-50/60 px-4 py-2 sm:px-5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 text-xs font-semibold text-text-muted hover:text-text"
      >
        <History className="h-3.5 w-3.5" />
        {isAr ? 'محادثات سابقة مع هذا العميل' : 'Past conversations with this customer'}
        <ChevronDown className={`ms-auto h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="mt-2 max-h-40 space-y-1 overflow-y-auto">
          {items === null ? (
            <p className="py-2 text-xs text-text-muted">{isAr ? 'جارٍ التحميل…' : 'Loading…'}</p>
          ) : past.length === 0 ? (
            <p className="py-2 text-xs text-text-muted">{isAr ? 'لا توجد محادثات سابقة' : 'No previous conversations'}</p>
          ) : past.map((item) => (
            <button
              key={item._id}
              type="button"
              onClick={() => onSelect?.(item._id)}
              className="flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-white px-3 py-2 text-start text-xs hover:border-primary-300"
            >
              <span className="min-w-0">
                <span className="block font-semibold text-text">
                  {item.closedAt ? new Date(item.closedAt).toLocaleDateString(isAr ? 'ar-EG' : 'en-GB') : '—'}
                  {' · '}
                  {item.messageCount} {isAr ? 'رسالة' : 'msgs'}
                  {item.rating && <span className="ms-2 align-middle"><RatingStars score={item.rating.score} className="h-3 w-3" /></span>}
                </span>
                <span className="block truncate text-text-muted">
                  {item.assignedTo?.name ? `${isAr ? 'تعامل معها:' : 'Handled by'} ${item.assignedTo.name}` : (isAr ? 'بدون مسؤول' : 'Unassigned')}
                  {item.lastMessage?.body ? ` — ${item.lastMessage.body}` : ''}
                </span>
              </span>
              <ChevronRight className={`h-3.5 w-3.5 shrink-0 text-text-muted ${isAr ? 'rotate-180' : ''}`} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const QUICK_REPLIES_AR = [
  'أهلاً بيك، إزاي أقدر أساعدك؟',
  'شكراً لتواصلك، سنرد عليك قريباً.',
  'تم استلام رسالتك وجاري المراجعة.',
];

const QUICK_REPLIES_EN = [
  'Hi there, how can I help?',
  'Thanks for reaching out — we will reply shortly.',
  'Got your message, looking into it now.',
];

export default function LiveChatThreadPanel({
  conversation,
  loading,
  isAr,
  updating,
  onSendMessage,
  onClose,
  onReopen,
  onClaim,
  onMarkPending,
  onReopenActive,
  onSelectHistory,
  onBack,
  showBack,
}) {
  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center bg-slate-50/50">
        <Loader size="md" />
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center bg-gradient-to-b from-slate-50 to-white px-8 text-center">
        <span className="flex h-20 w-20 items-center justify-center rounded-full bg-primary-50 text-primary-500">
          <MessageCircle className="h-10 w-10" strokeWidth={1.5} />
        </span>
        <h3 className="mt-5 text-lg font-bold text-text">
          {isAr ? 'الدردشة المباشرة' : 'Live chat inbox'}
        </h3>
        <p className="mt-2 max-w-sm text-sm text-text-muted">
          {isAr
            ? 'اختر محادثة من القائمة للرد على العميل مباشرة.'
            : 'Select a conversation to reply to the customer directly.'}
        </p>
      </div>
    );
  }

  const customerName = conversation.user?.name || '—';
  const phone = conversation.user?.phone || '';
  const whatsappLink = buildWhatsAppLink(phone, isAr ? 'أهلاً، بخصوص محادثتنا في تطبيق المتجر...' : "Hi, following up on our chat in the store's app...");

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
              <h2 className="text-lg font-bold text-text">{customerName}</h2>
              <span className={[
                'rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide',
                (STATUS_BADGE[conversation.status] || STATUS_BADGE.closed).cls,
              ].join(' ')}
              >
                {isAr
                  ? (STATUS_BADGE[conversation.status] || STATUS_BADGE.closed).ar
                  : (STATUS_BADGE[conversation.status] || STATUS_BADGE.closed).en}
              </span>
              {conversation.status === 'queued' && conversation.queuePosition && (
                <span className="text-xs font-semibold text-amber-700">
                  {isAr ? `الترتيب #${conversation.queuePosition} في الانتظار` : `Position #${conversation.queuePosition} in queue`}
                </span>
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-text-muted">
              {phone && (
                <a href={normalizePhoneTel(phone)} className="inline-flex items-center gap-1 hover:text-primary-700">
                  <Phone className="h-3.5 w-3.5" />
                  <span dir="ltr">{phone}</span>
                </a>
              )}
              {conversation.assignedTo?.name && (
                <span>{isAr ? 'المسؤول:' : 'Assigned:'} {conversation.assignedTo.name}</span>
              )}
            </div>
            {conversation.status === 'closed' && (
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                {conversation.rating ? (
                  <>
                    <span className="font-semibold text-text">{isAr ? 'تقييم العميل:' : 'Customer rating:'}</span>
                    <RatingStars score={conversation.rating.score} />
                    <span className="font-semibold text-amber-700">{conversation.rating.score}/5</span>
                    {conversation.rating.comment && (
                      <span className="text-text-muted">“{conversation.rating.comment}”</span>
                    )}
                  </>
                ) : (
                  <span className="text-text-muted">{isAr ? 'لم يقيّم العميل هذه المحادثة' : 'Not rated by the customer'}</span>
                )}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {whatsappLink && (
              <a
                href={whatsappLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                {isAr ? 'متابعة في واتساب' : 'Continue on WhatsApp'}
              </a>
            )}
            {!conversation.assignedTo && conversation.status !== 'closed' && (
              <button
                type="button"
                onClick={onClaim}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-text transition-colors hover:bg-slate-50"
              >
                <UserCheck className="h-3.5 w-3.5" />
                {isAr ? 'تولّي المحادثة' : 'Claim'}
              </button>
            )}
            {conversation.status === 'active' && (
              <button
                type="button"
                onClick={onMarkPending}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-text transition-colors hover:bg-slate-50"
              >
                <PauseCircle className="h-3.5 w-3.5" />
                {isAr ? 'تعليق' : 'Mark pending'}
              </button>
            )}
            {conversation.status === 'pending' && (
              <button
                type="button"
                onClick={onReopenActive}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-text transition-colors hover:bg-slate-50"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {isAr ? 'إرجاع لنشطة' : 'Back to active'}
              </button>
            )}
            {conversation.status !== 'closed' ? (
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-text transition-colors hover:bg-slate-50"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                {isAr ? 'إغلاق' : 'Close'}
              </button>
            ) : (
              <button
                type="button"
                onClick={onReopen}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-text transition-colors hover:bg-slate-50"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {isAr ? 'إعادة فتح' : 'Reopen'}
              </button>
            )}
          </div>
        </div>
      </header>

      <CustomerHistory
        userId={conversation.user?._id}
        currentId={conversation._id}
        isAr={isAr}
        onSelect={onSelectHistory}
      />

      <OrderChat
        variant="inbox"
        messages={conversation.messages || []}
        isAr={isAr}
        sending={updating}
        composerDisabled={conversation.status === 'closed'}
        composerDisabledMessage={isAr ? 'المحادثة مغلقة — أعد فتحها للرد' : 'This conversation is closed — reopen it to reply'}
        quickReplies={isAr ? QUICK_REPLIES_AR : QUICK_REPLIES_EN}
        placeholder={isAr ? 'اكتب رداً للعميل...' : 'Reply to the customer...'}
        className="min-h-0 flex-1"
        onSend={(payload) => onSendMessage?.(payload)}
      />
    </div>
  );
}
