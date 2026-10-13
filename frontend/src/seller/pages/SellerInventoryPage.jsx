import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext, useSearchParams } from '../../app/router';
import { ChevronDown, Percent, RotateCcw, Save, Search, Warehouse } from 'lucide-react';
import Loader from '../../components/ui/Loader';
import { useToast } from '../../components/ui/Toast';
import { sellerApi } from '../../services/sellerApi';
import { LISTING_STATUS, apiError } from '../sellerLabels';
import StatusBadge from '../StatusBadge';
import { EmptyState, PageHeader } from '../ui';

const cellCls = 'w-24 rounded-lg border px-2 py-1.5 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:bg-slate-50 disabled:text-slate-400';
const dirtyCls = 'border-amber-400 bg-amber-50';

/** Value shown in a cell: the unsaved edit if any, else the saved value. */
const shown = (edit, saved) => (edit !== undefined ? edit : saved ?? '');

/**
 * Manage inventory — Amazon-style quick edit: change price, old price and stock (incl. per
 * variant) right in the table and save every change at once.
 */
export default function SellerInventoryPage() {
  const { isAr, refreshSummary } = useOutletContext();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const stock = searchParams.get('stock') || '';
  const listingStatus = searchParams.get('listingStatus') || '';
  const [q, setQ] = useState(searchParams.get('q') || '');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [edits, setEdits] = useState({}); // id → { price, oldPrice, stock, variants: { vid: { price, stock } } }
  const [errors, setErrors] = useState({});
  const [expanded, setExpanded] = useState(() => new Set());
  const [selected, setSelected] = useState(() => new Set());
  const [saving, setSaving] = useState(false);
  const [pct, setPct] = useState('');
  const [setTo, setSetTo] = useState('');

  const dirtyCount = Object.keys(edits).length;

  const load = useCallback(() => {
    setLoading(true);
    sellerApi.listProducts({ q: q || undefined, stock: stock || undefined, listingStatus: listingStatus || undefined, sort: stock ? 'stock-asc' : 'updated', page, limit: 50 })
      .then(({ data }) => { setItems(data.data || []); setPagination(data.pagination || { pages: 1, total: 0 }); })
      .catch(() => toast.error(isAr ? 'تعذّر تحميل المخزون' : 'Could not load inventory'))
      .finally(() => setLoading(false));
  }, [q, stock, listingStatus, page, isAr, toast]);

  useEffect(() => {
    const timer = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, q]);

  useEffect(() => {
    if (!dirtyCount) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirtyCount]);

  const setFilter = (key, value) => {
    if (dirtyCount && !window.confirm(isAr ? 'لديك تغييرات غير محفوظة. المتابعة؟' : 'You have unsaved changes. Continue?')) return;
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value); else next.delete(key);
    setEdits({});
    setErrors({});
    setSelected(new Set());
    setPage(1);
    setSearchParams(next);
  };

  /** Record an edit; dropping it again when it equals the saved value keeps the counter honest. */
  const edit = (product, field, value, variantId = null) => {
    setEdits((prev) => {
      const next = { ...prev };
      const row = { ...(next[product._id] || {}) };
      if (variantId) {
        const v = product.variants.find((x) => String(x._id) === String(variantId));
        const vs = { ...(row.variants || {}) };
        const ve = { ...(vs[variantId] || {}) };
        if (String(value) === String(v?.[field] ?? '')) delete ve[field]; else ve[field] = value;
        if (Object.keys(ve).length) vs[variantId] = ve; else delete vs[variantId];
        if (Object.keys(vs).length) row.variants = vs; else delete row.variants;
      } else if (String(value) === String(product[field] ?? '')) {
        delete row[field];
      } else {
        row[field] = value;
      }
      if (Object.keys(row).length) next[product._id] = row; else delete next[product._id];
      return next;
    });
  };

  const applyToSelected = (fn) => {
    if (!selected.size) return toast.error(isAr ? 'حدد منتجات أولاً' : 'Select products first');
    items.filter((p) => selected.has(p._id)).forEach((p) => fn(p));
    return undefined;
  };

  const adjustPrices = () => {
    const n = Number(pct);
    if (!n || Number.isNaN(n)) return;
    applyToSelected((p) => {
      const r = (v) => String(Math.max(0.01, Math.round(v * (1 + n / 100) * 100) / 100));
      if (p.variants?.length) p.variants.forEach((v) => edit(p, 'price', r(Number(shown(edits[p._id]?.variants?.[v._id]?.price, v.price))), v._id));
      else edit(p, 'price', r(Number(shown(edits[p._id]?.price, p.price))));
    });
    setPct('');
  };

  const setStockForSelected = () => {
    if (setTo === '' || Number(setTo) < 0) return;
    applyToSelected((p) => {
      if (p.fulfilledBy === 'store') return;
      if (p.variants?.length) p.variants.forEach((v) => edit(p, 'stock', setTo, v._id));
      else edit(p, 'stock', setTo);
    });
    setSetTo('');
  };

  const saveAll = async () => {
    const payload = Object.entries(edits).map(([id, row]) => ({
      id,
      ...(row.price !== undefined ? { price: Number(row.price) } : {}),
      ...(row.oldPrice !== undefined ? { oldPrice: row.oldPrice === '' ? null : Number(row.oldPrice) } : {}),
      ...(row.stock !== undefined ? { stock: Number(row.stock) } : {}),
      ...(row.variants ? {
        variants: Object.entries(row.variants).map(([vid, v]) => ({
          _id: vid,
          ...(v.price !== undefined ? { price: Number(v.price) } : {}),
          ...(v.stock !== undefined ? { stock: Number(v.stock) } : {}),
        })),
      } : {}),
    }));
    setSaving(true);
    try {
      const { data } = await sellerApi.bulkInventory(payload);
      applyResults(data);
    } catch (err) {
      if (err.response?.data?.results) applyResults(err.response.data);
      else toast.error(apiError(err, isAr ? 'تعذّر الحفظ' : 'Save failed'));
    } finally {
      setSaving(false);
    }
  };

  const applyResults = (data) => {
    const okIds = new Set(data.results.filter((r) => r.ok).map((r) => String(r.id)));
    const updated = new Map(data.results.filter((r) => r.ok).map((r) => [String(r.id), r.data]));
    setItems((prev) => prev.map((p) => updated.get(String(p._id)) || p));
    setEdits((prev) => Object.fromEntries(Object.entries(prev).filter(([id]) => !okIds.has(id))));
    setErrors(Object.fromEntries(data.results.filter((r) => !r.ok).map((r) => [String(r.id), r.error])));
    if (data.failed) toast.error(isAr ? `حُفظ ${data.saved} وفشل ${data.failed}` : `${data.saved} saved, ${data.failed} failed`);
    else toast.success(isAr ? `تم حفظ ${data.saved} منتج` : `${data.saved} product(s) saved`);
    refreshSummary?.();
  };

  const allSelected = items.length > 0 && items.every((p) => selected.has(p._id));
  const toggleSel = (id) => setSelected((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleExp = (id) => setExpanded((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const stockTabs = useMemo(() => [
    { value: '', label: isAr ? 'الكل' : 'All' },
    { value: 'low', label: isAr ? 'مخزون منخفض' : 'Low stock' },
    { value: 'out', label: isAr ? 'نفد المخزون' : 'Out of stock' },
  ], [isAr]);

  const availability = (p) => {
    const total = p.variants?.length ? p.variants.reduce((n, v) => n + (v.stock || 0), 0) : p.stock || 0;
    const reserved = p.reservedStock || 0;
    const tone = total <= 0 ? 'text-red-600' : total <= 5 ? 'text-amber-600' : 'text-emerald-700';
    return (
      <span className={`text-sm font-semibold tabular-nums ${tone}`}>
        {total}
        {reserved > 0 && <span className="block text-[11px] font-normal text-slate-500">{isAr ? `${reserved} محجوز` : `${reserved} reserved`}</span>}
      </span>
    );
  };

  return (
    <div>
      <PageHeader
        icon={Warehouse}
        title={isAr ? 'إدارة المخزون والأسعار' : 'Manage inventory'}
        description={isAr ? 'عدّل الأسعار والمخزون مباشرة في الجدول ثم احفظ كل التغييرات مرة واحدة. التغييرات تظهر للعملاء فوراً.' : 'Edit prices and stock right in the table, then save every change at once. Changes go live immediately.'}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-xl bg-white p-1 ring-1 ring-slate-200">
          {stockTabs.map((t) => (
            <button key={t.value} type="button" onClick={() => setFilter('stock', t.value)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${stock === t.value ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>{t.label}</button>
          ))}
        </div>
        <select value={listingStatus} onChange={(e) => setFilter('listingStatus', e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
          <option value="">{isAr ? 'كل الحالات' : 'Any status'}</option>
          {Object.keys(LISTING_STATUS).map((k) => <option key={k} value={k}>{isAr ? LISTING_STATUS[k].ar : LISTING_STATUS[k].en}</option>)}
        </select>
        <label className="relative ms-auto w-full sm:w-72">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => { setPage(1); setQ(e.target.value); }} placeholder={isAr ? 'بحث بالاسم أو SKU' : 'Search name or SKU'} className="w-full rounded-xl border border-slate-200 bg-white py-2 pe-3 ps-9 text-sm" />
        </label>
      </div>

      {selected.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-2xl bg-slate-900 p-3 text-sm text-white">
          <span className="font-semibold">{isAr ? `${selected.size} محدد` : `${selected.size} selected`}</span>
          <span className="mx-1 h-5 w-px bg-white/20" />
          <Percent className="h-4 w-4 text-slate-400" />
          <input type="number" value={pct} onChange={(e) => setPct(e.target.value)} placeholder={isAr ? '+10 أو -5' : '+10 or -5'} className="w-24 rounded-lg bg-white/10 px-2 py-1.5 text-sm ring-1 ring-white/20 placeholder:text-slate-400" dir="ltr" />
          <button type="button" onClick={adjustPrices} className="rounded-lg bg-indigo-500 px-2.5 py-1.5 font-semibold">{isAr ? 'تعديل السعر %' : 'Change price %'}</button>
          <span className="mx-1 h-5 w-px bg-white/20" />
          <input type="number" min="0" value={setTo} onChange={(e) => setSetTo(e.target.value)} placeholder={isAr ? 'كمية' : 'Qty'} className="w-20 rounded-lg bg-white/10 px-2 py-1.5 text-sm ring-1 ring-white/20 placeholder:text-slate-400" dir="ltr" />
          <button type="button" onClick={setStockForSelected} className="rounded-lg bg-indigo-500 px-2.5 py-1.5 font-semibold">{isAr ? 'تعيين المخزون' : 'Set stock'}</button>
          <button type="button" onClick={() => setSelected(new Set())} className="ms-auto text-xs text-slate-300 hover:text-white">{isAr ? 'إلغاء التحديد' : 'Clear'}</button>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex min-h-[240px] items-center justify-center"><Loader size="lg" /></div>
        ) : items.length === 0 ? (
          <EmptyState icon={Warehouse} title={isAr ? 'لا توجد منتجات هنا' : 'Nothing here'} text={stock ? (isAr ? 'رائع — لا توجد منتجات بهذا المخزون.' : 'Great — no products in this state.') : undefined} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="w-10 px-3 py-3"><input type="checkbox" checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(items.map((p) => p._id)))} className="h-4 w-4 rounded" aria-label={isAr ? 'تحديد الكل' : 'Select all'} /></th>
                  <th className="px-3 py-3 text-start">{isAr ? 'المنتج' : 'Product'}</th>
                  <th className="px-3 py-3 text-start">{isAr ? 'الحالة' : 'Status'}</th>
                  <th className="px-3 py-3 text-start">{isAr ? 'المتاح' : 'Available'}</th>
                  <th className="px-3 py-3 text-start">{isAr ? 'السعر' : 'Price'}</th>
                  <th className="px-3 py-3 text-start">{isAr ? 'قبل الخصم' : 'Was'}</th>
                  <th className="px-3 py-3 text-start">{isAr ? 'المخزون' : 'Stock'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((p) => {
                  const e = edits[p._id] || {};
                  const hasVariants = p.variants?.length > 0;
                  const storeHeld = p.fulfilledBy === 'store';
                  const open = expanded.has(p._id);
                  return [
                    <tr key={p._id} className={`${errors[p._id] ? 'bg-red-50/60' : edits[p._id] ? 'bg-amber-50/40' : ''}`}>
                      <td className="px-3 py-2.5"><input type="checkbox" checked={selected.has(p._id)} onChange={() => toggleSel(p._id)} className="h-4 w-4 rounded" aria-label={isAr ? 'تحديد' : 'Select'} /></td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-3">
                          {typeof p.image === 'string' && p.image.startsWith('http')
                            ? <img src={p.image} alt="" className="h-10 w-10 rounded-lg object-cover ring-1 ring-slate-200" />
                            : <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">{p.emoji || '🛍️'}</span>}
                          <div className="min-w-0">
                            <Link to={`/seller-center/products/${p._id}`} className="block max-w-[260px] truncate font-semibold hover:text-indigo-700">{isAr ? p.nameAr : p.nameEn}</Link>
                            <span className="block text-xs text-slate-500" dir="ltr">{p.sku}</span>
                            {hasVariants && (
                              <button type="button" onClick={() => toggleExp(p._id)} className="mt-0.5 inline-flex items-center gap-1 text-xs font-semibold text-indigo-700">
                                <ChevronDown className={`h-3.5 w-3.5 transition ${open ? 'rotate-180' : ''}`} />{isAr ? `${p.variants.length} أنواع` : `${p.variants.length} variants`}
                              </button>
                            )}
                            {errors[p._id] && <span className="block text-xs font-medium text-red-600">{errors[p._id]}</span>}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5"><StatusBadge map={LISTING_STATUS} value={p.listingStatus} isAr={isAr} /></td>
                      <td className="px-3 py-2.5">{availability(p)}</td>
                      <td className="px-3 py-2.5">
                        {hasVariants ? <span className="text-xs text-slate-500">{isAr ? 'حسب النوع' : 'Per variant'}</span> : (
                          <input type="number" min="0" step="0.01" value={shown(e.price, p.price)} onChange={(ev) => edit(p, 'price', ev.target.value)} className={`${cellCls} ${e.price !== undefined ? dirtyCls : 'border-slate-200'}`} dir="ltr" aria-label={isAr ? 'السعر' : 'Price'} />
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <input type="number" min="0" step="0.01" value={shown(e.oldPrice, p.oldPrice || '')} onChange={(ev) => edit(p, 'oldPrice', ev.target.value)} className={`${cellCls} ${e.oldPrice !== undefined ? dirtyCls : 'border-slate-200'}`} dir="ltr" placeholder="—" aria-label={isAr ? 'السعر قبل الخصم' : 'Old price'} />
                      </td>
                      <td className="px-3 py-2.5">
                        {hasVariants ? <span className="text-xs text-slate-500">{isAr ? 'حسب النوع' : 'Per variant'}</span> : (
                          <input type="number" min="0" value={shown(e.stock, p.stock)} onChange={(ev) => edit(p, 'stock', ev.target.value)} disabled={storeHeld} title={storeHeld ? (isAr ? 'في مخزننا — يتغير عند استلام شحناتك' : 'Held in our warehouse') : undefined} className={`${cellCls} ${e.stock !== undefined ? dirtyCls : 'border-slate-200'}`} dir="ltr" aria-label={isAr ? 'المخزون' : 'Stock'} />
                        )}
                      </td>
                    </tr>,
                    ...(hasVariants && open ? p.variants.map((v) => {
                      const ve = e.variants?.[v._id] || {};
                      return (
                        <tr key={`${p._id}-${v._id}`} className="bg-slate-50/70">
                          <td />
                          <td className="py-2 pe-3 ps-16 text-sm">↳ {isAr ? v.valueAr : v.valueEn} <span className="text-xs text-slate-400" dir="ltr">{v.sku}</span></td>
                          <td />
                          <td className="px-3 py-2 text-sm tabular-nums">{v.stock}</td>
                          <td className="px-3 py-2"><input type="number" min="0" step="0.01" value={shown(ve.price, v.price)} onChange={(ev) => edit(p, 'price', ev.target.value, v._id)} className={`${cellCls} ${ve.price !== undefined ? dirtyCls : 'border-slate-200'}`} dir="ltr" /></td>
                          <td />
                          <td className="px-3 py-2"><input type="number" min="0" value={shown(ve.stock, v.stock)} onChange={(ev) => edit(p, 'stock', ev.target.value, v._id)} disabled={storeHeld} className={`${cellCls} ${ve.stock !== undefined ? dirtyCls : 'border-slate-200'}`} dir="ltr" /></td>
                        </tr>
                      );
                    }) : []),
                  ];
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {pagination.pages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2 text-sm">
          <button type="button" disabled={page <= 1 || dirtyCount > 0} onClick={() => setPage((n) => n - 1)} className="rounded-lg px-3 py-1.5 ring-1 ring-slate-200 disabled:opacity-40">{isAr ? 'السابق' : 'Previous'}</button>
          <span>{page} / {pagination.pages}</span>
          <button type="button" disabled={page >= pagination.pages || dirtyCount > 0} onClick={() => setPage((n) => n + 1)} className="rounded-lg px-3 py-1.5 ring-1 ring-slate-200 disabled:opacity-40">{isAr ? 'التالي' : 'Next'}</button>
        </div>
      )}

      {dirtyCount > 0 && (
        <div className="sticky bottom-3 z-20 mt-4 rounded-2xl border border-slate-200 bg-white/95 shadow-xl backdrop-blur">
          <div className="flex flex-wrap items-center justify-end gap-2 px-4 py-3">
            <span className="me-auto text-sm font-semibold text-amber-700">{isAr ? `${dirtyCount} منتج به تغييرات غير محفوظة` : `${dirtyCount} product(s) with unsaved changes`}</span>
            <button type="button" disabled={saving} onClick={() => { setEdits({}); setErrors({}); }} className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold ring-1 ring-slate-300 hover:bg-slate-50">
              <RotateCcw className="h-4 w-4" />{isAr ? 'تراجع' : 'Discard'}
            </button>
            <button type="button" disabled={saving} onClick={saveAll} className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-indigo-700 disabled:opacity-50">
              <Save className="h-4 w-4" />{saving ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'حفظ كل التغييرات' : 'Save all changes')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
