import { useEffect, useState } from 'react';
import { adminApi } from '../../adminApi';
import { formatDate } from '../../../utils/formatters';
import { activityLabel } from '../../utils/sellerDeal';

const AREAS = [
  ['', 'الكل', 'All'],
  ['product', 'المنتجات', 'Products'],
  ['order', 'الطلبات', 'Orders'],
  ['security', 'الدخول والأمان', 'Sign-in & security'],
  ['team', 'الفريق', 'Team'],
  ['store', 'المتجر', 'Store'],
  ['staff', 'تغييرات فريقنا', 'Our changes'],
];

/** What the seller's team did in Seller Center (and what our staff changed on their account). */
export default function SellerActivityTab({ sellerId, isAr }) {
  const [area, setArea] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState(null);
  const [more, setMore] = useState(false);

  useEffect(() => {
    let alive = true;
    adminApi.getSellerActivity(sellerId, { area: area || undefined, page, limit: 30 })
      .then(({ data }) => {
        if (!alive) return;
        setRows((prev) => (page === 1 ? data.data : [...(prev || []), ...data.data]));
        setMore(page < (data.pagination?.pages || 1));
      })
      .catch(() => { if (alive) setRows((prev) => prev || []); });
    return () => { alive = false; };
  }, [sellerId, area, page]);

  return (
    <div className="space-y-3">
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {AREAS.map(([id, ar, en]) => (
          <button
            key={id || 'all'}
            type="button"
            onClick={() => { setArea(id); setPage(1); setRows(null); }}
            className={`shrink-0 rounded-full border px-3 py-1 text-xs ${area === id ? 'border-primary-500 bg-primary-50 font-semibold text-primary-800' : 'border-border text-text-muted'}`}
          >
            {isAr ? ar : en}
          </button>
        ))}
      </div>
      {!rows ? <div className="h-32 animate-pulse rounded-2xl bg-slate-100" /> : !rows.length ? (
        <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-text-muted">{isAr ? 'لا يوجد نشاط.' : 'No activity.'}</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-2xl border border-border bg-white text-sm">
          {rows.map((a) => (
            <li key={a._id} className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2">
              <p className="min-w-0">
                <span className="font-semibold">{a.action.startsWith('staff.') ? (isAr ? 'فريقنا' : 'Our staff') : a.actorName || (isAr ? 'النظام' : 'System')}</span>
                {' '}{activityLabel(a.action, isAr)}
                {a.label && <span className="text-text-muted" dir="auto"> — {a.label}</span>}
              </p>
              <span className="shrink-0 text-xs text-text-muted">
                {formatDate(a.createdAt, isAr ? 'ar-EG' : 'en-GB')} {new Date(a.createdAt).toLocaleTimeString(isAr ? 'ar-EG' : 'en-GB', { hour: '2-digit', minute: '2-digit' })}
                {a.ip && <span dir="ltr" className="ms-1 font-mono">{a.ip}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
      {more && <button type="button" onClick={() => setPage((p) => p + 1)} className="w-full text-sm font-semibold text-primary-700">{isAr ? 'تحميل المزيد' : 'Load more'}</button>}
    </div>
  );
}
