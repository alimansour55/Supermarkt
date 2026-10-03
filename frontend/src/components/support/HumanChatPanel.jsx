import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, History, MessageCircle, Star } from 'lucide-react';
import OrderChat from '../order/OrderChat';
import Loader from '../ui/Loader';
import {
  getMySupportConversation,
  sendMySupportMessage,
  endMySupportConversation,
  getMySupportHistory,
  rateSupportConversation,
  keepMySupportConversationAlive,
} from '../../services/supportChatApi';
import { useOrderChat } from '../../hooks/useOrderChat';
import { useStoreSettings } from '../../context/StoreSettingsContext';
import { formatNextAvailable } from '../../utils/formatNextAvailable';

const LIVE_STATUSES = ['queued', 'active', 'pending', 'open'];

export default function HumanChatPanel({ isAr, whatsappUrl, onBack }) {
  const { settings } = useStoreSettings();
  const [conversationId, setConversationId] = useState(null);
  const [initialMessages, setInitialMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [status, setStatus] = useState(null);
  const [queuePosition, setQueuePosition] = useState(null);
  const [available, setAvailable] = useState(true);
  const [nextAvailableAt, setNextAvailableAt] = useState(null);
  const [ending, setEnding] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const hadLiveRef = useRef(false);
  const [idle, setIdle] = useState({ since: null, skew: 0 });
  const [idlePromptMinutes, setIdlePromptMinutes] = useState(0);
  const [ratingEnabled, setRatingEnabled] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const [agentName, setAgentName] = useState('');
  const [pendingRating, setPendingRating] = useState(null);
  const [stars, setStars] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [ratingBusy, setRatingBusy] = useState(false);
  const [view, setView] = useState('chat');
  const [history, setHistory] = useState(null);
  const [openHistoryId, setOpenHistoryId] = useState(null);

  const applyConversationInfo = useCallback((conversation) => {
    setAgentName(conversation.agentName || '');
    setIdle({
      since: conversation.idleSince ? new Date(conversation.idleSince).getTime() : null,
      skew: conversation.serverNow ? Date.now() - new Date(conversation.serverNow).getTime() : 0,
    });
    if (conversation.idlePromptMinutes !== undefined) setIdlePromptMinutes(conversation.idlePromptMinutes);
    if (conversation.ratingEnabled !== undefined) setRatingEnabled(conversation.ratingEnabled);
    const isLive = ['queued', 'active', 'pending', 'open'].includes(conversation.status);
    // Only offer a rating when a chat we watched live has just ended (e.g. staff closed it);
    // never for old closed chats found when the panel is merely opened.
    if (isLive) hadLiveRef.current = true;
    else if (hadLiveRef.current && conversation.pendingRating) {
      setPendingRating(conversation.pendingRating);
      hadLiveRef.current = false;
    }
    setStatus(conversation.status ?? null);
    setQueuePosition(conversation.queuePosition ?? null);
    setAvailable(conversation.available !== false);
    setNextAvailableAt(conversation.nextAvailableAt || null);
  }, []);

  const loadConversation = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const conversation = await getMySupportConversation();
      setConversationId(conversation._id);
      setInitialMessages(conversation.messages || []);
      applyConversationInfo(conversation);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [applyConversationInfo]);

  useEffect(() => {
    loadConversation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchMessages = useCallback(async () => {
    const conversation = await getMySupportConversation();
    const wasLive = hadLiveRef.current;
    applyConversationInfo(conversation);
    // The chat we were in just ended (staff or auto-close): keep showing its thread.
    if (wasLive && !LIVE_STATUSES.includes(conversation.status) && conversation.pendingRating?.messages) {
      setStatus('closed');
      return conversation.pendingRating.messages;
    }
    return conversation.messages || [];
  }, [applyConversationInfo]);

  const sendMessageFn = useCallback(async (payload) => {
    const result = await sendMySupportMessage(payload.body);
    applyConversationInfo(result);
    return result.messages || [];
  }, [applyConversationInfo]);

  const { messages, sending, send } = useOrderChat({
    orderId: conversationId,
    initialMessages,
    fetchMessages,
    sendMessageFn,
    enabled: Boolean(conversationId) && status !== 'closed',
  });

  const handleEndChat = async () => {
    setEnding(true);
    try {
      const result = await endMySupportConversation();
      setStatus('closed');
      setQueuePosition(null);
      if (result?._id && ratingEnabled) setPendingRating({ conversationId: result._id, agentName: result.agentName || agentName });
    } catch { /* best-effort */ } finally {
      setEnding(false);
      setConfirmEnd(false);
    }
  };

  const handleStartNew = () => {
    setInitialMessages([]);
    setPendingRating(null);
    loadConversation();
  };

  const submitRating = async () => {
    if (!stars || !pendingRating) return;
    setRatingBusy(true);
    try {
      await rateSupportConversation(pendingRating.conversationId, { score: stars, comment: ratingComment });
      setPendingRating(null);
      setStars(0);
      setRatingComment('');
      setHistory(null);
    } catch { /* keep the card so the customer can retry */ } finally {
      setRatingBusy(false);
    }
  };

  const openHistory = async () => {
    setView('history');
    setOpenHistoryId(null);
    if (history === null) {
      try {
        setHistory(await getMySupportHistory());
      } catch {
        setHistory([]);
      }
    }
  };

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);

  const showIdlePrompt = idlePromptMinutes > 0
    && idle.since != null
    && ['active', 'pending', 'open'].includes(status)
    && (now - idle.skew - idle.since) >= idlePromptMinutes * 60000;

  const continueChat = async () => {
    setIdle({ since: null, skew: 0 });
    try {
      await keepMySupportConversationAlive();
    } catch { /* the next poll re-syncs */ }
  };

  const BackIcon = isAr ? ArrowRight : ArrowLeft;
  const showEndChat = ['queued', 'active', 'pending'].includes(status);
  const offlineMessage = isAr ? settings?.liveChat?.offlineMessageAr : settings?.liveChat?.offlineMessageEn;
  const backAtText = formatNextAvailable(nextAvailableAt, isAr);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-slate-100 bg-white px-3 py-2.5">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
        >
          <BackIcon className="h-3.5 w-3.5" />
          {isAr ? 'رجوع للمساعد' : 'Back to assistant'}
        </button>
        <span className="flex-1 truncate text-center text-xs font-semibold text-text-muted">
          {isAr ? 'فريق الدعم' : 'Support team'}
        </span>
        <button
          type="button"
          onClick={() => (view === 'history' ? setView('chat') : openHistory())}
          className={`inline-flex shrink-0 items-center gap-1 rounded-xl border px-2.5 py-2 text-xs font-semibold transition ${
            view === 'history'
              ? 'border-primary-300 bg-primary-50 text-primary-800'
              : 'border-slate-200 bg-white text-text-muted hover:border-slate-300'
          }`}
          aria-label={isAr ? 'سجل المحادثات' : 'Chat history'}
        >
          <History className="h-3.5 w-3.5" />
          {isAr ? 'السجل' : 'History'}
        </button>
        {showEndChat && !confirmEnd && (
          <button
            type="button"
            onClick={() => setConfirmEnd(true)}
            className="inline-flex shrink-0 items-center rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-text-muted transition hover:border-red-200 hover:text-red-600"
          >
            {isAr ? 'إنهاء المحادثة' : 'End chat'}
          </button>
        )}
        {whatsappUrl && (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-emerald-600 px-2.5 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            WhatsApp
          </a>
        )}
      </div>

      {confirmEnd && (
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-amber-100 bg-amber-50 px-3 py-2 text-xs">
          <span className="font-semibold text-amber-900">
            {isAr ? 'هل تريد إنهاء المحادثة؟' : 'End this conversation?'}
          </span>
          <div className="flex shrink-0 gap-1.5">
            <button
              type="button"
              disabled={ending}
              onClick={handleEndChat}
              className="rounded-lg bg-red-600 px-2.5 py-1 font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
            >
              {isAr ? 'إنهاء' : 'End'}
            </button>
            <button
              type="button"
              disabled={ending}
              onClick={() => setConfirmEnd(false)}
              className="rounded-lg border border-amber-200 bg-white px-2.5 py-1 font-semibold text-amber-900 transition hover:bg-amber-100"
            >
              {isAr ? 'تراجع' : 'Cancel'}
            </button>
          </div>
        </div>
      )}

      {!loading && !loadError && available === false && (
        <div className="shrink-0 border-b border-slate-100 bg-slate-50 px-4 py-2.5 text-center text-xs text-text-muted">
          {offlineMessage || (isAr ? 'فريق الدعم غير متاح الآن' : "Our support team isn't available right now")}
          {backAtText && (
            <span className="block font-semibold text-text">
              {isAr ? `هنكون متاحين ${backAtText}` : `Back ${backAtText}`}
            </span>
          )}
        </div>
      )}

      {!loading && !loadError && available !== false && status === 'queued' && (
        <div className="shrink-0 border-b border-amber-100 bg-amber-50 px-4 py-2.5 text-center text-xs font-semibold text-amber-900">
          {isAr
            ? `أنت رقم ${queuePosition ?? '…'} في قائمة الانتظار — هيتواصل معاك حد قريب`
            : `You're #${queuePosition ?? '…'} in line — someone will be with you shortly`}
        </div>
      )}

      {view === 'chat' && !loading && !loadError && agentName && ['active', 'pending', 'open'].includes(status) && (
        <div className="shrink-0 border-b border-emerald-100 bg-emerald-50 px-4 py-2 text-center text-xs font-semibold text-emerald-900">
          {isAr ? `أنت تتحدث الآن مع ${agentName}` : `You are chatting with ${agentName}`}
        </div>
      )}

      {view === 'chat' && !loading && !loadError && status === 'closed' && (
        <div className="flex shrink-0 flex-col items-center gap-1.5 border-b border-slate-100 bg-slate-50 px-4 py-3 text-center">
          <p className="text-xs font-semibold text-text">
            {isAr ? 'انتهت هذه المحادثة' : 'This conversation has ended'}
          </p>
          <button
            type="button"
            onClick={handleStartNew}
            className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-primary-700"
          >
            {isAr ? 'بدء محادثة جديدة' : 'Start a new chat'}
          </button>
        </div>
      )}

      {view === 'history' ? (
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-slate-50/60 p-3">
          {history === null ? (
            <div className="flex justify-center py-10"><Loader size="md" /></div>
          ) : history.length === 0 ? (
            <p className="py-10 text-center text-sm text-text-muted">
              {isAr ? 'لا توجد محادثات سابقة' : 'No previous conversations yet'}
            </p>
          ) : history.map((item) => (
            <div key={item._id} className="rounded-xl border border-slate-200 bg-white">
              <button
                type="button"
                onClick={() => setOpenHistoryId(openHistoryId === item._id ? null : item._id)}
                className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-start"
              >
                <span className="min-w-0">
                  <span className="block text-xs font-bold text-text">
                    {item.closedAt ? new Date(item.closedAt).toLocaleString(isAr ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                  </span>
                  <span className="block truncate text-[11px] text-text-muted">
                    {item.agentName || (isAr ? 'فريق الدعم' : 'Support team')}
                    {' · '}
                    {item.messages.filter((m) => m.authorRole !== 'system').length} {isAr ? 'رسالة' : 'messages'}
                  </span>
                </span>
                {item.rating && (
                  <span className="flex shrink-0 items-center gap-0.5 text-xs font-bold text-amber-600">
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    {item.rating.score}
                  </span>
                )}
              </button>
              {openHistoryId === item._id && (
                <OrderChat
                  variant="default"
                  messages={item.messages}
                  isAr={isAr}
                  composerDisabled
                  composerDisabledMessage={isAr ? 'محادثة منتهية' : 'This conversation has ended'}
                  className="rounded-t-none border-x-0 border-b-0"
                />
              )}
            </div>
          ))}
        </div>
      ) : loading ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader size="md" />
        </div>
      ) : loadError ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
          <p className="text-sm font-semibold text-text">
            {isAr ? 'تعذر فتح المحادثة' : 'Could not open the chat'}
          </p>
          <p className="text-xs text-text-muted">
            {isAr ? 'جرّب مرة أخرى بعد قليل' : 'Please try again shortly'}
          </p>
        </div>
      ) : (
        <OrderChat
          variant="inbox"
          messages={messages}
          isAr={isAr}
          sending={sending}
          placeholder={isAr ? 'اكتب رسالتك لفريق الدعم...' : 'Message our support team...'}
          className="min-h-0 flex-1"
          onSend={send}
          composerDisabled={available === false || status === 'closed'}
          composerDisabledMessage={status === 'closed'
            ? (isAr ? 'ابدأ محادثة جديدة لإرسال رسالة' : 'Start a new chat to send a message')
            : undefined}
        />
      )}

      {view === 'chat' && !loading && !loadError && showIdlePrompt && (
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-sky-100 bg-sky-50 px-4 py-2.5">
          <span className="text-xs font-semibold text-sky-950">
            {isAr ? 'هل تريد إكمال المحادثة؟' : 'Do you want to continue the chat?'}
          </span>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={continueChat}
              className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white"
            >
              {isAr ? 'نعم، أكمل' : 'Yes, continue'}
            </button>
            <button
              type="button"
              onClick={handleEndChat}
              disabled={ending}
              className="rounded-lg border border-sky-200 bg-white px-3 py-1.5 text-xs font-semibold text-sky-900 disabled:opacity-60"
            >
              {isAr ? 'إنهاء' : 'End chat'}
            </button>
          </div>
        </div>
      )}

      {view === 'chat' && !loading && !loadError && ratingEnabled && pendingRating && (
        <div className="shrink-0 space-y-2 border-t border-amber-100 bg-amber-50/70 px-4 py-3 text-center">
          <p className="text-xs font-bold text-amber-950">
            {isAr ? 'شكراً لتواصلك معنا! قيّم المحادثة' : 'Thanks for contacting us! Rate this chat'}
            {pendingRating.agentName ? ` — ${pendingRating.agentName}` : ''}
          </p>
          <div className="flex justify-center gap-1" dir="ltr">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setStars(n)}
                aria-label={`${n}`}
                className="p-0.5"
              >
                <Star className={`h-6 w-6 ${n <= stars ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
              </button>
            ))}
          </div>
          <input
            type="text"
            value={ratingComment}
            maxLength={500}
            onChange={(e) => setRatingComment(e.target.value)}
            placeholder={isAr ? 'تعليق (اختياري)' : 'Comment (optional)'}
            className="w-full rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-200"
          />
          <div className="flex justify-center gap-2">
            <button
              type="button"
              disabled={!stars || ratingBusy}
              onClick={submitRating}
              className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              {isAr ? 'إرسال التقييم' : 'Submit rating'}
            </button>
            <button
              type="button"
              onClick={() => setPendingRating(null)}
              className="rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900"
            >
              {isAr ? 'لاحقاً' : 'Later'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
