import { useCallback, useEffect, useState } from 'react';
import { PackageCheck } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { adminApi } from '../adminApi';
import Button from '../../components/ui/Button';
import Loader from '../../components/ui/Loader';
import AdminSlidePanel from '../components/AdminSlidePanel';
import { PageHeader, useToast } from '../components';
import { hasPermission } from '../adminPermissions';
import { INBOUND_STATUS, apiError, label } from '../../seller/sellerLabels';
import StatusBadge from '../../seller/StatusBadge';

function fmtDate(value, isAr) {
  return value ? new Date(value).toLocaleDateString(isAr ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
}

/** Warehouse desk: stock sellers send for store fulfillment — count it in. */
export default function AdminSellerInboundPage() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const { user } = useAuth();
  const toast = useToast();
  const canReceive = hasPermission(user, 'products:write');
  const [status, setStatus] = useState('pending');
  const [items, setItems] = useState(null);
  const [receiving, setReceiving] = useState(null);
  const [counts, setCounts] = useState([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setItems(null);
    adminApi.listInbound({ status: status || undefined, limit: 50 }).then(({ data }) => setItems(data.data || []))
      .catch(() => { setItems([]); toast.error(isAr ? 'تعذّر التحميل' : 'Could not load'); });
  }, [status, isAr, toast]);
  useEffect(() => { load(); }, [load]);

  const openReceive = (s) => {
    setReceiving(s);
    setCounts(s.items.map((it) => String(it.quantity)));
    setNote('');
  };

  const receive = async () => {
    setBusy(true);
    try {
      await adminApi.receiveInbound(receiving._id, {
        items: counts.map((c, index) => ({ index, receivedQuantity: Number(c) })),
        note,
      });
      toast.success(isAr ? 'تم الاستلام وإضافة المخزون' : 'Received — stock added');
      setReceiving(null);
      load();
    } catch (err) {
      toast.error(apiError(err, isAr ? 'تعذّر الاستلام' : 'Could not receive'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={isAr ? 'مخزون البائعين الوارد' : 'Seller inbound stock'}
        description={isAr ? 'بضاعة يرسلها البائعون لمخزننا لنبيعها ونشحنها نيابة عنهم. يُضاف للمخزون ما تعدّه فقط.' : 'Stock sellers send to our warehouse so we sell and ship it for them. Only what you count is added.'}
      />
      <div className="flex gap-1.5">
        {['pending', 'received', 'cancelled', ''].map((s) => (
          <button key={s || 'all'} type="button" onClick={() => setStatus(s)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${status === s ? 'bg-primary-600 text-white' : 'bg-white ring-1 ring-border'}`}>
            {s ? label(INBOUND_STATUS, s, isAr) : (isAr ? 'الكل' : 'All')}
          </button>
        ))}
      </div>

      <section className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
        {!items ? (
          <div className="flex min-h-[160px] items-center justify-center"><Loader size="lg" /></div>
        ) : !items.length ? (
          <p className="p-6 text-sm text-text-muted">{isAr ? 'لا توجد شحنات.' : 'No inbound shipments.'}</p>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((s) => (
              <li key={s._id} className="px-5 py-3 text-sm">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-semibold" dir="ltr">{s.inboundNumber}</span>
                  <span>{isAr ? s.sellerNameAr : s.sellerNameEn}</span>
                  <StatusBadge map={INBOUND_STATUS} value={s.status} isAr={isAr} />
                  <span className="text-xs text-text-muted">
                    {fmtDate(s.createdAt, isAr)}
                    {s.expectedAt ? ` · ${isAr ? 'متوقع' : 'expected'} ${fmtDate(s.expectedAt, isAr)}` : ''}
                    {s.fulfillmentLocation?.name ? ` · ${s.fulfillmentLocation.name}` : ''}
                    {s.trackingNumber ? ` · ${s.carrier} ${s.trackingNumber}` : ''}
                  </span>
                  <span className="ms-auto font-semibold">{s.status === 'received' ? `${s.receivedUnits}/${s.totalUnits}` : s.totalUnits} {isAr ? 'قطعة' : 'units'}</span>
                  {canReceive && s.status === 'pending' && (
                    <Button size="sm" onClick={() => openReceive(s)}><PackageCheck className="h-4 w-4" />{isAr ? 'استلام' : 'Receive'}</Button>
                  )}
                </div>
                <p className="mt-1 text-xs text-text-muted">
                  {s.items.map((it) => `${isAr ? it.nameAr : it.nameEn}${it.variantLabelEn ? ` (${isAr ? it.variantLabelAr : it.variantLabelEn})` : ''} × ${it.quantity}`).join('، ')}
                </p>
                {s.receiveNote && <p className="mt-1 text-xs text-amber-800">{s.receiveNote}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <AdminSlidePanel open={Boolean(receiving)} onClose={() => setReceiving(null)} title={isAr ? 'استلام الشحنة' : 'Receive shipment'} subtitle={receiving ? `${receiving.inboundNumber} · ${isAr ? receiving.sellerNameAr : receiving.sellerNameEn}` : ''} isAr={isAr}>
        {receiving && (
          <div className="space-y-4">
            <p className="text-sm text-text-muted">{isAr ? 'اكتب الكمية التي وصلت سليمة لكل منتج.' : 'Enter how many units arrived in good condition for each line.'}</p>
            {receiving.items.map((it, i) => (
              <label key={`${it.product}-${i}`} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-white p-3 text-sm">
                <span>
                  <span className="block font-semibold">{isAr ? it.nameAr : it.nameEn}{it.variantLabelEn ? ` (${isAr ? it.variantLabelAr : it.variantLabelEn})` : ''}</span>
                  <span className="text-xs text-text-muted" dir="ltr">{it.sku} · {isAr ? 'أُرسل' : 'sent'} {it.quantity}</span>
                </span>
                <input
                  type="number"
                  min="0"
                  max={it.quantity}
                  value={counts[i] ?? ''}
                  onChange={(e) => setCounts((cs) => cs.map((c, idx) => (idx === i ? e.target.value : c)))}
                  className="w-24 rounded-lg border border-border px-2 py-1.5 text-sm"
                  aria-label={isAr ? 'الكمية المستلمة' : 'Received quantity'}
                />
              </label>
            ))}
            <input className="w-full rounded-xl border border-border px-3 py-2 text-sm" placeholder={isAr ? 'ملاحظة (مثلاً: قطعتان تالفتان)' : 'Note (e.g. 2 damaged)'} value={note} onChange={(e) => setNote(e.target.value)} />
            <Button disabled={busy} onClick={receive}>{isAr ? 'تأكيد الاستلام' : 'Confirm received'}</Button>
          </div>
        )}
      </AdminSlidePanel>
    </div>
  );
}
