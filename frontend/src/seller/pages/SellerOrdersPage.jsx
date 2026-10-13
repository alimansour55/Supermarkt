import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useOutletContext, useSearchParams } from '../../app/router';
import { AlarmClock, CheckCheck, ClipboardList, Download, PackageCheck, Printer, Search, X } from 'lucide-react';
import { useToast } from '../../components/ui/Toast';
import { sellerApi } from '../../services/sellerApi';
import { formatPrice } from '../../utils/formatters';
import { FULFILLMENT, SHIPMENT_STATUS, apiError, label } from '../sellerLabels';
import StatusBadge from '../StatusBadge';
import { EmptyState, PageHeader, TableSkeleton } from '../ui';
import { saveBlob } from '../sellerUtils';

const TABS = [
  { key: 'open', ar: 'مفتوحة', en: 'Open' },
  { key: 'pending', ar: 'للتأكيد', en: 'To confirm' },
  { key: 'confirmed', ar: 'للشحن', en: 'To ship' },
  { key: 'shipped', ar: 'في الطريق', en: 'In transit' },
  { key: 'delivered', ar: 'مسلّمة', en: 'Delivered' },
  { key: 'cancelled', ar: 'ملغاة', en: 'Cancelled' },
  { key: 'returned', ar: 'مرتجعة', en: 'Returned' },
  { key: 'all', ar: 'الكل', en: 'All' },
];

const DAY = 86400000;

function fmtDate(value, isAr) {
  return value ? new Date(value).toLocaleString(isAr ? 'ar-EG-u-nu-latn' : 'en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
}

/** "Ship by" for seller-shipped orders still waiting — overdue ones are red. */
function ShipBy({ shipment, handlingDays, isAr }) {
  if (shipment.fulfilledBy !== 'seller' || !['pending', 'confirmed', 'packed'].includes(shipment.status)) return null;
  const due = new Date(new Date(shipment.createdAt).getTime() + (handlingDays + 1) * DAY);
  const hoursLeft = Math.round((due - Date.now()) / 3600000);
  const overdue = hoursLeft < 0;
  const soon = !overdue && hoursLeft <= 24;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${overdue ? 'bg-red-100 text-red-700' : soon ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>
      <AlarmClock className="h-3 w-3" aria-hidden />
      {overdue
        ? (isAr ? 'متأخر عن موعد الشحن' : 'Past ship-by date')
        : (isAr ? `اشحن قبل ${due.toLocaleDateString('ar-EG-u-nu-latn', { day: 'numeric', month: 'short' })}` : `Ship by ${due.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`)}
    </span>
  );
}

export default function SellerOrdersPage() {
  const { isAr, seller, refreshSummary } = useOutletContext();
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const status = searchParams.get('status') || 'open';
  const fulfilledBy = searchParams.get('fulfilledBy') || '';
  const from = searchParams.get('from') || '';
  const to = searchParams.get('to') || '';
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState([]);
  const [counts, setCounts] = useState({});
  const [pagination, setPagination] = useState({ pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(() => new Set());
  const [busy, setBusy] = useState(false);

  const filters = useCallback(() => ({
    status: status === 'all' ? undefined : status,
    fulfilledBy: fulfilledBy || undefined,
    from: from || undefined,
    to: to || undefined,
    q: q || undefined,
  }), [status, fulfilledBy, from, to, q]);

  const load = useCallback(() => {
    setLoading(true);
    sellerApi.listShipments({ ...filters(), page, limit: 25 })
      .then(({ data }) => {
        setItems(data.data || []);
        setCounts(data.counts || {});
        setPagination(data.pagination || { pages: 1, total: 0 });
      })
      .catch(() => toast.error(isAr ? 'تعذّر تحميل الطلبات' : 'Could not load orders'))
      .finally(() => setLoading(false));
  }, [filters, page, isAr, toast]);

  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  const setParam = (changes) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(changes).forEach(([k, v]) => { if (v) next.set(k, v); else next.delete(k); });
    setPage(1);
    setSelected(new Set());
    setSearchParams(next);
  };

  const tabCount = (key) => {
    if (key === 'open') return ['pending', 'confirmed', 'packed', 'shipped'].reduce((s, k) => s + (counts[k] || 0), 0);
    if (key === 'confirmed') return (counts.confirmed || 0) + (counts.packed || 0);
    if (key === 'all') return Object.values(counts).reduce((a, b) => a + b, 0);
    return counts[key] || 0;
  };

  const selectable = (s) => s.fulfilledBy === 'seller' && ['pending', 'confirmed'].includes(s.status);
  const selectableItems = items.filter(selectable);
  const allSelected = selectableItems.length > 0 && selectableItems.every((s) => selected.has(s._id));
  const toggle = (id) => setSelected((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const bulk = async (next) => {
    const ids = items.filter((s) => selected.has(s._id) && (next === 'confirmed' ? s.status === 'pending' : s.status === 'confirmed')).map((s) => s._id);
    if (!ids.length) {
      toast.error(next === 'confirmed' ? (isAr ? 'لا توجد طلبات جديدة ضمن المحدد' : 'No new orders in the selection') : (isAr ? 'لا توجد طلبات مؤكدة ضمن المحدد' : 'No confirmed orders in the selection'));
      return;
    }
    setBusy(true);
    try {
      const { data } = await sellerApi.bulkShipmentStatus({ ids, status: next });
      toast[data.failed ? 'error' : 'success'](isAr ? `تم تحديث ${data.updated} طلب${data.failed ? ` — فشل ${data.failed}` : ''}` : `${data.updated} updated${data.failed ? ` — ${data.failed} failed` : ''}`);
    } catch (err) {
      toast.error(apiError(err, isAr ? 'تعذّر التحديث' : 'Update failed'));
    } finally {
      setBusy(false);
      setSelected(new Set());
      load();
      refreshSummary?.();
    }
  };

  const exportCsv = async () => {
    try {
      const res = await sellerApi.exportShipments(filters());
      saveBlob(res, 'orders.csv');
    } catch (err) {
      toast.error(apiError(err, isAr ? 'تعذّر التصدير' : 'Export failed'));
    }
  };

  const hasFilters = fulfilledBy || from || to;

  return (
    <div className="space-y-4">
      <PageHeader
        icon={ClipboardList}
        title={isAr ? 'إدارة الطلبات' : 'Manage orders'}
        description={isAr ? `أكّد الطلبات الجديدة واشحنها خلال ${seller.handlingDays} يوم للحفاظ على صحة حسابك.` : `Confirm new orders and ship within ${seller.handlingDays} day(s) to keep your account healthy.`}
        actions={(
          <button type="button" onClick={exportCsv} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold ring-1 ring-slate-300 hover:bg-white">
            <Download className="h-4 w-4" />{isAr ? 'تصدير CSV' : 'Export CSV'}
          </button>
        )}
      />

      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {TABS.map((tab) => {
          const n = tabCount(tab.key);
          const on = status === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setParam({ status: tab.key === 'open' ? '' : tab.key })}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold ${on ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'}`}
            >
              {isAr ? tab.ar : tab.en}
              <span className={`rounded-full px-1.5 text-[11px] ${on ? 'bg-white/20' : tab.key === 'pending' && n ? 'bg-red-500 text-white' : 'bg-slate-100'}`}>{n}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => { setPage(1); setQ(e.target.value); }} placeholder={isAr ? 'رقم الطلب أو الشحنة' : 'Order or shipment number'} className="w-full rounded-xl border border-slate-200 bg-white py-2 pe-3 ps-9 text-sm" dir="ltr" />
        </label>
        <select value={fulfilledBy} onChange={(e) => setParam({ fulfilledBy: e.target.value })} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" aria-label={isAr ? 'طريقة الشحن' : 'Fulfillment'}>
          <option value="">{isAr ? 'كل طرق الشحن' : 'Any fulfillment'}</option>
          <option value="seller">{label(FULFILLMENT, 'seller', isAr)}</option>
          <option value="store">{label(FULFILLMENT, 'store', isAr)}</option>
        </select>
        <div className="flex items-center gap-1.5 text-sm">
          <input type="date" value={from} max={to || undefined} onChange={(e) => setParam({ from: e.target.value })} className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5" aria-label={isAr ? 'من' : 'From'} />
          <span className="text-slate-400">—</span>
          <input type="date" value={to} min={from || undefined} onChange={(e) => setParam({ to: e.target.value })} className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5" aria-label={isAr ? 'إلى' : 'To'} />
        </div>
        {hasFilters && (
          <button type="button" onClick={() => setParam({ fulfilledBy: '', from: '', to: '' })} className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-700 hover:underline">
            <X className="h-3.5 w-3.5" />{isAr ? 'مسح الفلاتر' : 'Clear filters'}
          </button>
        )}
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-slate-900 p-3 text-sm text-white">
          <span className="font-semibold">{isAr ? `${selected.size} محدد` : `${selected.size} selected`}</span>
          <button type="button" disabled={busy} onClick={() => bulk('confirmed')} className="inline-flex items-center gap-1 rounded-lg bg-indigo-500 px-2.5 py-1.5 font-semibold disabled:opacity-40">
            <CheckCheck className="h-4 w-4" />{isAr ? 'تأكيد الطلبات' : 'Confirm orders'}
          </button>
          <button type="button" disabled={busy} onClick={() => bulk('packed')} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 font-semibold ring-1 ring-white/30 disabled:opacity-40">
            <PackageCheck className="h-4 w-4" />{isAr ? 'تم التغليف' : 'Mark packed'}
          </button>
          <button type="button" onClick={() => navigate(`/seller-center/orders/print?ids=${[...selected].join(',')}`)} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 font-semibold ring-1 ring-white/30">
            <Printer className="h-4 w-4" />{isAr ? 'طباعة البوالص' : 'Print labels'}
          </button>
          <button type="button" onClick={() => setSelected(new Set())} className="ms-auto rounded-lg p-1.5 hover:bg-white/10" aria-label={isAr ? 'إلغاء التحديد' : 'Clear selection'}><X className="h-4 w-4" /></button>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <TableSkeleton />
        ) : items.length === 0 ? (
          <EmptyState icon={ClipboardList} title={isAr ? 'لا توجد طلبات هنا' : 'No orders here'} text={status === 'pending' ? (isAr ? 'لا توجد طلبات جديدة بانتظارك.' : 'No new orders waiting for you.') : undefined} />
        ) : (
          <>
            {selectableItems.length > 0 && (
              <label className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-600">
                <input type="checkbox" checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(selectableItems.map((s) => s._id)))} className="h-4 w-4 rounded" />
                {isAr ? 'تحديد كل الطلبات القابلة للتأكيد/التغليف' : 'Select all orders you can confirm / pack'}
              </label>
            )}
            <ul className="divide-y divide-slate-100">
              {items.map((s) => (
                <li key={s._id} className={`flex items-center gap-3 px-4 ${selected.has(s._id) ? 'bg-indigo-50/50' : ''}`}>
                  <span className="w-4 shrink-0">
                    {selectable(s) && <input type="checkbox" checked={selected.has(s._id)} onChange={() => toggle(s._id)} className="h-4 w-4 rounded" aria-label={isAr ? 'تحديد' : 'Select'} />}
                  </span>
                  <Link to={`/seller-center/orders/${s._id}`} className="flex min-w-0 flex-1 flex-wrap items-center gap-4 py-3">
                    {s.items[0]?.image ? <img src={s.items[0].image} alt="" className="h-12 w-12 rounded-lg object-cover ring-1 ring-slate-200" /> : <span className="h-12 w-12 rounded-lg bg-slate-100" />}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold" dir="ltr">{s.shipmentNumber}</p>
                        <ShipBy shipment={s} handlingDays={seller.handlingDays ?? 2} isAr={isAr} />
                      </div>
                      <p className="text-xs text-slate-500">
                        {fmtDate(s.createdAt, isAr)} · {label(FULFILLMENT, s.fulfilledBy, isAr)} · {s.items.reduce((n, it) => n + it.quantity, 0)} {isAr ? 'قطعة' : 'units'}
                      </p>
                      <p className="mt-0.5 line-clamp-1 text-xs text-slate-600">{s.items.map((it) => `${it.quantity}× ${isAr ? it.nameAr : it.nameEn || it.nameAr}`).join('، ')}</p>
                    </div>
                    <div className="text-end">
                      <p className="font-semibold tabular-nums">{formatPrice(s.sellerNet)}</p>
                      <p className="text-xs text-slate-500">{isAr ? 'صافي ربحك' : 'your net'}</p>
                    </div>
                    <StatusBadge map={SHIPMENT_STATUS} value={s.status} isAr={isAr} />
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {pagination.pages > 1 && (
        <div className="flex items-center justify-center gap-2 text-sm">
          <button type="button" disabled={page <= 1} onClick={() => setPage((n) => n - 1)} className="rounded-lg px-3 py-1.5 ring-1 ring-slate-200 disabled:opacity-40">{isAr ? 'السابق' : 'Previous'}</button>
          <span>{page} / {pagination.pages}</span>
          <button type="button" disabled={page >= pagination.pages} onClick={() => setPage((n) => n + 1)} className="rounded-lg px-3 py-1.5 ring-1 ring-slate-200 disabled:opacity-40">{isAr ? 'التالي' : 'Next'}</button>
        </div>
      )}
    </div>
  );
}
