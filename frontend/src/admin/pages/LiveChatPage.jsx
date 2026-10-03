import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { adminApi } from '../adminApi';
import { useAdminListPage } from '../hooks/useAdminListPage';
import { useAdminStats } from '../context/AdminStatsContext';
import LiveChatSidebar from '../components/liveChat/LiveChatSidebar';
import LiveChatThreadPanel from '../components/liveChat/LiveChatThreadPanel';
import { useToast } from '../components';
import { scrollToTop } from '../../utils/scrollToTop';
import { useOrderChat } from '../../hooks/useOrderChat';
import { useAuth } from '../../context/AuthContext';
import { hasPermission } from '../adminPermissions';
import LiveChatAgentsPanel from '../components/liveChat/LiveChatAgentsPanel';
import LiveChatPerformancePanel from '../components/liveChat/LiveChatPerformancePanel';
import LiveChatSettingsPanel from '../components/liveChat/LiveChatSettingsPanel';

const LIST_POLL_MS = 8000;

export default function LiveChatPage() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const conversationFromUrl = searchParams.get('conversation');
  const { refreshStats } = useAdminStats();
  const { user } = useAuth();
  const [tab, setTab] = useState('chats');
  const canSettings = hasPermission(user, 'settings:write');
  const isSuperAdmin = user?.role === 'super_admin';

  const [selectedId, setSelectedId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [status, setStatus] = useState('active');
  const [dateRange, setDateRange] = useState({ dateFrom: '', dateTo: '' });
  const [mobileShowThread, setMobileShowThread] = useState(false);

  const list = useAdminListPage({
    fetchFn: (params) => adminApi.getLiveChats({
      ...params,
      status,
      ...(status === 'closed' ? dateRange : {}),
    }),
    pageSize: 30,
  });

  useEffect(() => {
    list.setPage(1);
    list.reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, dateRange]);

  const handleDateChange = (key, value) => setDateRange((prev) => ({ ...prev, [key]: value }));

  const unreadTotal = useMemo(
    () => list.data.reduce((sum, row) => sum + (row.unreadCustomerMessages || 0), 0),
    [list.data],
  );

  const loadDetail = useCallback(async (conversationId, { updateUrl = true } = {}) => {
    setDetailLoading(true);
    setMobileShowThread(true);
    try {
      const { data } = await adminApi.getLiveChatMessages(conversationId);
      setSelected(data.data);
      setSelectedId(conversationId);
      if (updateUrl) {
        setSearchParams({ conversation: conversationId }, { replace: true });
      }
      list.reload();
      refreshStats();
    } catch {
      setSelected(null);
      setSelectedId(null);
    } finally {
      setDetailLoading(false);
    }
  }, [refreshStats, list.reload, setSearchParams]);

  const handleSelect = (row) => {
    loadDetail(row._id);
    scrollToTop();
  };

  const handleBack = () => {
    setMobileShowThread(false);
    setSearchParams({}, { replace: true });
  };

  useEffect(() => {
    if (!conversationFromUrl) return;
    loadDetail(conversationFromUrl, { updateUrl: false });
  }, [conversationFromUrl, loadDetail]);

  const autoOpenedRef = useRef(false);
  useEffect(() => {
    if (autoOpenedRef.current || list.loading || !list.data.length || selectedId || conversationFromUrl) {
      return;
    }
    const firstUnread = list.data.find((r) => r.unreadCustomerMessages > 0);
    const target = firstUnread || list.data[0];
    if (target) {
      autoOpenedRef.current = true;
      loadDetail(target._id);
    }
  }, [list.loading, list.data, selectedId, conversationFromUrl, loadDetail]);

  useEffect(() => {
    if (!list.loadError) return;
    toast.error(list.loadError);
  }, [list.loadError, toast]);

  const fetchMessages = useCallback(async () => {
    if (!selectedId) return [];
    const { data } = await adminApi.getLiveChatMessages(selectedId);
    return data.data.messages;
  }, [selectedId]);

  const sendChatMessage = useCallback(async (payload) => {
    if (!selectedId) return [];
    const { data } = await adminApi.addLiveChatMessage(selectedId, payload);
    return data.data.messages;
  }, [selectedId]);

  const onChatMessagesChange = useCallback(() => {
    list.reload();
    refreshStats();
  }, [list.reload, refreshStats]);

  const {
    messages: chatMessages,
    sending: chatSending,
    send: sendThreadMessage,
  } = useOrderChat({
    orderId: selectedId,
    initialMessages: selected?.messages || [],
    fetchMessages,
    sendMessageFn: sendChatMessage,
    enabled: Boolean(selectedId) && !detailLoading,
    onMessagesChange: onChatMessagesChange,
  });

  useEffect(() => {
    if (!selectedId) return undefined;
    const timer = setInterval(() => {
      if (!document.hidden) list.reload();
    }, LIST_POLL_MS);
    return () => clearInterval(timer);
  }, [selectedId, list.reload]);

  const handleSendMessage = async (payload) => {
    if (!selectedId) return;
    try {
      await sendThreadMessage(payload);
    } catch (err) {
      toast.error(err.response?.data?.message || (isAr ? 'فشل الإرسال' : 'Send failed'));
    }
  };

  const updateConversation = async (patch) => {
    if (!selectedId) return;
    try {
      await adminApi.updateLiveChat(selectedId, patch);
      await loadDetail(selectedId, { updateUrl: false });
      list.reload();
      refreshStats();
    } catch (err) {
      toast.error(err.response?.data?.message || (isAr ? 'تعذر التحديث' : 'Update failed'));
    }
  };

  const threadConversation = selected
    ? { ...selected, messages: chatMessages }
    : null;

  return (
    <div className="flex h-[calc(100vh-7.5rem)] min-h-[560px] flex-col">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2 px-0.5">
        <div>
          <h1 className="text-xl font-bold text-text md:text-2xl">
            {isAr ? 'الدردشة المباشرة' : 'Live chat'}
          </h1>
          <p className="mt-0.5 text-sm text-text-muted">
            {isAr
              ? 'ردّ مباشرة على العملاء اللي بيطلبوا التحدث مع فريق الدعم من المساعد الذكي.'
              : 'Reply directly to customers who ask to talk to a person from the assistant widget.'}
          </p>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
        {[
          { id: 'chats', ar: 'المحادثات', en: 'Conversations' },
          { id: 'team', ar: 'الفريق وملفي', en: 'Team & my profile' },
          { id: 'performance', ar: 'الأداء والمستهدفات', en: 'Performance & targets' },
          ...(canSettings ? [{ id: 'settings', ar: 'الإعدادات', en: 'Settings' }] : []),
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={[
              'flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors',
              tab === t.id ? 'bg-white text-primary-700 shadow-sm' : 'text-text-muted hover:text-text',
            ].join(' ')}
          >
            {isAr ? t.ar : t.en}
          </button>
        ))}
      </div>

      {tab === 'team' && (
        <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-border bg-slate-50/50">
          <LiveChatAgentsPanel isAr={isAr} canManage={isSuperAdmin} />
        </div>
      )}
      {tab === 'performance' && (
        <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-border bg-slate-50/50">
          <LiveChatPerformancePanel isAr={isAr} />
        </div>
      )}
      {tab === 'settings' && canSettings && (
        <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-border bg-slate-50/50">
          <LiveChatSettingsPanel />
        </div>
      )}

      <div className={`min-h-0 flex-1 overflow-hidden rounded-2xl border border-border bg-white shadow-sm ${tab === 'chats' ? 'flex' : 'hidden'}`}>
        <LiveChatSidebar
          isAr={isAr}
          conversations={list.data}
          loading={list.loading}
          selectedId={selectedId}
          onSelect={handleSelect}
          q={list.q}
          onSearchChange={list.setQ}
          status={status}
          onStatusChange={setStatus}
          unreadTotal={unreadTotal}
          pagination={list.pagination}
          onPageChange={list.setPage}
          onRefresh={list.reload}
          refreshing={list.loading}
          dateFrom={dateRange.dateFrom}
          dateTo={dateRange.dateTo}
          onDateChange={handleDateChange}
          className={mobileShowThread ? 'hidden lg:flex' : 'flex'}
        />

        <div
          className={[
            'min-h-0 min-w-0 flex-1 flex-col',
            !mobileShowThread && !selectedId ? 'hidden lg:flex' : 'flex',
          ].join(' ')}
        >
          <LiveChatThreadPanel
            conversation={threadConversation}
            loading={detailLoading}
            isAr={isAr}
            updating={chatSending}
            onSendMessage={handleSendMessage}
            onClose={() => updateConversation({ status: 'closed' })}
            onReopen={() => updateConversation({ status: 'active' })}
            onReopenActive={() => updateConversation({ status: 'active' })}
            onMarkPending={() => updateConversation({ status: 'pending' })}
            onClaim={() => updateConversation({ claim: true })}
            onSelectHistory={(id) => loadDetail(id)}
            onBack={handleBack}
            showBack={Boolean(selectedId)}
          />
        </div>
      </div>
    </div>
  );
}
