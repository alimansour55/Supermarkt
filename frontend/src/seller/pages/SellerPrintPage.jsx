import { useEffect, useState } from 'react';
import { Link, useOutletContext, useSearchParams } from '../../app/router';
import { ArrowLeft, ArrowRight, Printer } from 'lucide-react';
import { sellerApi } from '../../services/sellerApi';
import { formatPrice } from '../../utils/formatters';
import Barcode128 from '../Barcode128';
import { PageSkeleton } from '../ui';

const addressLines = (a) => (a ? [
  [a.street, a.building && `مبنى ${a.building}`, a.floor && `دور ${a.floor}`, a.apartment && `شقة ${a.apartment}`].filter(Boolean).join('، '),
  [a.area, a.city, a.governorate].filter(Boolean).join('، '),
  a.landmark,
].filter(Boolean) : []);

/** One 10×15 cm courier label: sender, recipient, COD amount and a scannable shipment barcode. */
function Label({ s, seller, isAr }) {
  const units = s.items.reduce((n, i) => n + i.quantity, 0);
  return (
    <section className="label-page mx-auto flex w-[10cm] flex-col border-2 border-black bg-white p-3 text-[11px] leading-snug text-black" dir="rtl">
      <div className="flex items-start justify-between border-b-2 border-black pb-2">
        <div>
          <p className="text-[10px] uppercase">{isAr ? 'المرسل' : 'From'}</p>
          <p className="font-bold">{seller.nameAr || seller.nameEn}</p>
          <p>{[seller.address?.street, seller.address?.city].filter(Boolean).join('، ')}</p>
          <p dir="ltr" className="text-end">{seller.phone}</p>
        </div>
        <div className="text-end">
          <p className="text-[10px]">{new Date(s.createdAt).toLocaleDateString('en-GB')}</p>
          <p className="text-lg font-black">{units} {isAr ? 'قطعة' : 'pcs'}</p>
        </div>
      </div>
      <div className="border-b-2 border-black py-2">
        <p className="text-[10px] uppercase">{isAr ? 'المستلم' : 'To'}</p>
        {s.customer ? (
          <>
            <p className="text-base font-black">{s.customer.name}</p>
            {addressLines(s.customer.address).map((line) => <p key={line}>{line}</p>)}
            <p dir="ltr" className="text-end text-sm font-bold">{s.customer.phone}{s.customer.alternatePhone ? ` / ${s.customer.alternatePhone}` : ''}</p>
          </>
        ) : <p className="italic">{isAr ? 'بيانات العميل غير متاحة لهذه الشحنة' : 'Customer details not available for this shipment'}</p>}
      </div>
      <div className="flex items-center justify-between border-b-2 border-black py-2">
        <span className="text-[10px]">{isAr ? 'المبلغ المطلوب تحصيله' : 'Cash to collect'}</span>
        <span className="text-xl font-black" dir="ltr">{s.collectOnDelivery > 0 ? formatPrice(s.collectOnDelivery) : (isAr ? 'مدفوع' : 'PAID')}</span>
      </div>
      <div className="flex flex-col items-center pt-2" dir="ltr">
        <Barcode128 value={s.shipmentNumber} height={60} moduleWidth={1.6} />
        <p className="mt-1 text-[10px]">{isAr ? 'طلب' : 'Order'} {s.orderNumber}</p>
      </div>
    </section>
  );
}

function PackingSlip({ s, seller, isAr }) {
  return (
    <section className="slip-page mx-auto max-w-[19cm] bg-white p-6 text-sm text-black" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="flex items-start justify-between border-b border-black pb-3">
        <div>
          <p className="text-lg font-bold">{isAr ? 'قائمة التعبئة' : 'Packing slip'}</p>
          <p>{isAr ? seller.nameAr : seller.nameEn}</p>
        </div>
        <div dir="ltr"><Barcode128 value={s.shipmentNumber} height={40} moduleWidth={1.2} /></div>
      </div>
      <table className="mt-4 w-full">
        <thead>
          <tr className="border-b border-black text-xs">
            <th className="py-1 text-start">SKU</th>
            <th className="py-1 text-start">{isAr ? 'المنتج' : 'Item'}</th>
            <th className="py-1 text-center">{isAr ? 'الكمية' : 'Qty'}</th>
            <th className="py-1 text-center">✓</th>
          </tr>
        </thead>
        <tbody>
          {s.items.map((it) => (
            <tr key={it.itemIndex} className="border-b border-slate-300">
              <td className="py-2 font-mono text-xs" dir="ltr">{it.sku}</td>
              <td className="py-2">{isAr ? it.nameAr : it.nameEn || it.nameAr}{(it.variantLabelAr || it.variantLabelEn) && ` — ${isAr ? it.variantLabelAr : it.variantLabelEn}`}</td>
              <td className="py-2 text-center text-base font-bold">{it.quantity}</td>
              <td className="py-2 text-center">☐</td>
            </tr>
          ))}
        </tbody>
      </table>
      {s.customer?.notes && <p className="mt-4 rounded border border-black p-2">{isAr ? 'ملاحظة العميل: ' : 'Customer note: '}{s.customer.notes}</p>}
      <p className="mt-6 text-xs">{isAr ? 'شكراً لتسوقك معنا!' : 'Thank you for your order!'}</p>
    </section>
  );
}

/** /seller-center/orders/print?ids=a,b&what=labels|slips|both — prints many orders at once. */
export default function SellerPrintPage() {
  const { isAr, seller } = useOutletContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const ids = (searchParams.get('ids') || '').split(',').filter(Boolean).slice(0, 100);
  const what = searchParams.get('what') || 'both';
  const [items, setItems] = useState(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all(ids.map((id) => sellerApi.getShipment(id).then(({ data }) => data.data).catch(() => null)))
      .then((list) => { if (!cancelled) setItems(list.filter(Boolean)); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.get('ids')]);

  const Back = isAr ? ArrowRight : ArrowLeft;
  const opt = (value, text) => (
    <button key={value} type="button" onClick={() => setSearchParams({ ids: ids.join(','), what: value })} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${what === value ? 'bg-indigo-600 text-white' : 'ring-1 ring-slate-300'}`}>{text}</button>
  );

  return (
    <div>
      <style>{`@media print {
        @page { margin: 8mm; }
        body * { visibility: hidden; }
        #seller-print, #seller-print * { visibility: visible; }
        #seller-print { position: absolute; inset: 0; }
        .label-page, .slip-page { break-after: page; box-shadow: none; }
      }`}</style>
      <div className="mb-5 flex flex-wrap items-center gap-2 print:hidden">
        <Link to="/seller-center/orders" className="rounded-lg p-2 ring-1 ring-slate-200 hover:bg-white" aria-label={isAr ? 'رجوع' : 'Back'}><Back className="h-4 w-4" /></Link>
        <h1 className="me-auto text-xl font-bold">{isAr ? `طباعة ${ids.length} طلب` : `Print ${ids.length} order(s)`}</h1>
        {opt('labels', isAr ? 'بوالص الشحن' : 'Shipping labels')}
        {opt('slips', isAr ? 'قوائم التعبئة' : 'Packing slips')}
        {opt('both', isAr ? 'الاثنين' : 'Both')}
        <button type="button" onClick={() => window.print()} disabled={!items?.length} className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          <Printer className="h-4 w-4" />{isAr ? 'طباعة' : 'Print'}
        </button>
      </div>
      {!items ? <PageSkeleton /> : items.length === 0 ? (
        <p className="rounded-2xl bg-white p-6 text-center text-sm text-slate-500">{isAr ? 'لا توجد طلبات للطباعة.' : 'Nothing to print.'}</p>
      ) : (
        <div id="seller-print" className="space-y-6">
          {items.map((s) => (
            <div key={s._id} className="space-y-6">
              {what !== 'slips' && <Label s={s} seller={seller} isAr={isAr} />}
              {what !== 'labels' && <PackingSlip s={s} seller={seller} isAr={isAr} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
