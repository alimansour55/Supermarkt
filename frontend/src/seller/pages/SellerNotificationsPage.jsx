import { useCallback, useEffect, useState } from 'react';
import { Link, useOutletContext } from '../../app/router';
import { Bell, CheckCheck } from 'lucide-react';
import Loader from '../../components/ui/Loader';
import { sellerApi } from '../../services/sellerApi';
import { EmptyState, PageHeader, Segmented } from '../ui';

function dayGroup(date, isAr) {
  const d = new Date(date);
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const diff = Math.floor((start - new Date(d).setHours(0, 0, 0, 0)) / 86400000);
  if (diff <= 0) return isAr ? 'اليوم' : 'Today';
  if (diff === 1) return isAr ? 'أمس' : 'Yesterday';
  if (diff < 7) return isAr ? 'هذا الأسبوع' : 'This week';
  return isAr ? 'أقدم' : 'Earlier';
}

export default function SellerNotificationsPage() {
  const { isAr, refreshSummary } = useOutletContext();
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState(null);
  const [pages, setPages] = useState(1);
  const [unread, setUnread] = useState(0);

  const load = useCallback(() => {
    sellerApi.getNotifications({ page, limit: 30, unread: filter === 'unread' ? 'true' : undefined })
      .then(({ data }) => { setItems(data.data || []); setPages(data.pagination?.pages || 1); setUnread(data.unreadCount || 0); })
      .catch(() => setItems([]));
  }, [page, filter]);
  useEffect(() => { load(); }, [load]);

  const markAll = async () => {
    await sellerApi.markNotificationsRead().catch(() => {});
    load();
    refreshSummary?.();
  };
  const open = (n) => {
    if (!n.readAt) sellerApi.markNotificationRead(n._id).then(() => refreshSummary?.()).catch(() => {});
  };

  const groups = [];
  (items || []).forEach((n) => {
    const g = dayGroup(n.createdAt, isAr);
    const last = groups[groups.length - 1];
    if (last?.label === g) last.items.push(n); else groups.push({ label: g, items: [n] });
  });

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        icon={Bell}
        title={isAr ? 'الإشعارات' : 'Notifications'}
        description={isAr ? 'تحديثات الطلبات، مراجعة المنتجات، التحويلات وحالة حسابك.' : 'Order updates, listing reviews, payouts and account news.'}
        actions={unread > 0 && (
          <button type="button" onClick={markAll} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold ring-1 ring-slate-300 hover:bg-white">
            <CheckCheck className="h-4 w-4" />{isAr ? 'تحديد الكل كمقروء' : 'Mark all as read'}
          </button>
        )}
      />
      <div className="mb-4">
        <Segmented
          options={[{ value: 'all', label: isAr ? 'الكل' : 'All' }, { value: 'unread', label: isAr ? `غير مقروءة (${unread})` : `Unread (${unread})` }]}
          value={filter}
          onChange={(v) => { setPage(1); setFilter(v); }}
        />
      </div>

      {!items ? <div className="flex min-h-[30vh] items-center justify-center"><Loader size="lg" /></div> : items.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white"><EmptyState icon={Bell} title={isAr ? 'لا توجد إشعارات' : 'No notifications'} /></div>
      ) : (
        <div className="space-y-5">
          {groups.map((g) => (
            <section key={g.label}>
              <h2 className="mb-2 text-xs font-bold uppercase text-slate-400">{g.label}</h2>
              <ul className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                {g.items.map((n) => (
                  <li key={n._id} className="border-b border-slate-100 last:border-0">
                    <Link to={n.link?.startsWith('/seller-center') ? n.link : '#'} onClick={() => open(n)} className={`flex gap-3 px-5 py-4 hover:bg-slate-50 ${n.readAt ? '' : 'bg-indigo-50/50'}`}>
                      <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${n.readAt ? 'bg-slate-200' : 'bg-indigo-500'}`} aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold">{isAr ? n.titleAr : n.titleEn}</span>
                        <span className="block text-sm text-slate-600">{isAr ? n.messageAr : n.messageEn}</span>
                      </span>
                      <span className="shrink-0 text-xs text-slate-400">{new Date(n.createdAt).toLocaleString(isAr ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {pages > 1 && (
            <div className="flex items-center justify-center gap-2 text-sm">
              <button type="button" disabled={page <= 1} onClick={() => setPage((n) => n - 1)} className="rounded-lg px-3 py-1.5 ring-1 ring-slate-200 disabled:opacity-40">{isAr ? 'السابق' : 'Previous'}</button>
              <span>{page} / {pages}</span>
              <button type="button" disabled={page >= pages} onClick={() => setPage((n) => n + 1)} className="rounded-lg px-3 py-1.5 ring-1 ring-slate-200 disabled:opacity-40">{isAr ? 'التالي' : 'Next'}</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
