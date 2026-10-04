import { useCallback, useEffect, useState } from 'react';
import { Link, useOutletContext, useSearchParams } from '../../app/router';
import { Search } from 'lucide-react';
import Loader from '../../components/ui/Loader';
import { useToast } from '../../components/ui/Toast';
import { sellerApi } from '../../services/sellerApi';
import { formatPrice } from '../../utils/formatters';
import { FULFILLMENT, SHIPMENT_STATUS, label } from '../sellerLabels';
import StatusBadge from '../StatusBadge';

const TABS = [
  { key: 'open', ar: 'مفتوحة', en: 'Open' },
  { key: 'pending', ar: 'للتأكيد', en: 'To confirm' },
  { key: 'confirmed', ar: 'للشحن', en: 'To ship' },
  { key: 'shipped', ar: 'في الطريق', en: 'In transit' },
  { key: 'delivered', ar: 'مسلّمة', en: 'Delivered' },
  { key: 'cancelled', ar: 'ملغاة', en: 'Cancelled' },
  { key: '', ar: 'الكل', en: 'All' },
];

function fmtDate(value, isAr) {
  return value ? new Date(value).toLocaleString(isAr ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
}

export default function SellerOrdersPage() {
  const { isAr } = useOutletContext();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const status = searchParams.get('status') ?? 'open';
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState([]);
  const [counts, setCounts] = useState({});
  const [pagination, setPagination] = useState({ pages: 1 });
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    sellerApi.listShipments({ status: status || undefined, q: q || undefined, page, limit: 25 })
      .then(({ data }) => {
        setItems(data.data || []);
        setCounts(data.counts || {});
        setPagination(data.pagination || { pages: 1 });
      })
      .catch(() => toast.error(isAr ? 'تعذّر تحميل الطلبات' : 'Could not load orders'))
      .finally(() => setLoading(false));
  }, [status, q, page, isAr, toast]);

  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  const tabCount = (key) => {
    if (key === 'open') return ['pending', 'confirmed', 'packed', 'shipped'].reduce((s, k) => s + (counts[k] || 0), 0);
    if (key === 'confirmed') return (counts.confirmed || 0) + (counts.packed || 0);
    if (!key) return Object.values(counts).reduce((a, b) => a + b, 0);
    return counts[key] || 0;
  };

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">{isAr ? 'الطلبات' : 'Orders'}</h1>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1.5">
          {TABS.map((tab) => (
            <button
              key={tab.key || 'all'}
              type="button"
              onClick={() => { setPage(1); setSearchParams({ status: tab.key }); }}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${status === tab.key ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200'}`}
            >
              {isAr ? tab.ar : tab.en} ({tabCount(tab.key)})
            </button>
          ))}
        </div>
        <label className="relative ms-auto w-full sm:w-64">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => { setPage(1); setQ(e.target.value); }}
            placeholder={isAr ? 'رقم الطلب أو الشحنة' : 'Order or shipment number'}
            className="w-full rounded-xl border border-slate-200 bg-white py-2 ps-9 pe-3 text-sm"
            dir="ltr"
          />
        </label>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex min-h-[200px] items-center justify-center"><Loader size="lg" /></div>
        ) : items.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">{isAr ? 'لا توجد طلبات هنا.' : 'No orders here.'}</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((s) => (
              <li key={s._id}>
                <Link to={`/seller-center/orders/${s._id}`} className="flex flex-wrap items-center gap-4 px-4 py-3 hover:bg-slate-50">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold" dir="ltr">{s.shipmentNumber}</p>
                    <p className="text-xs text-slate-500">
                      {fmtDate(s.createdAt, isAr)} · {label(FULFILLMENT, s.fulfilledBy, isAr)}
                      {' · '}
                      {s.items.reduce((n, it) => n + it.quantity, 0)} {isAr ? 'قطعة' : 'units'}
                    </p>
                    <p className="mt-0.5 line-clamp-1 text-xs text-slate-600">
                      {s.items.map((it) => (isAr ? it.nameAr : it.nameEn || it.nameAr)).join('، ')}
                    </p>
                  </div>
                  <div className="text-end">
                    <p className="font-semibold">{formatPrice(s.sellerNet)}</p>
                    <p className="text-xs text-slate-500">{isAr ? 'صافي ربحك' : 'your net'}</p>
                  </div>
                  <StatusBadge map={SHIPMENT_STATUS} value={s.status} isAr={isAr} />
                </Link>
              </li>
            ))}
          </ul>
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
