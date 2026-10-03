import {
  Calendar,
  ChevronDown,
  Download,
  MessageCircle,
  RefreshCw,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { ORDER_STATUSES, PAYMENT_STATUSES } from '../../adminConstants';
import StatusBadge from '../StatusBadge';
import PaymentStatusBadge from '../PaymentStatusBadge';
import { ListFilterSelect } from '../list';
import Pagination from '../Pagination';
import Loader from '../../../components/ui/Loader';
import Button from '../../../components/ui/Button';
import OrderNumberChip from '../OrderNumberChip';
import { formatCount, formatPrice, formatRelativeTime } from '../../../utils/formatters';
import { TRASHABLE_STATUSES } from '../../../constants/orderFlow';

const QUICK_TABS = [
  { id: '', labelAr: 'الكل', labelEn: 'All' },
  { id: 'pending', labelAr: 'جديد', labelEn: 'New' },
  { id: 'preparing', labelAr: 'تحضير', labelEn: 'Preparing' },
  { id: 'out_for_delivery', labelAr: 'في الطريق', labelEn: 'On the way' },
  { id: 'delivered', labelAr: 'مُسلّم', labelEn: 'Delivered' },
];

function hasActiveFilters(filters) {
  return Boolean(
    filters.orderStatus
    || filters.paymentStatus
    || filters.dateFrom
    || filters.dateTo,
  );
}

function OrderRow({ order, isAr, language, selected, onSelect, canSelect, checked, onToggleCheck }) {
  const hasUnread = order.unreadCustomerMessages > 0;
  const customer = order.user?.name || order.phone || (isAr ? 'عميل' : 'Customer');

  return (
    <div
      className={[
        'group relative flex w-full items-start gap-2 px-4 py-2.5 text-start transition-all duration-150',
        selected
          ? 'border-s-2 border-s-primary-600 bg-white'
          : 'hover:bg-white/70',
        !selected && hasUnread ? 'bg-rose-50/25 hover:bg-rose-50/40' : '',
      ].join(' ')}
    >
      {canSelect && (
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => {
            e.stopPropagation();
            onToggleCheck(order._id);
          }}
          onClick={(e) => e.stopPropagation()}
          className="mt-1 h-4 w-4 shrink-0 rounded border-border"
          aria-label={isAr ? 'تحديد الطلب' : 'Select order'}
        />
      )}
      <button type="button" onClick={() => onSelect(order)} className="min-w-0 flex-1 text-start">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <OrderNumberChip orderNumber={order.orderNumber} size="sm" short />
              {hasUnread && (
                <span className="inline-flex h-5 min-w-5 items-center justify-center gap-0.5 rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">
                  <MessageCircle className="h-2.5 w-2.5" aria-hidden />
                  {order.unreadCustomerMessages}
                </span>
              )}
            </div>
            <p className="mt-0.5 truncate text-xs text-text-muted">{customer}</p>
          </div>
          <div className="shrink-0 text-end">
            <p className="text-sm font-bold tabular-nums text-text">{formatPrice(order.total)}</p>
            {order.createdAt && (
              <p className="mt-0.5 text-[11px] text-text-muted">
                {formatRelativeTime(order.createdAt, isAr)}
              </p>
            )}
          </div>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          <StatusBadge status={order.orderStatus || order.status} language={language} compact variant="subtle" />
          <PaymentStatusBadge status={order.paymentStatus} language={language} compact variant="subtle" />
        </div>
      </button>
    </div>
  );
}

export default function OrdersListPanel({
  isAr,
  language,
  orders,
  loading,
  selectedId,
  onSelect,
  q,
  onSearchChange,
  filters,
  onFilterChange,
  onClearFilters,
  pagination,
  onPageChange,
  onRefresh,
  onExport,
  exporting,
  className = 'flex',
  canBulkDelete = false,
  checkedIds = [],
  onToggleCheck,
  onToggleCheckAll,
  onBulkTrash,
  bulkTrashing = false,
}) {
  const [showAdvanced, setShowAdvanced] = useState(hasActiveFilters(filters));

  const activeTab = filters.orderStatus ?? '';
  const filtersActive = hasActiveFilters(filters);

  const totalLabel = useMemo(() => {
    if (loading) return '…';
    const total = pagination?.total ?? 0;
    if (total === 0) return isAr ? 'لا توجد طلبات' : 'No orders';
    return isAr ? `${formatCount(total)} طلب` : `${formatCount(total)} orders`;
  }, [loading, pagination?.total, isAr]);

  const trashableOrders = useMemo(
    () => (canBulkDelete ? orders.filter((o) => TRASHABLE_STATUSES.includes(o.orderStatus || o.status)) : []),
    [orders, canBulkDelete],
  );

  return (
    <aside
      className={[
        className,
        'w-full shrink-0 flex-col border-e border-border/80 bg-slate-100/50 md:w-[340px] lg:w-[360px] xl:w-[380px]',
      ].join(' ')}
    >
      <div className="border-b border-border/80 bg-white px-4 py-3.5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-text">
              {isAr ? 'قائمة الطلبات' : 'Orders'}
            </h2>
            <p className="text-[11px] text-text-muted">{totalLabel}</p>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="rounded-lg p-2 text-text-muted transition-colors hover:bg-slate-100 hover:text-text disabled:opacity-50"
              aria-label={isAr ? 'تحديث' : 'Refresh'}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <Button variant="secondary" size="sm" onClick={onExport} disabled={exporting} className="h-8 px-2.5">
              <Download className="h-3.5 w-3.5" />
              <span className="text-xs">CSV</span>
            </Button>
          </div>
        </div>

        <div className="relative mt-3">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input
            type="search"
            value={q}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={isAr ? 'بحث برقم الطلب أو الهاتف...' : 'Search order # or phone...'}
            className="w-full rounded-lg border-0 bg-slate-100 py-2 ps-9 pe-3 text-sm transition-colors placeholder:text-text-muted/70 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          />
        </div>

        <div className="mt-2.5 flex gap-0.5 overflow-x-auto rounded-lg bg-slate-100 p-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {QUICK_TABS.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id || 'all'}
                type="button"
                onClick={() => onFilterChange('orderStatus', tab.id)}
                className={[
                  'shrink-0 rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition-all',
                  active
                    ? 'bg-white text-primary-700 shadow-sm'
                    : 'text-text-muted hover:text-text',
                ].join(' ')}
              >
                {isAr ? tab.labelAr : tab.labelEn}
              </button>
            );
          })}
        </div>

        <div className="mt-2">
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-[11px] font-semibold text-text-muted transition-colors hover:bg-slate-100 hover:text-text"
          >
            <span className="inline-flex items-center gap-1.5">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              {isAr ? 'فلاتر متقدمة' : 'More filters'}
              {filtersActive && (
                <span className="h-1.5 w-1.5 rounded-full bg-primary-500" />
              )}
            </span>
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
          </button>

          {showAdvanced && (
            <div className="mt-1.5 space-y-3 rounded-xl border border-border/80 bg-white p-3 shadow-sm">
              <div className="grid gap-3 sm:grid-cols-2">
                <ListFilterSelect
                  label={isAr ? 'حالة الطلب' : 'Order status'}
                  showLabel
                  value={filters.orderStatus}
                  onChange={(v) => onFilterChange('orderStatus', v)}
                  options={[
                    { value: '', label: isAr ? 'كل الحالات' : 'All statuses' },
                    ...ORDER_STATUSES.map((s) => ({
                      value: s.value,
                      label: isAr ? s.labelAr : s.labelEn,
                    })),
                  ]}
                  className="w-full min-w-0"
                />
                <ListFilterSelect
                  label={isAr ? 'الدفع' : 'Payment'}
                  showLabel
                  value={filters.paymentStatus}
                  onChange={(v) => onFilterChange('paymentStatus', v)}
                  options={[
                    { value: '', label: isAr ? 'الكل' : 'All' },
                    ...PAYMENT_STATUSES.map((s) => ({
                      value: s.value,
                      label: isAr ? s.labelAr : s.labelEn,
                    })),
                  ]}
                  className="w-full min-w-0"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1">
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-text-muted">
                    <Calendar className="h-3 w-3" />
                    {isAr ? 'من تاريخ' : 'From'}
                  </span>
                  <input
                    type="date"
                    value={filters.dateFrom}
                    onChange={(e) => onFilterChange('dateFrom', e.target.value)}
                    className="rounded-lg border border-border px-2.5 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/15"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-text-muted">
                    <Calendar className="h-3 w-3" />
                    {isAr ? 'إلى تاريخ' : 'To'}
                  </span>
                  <input
                    type="date"
                    value={filters.dateTo}
                    onChange={(e) => onFilterChange('dateTo', e.target.value)}
                    className="rounded-lg border border-border px-2.5 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/15"
                  />
                </label>
              </div>
              {filtersActive && (
                <button
                  type="button"
                  onClick={onClearFilters}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-700 hover:text-primary-800"
                >
                  <X className="h-3.5 w-3.5" />
                  {isAr ? 'مسح الفلاتر' : 'Clear filters'}
                </button>
              )}
            </div>
          )}
        </div>

        {canBulkDelete && (
          <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-border/60 pt-2.5">
            <label className="flex items-center gap-1.5 text-[11px] font-semibold text-text-muted">
              <input
                type="checkbox"
                checked={trashableOrders.length > 0 && trashableOrders.every((o) => checkedIds.includes(o._id))}
                onChange={onToggleCheckAll}
                disabled={trashableOrders.length === 0}
                className="h-3.5 w-3.5 rounded border-border"
              />
              {isAr ? 'تحديد القابلة للحذف' : 'Select deletable'}
            </label>
            {checkedIds.length > 0 && (
              <Button
                size="sm"
                variant="danger"
                onClick={onBulkTrash}
                disabled={bulkTrashing}
                className="h-7 px-2.5 text-xs"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {isAr ? `نقل ${checkedIds.length} لسلة المحذوفات` : `Trash ${checkedIds.length}`}
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-white">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader size="md" />
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
              <ShoppingBag className="h-6 w-6" strokeWidth={1.5} />
            </div>
            <p className="text-sm font-semibold text-text">
              {isAr ? 'لا توجد طلبات' : 'No orders found'}
            </p>
            <p className="mt-1 max-w-xs text-xs text-text-muted">
              {filtersActive || q
                ? (isAr ? 'جرّب تغيير الفلاتر أو البحث' : 'Try adjusting filters or search')
                : (isAr ? 'ستظهر الطلبات الجديدة هنا' : 'New orders will appear here')}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border/60">
            {orders.map((order) => (
              <li key={order._id}>
                <OrderRow
                  order={order}
                  isAr={isAr}
                  language={language}
                  selected={selectedId === order._id}
                  onSelect={onSelect}
                  canSelect={canBulkDelete && TRASHABLE_STATUSES.includes(order.orderStatus || order.status)}
                  checked={checkedIds.includes(order._id)}
                  onToggleCheck={onToggleCheck}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {!loading && pagination?.total > 0 && pagination.pages > 1 && (
        <div className="border-t border-border/80 bg-white">
          <Pagination
            page={pagination.page}
            pages={pagination.pages}
            total={pagination.total}
            limit={pagination.limit}
            onPageChange={onPageChange}
            isAr={isAr}
            className="rounded-none border-0 shadow-none"
          />
        </div>
      )}
    </aside>
  );
}
