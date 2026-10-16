import { useCallback, useEffect, useState } from 'react';
import { Check, ExternalLink, Search, X } from 'lucide-react';
import { Link } from '../../../app/router';
import { useToast } from '../index';
import { adminApi } from '../../adminApi';
import { LISTING_STATUS, apiError } from '../../../seller/sellerLabels';
import StatusBadge from '../../../seller/StatusBadge';
import { formatPrice } from '../../../utils/formatters';

const STATES = [
  ['all', 'الكل', 'All'],
  ['pending', 'تنتظر المراجعة', 'To review'],
  ['approved', 'معروضة', 'Live'],
  ['out_of_stock', 'نفد المخزون', 'Out of stock'],
  ['rejected', 'مرفوضة', 'Rejected'],
  ['paused', 'موقوفة', 'Paused'],
  ['draft', 'مسودة', 'Draft'],
];

/** One seller's catalog inside its panel: by state, searchable, approve / reject in place. */
export default function SellerProductsTab({ sellerId, isAr, canWrite, onChanged }) {
  const toast = useToast();
  const [state, setState] = useState('all');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState('');

  const load = useCallback(() => {
    adminApi.listListingQueue({ seller: sellerId, state, q: query || undefined, limit: 50 })
      .then(({ data: d }) => setData(d))
      .catch(() => setData({ data: [], counts: {} }));
  }, [sellerId, state, query]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const t = setTimeout(() => setQuery(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const act = async (p, kind) => {
    let note = '';
    if (kind === 'reject') {
      note = window.prompt(isAr ? 'ما الذي يجب على البائع تعديله؟' : 'What should the seller fix?') || '';
      if (!note.trim()) return;
    }
    setBusy(p._id);
    try {
      if (kind === 'approve') await adminApi.approveListing(p._id);
      else await adminApi.rejectListing(p._id, { note });
      toast.success(kind === 'approve' ? (isAr ? 'تم الاعتماد' : 'Approved') : (isAr ? 'تم الرفض' : 'Rejected'));
      load();
      onChanged?.();
    } catch (err) {
      toast.error(apiError(err, isAr ? 'تعذّر التنفيذ' : 'Action failed'));
    } finally {
      setBusy('');
    }
  };

  const counts = data?.counts || {};
  return (
    <div className="space-y-3">
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {STATES.map(([id, ar, en]) => (
          <button
            key={id}
            type="button"
            onClick={() => setState(id)}
            className={`shrink-0 rounded-full border px-3 py-1 text-xs ${state === id ? 'border-primary-500 bg-primary-50 font-semibold text-primary-800' : 'border-border text-text-muted'}`}
          >
            {isAr ? ar : en} <span className="tabular-nums">({counts[id] ?? 0})</span>
          </button>
        ))}
      </div>
      <div className="relative">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
        <input className="w-full rounded-xl border border-border py-2 pe-3 ps-9 text-sm" placeholder={isAr ? 'ابحث بالاسم أو SKU' : 'Search name or SKU'} value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {!data ? (
        <div className="h-32 animate-pulse rounded-2xl bg-slate-100" />
      ) : !data.data.length ? (
        <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-text-muted">{isAr ? 'لا توجد منتجات هنا.' : 'No products here.'}</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-2xl border border-border bg-white">
          {data.data.map((p) => {
            const first = p.images?.[0];
            const img = (typeof first === 'string' ? first : first?.url) || p.image || '';
            // Some products use an emoji instead of a photo.
            const isUrl = /^(https?:)?///.test(img) || img.startsWith('/');
            const waiting = p.listingStatus === 'pending_review' || p.pendingChangesAt;
            return (
              <li key={p._id} className="flex items-center gap-3 p-3">
                {isUrl
                  ? <img src={img} alt="" className="h-12 w-12 shrink-0 rounded-lg border border-border object-cover" />
                  : <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xl">{img}</span>}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{isAr ? p.nameAr || p.nameEn : p.nameEn || p.nameAr}</p>
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-muted">
                    <StatusBadge map={LISTING_STATUS} value={p.listingStatus} isAr={isAr} />
                    {p.pendingChangesAt && <span className="rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-800">{isAr ? 'تعديل ينتظر' : 'Edit waiting'}</span>}
                    <span>{formatPrice(p.price)}</span>
                    <span>{isAr ? 'المخزون' : 'Stock'}: {p.stock ?? 0}</span>
                    {p.sku && <span dir="ltr">{p.sku}</span>}
                  </p>
                  {p.reviewNote && p.listingStatus === 'rejected' && <p className="mt-1 text-xs text-red-700">{p.reviewNote}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {canWrite && waiting && p.hasMarketplaceCategory !== false && (
                    <>
                      <button type="button" disabled={busy === p._id} onClick={() => act(p, 'approve')} className="rounded-lg p-1.5 text-emerald-700 hover:bg-emerald-50" title={isAr ? 'اعتماد' : 'Approve'}><Check className="h-4 w-4" /></button>
                      <button type="button" disabled={busy === p._id} onClick={() => act(p, 'reject')} className="rounded-lg p-1.5 text-red-700 hover:bg-red-50" title={isAr ? 'رفض' : 'Reject'}><X className="h-4 w-4" /></button>
                    </>
                  )}
                  {canWrite && waiting && p.hasMarketplaceCategory === false && (
                    <Link to={`/admin/listing-review?seller=${sellerId}`} className="text-xs font-semibold text-primary-700 hover:underline">{isAr ? 'يحتاج قسماً' : 'Needs a category'}</Link>
                  )}
                  <Link to={`/admin/products/${p._id}/edit`} className="rounded-lg p-1.5 text-text-muted hover:bg-slate-50" title={isAr ? 'فتح' : 'Open'}><ExternalLink className="h-4 w-4" /></Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {data?.pagination?.total > data?.data?.length && (
        <Link to={`/admin/listing-review?seller=${sellerId}`} className="block text-center text-sm font-semibold text-primary-700 hover:underline">
          {isAr ? `عرض الكل (${data.pagination.total})` : `See all ${data.pagination.total}`}
        </Link>
      )}
    </div>
  );
}
