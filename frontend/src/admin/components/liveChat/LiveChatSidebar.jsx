import { MessageCircle, RefreshCw, Search } from 'lucide-react';
import { formatRelativeTime } from '../../../utils/formatters';
import Loader from '../../../components/ui/Loader';
import Pagination from '../Pagination';
import { RatingStars } from './LiveChatThreadPanel';

function customerInitials(name, phone) {
  const base = (name || phone || '?').trim();
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

export default function LiveChatSidebar({
  isAr,
  conversations,
  loading,
  selectedId,
  onSelect,
  q,
  onSearchChange,
  status,
  onStatusChange,
  unreadTotal,
  pagination,
  onPageChange,
  onRefresh,
  refreshing,
  dateFrom = '',
  dateTo = '',
  onDateChange,
  className = 'flex',
}) {
  const statuses = [
    { id: 'queued', label: isAr ? 'انتظار' : 'Waiting' },
    { id: 'active', label: isAr ? 'نشطة' : 'Active' },
    { id: 'pending', label: isAr ? 'معلّقة' : 'Pending' },
    { id: 'closed', label: isAr ? 'مغلقة' : 'Closed' },
  ];
  const emptyHint = {
    queued: isAr ? 'لا يوجد عملاء في الانتظار' : 'No customers waiting in the queue',
    active: isAr ? 'ستظهر هنا عندما يبدأ عميل محادثة' : 'Shows when a customer starts a chat',
    pending: isAr ? 'لا توجد محادثات معلّقة' : 'No pending conversations',
    closed: isAr ? 'لا توجد محادثات مغلقة' : 'No closed conversations',
  }[status];

  const sorted = [...conversations].sort((a, b) => {
    const ua = a.unreadCustomerMessages > 0 ? 1 : 0;
    const ub = b.unreadCustomerMessages > 0 ? 1 : 0;
    if (ub !== ua) return ub - ua;
    const ta = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt).getTime() : 0;
    const tb = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt).getTime() : 0;
    return tb - ta;
  });

  return (
    <aside className={`${className} w-full shrink-0 flex-col border-e border-border bg-white md:w-[340px] lg:w-[380px]`}>
      <div className="border-b border-border px-4 py-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-text">
              {isAr ? 'المحادثات' : 'Conversations'}
            </h2>
            {unreadTotal > 0 && (
              <p className="mt-0.5 text-xs font-medium text-rose-600">
                {isAr ? `${unreadTotal} بانتظار الرد` : `${unreadTotal} awaiting reply`}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="rounded-lg border border-border p-2 text-text-muted transition-colors hover:bg-slate-50 hover:text-text"
            aria-label={isAr ? 'تحديث' : 'Refresh'}
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="relative mt-3">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input
            type="search"
            value={q}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={isAr ? 'بحث بالاسم أو الهاتف...' : 'Search name or phone...'}
            className="w-full rounded-xl border border-border py-2.5 ps-10 pe-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/15"
          />
        </div>

        <div className="mt-3 flex gap-1 rounded-xl bg-slate-100 p-1">
          {statuses.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onStatusChange(s.id)}
              className={[
                'flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors',
                status === s.id ? 'bg-white text-primary-700 shadow-sm' : 'text-text-muted hover:text-text',
              ].join(' ')}
            >
              {s.label}
            </button>
          ))}
        </div>

        {status === 'closed' && onDateChange && (
          <div className="mt-3 flex items-center gap-2 text-xs text-text-muted">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => onDateChange('dateFrom', e.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-border px-2 py-1.5 text-xs"
              aria-label={isAr ? 'من تاريخ' : 'From date'}
            />
            <span>{isAr ? 'إلى' : 'to'}</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => onDateChange('dateTo', e.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-border px-2 py-1.5 text-xs"
              aria-label={isAr ? 'إلى تاريخ' : 'To date'}
            />
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader size="md" />
          </div>
        ) : sorted.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <MessageCircle className="mx-auto h-10 w-10 text-slate-300" strokeWidth={1.5} />
            <p className="mt-3 text-sm font-medium text-text">
              {isAr ? 'لا توجد محادثات' : 'No conversations'}
            </p>
            <p className="mt-1 text-xs text-text-muted">{emptyHint}</p>
          </div>
        ) : (
          <ul className="divide-y divide-border/80">
            {sorted.map((row) => {
              const active = selectedId === row._id;
              const unread = row.unreadCustomerMessages > 0;
              const name = row.user?.name || row.user?.phone || '—';

              return (
                <li key={row._id}>
                  <button
                    type="button"
                    onClick={() => onSelect(row)}
                    className={[
                      'flex w-full gap-3 px-4 py-3.5 text-start transition-colors',
                      active ? 'bg-primary-50' : 'hover:bg-slate-50',
                      unread && !active ? 'bg-rose-50/40' : '',
                    ].join(' ')}
                  >
                    <span
                      className={[
                        'flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold',
                        unread ? 'bg-rose-100 text-rose-800' : 'bg-primary-100 text-primary-800',
                      ].join(' ')}
                    >
                      {customerInitials(row.user?.name, row.user?.phone)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-2">
                        <span className="truncate font-semibold text-text">{name}</span>
                        <span className="shrink-0 text-[10px] text-text-muted">
                          {row.lastMessage?.createdAt
                            ? formatRelativeTime(row.lastMessage.createdAt, isAr)
                            : ''}
                        </span>
                      </span>
                      {row.user?.phone && (
                        <span className="mt-0.5 block truncate text-xs text-text-muted" dir="ltr">{row.user.phone}</span>
                      )}
                      {status === 'closed' && row.rating && (
                        <span className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-amber-700">
                          <RatingStars score={row.rating.score} className="h-3 w-3" />
                          {row.rating.score}/5
                        </span>
                      )}
                      {status === 'closed' && (
                        <span className="mt-0.5 block truncate text-[11px] text-text-muted">
                          {row.assignedTo?.name
                            ? `${isAr ? 'تعامل معها:' : 'Handled by'} ${row.assignedTo.name}`
                            : (isAr ? 'بدون مسؤول' : 'Unassigned')}
                          {row.closedBy ? ` · ${row.closedBy === 'customer' ? (isAr ? 'أنهاها العميل' : 'ended by customer') : (isAr ? 'أنهاها الفريق' : 'closed by staff')}` : ''}
                        </span>
                      )}
                      <span className="mt-1 line-clamp-2 text-xs text-text-muted">
                        {unread && (
                          <span className="me-1 font-bold text-rose-600">
                            {isAr ? 'جديد: ' : 'New: '}
                          </span>
                        )}
                        {row.lastMessage?.body || '—'}
                      </span>
                    </span>
                    {unread > 0 && (
                      <span className="mt-1 flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">
                        {row.unreadCustomerMessages}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {pagination && pagination.pages > 1 && (
        <div className="border-t border-border px-2 py-2">
          <Pagination
            isAr={isAr}
            page={pagination.page}
            pages={pagination.pages}
            total={pagination.total}
            limit={pagination.limit}
            onPageChange={onPageChange}
            className="border-0 rounded-none shadow-none"
          />
        </div>
      )}
    </aside>
  );
}
