import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from '../../app/router';
import { Search } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { adminApi } from '../adminApi';
import Loader from '../../components/ui/Loader';
import { PageHeader, Pagination, useToast } from '../components';
import { formatPrice } from '../../utils/formatters';
import { FULFILLMENT, SHIPMENT_STATUS, label } from '../../seller/sellerLabels';
import StatusBadge from '../../seller/StatusBadge';

const FILTERS = [
  { key: 'open', ar: 'مفتوحة', en: 'Open' },
  { key: 'pending', ar: 'لم يؤكدها البائع', en: 'Not confirmed' },
  { key: 'shipped', ar: 'في الطريق', en: 'In transit' },
  { key: 'delivered', ar: 'مسلّمة', en: 'Delivered' },
  { key: 'cancelled', ar: 'ملغاة', en: 'Cancelled' },
  { key: 'manual', ar: 'تحتاج استرداداً يدوياً', en: 'Needs manual refund' },
  { key: '', ar: 'الكل', en: 'All' },
];

const inputCls = 'w-full rounded-xl border border-border bg-white px-3 py-2 text-sm';

function fmtDate(value, isAr) {
  return value ? new Date(value).toLocaleString(isAr ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
}

/** Ops view across all sellers — find late, stuck or refund-pending seller shipments. */
export default function SellerShipmentsPage() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const filter = searchParams.get('filter') ?? 'open';
  const sellerId = searchParams.get('seller') || '';
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    adminApi.listSellerShipments({
      status: filter === 'manual' ? undefined : filter || undefined,
      refund: filter === 'manual' ? 'manual' : undefined,
      seller: sellerId || undefined,
      q: q || undefined,
      page,
      limit: 25,
    })
      .then(({ data }) => {
        setItems(data.data || []);
        setPagination(data.pagination);
      })
      .catch(() => toast.error(isAr ? 'تعذّر التحميل' : 'Could not load shipments'))
      .finally(() => setLoading(false));
  }, [filter, sellerId, q, page, isAr, toast]);

  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  const setFilter = (key) => {
    setPage(1);
    setSearchParams({ filter: key, ...(sellerId ? { seller: sellerId } : {}) });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        description={isAr ? 'شحنات يرسلها البائع بنفسه، أو نرسلها نحن عنه.' : 'Parcels sellers send themselves, or that we send for them.'}
      />
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button key={f.key || 'all'} type="button" onClick={() => setFilter(f.key)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${filter === f.key ? 'bg-primary-600 text-white' : 'bg-white text-text ring-1 ring-border'}`}>
              {isAr ? f.ar : f.en}
            </button>
          ))}
          {sellerId && (
            <button type="button" onClick={() => setSearchParams({ filter })} className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold">
              {isAr ? 'كل البائعين ×' : 'All sellers ×'}
            </button>
          )}
        </div>
        <label className="relative ms-auto w-full sm:w-64">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input value={q} onChange={(e) => { setPage(1); setQ(e.target.value); }} placeholder={isAr ? 'رقم الطلب أو الشحنة' : 'Order or shipment no.'} className={`${inputCls} ps-9`} dir="ltr" />
        </label>
      </div>

      <section className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
        {loading ? (
          <div className="flex min-h-[200px] items-center justify-center"><Loader size="lg" /></div>
        ) : items.length === 0 ? (
          <p className="p-8 text-center text-sm text-text-muted">{isAr ? 'لا توجد شحنات.' : 'No shipments.'}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-slate-50 text-xs text-text-muted">
                <tr>
                  <th className="px-4 py-3 text-start">{isAr ? 'الشحنة' : 'Shipment'}</th>
                  <th className="px-4 py-3 text-start">{isAr ? 'البائع' : 'Seller'}</th>
                  <th className="px-4 py-3 text-start">{isAr ? 'القيمة / صافي البائع' : 'Value / seller net'}</th>
                  <th className="px-4 py-3 text-start">{isAr ? 'الحالة' : 'Status'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((s) => (
                  <tr key={s._id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link to={`/admin/orders?order=${s.orderId}`} className="font-semibold text-primary-700 hover:underline" dir="ltr">{s.shipmentNumber}</Link>
                      <p className="text-xs text-text-muted">{fmtDate(s.createdAt, isAr)} · {label(FULFILLMENT, s.fulfilledBy, isAr)}</p>
                    </td>
                    <td className="px-4 py-3">{isAr ? s.seller.nameAr : s.seller.nameEn}</td>
                    <td className="px-4 py-3 tabular-nums">{formatPrice(s.subtotal + s.deliveryFee)} / {formatPrice(s.sellerNet)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge map={SHIPMENT_STATUS} value={s.status} isAr={isAr} />
                      {s.refund?.status === 'manual_required' && (
                        <span className="mt-1 block text-xs font-semibold text-red-700">
                          {isAr ? `استرداد يدوي ${formatPrice(s.refund.amount)}` : `Manual refund ${formatPrice(s.refund.amount)}`}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {pagination?.pages > 1 && <Pagination page={page} pages={pagination.pages} total={pagination.total} limit={pagination.limit} onPageChange={setPage} isAr={isAr} />}
    </div>
  );
}
