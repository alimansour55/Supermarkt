import { useCallback, useEffect, useState } from 'react';
import { Link, useOutletContext, useSearchParams } from '../../app/router';
import { Pause, Play, Plus, Search, Send, Trash2 } from 'lucide-react';
import Loader from '../../components/ui/Loader';
import { useToast } from '../../components/ui/Toast';
import { sellerApi } from '../../services/sellerApi';
import { formatPrice } from '../../utils/formatters';
import { FULFILLMENT, LISTING_STATUS, apiError, label } from '../sellerLabels';
import StatusBadge from '../StatusBadge';

const TABS = ['', 'approved', 'pending_review', 'draft', 'rejected', 'paused'];

function StockCell({ product, isAr, onSaved }) {
  const toast = useToast();
  const [value, setValue] = useState(String(product.stock ?? 0));
  const [busy, setBusy] = useState(false);
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

export default function SellerProductsPage() {
  const { isAr, reload: reloadSeller } = useOutletContext();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const listingStatus = searchParams.get('listingStatus') || '';
  const [q, setQ] = useState('');
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    sellerApi.listProducts({ listingStatus: listingStatus || undefined, q: q || undefined, page, limit: 25 })
      .then(({ data }) => {
        setItems(data.data || []);
        setPagination(data.pagination || { page: 1, pages: 1, total: 0 });
      })
      .catch(() => toast.error(isAr ? 'تعذّر تحميل المنتجات' : 'Could not load products'))
      .finally(() => setLoading(false));
  }, [listingStatus, q, page, isAr, toast]);

  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  const replaceItem = (next) => setItems((prev) => prev.map((p) => (p._id === next._id ? next : p)));

  const act = async (product, action) => {
    if (action === 'delete' && !window.confirm(isAr ? 'حذف هذا المنتج نهائياً؟' : 'Delete this product permanently?')) return;
    setBusyId(product._id);
    try {
      if (action === 'delete') {
        await sellerApi.deleteProduct(product._id);
        setItems((prev) => prev.filter((p) => p._id !== product._id));
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

  const tabLabel = (tab) => (tab ? label(LISTING_STATUS, tab, isAr) : (isAr ? 'الكل' : 'All'));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{isAr ? 'منتجاتي' : 'My products'}</h1>
        <Link to="/seller-center/products/new" className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-indigo-700">
          <Plus className="h-4 w-4" aria-hidden />
          {isAr ? 'إضافة منتج' : 'Add product'}
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1.5">
          {TABS.map((tab) => (
            <button
              key={tab || 'all'}
              type="button"
              onClick={() => { setPage(1); setSearchParams(tab ? { listingStatus: tab } : {}); }}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${listingStatus === tab ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200'}`}
            >
              {tabLabel(tab)}
            </button>
          ))}
        </div>
        <label className="relative ms-auto w-full sm:w-64">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => { setPage(1); setQ(e.target.value); }}
            placeholder={isAr ? 'بحث بالاسم أو SKU' : 'Search name or SKU'}
            className="w-full rounded-xl border border-slate-200 bg-white py-2 ps-9 pe-3 text-sm"
          />
        </label>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex min-h-[200px] items-center justify-center"><Loader size="lg" /></div>
        ) : items.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">
            {isAr ? 'لا توجد منتجات هنا بعد.' : 'No products here yet.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-slate-50 text-start text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-start">{isAr ? 'المنتج' : 'Product'}</th>
                  <th className="px-4 py-3 text-start">{isAr ? 'السعر' : 'Price'}</th>
                  <th className="px-4 py-3 text-start">{isAr ? 'المخزون' : 'Stock'}</th>
                  <th className="px-4 py-3 text-start">{isAr ? 'الحالة' : 'Status'}</th>
                  <th className="px-4 py-3 text-end">{isAr ? 'إجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((p) => (
                  <tr key={p._id} className="align-top">
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
                    </td>
                    <td className="px-4 py-3 font-semibold">{formatPrice(p.price)}</td>
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
