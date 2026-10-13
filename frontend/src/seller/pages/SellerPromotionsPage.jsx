import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from '../../app/router';
import { BadgePercent, Plus, X } from 'lucide-react';
import Loader from '../../components/ui/Loader';
import { useToast } from '../../components/ui/Toast';
import { sellerApi } from '../../services/sellerApi';
import { formatPrice } from '../../utils/formatters';
import { apiError } from '../sellerLabels';
import StatusBadge from '../StatusBadge';
import { Card, EmptyState, PageHeader, Segmented } from '../ui';
import { fmtDateTime } from '../sellerUtils';

const STATUS = {
  pending: { ar: 'بانتظار الموافقة', en: 'Waiting for approval', tone: 'bg-amber-100 text-amber-900' },
  approved: { ar: 'مجدول', en: 'Scheduled', tone: 'bg-sky-100 text-sky-800' },
  active: { ar: 'يعمل الآن', en: 'Running', tone: 'bg-emerald-100 text-emerald-800' },
  ended: { ar: 'انتهى', en: 'Ended', tone: 'bg-slate-200 text-slate-700' },
  rejected: { ar: 'مرفوض', en: 'Rejected', tone: 'bg-red-100 text-red-800' },
  cancelled: { ar: 'ملغي', en: 'Cancelled', tone: 'bg-slate-100 text-slate-600' },
};

const inputCls = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100';
const localInput = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

function CreatePromotion({ isAr, onCreated, onClose }) {
  const toast = useToast();
  const [form, setForm] = useState(() => ({
    name: '', percent: 10, scope: 'all', sections: [], products: [],
    startsAt: localInput(new Date(Date.now() + 3600000)), endsAt: localInput(new Date(Date.now() + 7 * 86400000)),
  }));
  const [sections, setSections] = useState([]);
  const [products, setProducts] = useState([]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    sellerApi.listCategories().then(({ data }) => setSections(data.data || [])).catch(() => {});
    sellerApi.listProducts({ listingStatus: 'approved', limit: 100 }).then(({ data }) => setProducts(data.data || [])).catch(() => {});
  }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const toggle = (k, id) => set(k, form[k].includes(id) ? form[k].filter((x) => x !== id) : [...form[k], id]);
  const example = useMemo(() => products[0], [products]);
  const shownProducts = products.filter((p) => !q || `${p.nameAr} ${p.nameEn} ${p.sku}`.toLowerCase().includes(q.toLowerCase()));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await sellerApi.createPromotion({ ...form, startsAt: new Date(form.startsAt).toISOString(), endsAt: new Date(form.endsAt).toISOString() });
      toast.success(isAr ? `تم إرسال العرض للمراجعة (${data.data.productCount} منتج)` : `Sent for approval (${data.data.productCount} products)`);
      onCreated();
    } catch (err) {
      toast.error(apiError(err, isAr ? 'تعذّر الإنشاء' : 'Could not create'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title={isAr ? 'عرض جديد' : 'New promotion'} action={<button type="button" onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100" aria-label={isAr ? 'إغلاق' : 'Close'}><X className="h-4 w-4" /></button>}>
      <form onSubmit={submit} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">{isAr ? 'اسم العرض (لك فقط)' : 'Promotion name (for you)'}</span>
            <input className={inputCls} value={form.name} onChange={(e) => set('name', e.target.value)} maxLength={120} placeholder={isAr ? 'مثال: خصم رمضان' : 'e.g. Ramadan sale'} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 flex justify-between font-medium">{isAr ? 'نسبة الخصم' : 'Discount'}<span className="text-lg font-extrabold text-indigo-700">{form.percent}%</span></span>
            <input type="range" min="5" max="70" step="5" value={form.percent} onChange={(e) => set('percent', Number(e.target.value))} className="w-full accent-indigo-600" />
            {example && <span className="text-xs text-slate-500">{isAr ? 'مثال: ' : 'e.g. '}{isAr ? example.nameAr : example.nameEn}: <s>{formatPrice(example.price)}</s> → <b>{formatPrice(Math.round(example.price * (1 - form.percent / 100) * 100) / 100)}</b></span>}
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">{isAr ? 'يبدأ' : 'Starts'}</span>
            <input type="datetime-local" className={inputCls} value={form.startsAt} onChange={(e) => set('startsAt', e.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">{isAr ? 'ينتهي (حتى 31 يوماً)' : 'Ends (up to 31 days)'}</span>
            <input type="datetime-local" className={inputCls} value={form.endsAt} onChange={(e) => set('endsAt', e.target.value)} />
          </label>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">{isAr ? 'على أي منتجات؟' : 'Which products?'}</p>
          <Segmented
            options={[
              { value: 'all', label: isAr ? 'كل منتجاتي' : 'All my products' },
              { value: 'sections', label: isAr ? 'أقسام محددة' : 'Some sections' },
              { value: 'products', label: isAr ? 'منتجات محددة' : 'Some products' },
            ]}
            value={form.scope}
            onChange={(v) => set('scope', v)}
          />
          {form.scope === 'sections' && (
            <div className="mt-3 flex flex-wrap gap-2">
              {sections.length === 0 && <p className="text-sm text-slate-500">{isAr ? 'لا توجد أقسام — أنشئها من «أقسام متجري».' : 'No sections yet — create them in My store sections.'}</p>}
              {sections.map((s) => (
                <button key={s._id} type="button" onClick={() => toggle('sections', s._id)} className={`rounded-full px-3 py-1.5 text-sm ring-1 ${form.sections.includes(s._id) ? 'bg-indigo-600 text-white ring-indigo-600' : 'ring-slate-200'}`}>
                  {isAr ? s.nameAr : s.nameEn} <span className="opacity-70">({s.productCount})</span>
                </button>
              ))}
            </div>
          )}
          {form.scope === 'products' && (
            <div className="mt-3">
              <input className={`${inputCls} mb-2`} value={q} onChange={(e) => setQ(e.target.value)} placeholder={isAr ? 'ابحث في منتجاتك المعروضة…' : 'Search your live products…'} />
              <ul className="max-h-60 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">
                {shownProducts.map((p) => (
                  <li key={p._id}>
                    <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-slate-50">
                      <input type="checkbox" checked={form.products.includes(p._id)} onChange={() => toggle('products', p._id)} className="h-4 w-4 rounded" />
                      <span className="flex-1 truncate">{isAr ? p.nameAr : p.nameEn}</span>
                      <span className="tabular-nums text-slate-500">{formatPrice(p.price)}</span>
                    </label>
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-xs text-slate-500">{isAr ? `${form.products.length} محدد` : `${form.products.length} selected`}</p>
            </div>
          )}
        </div>

        <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
          {isAr
            ? 'العرض يُمول منك: يُباع المنتج بالسعر المخفض وتُحسب العمولة عليه. خلال العرض لا يمكن تعديل أسعار المنتجات المشمولة، وتعود الأسعار تلقائياً عند الانتهاء. المنتج الموجود في عرض آخر لا يُخصم مرتين.'
            : "You fund the discount: items sell at the lower price and the fee is on that price. While it runs, prices of included products are locked, and they restore automatically at the end. A product already in another promotion isn't discounted twice."}
        </div>
        <button type="submit" disabled={busy || form.name.trim().length < 2} className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
          {isAr ? 'إرسال للموافقة' : 'Send for approval'}
        </button>
      </form>
    </Card>
  );
}

/** Seller-funded promotions: create, follow approval, stop early. */
export default function SellerPromotionsPage() {
  const { isAr } = useOutletContext();
  const toast = useToast();
  const [items, setItems] = useState(null);
  const [creating, setCreating] = useState(false);

  const load = () => sellerApi.listPromotions().then(({ data }) => setItems(data.data || [])).catch(() => setItems([]));
  useEffect(() => { load(); }, []);

  const cancel = async (p) => {
    const msg = p.status === 'active'
      ? (isAr ? 'إيقاف العرض الآن؟ ستعود الأسعار فوراً.' : 'Stop this promotion now? Prices restore immediately.')
      : (isAr ? 'إلغاء هذا العرض؟' : 'Cancel this promotion?');
    if (!window.confirm(msg)) return;
    try {
      await sellerApi.cancelPromotion(p._id);
      toast.success(isAr ? 'تم' : 'Done');
      load();
    } catch (err) {
      toast.error(apiError(err, isAr ? 'تعذّر الإلغاء' : 'Could not cancel'));
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        icon={BadgePercent}
        title={isAr ? 'العروض والخصومات' : 'Promotions'}
        description={isAr ? 'أنشئ خصماً على متجرك أو أقسام أو منتجات محددة لفترة محددة. يظهر للعملاء كخصم مع السعر القديم مشطوباً.' : 'Discount your whole store, some sections or products for a set time. Customers see it as a deal with the old price struck through.'}
        actions={!creating && (
          <button type="button" onClick={() => setCreating(true)} className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white"><Plus className="h-4 w-4" />{isAr ? 'عرض جديد' : 'New promotion'}</button>
        )}
      />
      {creating && <CreatePromotion isAr={isAr} onClose={() => setCreating(false)} onCreated={() => { setCreating(false); load(); }} />}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {!items ? <div className="flex min-h-[200px] items-center justify-center"><Loader size="lg" /></div> : items.length === 0 ? (
          <EmptyState icon={BadgePercent} title={isAr ? 'لا توجد عروض بعد' : 'No promotions yet'} text={isAr ? 'العروض تزيد الظهور في صفحة العروض والمبيعات.' : 'Promotions show up on the offers page and boost sales.'} />
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((p) => (
              <li key={p._id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-lg font-extrabold text-indigo-700">-{p.percent}%</span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{p.name}</p>
                  <p className="text-xs text-slate-500">
                    {fmtDateTime(p.startsAt, isAr)} → {fmtDateTime(p.endsAt, isAr)}
                    {' · '}{p.scope === 'all' ? (isAr ? 'كل المنتجات' : 'All products') : p.scope === 'sections' ? (isAr ? `${p.sections.length} قسم` : `${p.sections.length} section(s)`) : (isAr ? `${p.products.length} منتج` : `${p.products.length} product(s)`)}
                    {p.status === 'active' && ` · ${isAr ? `يعمل على ${p.appliedCount} منتج` : `on ${p.appliedCount} product(s)`}`}
                    {p.skipped > 0 && ` · ${isAr ? `${p.skipped} في عرض آخر` : `${p.skipped} already in another deal`}`}
                  </p>
                  {p.reviewNote && <p className="mt-1 text-xs text-red-700">{p.reviewNote}</p>}
                </div>
                <StatusBadge map={STATUS} value={p.status} isAr={isAr} />
                {['pending', 'approved', 'active'].includes(p.status) && (
                  <button type="button" onClick={() => cancel(p)} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-red-600 ring-1 ring-red-200 hover:bg-red-50">
                    {p.status === 'active' ? (isAr ? 'إيقاف' : 'Stop') : (isAr ? 'إلغاء' : 'Cancel')}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
