import { useMemo, useState } from 'react';
import { AlertTriangle, ArchiveRestore, ArrowLeftCircle, Ban, ChevronDown, RefreshCw, Search, Trash2 } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { adminApi } from '../adminApi';
import { useAdminListPage } from '../hooks/useAdminListPage';
import { useConfirm, useToast } from '../components';
import { hasPermission } from '../adminPermissions';
import StatusBadge from '../components/StatusBadge';
import Pagination from '../components/Pagination';
import Loader from '../../components/ui/Loader';
import Button from '../../components/ui/Button';
import EmptyState from '../components/EmptyState';
import { formatOrderNumber, formatPrice, formatRelativeTime } from '../../utils/formatters';

const SECOND_BIN_RETENTION_DAYS = 30;
const RESET_CONFIRM_PHRASE = 'RESET';

function daysLeft(purgeAt) {
  if (!purgeAt) return null;
  const ms = new Date(purgeAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

function deletedByName(order, isAr) {
  const by = order.trash?.bin1By;
  if (!by) return '—';
  return by.name || by.email || (isAr ? 'مستخدم محذوف' : 'Deleted user');
}

function DangerZone({ isAr, toast, confirm, onReset }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [phrase, setPhrase] = useState('');
  const [resetting, setResetting] = useState(false);

  const loadStatus = async () => {
    setLoadingStatus(true);
    try {
      const { data } = await adminApi.getOrderResetStatus();
      setStatus(data);
    } catch (err) {
      toast.error(err.response?.data?.message || (isAr ? 'تعذّر تحميل الحالة' : 'Could not load status'));
    } finally {
      setLoadingStatus(false);
    }
  };

  const handleToggle = () => {
    const next = !open;
    setOpen(next);
    if (next) loadStatus();
  };

  const handleReset = async () => {
    const ok = await confirm({
      title: isAr ? 'حذف كل الطلبات نهائياً' : 'Permanently delete every order',
      message: isAr
        ? `سيتم حذف ${status?.totalOrders ?? 0} طلب نهائياً من الخادم — كأن المتجر لم يستقبل أي طلب من قبل. هذا الإجراء لا رجعة فيه.`
        : `${status?.totalOrders ?? 0} order${status?.totalOrders === 1 ? '' : 's'} will be permanently deleted from the server — as if the store had never received an order. This cannot be undone.`,
      confirmLabel: isAr ? 'حذف كل شيء' : 'Delete everything',
      variant: 'danger',
    });
    if (!ok) return;

    setResetting(true);
    try {
      const { data } = await adminApi.resetAllOrders(phrase);
      toast.success(
        isAr
          ? `تم حذف ${data.deletedCount} طلب نهائياً`
          : `${data.deletedCount} order${data.deletedCount === 1 ? '' : 's'} permanently deleted`,
      );
      setPhrase('');
      onReset();
      loadStatus();
    } catch (err) {
      toast.error(err.response?.data?.message || (isAr ? 'فشلت إعادة التعيين' : 'Reset failed'));
    } finally {
      setResetting(false);
    }
  };

  const canConfirmReset = status?.canReset && phrase.trim() === RESET_CONFIRM_PHRASE;

  return (
    <div className="rounded-2xl border border-red-200 bg-red-50/40">
      <button
        type="button"
        onClick={handleToggle}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-start"
      >
        <span className="flex items-center gap-2 text-sm font-bold text-red-800">
          <AlertTriangle className="h-4 w-4" />
          {isAr ? 'منطقة الخطر' : 'Danger Zone'}
        </span>
        <ChevronDown className={`h-4 w-4 text-red-600 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="space-y-3 border-t border-red-200 px-4 py-4">
          <div>
            <p className="text-sm font-semibold text-red-900">
              {isAr ? 'إعادة تعيين جميع الطلبات' : 'Reset all orders'}
            </p>
            <p className="mt-1 text-xs text-red-800/90">
              {isAr
                ? 'يحذف كل طلب نهائياً من الخادم — كأن المتجر لم يستقبل أي طلب من قبل. لا يمس نقاط الولاء أو أرصدة المحافظ أو استخدام الكوبونات أو المخزون.'
                : 'Permanently deletes every order from the server — as if the store had never received one. Loyalty points, wallet balances, coupon usage, and stock are left untouched.'}
            </p>
          </div>

          {loadingStatus ? (
            <Loader size="sm" />
          ) : status ? (
            status.totalOrders === 0 ? (
              <p className="text-xs font-semibold text-text-muted">
                {isAr ? 'لا توجد طلبات لحذفها.' : 'There are no orders to delete.'}
              </p>
            ) : status.activeOrders > 0 ? (
              <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
                {isAr
                  ? `تعذّر إعادة التعيين — ${status.activeOrders} طلب لا يزال نشطاً (قيد الانتظار أو التحضير أو التوصيل). أكمل هذه الطلبات أو ألغِها أولاً.`
                  : `Cannot reset — ${status.activeOrders} order${status.activeOrders === 1 ? ' is' : 's are'} still active (pending, preparing, or out for delivery). Complete or cancel them first.`}
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-text-muted">
                  {isAr
                    ? `سيتم حذف ${status.totalOrders} طلب نهائياً. اكتب ${RESET_CONFIRM_PHRASE} للتأكيد.`
                    : `This will permanently delete ${status.totalOrders} order${status.totalOrders === 1 ? '' : 's'}. Type ${RESET_CONFIRM_PHRASE} to confirm.`}
                </p>
                <div className="flex flex-wrap gap-2">
                  <input
                    type="text"
                    value={phrase}
                    onChange={(e) => setPhrase(e.target.value)}
                    placeholder={RESET_CONFIRM_PHRASE}
                    className="w-40 rounded-lg border border-red-300 px-2.5 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-500/30"
                  />
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={!canConfirmReset || resetting}
                    onClick={handleReset}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {isAr ? 'حذف كل الطلبات' : 'Reset all orders'}
                  </Button>
                </div>
              </div>
            )
          ) : null}
        </div>
      )}
    </div>
  );
}

export default function OrderTrashPage() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const toast = useToast();
  const confirm = useConfirm();
  const { user } = useAuth();
  const canReset = hasPermission(user, 'orders:reset');
  const [busyId, setBusyId] = useState(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  const list = useAdminListPage({
    fetchFn: (params) => adminApi.getOrderTrash(params),
    initialFilters: { stage: 'bin1' },
  });

  const stage = list.filters.stage;

  const switchTab = (nextStage) => {
    if (nextStage === stage) return;
    list.clearSelection();
    list.setFilter('stage', nextStage);
  };

  const reportBulkResult = (succeeded, failed, successMessage) => {
    if (succeeded.length) toast.success(successMessage(succeeded.length));
    if (failed.length) {
      toast.error(
        isAr
          ? `تعذّر تنفيذ الإجراء على ${failed.length} طلب`
          : `Could not process ${failed.length} order${failed.length === 1 ? '' : 's'}`,
      );
    }
  };

  const runAction = async (order, action) => {
    setBusyId(order._id);
    try {
      if (action === 'restore') {
        await adminApi.restoreOrder(order._id);
        toast.success(
          stage === 'bin2'
            ? (isAr ? 'تم إرجاع الطلب إلى السلة الأولى' : 'Order moved back to the first bin')
            : (isAr ? 'تم استرجاع الطلب' : 'Order restored'),
        );
      } else if (action === 'second') {
        await adminApi.trashOrderSecond(order._id);
        toast.success(
          isAr
            ? `تم نقله للسلة الثانية — سيُحذف نهائياً بعد ${SECOND_BIN_RETENTION_DAYS} يوماً`
            : `Moved to the second bin — permanently deleted after ${SECOND_BIN_RETENTION_DAYS} days`,
        );
      } else if (action === 'delete') {
        const ok = await confirm({
          title: isAr ? 'حذف الطلب نهائياً' : 'Delete order permanently',
          message: isAr
            ? `سيتم حذف الطلب #${formatOrderNumber(order.orderNumber)} نهائياً من الخادم ولا يمكن التراجع عن هذا الإجراء.`
            : `Order #${formatOrderNumber(order.orderNumber)} will be permanently deleted from the server. This cannot be undone.`,
          confirmLabel: isAr ? 'حذف نهائياً' : 'Delete forever',
          variant: 'danger',
        });
        if (!ok) {
          setBusyId(null);
          return;
        }
        await adminApi.deleteOrderForever(order._id);
        toast.success(isAr ? 'تم الحذف النهائي' : 'Permanently deleted');
      }
      list.reload();
    } catch (err) {
      toast.error(err.response?.data?.message || (isAr ? 'حدث خطأ' : 'Action failed'));
    } finally {
      setBusyId(null);
    }
  };

  const runBulkAction = async (action) => {
    const ids = [...list.selectedIds];
    if (!ids.length) return;

    if (action === 'delete') {
      const ok = await confirm({
        title: isAr ? 'حذف الطلبات نهائياً' : 'Delete orders permanently',
        message: isAr
          ? `سيتم حذف ${ids.length} طلب نهائياً من الخادم ولا يمكن التراجع عن هذا الإجراء.`
          : `${ids.length} order${ids.length === 1 ? '' : 's'} will be permanently deleted from the server. This cannot be undone.`,
        confirmLabel: isAr ? 'حذف نهائياً' : 'Delete forever',
        variant: 'danger',
      });
      if (!ok) return;
    }

    setBulkBusy(true);
    try {
      let succeeded = [];
      let failed = [];
      if (action === 'restore') {
        ({ succeeded, failed } = (await adminApi.bulkRestoreOrders(ids)).data);
        reportBulkResult(succeeded, failed, (n) => (
          stage === 'bin2'
            ? (isAr ? `تم إرجاع ${n} طلب إلى السلة الأولى` : `${n} order${n === 1 ? '' : 's'} moved back to the first bin`)
            : (isAr ? `تم استرجاع ${n} طلب` : `${n} order${n === 1 ? '' : 's'} restored`)
        ));
      } else if (action === 'second') {
        ({ succeeded, failed } = (await adminApi.bulkTrashOrdersSecond(ids)).data);
        reportBulkResult(succeeded, failed, (n) => (
          isAr ? `تم نقل ${n} طلب للسلة الثانية` : `${n} order${n === 1 ? '' : 's'} moved to the second bin`
        ));
      } else if (action === 'delete') {
        ({ succeeded, failed } = (await adminApi.bulkDeleteOrdersForever(ids)).data);
        reportBulkResult(succeeded, failed, (n) => (
          isAr ? `تم حذف ${n} طلب نهائياً` : `${n} order${n === 1 ? '' : 's'} permanently deleted`
        ));
      }
      list.clearSelection();
      list.reload();
    } catch (err) {
      toast.error(err.response?.data?.message || (isAr ? 'حدث خطأ' : 'Action failed'));
    } finally {
      setBulkBusy(false);
    }
  };

  const total = list.pagination?.total ?? 0;
  const selectedCount = list.selectedIds.length;

  const tabs = useMemo(
    () => [
      { id: 'bin1', labelAr: 'السلة الأولى', labelEn: 'Recycle Bin 1' },
      { id: 'bin2', labelAr: 'السلة الثانية', labelEn: 'Recycle Bin 2' },
    ],
    [],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-text">{isAr ? 'سلة المحذوفات' : 'Recycle Bin'}</h1>
          <p className="mt-1 text-sm text-text-muted">
            {isAr
              ? 'الطلبات المحذوفة تنتقل هنا أولاً، ثم للسلة الثانية عند نقلها يدوياً، وتُحذف نهائياً من الخادم تلقائياً بعد شهر من دخولها السلة الثانية — ولا يمكن استرجاعها بعد ذلك.'
              : 'Deleted orders land here first, then move to the second bin when you advance them. One month after entering the second bin they are permanently purged from the server — with no way to restore them after that.'}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={list.reload} disabled={list.loading}>
          <RefreshCw className={`h-4 w-4 ${list.loading ? 'animate-spin' : ''}`} />
          {isAr ? 'تحديث' : 'Refresh'}
        </Button>
      </div>

      <div className="flex gap-1 rounded-lg bg-slate-100 p-1 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => switchTab(tab.id)}
            className={[
              'rounded-md px-4 py-1.5 text-sm font-semibold transition-all',
              stage === tab.id ? 'bg-white text-primary-700 shadow-sm' : 'text-text-muted hover:text-text',
            ].join(' ')}
          >
            {isAr ? tab.labelAr : tab.labelEn}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input
            type="search"
            value={list.q}
            onChange={(e) => list.setQ(e.target.value)}
            placeholder={isAr ? 'بحث برقم الطلب أو الهاتف...' : 'Search order # or phone...'}
            className="w-full rounded-lg border border-border bg-white py-2 ps-9 pe-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          />
        </div>

        {selectedCount > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary-200 bg-primary-50 px-3 py-1.5">
            <span className="text-xs font-semibold text-primary-800">
              {isAr ? `${selectedCount} محدد` : `${selectedCount} selected`}
            </span>
            <Button size="sm" variant="secondary" disabled={bulkBusy} onClick={() => runBulkAction('restore')}>
              <ArchiveRestore className="h-3.5 w-3.5" />
              {stage === 'bin2' ? (isAr ? 'إرجاع للسلة الأولى' : 'Back to Bin 1') : (isAr ? 'استرجاع' : 'Restore')}
            </Button>
            {stage === 'bin1' && (
              <Button size="sm" variant="secondary" disabled={bulkBusy} onClick={() => runBulkAction('second')}>
                <Ban className="h-3.5 w-3.5" />
                {isAr ? 'نقل للسلة الثانية' : 'Move to Bin 2'}
              </Button>
            )}
            {stage === 'bin2' && (
              <Button size="sm" variant="danger" disabled={bulkBusy} onClick={() => runBulkAction('delete')}>
                <Trash2 className="h-3.5 w-3.5" />
                {isAr ? 'حذف نهائي' : 'Delete forever'}
              </Button>
            )}
            <button
              type="button"
              onClick={list.clearSelection}
              className="text-xs font-semibold text-text-muted hover:text-text"
            >
              {isAr ? 'إلغاء التحديد' : 'Clear'}
            </button>
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-border/80 bg-white shadow-sm">
        {list.loading ? (
          <div className="flex justify-center py-16">
            <Loader size="md" />
          </div>
        ) : list.data.length === 0 ? (
          <EmptyState
            icon={Trash2}
            title={isAr ? 'السلة فارغة' : 'Bin is empty'}
            description={
              stage === 'bin1'
                ? (isAr ? 'الطلبات المحذوفة من صفحة الطلبات ستظهر هنا' : 'Orders deleted from the Orders page show up here')
                : (isAr ? 'انقل طلبات من السلة الأولى لتظهر هنا' : 'Move orders from Bin 1 to see them here')
            }
            className="border-0 py-16"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-text-muted">
                <tr>
                  <th className="w-10 px-4 py-2.5">
                    <input
                      type="checkbox"
                      checked={list.allSelected}
                      onChange={list.toggleSelectAll}
                      className="h-4 w-4 rounded border-border"
                      aria-label={isAr ? 'تحديد الكل' : 'Select all'}
                    />
                  </th>
                  <th className="px-3 py-2.5 text-start">{isAr ? 'الطلب' : 'Order'}</th>
                  <th className="px-3 py-2.5 text-start">{isAr ? 'العميل' : 'Customer'}</th>
                  <th className="px-3 py-2.5 text-start">{isAr ? 'الحالة' : 'Status'}</th>
                  <th className="px-3 py-2.5 text-end">{isAr ? 'الإجمالي' : 'Total'}</th>
                  <th className="px-3 py-2.5 text-start">{isAr ? 'حذف بواسطة' : 'Deleted by'}</th>
                  <th className="px-3 py-2.5 text-start">
                    {stage === 'bin1' ? (isAr ? 'تاريخ الحذف' : 'Deleted') : (isAr ? 'الحذف النهائي بعد' : 'Purges in')}
                  </th>
                  <th className="px-4 py-2.5 text-end">{isAr ? 'إجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {list.data.map((order) => {
                  const busy = busyId === order._id;
                  const left = stage === 'bin2' ? daysLeft(order.trash?.purgeAt) : null;
                  const checked = list.selectedIds.includes(order._id);
                  return (
                    <tr key={order._id} className={`hover:bg-slate-50/60 ${checked ? 'bg-primary-50/40' : ''}`}>
                      <td className="px-4 py-2.5">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => list.toggleSelect(order._id)}
                          className="h-4 w-4 rounded border-border"
                          aria-label={isAr ? 'تحديد الطلب' : 'Select order'}
                        />
                      </td>
                      <td className="px-3 py-2.5 font-mono font-bold tabular-nums text-text" dir="ltr">
                        #{formatOrderNumber(order.orderNumber)}
                      </td>
                      <td className="px-3 py-2.5 text-text-muted">{order.user?.name || order.phone}</td>
                      <td className="px-3 py-2.5">
                        <StatusBadge status={order.orderStatus} language={language} compact variant="subtle" />
                      </td>
                      <td className="px-3 py-2.5 text-end tabular-nums font-medium text-text">{formatPrice(order.total)}</td>
                      <td className="px-3 py-2.5 text-text-muted">{deletedByName(order, isAr)}</td>
                      <td className="px-3 py-2.5 text-text-muted">
                        {stage === 'bin1'
                          ? formatRelativeTime(order.trash?.bin1At, isAr)
                          : (
                            <span className={left <= 3 ? 'font-semibold text-red-600' : ''}>
                              {isAr ? `${left} يوم` : `${left} day${left === 1 ? '' : 's'}`}
                            </span>
                          )}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={busy}
                            onClick={() => runAction(order, 'restore')}
                            title={stage === 'bin2' ? (isAr ? 'إرجاع للسلة الأولى' : 'Move back to Bin 1') : (isAr ? 'استرجاع' : 'Restore')}
                          >
                            {stage === 'bin2' ? <ArrowLeftCircle className="h-3.5 w-3.5" /> : <ArchiveRestore className="h-3.5 w-3.5" />}
                            {stage === 'bin2' ? (isAr ? 'السلة الأولى' : 'To Bin 1') : (isAr ? 'استرجاع' : 'Restore')}
                          </Button>
                          {stage === 'bin1' && (
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={busy}
                              onClick={() => runAction(order, 'second')}
                              title={isAr ? 'نقل للسلة الثانية' : 'Move to Bin 2'}
                            >
                              <Ban className="h-3.5 w-3.5" />
                              {isAr ? 'السلة الثانية' : 'To Bin 2'}
                            </Button>
                          )}
                          {stage === 'bin2' && (
                            <Button
                              size="sm"
                              variant="danger"
                              disabled={busy}
                              onClick={() => runAction(order, 'delete')}
                              title={isAr ? 'حذف نهائي' : 'Delete forever'}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!list.loading && total > 0 && list.pagination.pages > 1 && (
          <Pagination
            page={list.pagination.page}
            pages={list.pagination.pages}
            total={list.pagination.total}
            limit={list.pagination.limit}
            onPageChange={list.setPage}
            isAr={isAr}
            className="rounded-none border-x-0 border-b-0"
          />
        )}
      </div>

      {canReset && (
        <DangerZone isAr={isAr} toast={toast} confirm={confirm} onReset={list.reload} />
      )}
    </div>
  );
}
