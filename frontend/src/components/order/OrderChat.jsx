import { useState, useEffect, useRef, useCallback } from 'react';
import { Send } from 'lucide-react';
import Button from '../ui/Button';

const SYSTEM_TEXT = {
  ack: {
    ar: 'شكراً لتواصلك معنا — رسالتك هتتوصل لأحد موظفي الدعم.',
    en: 'Thank you for contacting us — your message will be delivered to an agent.',
  },
  auto_closed: {
    ar: 'تم إغلاق المحادثة لعدم الرد.',
    en: 'This chat was closed because there was no reply.',
  },
  joined: {
    ar: (name) => `أنت الآن تتحدث مع ${name}`,
    en: (name) => `You are now chatting with ${name}`,
  },
};

function systemLine(msg, isAr) {
  const entry = SYSTEM_TEXT[msg.systemKey];
  if (!entry) return msg.body;
  const value = isAr ? entry.ar : entry.en;
  return typeof value === 'function' ? value(msg.authorName || '') : value;
}

function MessageBubble({ msg, isAr, inbox }) {
  if (msg.authorRole === 'system') {
    return (
      <div className="flex w-full justify-center">
        <p className="max-w-[90%] rounded-full bg-slate-100 px-3 py-1.5 text-center text-xs font-medium text-text-muted">
          {systemLine(msg, isAr)}
        </p>
      </div>
    );
  }
  const isStaff = msg.authorRole === 'staff';
  const label = msg.authorName
    || (isStaff ? (isAr ? 'الفريق' : 'Support') : (isAr ? 'العميل' : 'Customer'));

  if (inbox) {
    return (
      <div
        className={[
          'flex w-full',
          isStaff ? 'justify-end' : 'justify-start',
        ].join(' ')}
      >
        <div
          className={[
            'max-w-[85%] rounded-2xl px-4 py-2.5 shadow-sm',
            isStaff
              ? 'rounded-be-sm bg-primary-600 text-white'
              : 'rounded-bs-sm border border-border bg-white text-text',
            msg.isInternal ? 'border-2 border-dashed border-amber-400 bg-amber-50 text-amber-950' : '',
          ].join(' ')}
        >
          <div className={[
            'mb-1 flex flex-wrap items-center gap-2 text-[11px] font-medium',
            isStaff && !msg.isInternal ? 'text-primary-100' : 'text-text-muted',
          ].join(' ')}
          >
            <span>{label}</span>
            {msg.isInternal && (
              <span className="rounded bg-amber-200 px-1.5 py-0.5 text-[10px] font-bold text-amber-900">
                {isAr ? 'داخلي' : 'Internal'}
              </span>
            )}
            <span className="opacity-80">
              {new Date(msg.createdAt).toLocaleString(isAr ? 'ar-EG' : 'en-GB', {
                hour: '2-digit',
                minute: '2-digit',
                day: 'numeric',
                month: 'short',
              })}
            </span>
          </div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.body}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={[
        'rounded-lg px-3 py-2 text-sm',
        isStaff ? 'ms-8 bg-primary-50 text-primary-900' : 'me-8 bg-slate-100 text-text',
        msg.isInternal ? 'border border-dashed border-amber-300 bg-amber-50' : '',
      ].join(' ')}
    >
      <div className="mb-0.5 flex items-center gap-2 text-xs text-text-muted">
        <span className="font-semibold">{label}</span>
        {msg.isInternal && (
          <span className="rounded bg-amber-200 px-1.5 py-0.5 text-[10px] font-bold text-amber-900">
            {isAr ? 'داخلي' : 'Internal'}
          </span>
        )}
        <span>
          {new Date(msg.createdAt).toLocaleString(isAr ? 'ar-EG' : 'en-GB', {
            dateStyle: 'short',
            timeStyle: 'short',
          })}
        </span>
      </div>
      <p className="whitespace-pre-wrap">{msg.body}</p>
    </div>
  );
}

export default function OrderChat({
  messages = [],
  isAr,
  onSend,
  sending,
  placeholder,
  showInternalToggle = false,
  variant = 'default',
  quickReplies = [],
  className = '',
  composerDisabled = false,
  composerDisabledMessage = '',
}) {
  const [text, setText] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const scrollRef = useRef(null);
  const inbox = variant === 'inbox';

  /** Scroll only inside the chat panel — never the whole page. */
  const scrollChatToBottom = useCallback((behavior = 'smooth') => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, left: 0, behavior });
  }, []);

  useEffect(() => {
    scrollChatToBottom(inbox ? 'smooth' : 'instant');
  }, [messages.length, messages[messages.length - 1]?._id, inbox, scrollChatToBottom]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setText('');
    try {
      await onSend({ body, isInternal: showInternalToggle ? isInternal : false });
    } catch {
      setText(body);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && inbox) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const rootClass = inbox
    ? `flex min-h-0 flex-1 flex-col bg-slate-50/80 ${className}`
    : `rounded-xl border border-border bg-white ${className}`;

  const scrollClass = inbox
    ? 'flex-1 space-y-3 overflow-y-auto px-4 py-4'
    : 'max-h-56 space-y-2 overflow-y-auto p-3';

  return (
    <div className={rootClass}>
      <div ref={scrollRef} className={scrollClass}>
        {messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-text-muted">
            {isAr ? 'لا توجد رسائل بعد — ابدأ المحادثة' : 'No messages yet — start the conversation'}
          </p>
        ) : (
          messages.map((msg, index) => (
            <MessageBubble
              key={msg._id || `${index}-${msg.createdAt}-${msg.body?.slice(0, 24)}`}
              msg={msg}
              isAr={isAr}
              inbox={inbox}
            />
          ))
        )}
      </div>

      {composerDisabled ? (
        <div className="shrink-0 border-t border-border bg-slate-50 px-4 py-3 text-center text-sm text-text-muted">
          {composerDisabledMessage || (isAr ? 'المحادثة غير متاحة للرد الآن' : 'This chat is not available for replies right now')}
        </div>
      ) : (
      <form
        onSubmit={handleSubmit}
        className={[
          'shrink-0 border-t border-border bg-white',
          inbox ? 'p-4' : 'flex flex-col gap-2 p-3',
        ].join(' ')}
      >
        {showInternalToggle && (
          <label className="mb-2 flex items-center gap-2 text-xs text-text-muted">
            <input
              type="checkbox"
              checked={isInternal}
              onChange={(e) => setIsInternal(e.target.checked)}
              className="rounded border-border text-primary-600"
            />
            {isAr ? 'ملاحظة داخلية (لا يراها العميل)' : 'Internal note (hidden from customer)'}
          </label>
        )}

        {inbox && quickReplies.length > 0 && !isInternal && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {quickReplies.map((reply) => (
              <button
                key={reply}
                type="button"
                disabled={sending}
                onClick={() => setText(reply)}
                className="rounded-full border border-border bg-slate-50 px-3 py-1 text-xs font-medium text-text-muted transition-colors hover:border-primary-300 hover:bg-primary-50 hover:text-primary-800"
              >
                {reply}
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          {inbox ? (
            <textarea
              rows={2}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder || (isAr ? 'اكتب رداً للعميل...' : 'Write a reply to the customer...')}
              className="min-h-[44px] min-w-0 flex-1 resize-none rounded-xl border border-border px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
          ) : (
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={placeholder || (isAr ? 'اكتب رسالة...' : 'Type a message...')}
              className="min-w-0 flex-1 rounded-lg border border-border px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
            />
          )}
          <Button
            type="submit"
            size="sm"
            disabled={sending || !text.trim()}
            className={inbox ? 'h-auto self-end px-4 py-2.5' : ''}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        {inbox && (
          <p className="mt-1.5 text-[10px] text-text-muted">
            {isAr ? 'Enter للإرسال · Shift+Enter سطر جديد' : 'Enter to send · Shift+Enter new line'}
          </p>
        )}
      </form>
      )}
    </div>
  );
}
