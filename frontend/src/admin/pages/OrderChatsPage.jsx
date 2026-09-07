import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { adminApi } from '../adminApi';
import { useAdminListPage } from '../hooks/useAdminListPage';
import { useAdminStats } from '../context/AdminStatsContext';
import OrderChatsSidebar from '../components/orderChat/OrderChatsSidebar';
import OrderChatThreadPanel from '../components/orderChat/OrderChatThreadPanel';
import { useToast } from '../components';
import { scrollToTop } from '../../utils/scrollToTop';
import { useOrderChat } from '../../hooks/useOrderChat';

const LIST_POLL_MS = 8000;

export default function OrderChatsPage() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const orderFromUrl = searchParams.get('order');
  const { refreshStats } = useAdminStats();

  const [selectedId, setSelectedId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [highlightChat, setHighlightChat] = useState(false);
  const [filter, setFilter] = useState('all');
  const [mobileShowThread, setMobileShowThread] = useState(false);

  const unreadOnly = filter === 'unread';

  const list = useAdminListPage({
    fetchFn: (params) => adminApi.getOrderChats({
      ...params,
      unreadOnly: unreadOnly ? '1' : '',
    }),
    pageSize: 30,
  });

  useEffect(() => {
    list.setPage(1);
    list.reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const unreadTotal = useMemo(
    () => list.data.reduce((sum, row) => sum + (row.unreadCustomerMessages || 0), 0),
    [list.data],
  );

  const loadDetail = useCallback(async (orderId, { updateUrl = true } = {}) => {
    setDetailLoading(true);
    setHighlightChat(false);
    setMobileShowThread(true);
    try {
      const { data } = await adminApi.getOrder(orderId);
      setSelected(data.order);
      setSelectedId(orderId);
      setHighlightChat(Boolean(data.hadUnreadCustomerMessages));
      if (updateUrl) {
        setSearchParams({ order: orderId }, { replace: true });
      }
      list.reload();
      refreshStats();
    } catch {
      setSelected(null);
      setSelectedId(null);
      setHighlightChat(false);
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
    if (!orderFromUrl) return;
    loadDetail(orderFromUrl, { updateUrl: false });
  }, [orderFromUrl, loadDetail]);

  const autoOpenedRef = useRef(false);
  useEffect(() => {
    if (autoOpenedRef.current || list.loading || !list.data.length || selectedId || orderFromUrl) {
      return;
    }
    const firstUnread = list.data.find((r) => r.unreadCustomerMessages > 0);
    const target = firstUnread || list.data[0];
    if (target) {
      autoOpenedRef.current = true;
      loadDetail(target._id);
    }
  }, [list.loading, list.data, selectedId, orderFromUrl, loadDetail]);

  useEffect(() => {
    if (!list.loadError) return;
    toast.error(list.loadError);
  }, [list.loadError, toast]);

  const fetchMessages = useCallback(async () => {
    if (!selectedId) return [];
    const { data } = await adminApi.getOrderMessages(selectedId);
    return data.messages;
  }, [selectedId]);

  const sendChatMessage = useCallback(async (payload) => {
    if (!selectedId) return [];
    const { data } = await adminApi.addOrderMessage(selectedId, payload);
    return data.order.messages;
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
    setHighlightChat(false);
    try {
      await sendThreadMessage(payload);
    } catch (err) {
      toast.error(err.response?.data?.message || (isAr ? 'فشل الإرسال' : 'Send failed'));
    }
  };

  const threadOrder = selected
    ? { ...selected, messages: chatMessages }
    : null;

  return (
    <div className="flex h-[calc(100vh-7.5rem)] min-h-[560px] flex-col">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2 px-0.5">
        <div>
          <h1 className="text-xl font-bold text-text md:text-2xl">
            {isAr ? 'محادثة الطلبات' : 'Order chats'}
          </h1>
          <p className="mt-0.5 text-sm text-text-muted">
            {isAr
              ? 'ردّ سريع على العملاء — محادثة، حالة الطلب، والمرتجعات في مكان واحد.'
              : 'Reply quickly — chat, order status, and returns in one place.'}
          </p>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
        <OrderChatsSidebar
          isAr={isAr}
          conversations={list.data}
          loading={list.loading}
          selectedId={selectedId}
          onSelect={handleSelect}
          q={list.q}
          onSearchChange={list.setQ}
          filter={filter}
          onFilterChange={setFilter}
          unreadTotal={unreadTotal}
          pagination={list.pagination}
          onPageChange={list.setPage}
          onRefresh={list.reload}
          refreshing={list.loading}
          className={mobileShowThread ? 'hidden lg:flex' : 'flex'}
        />

        <div
          className={[
            'min-h-0 min-w-0 flex-1 flex-col',
            !mobileShowThread && !selectedId ? 'hidden lg:flex' : 'flex',
          ].join(' ')}
        >
          <OrderChatThreadPanel
              order={threadOrder}
              loading={detailLoading}
              isAr={isAr}
              updating={chatSending}
              highlightChat={highlightChat}
              onDismissChatHighlight={() => setHighlightChat(false)}
              onSendMessage={handleSendMessage}
              onBack={handleBack}
              showBack={Boolean(selectedId)}
            />
        </div>
      </div>
    </div>
  );
}
