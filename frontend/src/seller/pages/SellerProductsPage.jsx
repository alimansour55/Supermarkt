import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useOutletContext, useSearchParams } from '../../app/router';
import {
  Copy, FileDown, FileUp, FolderMinus, FolderPlus, PackageOpen, Pause, Pencil, Play, Plus, Search, Send, Tags, Trash2, X,
} from 'lucide-react';
import Loader from '../../components/ui/Loader';
import { useToast } from '../../components/ui/Toast';
import { sellerApi } from '../../services/sellerApi';
import { formatPrice } from '../../utils/formatters';
import { FULFILLMENT, LISTING_STATUS, apiError, label } from '../sellerLabels';
import StatusBadge from '../StatusBadge';

const TABS = ['', 'approved', 'pending_review', 'draft', 'rejected', 'paused'];

const CSV_TEMPLATE = [
  'nameAr,nameEn,price,category,oldPrice,stock,brand,sku,barcode,unit,size,descriptionAr,descriptionEn,fulfilledBy',
  'عسل نحل,Bee Honey,120,عسل,140,25,Nahl,,,piece,500 g,عسل طبيعي,Natural honey,seller',
].join('\n');

function downloadTemplate() {
  const blob = new Blob([`\uFEFF${CSV_TEMPLATE}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'products-template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

/** Bulk-create drafts from a CSV file; shows a result per row. */
function CsvImport({ isAr, onDone }) {
  const toast = useToast();
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    setResult(null);
    try {
      const { data } = await sellerApi.importProducts(await file.text());
      setResult(data);
      onDone();
    } catch (err) {
      const data = err.response?.data;
      if (data?.results) setResult(data);
      else toast.error(apiError(err, isAr ? 'تعذّر الاستيراد' : 'Import failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" disabled={busy} onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 font-semibold text-white disabled:opacity-50">
          <FileUp className="h-4 w-4" />{busy ? (isAr ? 'جاري الاستيراد...' : 'Importing...') : (isAr ? 'استيراد ملف CSV' : 'Import CSV')}
        </button>
        <button type="button" onClick={downloadTemplate} className="inline-flex items-center gap-1.5 font-semibold text-indigo-700 hover:underline">
          <FileDown className="h-4 w-4" />{isAr ? 'تحميل النموذج' : 'Download template'}
        </button>
        <span className="text-xs text-slate-500">{isAr ? 'storeCategory: أقسام متجرك مفصولة بـ | (تُنشأ تلقائياً). category: قسم المنصة (اختياري). تُنشأ المنتجات كمسودات — أضف الصور ثم أرسلها. حتى 500 صف.' : 'storeCategory: your sections separated by | (created automatically). category: marketplace category (optional). Products are created as drafts — add photos, then submit. Up to 500 rows.'}</span>
        <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={onFile} />
      </div>
      {result && (
        <div className="mt-3">
          <p className="font-semibold">
            {isAr ? `تم إنشاء ${result.created} — فشل ${result.failed}` : `${result.created} created — ${result.failed} failed`}
          </p>
          {result.results?.some((r) => !r.ok) && (
            <ul className="mt-1 max-h-40 overflow-y-auto text-xs text-red-700">
              {result.results.filter((r) => !r.ok).map((r) => (
                <li key={r.line}>{isAr ? `السطر ${r.line}` : `Line ${r.line}`}{r.nameEn ? ` (${r.nameEn})` : ''}: {r.error}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function StockCell({ product, isAr, onSaved }) {
  const toast = useToast();
  const [value, setValue] = useState(String(product.stock ?? 0));
  const [busy, setBusy] = useState(false);
  if (product.fulfilledBy === 'store') {
    return (
      <span className="text-sm">
        {product.stock ?? 0}
        <span className="block text-[11px] text-slate-500">{isAr ? 'في مخزننا' : 'in our warehouse'}</span>
      </span>
    );
  }
  if (product.hasVariants) {
    return <span className="text-xs text-slate-500">{isAr ? 'حسب النوع' : 'Per variant'}</span>;
  }
  const dirty = Number(value) !== Number(product.stock);
  const save = async () => {
    setBusy(true);
    try {
      const { data } = await sellerApi.updateStock(product._id, { stock: Number(value) });
      onSaved(data.data);
      toast.success(isAr ? 'تم تحديث المخزون' : 'Stock updated');
    } catch (err) {
      toast.error(apiError(err, isAr ? 'تعذّر التحديث' : 'Update failed'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex items-center gap-1.5">
      <input
        type="number"
        min="0"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-sm"
        aria-label={isAr ? 'المخزون' : 'Stock'}
      />
      {dirty && (
        <button type="button" disabled={busy} onClick={save} className="rounded-lg bg-indigo-600 px-2 py-1 text-xs font-semibold text-white disabled:opacity-50">
          {isAr ? 'حفظ' : 'Save'}
        </button>
      )}
    </div>
  );
}

/** Bulk bar: add/remove a store section, submit drafts, pause live products. */
function BulkBar({ isAr, count, sections, busy, onSection, onAction, onClear }) {
  const [sectionId, setSectionId] = useState('');
  return (
    <div className="sticky top-16 z-10 flex flex-wrap items-center gap-2 rounded-2xl bg-slate-900 p-3 text-sm text-white shadow-lg">
      <span className="font-semibold">{isAr ? `${count} محدد` : `${count} selected`}</span>
      <select value={sectionId} onChange={(e) => setSectionId(e.target.value)} className="rounded-lg bg-white/10 px-2 py-1.5 text-sm text-white ring-1 ring-white/20 [&>option]:text-slate-900">
        <option value="">{isAr ? 'اختر قسماً…' : 'Choose a section…'}</option>
        {sections.map((c) => <option key={c._id} value={c._id}>{c.parent ? '↳ ' : ''}{isAr ? c.nameAr : c.nameEn}</option>)}
      </select>
      <button type="button" disabled={busy || !sectionId} onClick={() => onSection({ add: [sectionId] })} className="inline-flex items-center gap-1 rounded-lg bg-indigo-500 px-2.5 py-1.5 font-semibold disabled:opacity-40">
        <FolderPlus className="h-4 w-4" />{isAr ? 'إضافة للقسم' : 'Add to section'}
      </button>
      <button type="button" disabled={busy || !sectionId} onClick={() => onSection({ remove: [sectionId] })} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 font-semibold ring-1 ring-white/30 disabled:opacity-40">
        <FolderMinus className="h-4 w-4" />{isAr ? 'إزالة من القسم' : 'Remove from section'}
      </button>
      <span className="mx-1 h-5 w-px bg-white/20" aria-hidden />
      <button type="button" disabled={busy} onClick={() => onAction('submit')} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 font-semibold ring-1 ring-white/30 disabled:opacity-40">
        <Send className="h-4 w-4" />{isAr ? 'إرسال المسودات' : 'Submit drafts'}
      </button>
      <button type="button" disabled={busy} onClick={() => onAction('pause')} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 font-semibold ring-1 ring-white/30 disabled:opacity-40">
        <Pause className="h-4 w-4" />{isAr ? 'إيقاف المعروض' : 'Pause live'}
      </button>
      <button type="button" onClick={onClear} className="ms-auto rounded-lg p-1.5 hover:bg-white/10" aria-label={isAr ? 'إلغاء التحديد' : 'Clear selection'}>
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

const SORT_OPTIONS = [
  { value: 'updated', ar: 'آخر تعديل', en: 'Recently updated' },
  { value: 'newest', ar: 'الأحدث', en: 'Newest' },
  { value: 'name', ar: 'الاسم', en: 'Name' },
  { value: 'price-asc', ar: 'السعر ↑', en: 'Price ↑' },
  { value: 'price-desc', ar: 'السعر ↓', en: 'Price ↓' },
  { value: 'stock-asc', ar: 'المخزون ↑', en: 'Stock ↑' },
  { value: 'best-selling', ar: 'الأكثر مبيعاً', en: 'Best selling' },
];

export default function SellerProductsPage() {
  const { isAr, reload: reloadSeller } = useOutletContext();
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const listingStatus = searchParams.get('listingStatus') || '';
  const sellerCategory = searchParams.get('sellerCategory') || '';
  const stockFilter = searchParams.get('stock') || '';
  const sort = searchParams.get('sort') || 'updated';
  const [q, setQ] = useState(() => searchParams.get('q') || '');
  const [items, setItems] = useState([]);
  const [sections, setSections] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [selected, setSelected] = useState(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const urlQ = searchParams.get('q');
  // The top-bar search lands here with ?q= — follow it even when already on this page.
  useEffect(() => { if (urlQ !== null) setQ(urlQ); }, [urlQ]);
  const showImport = searchParams.get('import') === '1';
  const setShowImport = (fn) => setParam('import', fn(showImport) ? '1' : '');

  const setParam = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value); else next.delete(key);
    setPage(1);
    setSelected(new Set());
    setSearchParams(next);
  };

  const loadSections = useCallback(() => {
    sellerApi.listCategories().then(({ data }) => setSections(data.data || [])).catch(() => {});
  }, []);
  useEffect(() => { loadSections(); }, [loadSections]);

  const load = useCallback(() => {
    setLoading(true);
    sellerApi.listProducts({
      listingStatus: listingStatus || undefined,
      sellerCategory: sellerCategory || undefined,
      stock: stockFilter || undefined,
      sort,
      q: q || undefined,
      page,
      limit: 25,
    })
      .then(({ data }) => {
        setItems(data.data || []);
        setPagination(data.pagination || { page: 1, pages: 1, total: 0 });
      })
      .catch(() => toast.error(isAr ? 'تعذّر تحميل المنتجات' : 'Could not load products'))
      .finally(() => setLoading(false));
  }, [listingStatus, sellerCategory, stockFilter, sort, q, page, isAr, toast]);

  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  const sectionById = useMemo(() => new Map(sections.map((c) => [String(c._id), c])), [sections]);
  const replaceItem = (next) => setItems((prev) => prev.map((p) => (p._id === next._id ? next : p)));

  const act = async (product, action) => {
    if (action === 'delete' && !window.confirm(isAr ? 'حذف هذا المنتج نهائياً؟' : 'Delete this product permanently?')) return;
    setBusyId(product._id);
    try {
      if (action === 'delete') {
        await sellerApi.deleteProduct(product._id);
        setItems((prev) => prev.filter((p) => p._id !== product._id));
      } else if (action === 'duplicate') {
        const { data } = await sellerApi.duplicateProduct(product._id);
        toast.success(isAr ? 'تم إنشاء نسخة كمسودة — أضف الصور' : 'Copy created as a draft — add photos');
        navigate(`/seller-center/products/${data.data._id}`);
        return;
      } else {
        const fn = { submit: sellerApi.submitProduct, pause: sellerApi.pauseProduct, unpause: sellerApi.unpauseProduct }[action];
        const { data } = await fn(product._id);
        replaceItem(data.data);
      }
      toast.success(isAr ? 'تم' : 'Done');
      reloadSeller();
    } catch (err) {
      toast.error(apiError(err, isAr ? 'تعذّر تنفيذ الإجراء' : 'Action failed'));
    } finally {
      setBusyId('');
    }
  };

  const toggle = (id) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const allOnPage = items.length > 0 && items.every((p) => selected.has(p._id));
  const toggleAll = () => setSelected(allOnPage ? new Set() : new Set(items.map((p) => p._id)));

  const bulkSection = async (change) => {
    setBulkBusy(true);
    try {
      await sellerApi.bulkProductCategories({ ids: [...selected], ...change });
      toast.success(isAr ? 'تم تحديث الأقسام' : 'Sections updated');
      setSelected(new Set());
      load();
      loadSections();
    } catch (err) {
      toast.error(apiError(err, isAr ? 'تعذّر التحديث' : 'Update failed'));
    } finally {
      setBulkBusy(false);
    }
  };

  /** Runs the per-product endpoint for each eligible selected product. */
  const bulkAction = async (action) => {
    const eligible = items.filter((p) => selected.has(p._id)
      && (action === 'submit' ? ['draft', 'rejected'].includes(p.listingStatus) : p.listingStatus === 'approved'));
    if (!eligible.length) {
      toast.error(action === 'submit'
        ? (isAr ? 'لا توجد مسودات ضمن المحدد' : 'No drafts in the selection')
        : (isAr ? 'لا توجد منتجات معروضة ضمن المحدد' : 'No live products in the selection'));
      return;
    }
    setBulkBusy(true);
    const fn = action === 'submit' ? sellerApi.submitProduct : sellerApi.pauseProduct;
    const results = await Promise.allSettled(eligible.map((p) => fn(p._id)));
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    toast[ok === eligible.length ? 'success' : 'error'](isAr ? `تم ${ok} من ${eligible.length}` : `${ok} of ${eligible.length} done`);
    setBulkBusy(false);
    setSelected(new Set());
    load();
    reloadSeller();
  };

  const tabLabel = (tab) => (tab ? label(LISTING_STATUS, tab, isAr) : (isAr ? 'الكل' : 'All'));
  const selectCls = 'rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{isAr ? 'منتجاتي' : 'My products'}</h1>
          <p className="text-sm text-slate-500">{isAr ? `${pagination.total} منتج` : `${pagination.total} product(s)`}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setShowImport((v) => !v)} className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold ring-1 ring-slate-300 hover:bg-white">
            <FileUp className="h-4 w-4" aria-hidden />{isAr ? 'استيراد CSV' : 'Import CSV'}
          </button>
          <Link to="/seller-center/categories" className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold ring-1 ring-slate-300 hover:bg-white">
            <Tags className="h-4 w-4" aria-hidden />{isAr ? 'أقسام متجري' : 'My sections'}
          </Link>
          <Link to="/seller-center/products/new" className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-indigo-700">
            <Plus className="h-4 w-4" aria-hidden />{isAr ? 'إضافة منتج' : 'Add product'}
          </Link>
        </div>
      </div>

      {showImport && <CsvImport isAr={isAr} onDone={() => { load(); loadSections(); }} />}

      <div className="flex flex-wrap gap-1.5">
        {TABS.map((tab) => (
          <button
            key={tab || 'all'}
            type="button"
            onClick={() => setParam('listingStatus', tab)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${listingStatus === tab ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200'}`}
          >
            {tabLabel(tab)}
          </button>
        ))}
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto_auto]">
        <label className="relative">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => { setPage(1); setQ(e.target.value); }}
            placeholder={isAr ? 'بحث بالاسم أو SKU أو الباركود' : 'Search name, SKU or barcode'}
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pe-3 ps-9 text-sm"
          />
        </label>
        <select value={sellerCategory} onChange={(e) => setParam('sellerCategory', e.target.value)} className={selectCls} aria-label={isAr ? 'القسم' : 'Section'}>
          <option value="">{isAr ? 'كل الأقسام' : 'All sections'}</option>
          <option value="none">{isAr ? 'بدون قسم' : 'No section'}</option>
          {sections.map((c) => <option key={c._id} value={c._id}>{c.parent ? '↳ ' : ''}{isAr ? c.nameAr : c.nameEn} ({c.productCount})</option>)}
        </select>
        <select value={stockFilter} onChange={(e) => setParam('stock', e.target.value)} className={selectCls} aria-label={isAr ? 'المخزون' : 'Stock'}>
          <option value="">{isAr ? 'كل المخزون' : 'Any stock'}</option>
          <option value="low">{isAr ? 'مخزون منخفض (≤5)' : 'Low stock (≤5)'}</option>
          <option value="out">{isAr ? 'نفد المخزون' : 'Out of stock'}</option>
        </select>
        <select value={sort} onChange={(e) => setParam('sort', e.target.value === 'updated' ? '' : e.target.value)} className={selectCls} aria-label={isAr ? 'ترتيب' : 'Sort'}>
          {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{isAr ? o.ar : o.en}</option>)}
        </select>
      </div>

      {selected.size > 0 && (
        <BulkBar
          isAr={isAr}
          count={selected.size}
          sections={sections}
          busy={bulkBusy}
          onSection={bulkSection}
          onAction={bulkAction}
          onClear={() => setSelected(new Set())}
        />
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex min-h-[200px] items-center justify-center"><Loader size="lg" /></div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-10 text-center text-sm text-slate-500">
            <PackageOpen className="h-10 w-10 text-slate-300" aria-hidden />
            {isAr ? 'لا توجد منتجات هنا.' : 'No products here.'}
            <Link to="/seller-center/products/new" className="font-semibold text-indigo-700 hover:underline">{isAr ? 'أضف منتجاً' : 'Add a product'}</Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="bg-slate-50 text-start text-xs uppercase text-slate-500">
                <tr>
                  <th className="w-10 px-4 py-3">
                    <input type="checkbox" checked={allOnPage} onChange={toggleAll} aria-label={isAr ? 'تحديد الكل' : 'Select all'} className="h-4 w-4 rounded" />
                  </th>
                  <th className="px-4 py-3 text-start">{isAr ? 'المنتج' : 'Product'}</th>
                  <th className="px-4 py-3 text-start">{isAr ? 'السعر' : 'Price'}</th>
                  <th className="px-4 py-3 text-start">{isAr ? 'المخزون' : 'Stock'}</th>
                  <th className="px-4 py-3 text-start">{isAr ? 'الحالة' : 'Status'}</th>
                  <th className="px-4 py-3 text-end">{isAr ? 'إجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((p) => (
                  <tr key={p._id} className={`align-top ${selected.has(p._id) ? 'bg-indigo-50/50' : ''}`}>
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={selected.has(p._id)} onChange={() => toggle(p._id)} aria-label={isAr ? 'تحديد' : 'Select'} className="h-4 w-4 rounded" />
                    </td>
                    <td className="px-4 py-3">
                      <Link to={`/seller-center/products/${p._id}`} className="flex items-center gap-3 hover:text-indigo-700">
                        {typeof p.image === 'string' && p.image.startsWith('http') ? (
                          <img src={p.image} alt="" className="h-12 w-12 rounded-lg object-cover ring-1 ring-slate-200" />
                        ) : (
                          <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 text-xl">{p.emoji || '🛍️'}</span>
                        )}
                        <span className="min-w-0">
                          <span className="block font-semibold">{isAr ? p.nameAr : p.nameEn}</span>
                          <span className="block text-xs text-slate-500" dir="ltr">{p.sku}</span>
                          <span className="block text-xs text-slate-500">{label(FULFILLMENT, p.fulfilledBy, isAr)}</span>
                        </span>
                      </Link>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {(p.sellerCategories || []).map((cid) => sectionById.get(cid)).filter(Boolean).map((c) => (
                          <button key={c._id} type="button" onClick={() => setParam('sellerCategory', c._id)} className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700 hover:bg-indigo-100">
                            {isAr ? c.nameAr : c.nameEn}
                          </button>
                        ))}
                        {!p.hasMarketplaceCategory && (
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800" title={isAr ? 'سيضعه فريق المراجعة في قسم المنصة' : 'Our review team will place it in a marketplace category'}>
                            {isAr ? 'بدون قسم منصة' : 'No marketplace category'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-semibold">{formatPrice(p.price)}</span>
                      {p.oldPrice > p.price && <span className="block text-xs text-slate-400 line-through">{formatPrice(p.oldPrice)}</span>}
                    </td>
                    <td className="px-4 py-3"><StockCell product={p} isAr={isAr} onSaved={replaceItem} /></td>
                    <td className="px-4 py-3">
                      <StatusBadge map={LISTING_STATUS} value={p.listingStatus} isAr={isAr} />
                      {p.pendingChangesAt && (
                        <span className="mt-1 block text-xs text-amber-700">{isAr ? 'تعديلات بانتظار المراجعة' : 'Edits waiting for review'}</span>
                      )}
                      {p.reviewNote && ['rejected'].includes(p.listingStatus) && (
                        <span className="mt-1 block max-w-[220px] text-xs text-red-700">{p.reviewNote}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        {['draft', 'rejected'].includes(p.listingStatus) && (
                          <button type="button" disabled={busyId === p._id} onClick={() => act(p, 'submit')} className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
                            <Send className="h-3.5 w-3.5" aria-hidden />{isAr ? 'إرسال للمراجعة' : 'Submit'}
                          </button>
                        )}
                        {p.listingStatus === 'approved' && (
                          <button type="button" disabled={busyId === p._id} onClick={() => act(p, 'pause')} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-50">
                            <Pause className="h-3.5 w-3.5" aria-hidden />{isAr ? 'إيقاف' : 'Pause'}
                          </button>
                        )}
                        {p.listingStatus === 'paused' && (
                          <button type="button" disabled={busyId === p._id} onClick={() => act(p, 'unpause')} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-50">
                            <Play className="h-3.5 w-3.5" aria-hidden />{isAr ? 'تشغيل' : 'Resume'}
                          </button>
                        )}
                        <Link to={`/seller-center/products/${p._id}`} className="rounded-lg p-1.5 ring-1 ring-slate-200 hover:bg-slate-50" aria-label={isAr ? 'تعديل' : 'Edit'} title={isAr ? 'تعديل' : 'Edit'}>
                          <Pencil className="h-4 w-4" aria-hidden />
                        </Link>
                        <button type="button" disabled={busyId === p._id} onClick={() => act(p, 'duplicate')} className="rounded-lg p-1.5 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-50" aria-label={isAr ? 'نسخ' : 'Duplicate'} title={isAr ? 'نسخ كمنتج جديد' : 'Duplicate'}>
                          <Copy className="h-4 w-4" aria-hidden />
                        </button>
                        {!(p.soldCount > 0) && (
                          <button type="button" disabled={busyId === p._id} onClick={() => act(p, 'delete')} className="rounded-lg p-1.5 text-red-600 ring-1 ring-slate-200 hover:bg-red-50 disabled:opacity-50" aria-label={isAr ? 'حذف' : 'Delete'}>
                            <Trash2 className="h-4 w-4" aria-hidden />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {pagination.pages > 1 && (
        <div className="flex items-center justify-center gap-2 text-sm">
          <button type="button" disabled={page <= 1} onClick={() => setPage((n) => n - 1)} className="rounded-lg px-3 py-1.5 ring-1 ring-slate-200 disabled:opacity-40">
            {isAr ? 'السابق' : 'Previous'}
          </button>
          <span>{page} / {pagination.pages}</span>
          <button type="button" disabled={page >= pagination.pages} onClick={() => setPage((n) => n + 1)} className="rounded-lg px-3 py-1.5 ring-1 ring-slate-200 disabled:opacity-40">
            {isAr ? 'التالي' : 'Next'}
          </button>
        </div>
      )}
    </div>
  );
}
