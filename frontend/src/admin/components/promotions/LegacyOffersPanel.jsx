import { useCallback, useEffect, useState } from 'react';
import { Layers, Loader2, Search, XCircle } from 'lucide-react';
import { adminApi } from '../../adminApi';
import { useConfirm, useToast } from '..';
import Pagination from '../Pagination';
import { pickProductImage } from '../../../utils/imageHelpers';
import { ProductIconTile } from '../../../components/ui/ProductImage';

const PAGE_SIZE = 20;

function ProductThumb({ row }) {
  const image = pickProductImage(row);
  const isUrl = image && (String(image).startsWith('http') || String(image).startsWith('/'));
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-white">
      {isUrl ? (
        <img src={image} alt="" className="h-full w-full object-contain p-1" loading="lazy" />
      ) : (
        <ProductIconTile emoji={row.emoji} className="h-full w-full" iconClassName="h-5 w-5" />
      )}
    </div>
  );
}

/**
 * Discounts typed straight onto a product (oldPrice > price) with no campaign behind them.
 * They can't be scheduled or paused as a group, so the admin either converts them into
 * one-product campaigns or removes the discount.
 */
export default function LegacyOffersPanel({ isAr, onChanged }) {
  const confirm = useConfirm();
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedQ(q.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await adminApi.getCatalogOffers({
        source: 'legacy',
        page,
        limit: PAGE_SIZE,
        q: debouncedQ || undefined,
      });
      setRows(data.data || []);
      setPagination(data.pagination || null);
    } catch {
      toast.error(isAr ? 'تعذر تحميل المنتجات' : 'Could not load products');
    } finally {
      setLoading(false);
    }
  }, [page, debouncedQ, isAr, toast]);

  useEffect(() => { load(); }, [load]);

  const afterChange = async () => {
    setSelected([]);
    await load();
    onChanged?.();
  };

  const toggle = (id) => setSelected((prev) => (
    prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
  ));
  const pageIds = rows.map((r) => r._id);
  const allOnPage = pageIds.length > 0 && pageIds.every((id) => selected.includes(id));
  const togglePage = () => setSelected((prev) => (
    allOnPage ? prev.filter((id) => !pageIds.includes(id)) : [...new Set([...prev, ...pageIds])]
  ));

  const convert = async (all) => {
    const count = all ? (pagination?.total ?? rows.length) : selected.length;
    const ok = await confirm({
      title: isAr ? `تحويل ${count} منتج إلى حملات؟` : `Convert ${count} product(s) to campaigns?`,
      message: isAr
        ? 'سيحصل كل منتج على حملة خاصة به بنفس الخصم، ويمكنك بعدها جدولتها أو إيقافها.'
        : 'Each product gets its own campaign with the same discount, which you can then schedule or pause.',
      confirmLabel: isAr ? 'تحويل' : 'Convert',
    });
    if (!ok) return;
    setBusy(true);
    try {
      const { data } = await adminApi.importCatalogOffers(all ? { all: true } : { productIds: selected });
      toast.success(isAr ? `تم إنشاء ${data.created} حملة` : `Created ${data.created} campaign(s)`);
      await afterChange();
    } catch (err) {
      toast.error(err?.response?.data?.message || (isAr ? 'فشل التحويل' : 'Convert failed'));
    } finally {
      setBusy(false);
    }
  };

  const removeDiscount = async () => {
    const ok = await confirm({
      title: isAr ? `إزالة الخصم من ${selected.length} منتج؟` : `Remove the discount from ${selected.length} product(s)?`,
      message: isAr ? 'سيعود كل منتج إلى سعره قبل الخصم.' : 'Each product goes back to its pre-discount price.',
      confirmLabel: isAr ? 'إزالة الخصم' : 'Remove discount',
      variant: 'danger',
    });
    if (!ok) return;
    setBusy(true);
    try {
      await adminApi.bulkCatalogOffers(selected, 'clear');
      toast.success(isAr ? 'تمت إزالة الخصم' : 'Discount removed');
      await afterChange();
    } catch {
      toast.error(isAr ? 'فشل التحديث' : 'Update failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-text-muted">
        {isAr
          ? 'هذه المنتجات عليها خصم مكتوب مباشرة في المنتج وليس ضمن حملة، لذلك لا يمكن جدولتها أو إيقافها. حوّلها إلى حملات أو أزل الخصم.'
          : "These products have a discount typed straight onto the product, not in a campaign, so they can't be scheduled or paused. Convert them to campaigns or remove the discount."}
      </p>

      <div className="relative">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={isAr ? 'بحث بالاسم أو الكود...' : 'Search name or SKU...'}
          className="w-full rounded-xl border border-border bg-white py-2 pe-3 ps-9 text-sm"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy || !selected.length}
          onClick={() => convert(false)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-orange-600 px-3 py-2 text-xs font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
        >
          <Layers className="h-3.5 w-3.5" />
          {isAr ? `تحويل المحدد (${selected.length})` : `Convert selected (${selected.length})`}
        </button>
        <button
          type="button"
          disabled={busy || !selected.length}
          onClick={removeDiscount}
          className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
        >
          <XCircle className="h-3.5 w-3.5" />
          {isAr ? 'إزالة الخصم' : 'Remove discount'}
        </button>
        <button
          type="button"
          disabled={busy || !rows.length}
          onClick={() => convert(true)}
          className="ms-auto rounded-lg border border-border bg-white px-3 py-2 text-xs font-semibold text-text hover:bg-slate-50 disabled:opacity-50"
        >
          {isAr ? 'تحويل الكل' : 'Convert all'}
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-white">
        <label className="flex items-center gap-3 border-b border-border bg-slate-50 px-3 py-2 text-xs font-semibold text-text-muted">
          <input type="checkbox" checked={allOnPage} onChange={togglePage} disabled={!rows.length} />
          {isAr ? 'تحديد الصفحة' : 'Select page'}
          {pagination?.total != null && (
            <span className="ms-auto tabular-nums">{pagination.total} {isAr ? 'منتج' : 'products'}</span>
          )}
        </label>
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-text-muted" /></div>
        ) : !rows.length ? (
          <p className="py-10 text-center text-sm text-text-muted">
            {isAr ? 'لا توجد منتجات بخصم خارج الحملات' : 'No discounts outside campaigns'}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((row) => (
              <li key={row._id}>
                <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-orange-50/40">
                  <input type="checkbox" checked={selected.includes(row._id)} onChange={() => toggle(row._id)} />
                  <ProductThumb row={row} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-text">{isAr ? row.nameAr : row.nameEn}</p>
                    <p className="text-xs tabular-nums text-text-muted">
                      {row.price} EGP
                      {row.oldPrice ? <span className="ms-2 line-through">{row.oldPrice}</span> : null}
                    </p>
                  </div>
                  {row.discount > 0 && (
                    <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-bold text-orange-800">
                      -{row.discount}%
                    </span>
                  )}
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>

      {pagination && pagination.pages > 1 && (
        <Pagination
          page={pagination.page}
          pages={pagination.pages}
          total={pagination.total}
          limit={pagination.limit}
          onPageChange={setPage}
          isAr={isAr}
        />
      )}
    </div>
  );
}
