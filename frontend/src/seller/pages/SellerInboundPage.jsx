import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from '../../app/router';
import { PackagePlus, Plus, Trash2, Warehouse } from 'lucide-react';
import { useToast } from '../../components/ui/Toast';
import { sellerApi } from '../../services/sellerApi';
import { INBOUND_STATUS, apiError } from '../sellerLabels';
import StatusBadge from '../StatusBadge';
import { PageSkeleton } from '../ui';

const inputCls = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm';

function fmtDate(value, isAr) {
  return value ? new Date(value).toLocaleDateString(isAr ? 'ar-EG-u-nu-latn' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
}

/** Seller sends stock of its store-fulfilled products to the store's warehouse. */
export default function SellerInboundPage() {
  const { isAr, seller } = useOutletContext();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [products, setProducts] = useState([]);
  const [lines, setLines] = useState([{ key: 'l0', productId: '', variantId: '', quantity: '' }]);
  const [form, setForm] = useState({ fulfillmentLocation: '', carrier: '', trackingNumber: '', expectedAt: '', note: '' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    sellerApi.listInbound({ limit: 50 }).then(({ data: d }) => setData(d)).catch(() => toast.error(isAr ? 'تعذّر التحميل' : 'Could not load'));
  }, [isAr, toast]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    sellerApi.listProducts({ limit: 100 }).then(({ data: d }) => setProducts((d.data || []).filter((p) => p.fulfilledBy === 'store'))).catch(() => {});
  }, []);

  const productById = useMemo(() => new Map(products.map((p) => [p._id, p])), [products]);
  const storeEnabled = (seller.allowedFulfillment || []).includes('store');

  const setLine = (i, patch) => setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const submit = async () => {
    const items = lines.filter((l) => l.productId && Number(l.quantity) > 0)
      .map((l) => ({ productId: l.productId, variantId: l.variantId || undefined, quantity: Number(l.quantity) }));
    if (!items.length) return toast.error(isAr ? 'أضف منتجاً وكمية' : 'Add a product and quantity');
    setBusy(true);
    try {
      const { data: d } = await sellerApi.createInbound({ ...form, items });
      toast.success(isAr ? `أنشئت الشحنة ${d.data.inboundNumber}` : `Created ${d.data.inboundNumber}`);
      setLines([{ key: `l${Date.now()}`, productId: '', variantId: '', quantity: '' }]);
      setForm({ fulfillmentLocation: '', carrier: '', trackingNumber: '', expectedAt: '', note: '' });
      load();
    } catch (err) {
      toast.error(apiError(err, isAr ? 'تعذّر الإنشاء' : 'Could not create'));
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (id) => {
    try {
      await sellerApi.cancelInbound(id);
      load();
    } catch (err) {
      toast.error(apiError(err, isAr ? 'تعذّر الإلغاء' : 'Could not cancel'));
    }
  };

  if (!data) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{isAr ? 'شحنات للمخزن' : 'Send stock to our warehouse'}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {isAr
            ? 'منتجاتك التي "يشحنها المتجر" تُخزّن عندنا. أرسل المخزون هنا، ويُضاف لمخزونك فور استلامه وعدّه.'
            : 'Products "shipped by store" are stored with us. Send stock here — it becomes sellable once we receive and count it.'}
        </p>
      </div>

      {!storeEnabled ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
          {isAr ? 'شحن المتجر غير مفعّل لمتجرك. تواصل مع فريقنا لتفعيله.' : 'Store fulfillment is not enabled for your store. Contact our team to enable it.'}
        </p>
      ) : (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 font-bold"><PackagePlus className="h-5 w-5 text-indigo-600" />{isAr ? 'شحنة جديدة' : 'New inbound shipment'}</h2>
          {!products.length ? (
            <p className="text-sm text-slate-500">{isAr ? 'لا توجد منتجات بطريقة "يشحنه المتجر" بعد.' : 'You have no "shipped by store" products yet.'}</p>
          ) : (
            <>
              <div className="space-y-2">
                {lines.map((l, i) => {
                  const product = productById.get(l.productId);
                  return (
                    <div key={l.key} className="grid gap-2 sm:grid-cols-[1fr,180px,120px,auto]">
                      <select className={inputCls} value={l.productId} onChange={(e) => setLine(i, { productId: e.target.value, variantId: '' })}>
                        <option value="">{isAr ? 'اختر منتجاً' : 'Choose a product'}</option>
                        {products.map((p) => <option key={p._id} value={p._id}>{isAr ? p.nameAr : p.nameEn} · {p.sku}</option>)}
                      </select>
                      {product?.variants?.length ? (
                        <select className={inputCls} value={l.variantId} onChange={(e) => setLine(i, { variantId: e.target.value })}>
                          <option value="">{isAr ? 'النوع' : 'Variant'}</option>
                          {product.variants.map((v) => <option key={v._id} value={v._id}>{isAr ? v.valueAr : v.valueEn}</option>)}
                        </select>
                      ) : <span className="hidden sm:block" />}
                      <input type="number" min="1" className={inputCls} placeholder={isAr ? 'الكمية' : 'Qty'} value={l.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} />
                      <button type="button" onClick={() => setLines((ls) => (ls.length > 1 ? ls.filter((_, idx) => idx !== i) : ls))} className="rounded-lg p-2 text-red-600 hover:bg-red-50" aria-label={isAr ? 'حذف' : 'Remove'}><Trash2 className="h-4 w-4" /></button>
                    </div>
                  );
                })}
              </div>
              <button type="button" onClick={() => setLines((ls) => [...ls, { key: `l${Date.now()}`, productId: '', variantId: '', quantity: '' }])} className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-indigo-700">
                <Plus className="h-4 w-4" />{isAr ? 'منتج آخر' : 'Another product'}
              </button>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {data.locations?.length > 1 && (
                  <select className={inputCls} value={form.fulfillmentLocation} onChange={(e) => setForm((f) => ({ ...f, fulfillmentLocation: e.target.value }))}>
                    <option value="">{isAr ? 'المخزن الرئيسي' : 'Main warehouse'}</option>
                    {data.locations.map((loc) => <option key={loc._id} value={loc._id}>{loc.name}</option>)}
                  </select>
                )}
                <input className={inputCls} placeholder={isAr ? 'شركة الشحن' : 'Carrier'} value={form.carrier} onChange={(e) => setForm((f) => ({ ...f, carrier: e.target.value }))} />
                <input className={inputCls} placeholder={isAr ? 'رقم التتبع' : 'Tracking number'} value={form.trackingNumber} onChange={(e) => setForm((f) => ({ ...f, trackingNumber: e.target.value }))} dir="ltr" />
                <input type="date" className={inputCls} value={form.expectedAt} onChange={(e) => setForm((f) => ({ ...f, expectedAt: e.target.value }))} aria-label={isAr ? 'تاريخ الوصول المتوقع' : 'Expected arrival'} />
              </div>
              <button type="button" disabled={busy} onClick={submit} className="mt-4 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
                {isAr ? 'إنشاء الشحنة' : 'Create shipment'}
              </button>
            </>
          )}
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <h2 className="flex items-center gap-2 border-b border-slate-100 px-5 py-3 font-bold"><Warehouse className="h-5 w-5 text-slate-500" />{isAr ? 'شحناتك للمخزن' : 'Your inbound shipments'}</h2>
        {!data.data.length ? (
          <p className="p-5 text-sm text-slate-500">{isAr ? 'لا توجد شحنات بعد.' : 'No inbound shipments yet.'}</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.data.map((s) => (
              <li key={s._id} className="px-5 py-3 text-sm">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-semibold" dir="ltr">{s.inboundNumber}</span>
                  <StatusBadge map={INBOUND_STATUS} value={s.status} isAr={isAr} />
                  <span className="text-slate-500">{fmtDate(s.createdAt, isAr)}{s.fulfillmentLocation?.name ? ` · ${s.fulfillmentLocation.name}` : ''}</span>
                  <span className="ms-auto">
                    {s.status === 'received'
                      ? (isAr ? `استُلم ${s.receivedUnits} من ${s.totalUnits}` : `${s.receivedUnits} of ${s.totalUnits} received`)
                      : (isAr ? `${s.totalUnits} قطعة` : `${s.totalUnits} units`)}
                  </span>
                  {s.status === 'pending' && (
                    <button type="button" onClick={() => cancel(s._id)} className="text-xs font-semibold text-red-700 hover:underline">{isAr ? 'إلغاء' : 'Cancel'}</button>
                  )}
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {s.items.map((it) => `${isAr ? it.nameAr : it.nameEn}${it.variantLabelEn ? ` (${isAr ? it.variantLabelAr : it.variantLabelEn})` : ''} × ${it.quantity}${s.status === 'received' ? ` → ${it.receivedQuantity}` : ''}`).join('، ')}
                </p>
                {s.receiveNote && <p className="mt-1 text-xs text-amber-800">{s.receiveNote}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

