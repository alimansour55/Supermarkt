import { useCallback, useEffect, useState } from 'react';
import { History } from 'lucide-react';
import { adminApi } from '../../adminApi';
import { formatDate } from '../../../utils/formatters';
import { historyLines } from '../../utils/sellerDeal';

const PAGE = 20;

/**
 * Who changed what on this seller, field by field (from → to), newest first.
 * `onlyDeal` narrows it to commission & fee changes.
 */
export default function SellerHistoryCard({ sellerId, isAr, onlyDeal = false, lookup, refreshKey, title }) {
  const [rows, setRows] = useState(null);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (before = null) => {
    setLoading(true);
    try {
      const { data } = await adminApi.getSellerHistory(sellerId, { type: onlyDeal ? 'deal' : undefined, limit: PAGE, before: before || undefined });
      setRows((prev) => (before ? [...(prev || []), ...data.data] : data.data));
      setMore(data.data.length === PAGE);
    } catch {
      setRows((prev) => prev || []);
    } finally {
      setLoading(false);
    }
  }, [sellerId, onlyDeal]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const opts = { isAr, lookup };
  return (
    <details className="group rounded-2xl border border-border bg-white p-4" open={onlyDeal}>
      <summary className="flex cursor-pointer list-none items-center gap-1.5 font-bold marker:hidden">
        <History className="h-4 w-4 text-text-muted" />
        {title || (isAr ? 'سجل التغييرات' : 'Change history')}
        {rows && <span className="text-xs font-normal text-text-muted">({rows.length}{more ? '+' : ''})</span>}
      </summary>
      {!rows ? (
        <p className="mt-3 text-sm text-text-muted">{isAr ? 'جارٍ التحميل…' : 'Loading…'}</p>
      ) : !rows.length ? (
        <p className="mt-3 text-sm text-text-muted">{isAr ? 'لا توجد تغييرات مسجلة بعد.' : 'No changes recorded yet.'}</p>
      ) : (
        <ol className="mt-3 space-y-3">
          {rows.map((r) => {
            const lines = historyLines(r, opts);
            if (!lines.length) return null;
            const note = r.changes?.note?.to;
            const scheduled = r.changes?.via?.to === 'schedule';
            return (
              <li key={r._id} className="rounded-xl border border-slate-100 p-3 text-sm">
                <p className="mb-1.5 text-xs text-text-muted">
                  {formatDate(r.at, isAr ? 'ar-EG' : 'en-GB')} · {new Date(r.at).toLocaleTimeString(isAr ? 'ar-EG' : 'en-GB', { hour: '2-digit', minute: '2-digit' })}
                  {' · '}<span className="font-semibold text-text">{scheduled ? (isAr ? 'تغيير مجدول' : 'Scheduled change') : r.actorName || (isAr ? 'النظام' : 'System')}</span>
                  {r.action !== 'update' && ` · ${r.action}`}
                </p>
                <ul className="space-y-0.5">
                  {lines.map((l) => (
                    <li key={l.key} className="flex flex-wrap gap-x-1.5">
                      <span className="text-text-muted">{l.label}:</span>
                      {l.single ? <span className="font-medium">{l.to}</span> : (
                        <>
                          <span className="text-text-muted line-through decoration-slate-300" dir="auto">{l.from}</span>
                          <span aria-hidden>→</span>
                          <span className="font-medium" dir="auto">{l.to}</span>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
                {note && <p className="mt-1.5 rounded-lg bg-slate-50 px-2 py-1 text-xs">{note}</p>}
              </li>
            );
          })}
        </ol>
      )}
      {more && (
        <button type="button" disabled={loading} onClick={() => load(rows[rows.length - 1]?.at)} className="mt-3 text-sm font-semibold text-primary-700">
          {loading ? (isAr ? 'جارٍ التحميل…' : 'Loading…') : (isAr ? 'تحميل المزيد' : 'Load more')}
        </button>
      )}
    </details>
  );
}
