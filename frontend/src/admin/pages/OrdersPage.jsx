import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from '../../app/router';
import { MessageCircle, Package, ShoppingCart } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { adminApi } from '../adminApi';
import { useAdminListPage } from '../hooks/useAdminListPage';
import { downloadBlob } from '../utils/downloadBlob';
import OrderDetailPanel from '../components/OrderDetailPanel';
import OrdersListPanel from '../components/orders/OrdersListPanel';
import { useAdminStats } from '../context/AdminStatsContext';
import { useConfirm, useToast } from '../components';
import { scrollToTop } from '../../utils/scrollToTop';
import { useOrderChat } from '../../hooks/useOrderChat';
import { TRASHABLE_STATUSES } from '../../constants/orderFlow';
import { ORDER_STATUSES } from '../adminConstants';
import OrderNumberChip from '../components/OrderNumberChip';
import { hasPermission } from '../adminPermissions';
import { useAuth } from '../../context/AuthContext';

const INITIAL_FILTERS = {
  orderStatus: '',
  paymentStatus: '',
  dateFrom: '',
  dateTo: '',
};

export default function OrdersPage() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const toast = useToast();
  const confirm = useConfirm();
  const { user } = useAuth();
  const canBulkDelete = hasPermission(user, 'orders:delete');
  const [searchParams, setSearchParams] = useSearchParams();
  const orderFromUrl = searchParams.get('order');
  const statusFromUrl = searchParams.get('status');
  const [selectedId, setSelectedId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [drivers, setDrivers] = useState([]);
  const [highlightChat, setHighlightChat] = useState(false);
  const [mobileShowDetail, setMobileShowDetail] = useState(false);
  const [bulkTrashing, setBulkTrashing] = useState(false);

  const refreshDrivers = useCallback(() => {
    adminApi.getDeliveryStaff()
      .then(({ data }) => setDrivers(data.data || []))
      .catch(() => setDrivers([]));
  }, []);

  useEffect(() => {
    refreshDrivers();
  }, [refreshDrivers]);

  const {
    pendingOrdersCount,
    ordersUnreadMessagesCount,
    refreshStats,
  } = useAdminStats();

  const validStatusFromUrl = ORDER_STATUSES.some((s) => s.value === statusFromUrl) ? statusFromUrl : '';

  const list = useAdminListPage({
    fetchFn: (params) => adminApi.getOrders(params),
    initialFilters: validStatusFromUrl
      ? { ...INITIAL_FILTERS, orderStatus: validStatusFromUrl }
      : INITIAL_FILTERS,
  });

  const loadDetail = useCallback(async (orderId, { updateUrl = true } = {}) => {
    setDetailLoading(true);
    setHighlightChat(false);
    setMobileShowDetail(true);
    try {
      const { data } = await adminApi.getOrder(orderId);
      setSelected(data.order);
      setSelectedId(orderId);
      const hadUnread = Boolean(data.hadUnreadCustomerMessages);
      setHighlightChat(hadUnread);
      if (updateUrl) {
        setSearchParams({ order: orderId }, { replace: true });
      }
      // Opening an order only mutates server state when it clears unread
      // customer messages — skip the list/stats refetch otherwise so the
      // list doesn't flash on every click.
      if (hadUnread) {
        list.reload();
        refreshStats();
      }
    } catch {
      setSelected(null);
      setSelectedId(null);
      setHighlightChat(false);
    } finally {
      setDetailLoading(false);
    }
  }, [refreshStats, list.reload, setSearchParams]);

  const handleSelectOrder = (order) => {
    loadDetail(order._id);
    scrollToTop();
  };

  const handleBack = () => {
    setMobileShowDetail(false);
    setSearchParams({}, { replace: true });
  };

  useEffect(() => {
    if (!orderFromUrl) return;
    loadDetail(orderFromUrl, { updateUrl: false });
  }, [orderFromUrl, loadDetail]);

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
    refreshStats();
  }, [refreshStats]);

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

  const detailOrder = selected
    ? { ...selected, messages: chatMessages }
    : null;

  const patchOrder = async (fields) => {
    if (!selectedId) return;
    setUpdating(true);
    try {
      const { data } = await adminApi.updateOrderStatus(selectedId, fields);
      setSelected(data.order);
      list.reload();
      refreshStats();
      if (fields.orderStatus === 'delivery_failed') {
        toast.success(isAr ? 'تم تسجيل فشل التسليم' : 'Delivery failure recorded');
      } else if (fields.orderStatus) {
        toast.success(isAr ? 'تم تحديث الحالة' : 'Status updated');
      } else if (fields.adminNotes !== undefined) {
        toast.success(isAr ? 'تم حفظ الملاحظات' : 'Notes saved');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || (isAr ? 'حدث خطأ' : 'Update failed'));
    } finally {
      setUpdating(false);
    }
  };

  const handleOrderAction = async (action, payload = {}) => {
    if (!selectedId) return;
    setUpdating(true);
    try {
      let data;
      switch (action) {
        case 'cancel':
          ({ data } = await adminApi.cancelOrder(selectedId, payload));
          toast.success(isAr ? 'تم إلغاء الطلب' : 'Order cancelled');
          break;
        case 'refund':
          ({ data } = await adminApi.refundOrder(selectedId, payload));
          toast.success(isAr ? 'تم الاسترداد' : 'Refund processed');
          break;
        case 'substitution':
          ({ data } = await adminApi.suggestSubstitution(selectedId, payload));
          toast.success(isAr ? 'تم إرسال اقتراح البديل' : 'Substitution suggested');
          break;
        case 'assignDriver': {
          const prevStatus = selected?.orderStatus;
          ({ data } = await adminApi.assignDriver(selectedId, payload));
          const newStatus = data.order?.orderStatus;
          if (newStatus === 'out_for_delivery' && prevStatus !== 'out_for_delivery') {
            toast.success(
              isAr
                ? 'تم تعيين المندوب — الطلب الآن «في الطريق»'
                : 'Driver assigned — order is now out for delivery',
            );
          } else {
            toast.success(isAr ? 'تم تعيين المندوب' : 'Driver assigned');
          }
          refreshDrivers();
          break;
        }
        case 'message':
          await sendThreadMessage(payload);
          toast.success(isAr ? 'تم إرسال الرسالة' : 'Message sent');
          list.reload();
          refreshStats();
          setUpdating(false);
          return;
        case 'return':
          ({ data } = await adminApi.requestOrderReturn(selectedId, payload));
          toast.success(isAr ? 'تم تسجيل الإرجاع' : 'Return recorded');
          break;
        case 'reviewReturn': {
          const rejectNote = (payload.adminNote || '').trim();
          if (payload.action === 'reject' && rejectNote.length < 5) {
            toast.error(
              isAr
                ? 'يرجى كتابة سبب الرفض أو اختيار أحد الأسباب المقترحة'
                : 'Please enter a rejection reason or pick a suggested reason',
            );
            setUpdating(false);
            return;
          }
          ({ data } = await adminApi.reviewReturn(selectedId, payload.returnId, {
            action: payload.action,
            adminNote: rejectNote,
          }));
          if (payload.action === 'approve') {
            toast.success(isAr ? 'تمت الموافقة — يمكنك متابعة مراحل الاسترجاع' : 'Return approved — continue return steps');
          } else if (payload.action === 'reopen') {
            toast.success(isAr ? 'تم إعادة الطلب للمراجعة' : 'Sent back to pending review');
          } else if (payload.action === 'reject' && payload.fromRejected) {
            toast.success(isAr ? 'تم تحديث سبب الرفض' : 'Rejection reason updated');
          } else {
            toast.success(isAr ? 'تم رفض الإرجاع' : 'Return rejected');
          }
          break;
        }
        case 'returnFulfillment':
          ({ data } = await adminApi.updateReturnFulfillment(
            selectedId,
            payload.returnId,
            payload.fulfillmentStatus,
          ));
          toast.success(
            payload.fulfillmentStatus === 'completed'
              ? (isAr ? 'تم الاسترجاع — تم تحديث حالة الطلب' : 'Returned — order status synced')
              : (isAr ? 'تم تحديث مرحلة الاسترجاع' : 'Return stage updated'),
          );
          break;
        case 'invoice': {
          const res = await adminApi.downloadInvoice(selectedId, isAr ? 'ar' : 'en');
          downloadBlob(res.data, `invoice-${selected?.orderNumber || selectedId}.pdf`);
          setUpdating(false);
          return;
        }
        case 'trash': {
          const ok = await confirm({
            title: isAr ? 'نقل الطلب لسلة المحذوفات' : 'Move order to the recycle bin',
            message: isAr
              ? `سيتم نقل الطلب #${selected?.orderNumber} إلى سلة المحذوفات. يمكن استرجاعه من هناك.`
              : `Order #${selected?.orderNumber} will move to the recycle bin. It can be restored from there.`,
            confirmLabel: isAr ? 'نقل' : 'Move',
            variant: 'danger',
          });
          if (!ok) {
            setUpdating(false);
            return;
          }
          await adminApi.trashOrder(selectedId);
          toast.success(isAr ? 'تم نقل الطلب لسلة المحذوفات' : 'Order moved to the recycle bin');
          setSelected(null);
          setSelectedId(null);
          setSearchParams({}, { replace: true });
          list.reload();
          refreshStats();
          setUpdating(false);
          return;
        }
        default:
          return;
      }
      setSelected(data.order);
      list.reload();
      refreshStats();
    } catch (err) {
      toast.error(err.response?.data?.message || (isAr ? 'حدث خطأ' : 'Action failed'));
    } finally {
      setUpdating(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const { data } = await adminApi.exportOrders(list.queryParams);
      downloadBlob(data, 'orders.csv');
    } catch {
      toast.error(isAr ? 'فشل التصدير' : 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const handleClearFilters = () => {
    Object.entries(INITIAL_FILTERS).forEach(([key, value]) => {
      list.setFilter(key, value);
    });
  };

  const trashablePageIds = useMemo(
    () => list.data.filter((o) => TRASHABLE_STATUSES.includes(o.orderStatus)).map((o) => o._id),
    [list.data],
  );

  const handleToggleCheckAll = () => {
    const allChecked = trashablePageIds.length > 0 && trashablePageIds.every((id) => list.selectedIds.includes(id));
    trashablePageIds.forEach((id) => {
      const isSelected = list.selectedIds.includes(id);
      if (allChecked ? isSelected : !isSelected) {
        list.toggleSelect(id);
      }
    });
  };

  const handleBulkTrash = async () => {
    const ids = [...list.selectedIds];
    if (!ids.length) return;
    const ok = await confirm({
      title: isAr ? 'نقل الطلبات لسلة المحذوفات' : 'Move orders to the recycle bin',
      message: isAr
        ? `سيتم نقل ${ids.length} طلب إلى سلة المحذوفات. يمكن استرجاعها من هناك.`
        : `${ids.length} order${ids.length === 1 ? '' : 's'} will move to the recycle bin. They can be restored from there.`,
      confirmLabel: isAr ? 'نقل' : 'Move',
      variant: 'danger',
    });
    if (!ok) return;

    setBulkTrashing(true);
    try {
      const { data } = await adminApi.bulkTrashOrders(ids);
      if (data.succeeded.length) {
        toast.success(
          isAr
            ? `تم نقل ${data.succeeded.length} طلب لسلة المحذوفات`
            : `${data.succeeded.length} order${data.succeeded.length === 1 ? '' : 's'} moved to the recycle bin`,
        );
      }
      if (data.failed.length) {
        toast.error(
          isAr
            ? `تعذّر نقل ${data.failed.length} طلب`
            : `Could not move ${data.failed.length} order${data.failed.length === 1 ? '' : 's'}`,
        );
      }
      list.clearSelection();
      if (data.succeeded.includes(selectedId)) {
        setSelected(null);
        setSelectedId(null);
        setSearchParams({}, { replace: true });
      }
      list.reload();
      refreshStats();
    } catch (err) {
      toast.error(err.response?.data?.message || (isAr ? 'حدث خطأ' : 'Action failed'));
    } finally {
      setBulkTrashing(false);
    }
  };

  const ordersTotal = list.pagination?.total ?? 0;
  const hasQueryOrFilters = Boolean(list.q) || Object.values(list.filters).some(Boolean);
  const noOrdersAtAll = !list.loading && ordersTotal === 0 && !hasQueryOrFilters;

  return (
    <div className="flex h-[calc(100vh-7.5rem)] min-h-[560px] flex-col">
      {(pendingOrdersCount > 0 || ordersUnreadMessagesCount > 0) && (
        <div className="mb-3 flex flex-wrap gap-2">
          {pendingOrdersCount > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200/80 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
              {pendingOrdersCount}
              {' '}
              {isAr ? 'بانتظار المعالجة' : 'awaiting action'}
            </span>
          )}
          {ordersUnreadMessagesCount > 0 && (
            <Link
              to="/admin/order-chats"
              className="inline-flex items-center gap-1.5 rounded-full border border-rose-200/80 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-800 transition-colors hover:bg-rose-100"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              {ordersUnreadMessagesCount}
              {' '}
              {isAr ? 'رسالة جديدة' : 'new messages'}
            </Link>
          )}
        </div>
      )}

      <div className="flex min-h-0 flex-1 overflow-hidden rounded-2xl border border-border/80 bg-white shadow-sm">
        <OrdersListPanel
          isAr={isAr}
          language={language}
          orders={list.data}
          loading={list.loading}
          selectedId={selectedId}
          onSelect={handleSelectOrder}
          q={list.q}
          onSearchChange={list.setQ}
          filters={list.filters}
          onFilterChange={list.setFilter}
          onClearFilters={handleClearFilters}
          pagination={list.pagination}
          onPageChange={list.setPage}
          onRefresh={list.reload}
          onExport={handleExport}
          exporting={exporting}
          className={mobileShowDetail ? 'hidden lg:flex' : 'flex'}
          canBulkDelete={canBulkDelete}
          checkedIds={list.selectedIds}
          onToggleCheck={list.toggleSelect}
          onToggleCheckAll={handleToggleCheckAll}
          onBulkTrash={handleBulkTrash}
          bulkTrashing={bulkTrashing}
        />

        <div
          className={[
            'min-h-0 min-w-0 flex-1 flex-col overflow-y-auto bg-slate-50/60',
            !mobileShowDetail && !selectedId ? 'hidden lg:flex' : 'flex',
          ].join(' ')}
        >
          {selectedId && (
            <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
              <button
                type="button"
                onClick={handleBack}
                className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold text-text-muted hover:bg-slate-50"
              >
                {isAr ? '← القائمة' : '← List'}
              </button>
              {selected?.orderNumber && (
                <OrderNumberChip orderNumber={selected.orderNumber} size="sm" short />
              )}
            </div>
          )}

          <div className="flex-1 p-4 lg:p-5">
            {!selected && !detailLoading ? (
              <div className="flex h-full min-h-[360px] flex-col items-center justify-center px-6 py-12 text-center">
                <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-50 text-primary-600 ring-1 ring-inset ring-primary-100">
                  <Package className="h-8 w-8" strokeWidth={1.5} />
                </div>
                <h3 className="text-lg font-bold text-text">
                  {noOrdersAtAll
                    ? (isAr ? 'لا توجد طلبات بعد' : 'No orders yet')
                    : (isAr ? 'اختر طلباً من القائمة' : 'Select an order')}
                </h3>
                <p className="mt-2 max-w-md text-sm leading-relaxed text-text-muted">
                  {noOrdersAtAll
                    ? (isAr
                      ? 'ستظهر الطلبات الجديدة هنا فور استلامها، ويمكنك حينها إدارة الحالة والدفع والمحادثة والمرتجعات.'
                      : 'New orders show up here the moment they come in — you can then manage status, payment, chat, and returns.')
                    : (isAr
                      ? 'انقر على أي طلب لعرض التفاصيل وتحديث الحالة والدفع والمحادثة والمرتجعات.'
                      : 'Click any order to view details and manage status, payment, chat, and returns.')}
                </p>
                {!noOrdersAtAll && (
                  <div className="mt-8 grid max-w-sm grid-cols-3 gap-3 text-center">
                    {[
                      { icon: ShoppingCart, labelAr: 'تحديث الحالة', labelEn: 'Update status' },
                      { icon: MessageCircle, labelAr: 'المحادثة', labelEn: 'Chat' },
                      { icon: Package, labelAr: 'المرتجعات', labelEn: 'Returns' },
                    ].map(({ icon: Icon, labelAr, labelEn }) => (
                      <div key={labelEn} className="rounded-xl bg-white px-3 py-3 shadow-sm ring-1 ring-border/60">
                        <Icon className="mx-auto h-5 w-5 text-primary-600" strokeWidth={1.5} />
                        <p className="mt-1.5 text-[11px] font-medium text-text-muted">
                          {isAr ? labelAr : labelEn}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="mx-auto w-full max-w-4xl">
                <OrderDetailPanel
                  order={detailOrder}
                  loading={detailLoading}
                  isAr={isAr}
                  updating={updating || chatSending}
                  drivers={drivers}
                  highlightChat={highlightChat}
                  onDismissChatHighlight={() => setHighlightChat(false)}
                  onPatch={patchOrder}
                  onAction={handleOrderAction}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
