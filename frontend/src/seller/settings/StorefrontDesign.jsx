import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ExternalLink, ImagePlus, LayoutTemplate, Star, X } from 'lucide-react';
import Loader from '../../components/ui/Loader';
import { useToast } from '../../components/ui/Toast';
import { sellerApi } from '../../services/sellerApi';
import { formatPrice } from '../../utils/formatters';
import { apiError } from '../sellerLabels';

const inputCls = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100';

/** Store page design: tagline, a banner slider (up to 5) and hand-picked featured products (up to 12). */
export default function StorefrontDesign({ seller, isAr }) {
  const toast = useToast();
  const fileRef = useRef(null);
  const [data, setData] = useState(null);
  const [products, setProducts] = useState([]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    sellerApi.getStorefront().then(({ data: d }) => setData(d.data)).catch(() => setData({ taglineAr: '', taglineEn: '', banners: [], featuredProducts: [] }));
    sellerApi.listProducts({ listingStatus: 'approved', limit: 100 }).then(({ data: d }) => setProducts(d.data || [])).catch(() => {});
  }, []);

  if (!data) return <div className="flex min-h-[20vh] items-center justify-center"><Loader size="lg" /></div>;

  const set = (k, v) => setData((d) => ({ ...d, [k]: v }));
  const move = (list, i, dir) => {
    const next = [...list];
    [next[i], next[i + dir]] = [next[i + dir], next[i]];
    return next;
  };
  const productById = new Map(products.map((p) => [p._id, p]));
  const toggleFeatured = (id) => set('featuredProducts', data.featuredProducts.includes(id)
    ? data.featuredProducts.filter((x) => x !== id)
    : [...data.featuredProducts, id].slice(0, 12));

  const upload = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    setUploading(true);
    try {
      const { data: d } = await sellerApi.uploadStorefrontMedia(files.slice(0, 5 - data.banners.length));
      set('banners', [...data.banners, ...d.data.map((m) => ({ url: m.url, publicId: m.publicId, link: '' }))].slice(0, 5));
    } catch (err) {
      toast.error(apiError(err, isAr ? 'تعذّر الرفع' : 'Upload failed'));
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    setBusy(true);
    try {
      const { data: d } = await sellerApi.updateStorefront(data);
      setData(d.data);
      toast.success(isAr ? 'تم حفظ تصميم المتجر' : 'Store design saved');
    } catch (err) {
      toast.error(apiError(err, isAr ? 'تعذّر الحفظ' : 'Could not save'));
    } finally {
      setBusy(false);
    }
  };

  const storeUrl = seller.slug ? `/${isAr ? 'ar' : 'en'}/sellers/${seller.slug}` : null;
  const shown = products.filter((p) => !q || `${p.nameAr} ${p.nameEn}`.toLowerCase().includes(q.toLowerCase())).slice(0, 30);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-bold"><LayoutTemplate className="h-5 w-5 text-indigo-600" />{isAr ? 'تصميم صفحة المتجر' : 'Store page design'}</h2>
          {storeUrl && <a href={storeUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-700 hover:underline"><ExternalLink className="h-4 w-4" />{isAr ? 'معاينة' : 'Preview'}</a>}
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">{isAr ? 'شعار قصير (عربي)' : 'Tagline (Arabic)'}</span>
            <input className={inputCls} value={data.taglineAr} onChange={(e) => set('taglineAr', e.target.value)} maxLength={160} dir="rtl" placeholder="عسل طبيعي من مناحلنا مباشرة" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">{isAr ? 'شعار قصير (إنجليزي)' : 'Tagline (English)'}</span>
            <input className={inputCls} value={data.taglineEn} onChange={(e) => set('taglineEn', e.target.value)} maxLength={160} dir="ltr" placeholder="Raw honey straight from our hives" />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="font-bold">{isAr ? 'شرائح البانر' : 'Banner slider'} <span className="text-sm font-normal text-slate-500">({data.banners.length}/5)</span></h3>
        <p className="text-sm text-slate-500">{isAr ? 'صور عريضة (1600×500 مثالي) تظهر أعلى صفحة متجرك. الرابط اختياري — صفحة داخل الموقع تبدأ بـ /' : 'Wide images (1600×500 is ideal) at the top of your store. The link is optional — a page on this site starting with /'}</p>
        <ul className="mt-3 space-y-3">
          {data.banners.map((b, i) => (
            <li key={b.url} className="flex flex-wrap items-center gap-3 rounded-xl bg-slate-50 p-2">
              <img src={b.url} alt="" className="h-16 w-40 rounded-lg object-cover" />
              <input className={`${inputCls} min-w-[12rem] flex-1`} value={b.link} onChange={(e) => set('banners', data.banners.map((x, j) => (j === i ? { ...x, link: e.target.value } : x)))} placeholder="/ar/sellers/…" dir="ltr" />
              <div className="flex gap-1">
                <button type="button" disabled={i === 0} onClick={() => set('banners', move(data.banners, i, -1))} className="rounded-lg p-1.5 hover:bg-white disabled:opacity-30" aria-label={isAr ? 'لأعلى' : 'Up'}><ArrowUp className="h-4 w-4" /></button>
                <button type="button" disabled={i === data.banners.length - 1} onClick={() => set('banners', move(data.banners, i, 1))} className="rounded-lg p-1.5 hover:bg-white disabled:opacity-30" aria-label={isAr ? 'لأسفل' : 'Down'}><ArrowDown className="h-4 w-4" /></button>
                <button type="button" onClick={() => set('banners', data.banners.filter((_, j) => j !== i))} className="rounded-lg p-1.5 text-red-600 hover:bg-red-50" aria-label={isAr ? 'حذف' : 'Remove'}><X className="h-4 w-4" /></button>
              </div>
            </li>
          ))}
        </ul>
        {data.banners.length < 5 && (
          <button type="button" disabled={uploading} onClick={() => fileRef.current?.click()} className="mt-3 inline-flex items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 px-4 py-3 text-sm font-semibold text-slate-600 hover:border-indigo-400 hover:text-indigo-700">
            {uploading ? <Loader size="sm" /> : <ImagePlus className="h-5 w-5" />}{isAr ? 'إضافة صورة' : 'Add image'}
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={upload} />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="flex items-center gap-2 font-bold"><Star className="h-4 w-4 text-amber-500" />{isAr ? 'منتجات مميزة' : 'Featured products'} <span className="text-sm font-normal text-slate-500">({data.featuredProducts.length}/12)</span></h3>
        <p className="text-sm text-slate-500">{isAr ? 'تظهر أولاً في صفحة متجرك بهذا الترتيب.' : 'Shown first on your store page, in this order.'}</p>
        {data.featuredProducts.length > 0 && (
          <ol className="mt-3 flex flex-wrap gap-2">
            {data.featuredProducts.map((id, i) => {
              const p = productById.get(id);
              return (
                <li key={id} className="flex items-center gap-1.5 rounded-full bg-indigo-50 py-1 pe-1 ps-3 text-sm text-indigo-900">
                  <span className="text-xs font-bold">{i + 1}.</span>{p ? (isAr ? p.nameAr : p.nameEn) : '…'}
                  {i > 0 && <button type="button" onClick={() => set('featuredProducts', move(data.featuredProducts, i, -1))} className="rounded-full p-0.5 hover:bg-indigo-100" aria-label={isAr ? 'تقديم' : 'Move earlier'}><ArrowUp className="h-3.5 w-3.5 -rotate-90 rtl:rotate-90" /></button>}
                  <button type="button" onClick={() => toggleFeatured(id)} className="rounded-full p-0.5 hover:bg-indigo-100" aria-label={isAr ? 'إزالة' : 'Remove'}><X className="h-3.5 w-3.5" /></button>
                </li>
              );
            })}
          </ol>
        )}
        <input className={`${inputCls} mt-3`} value={q} onChange={(e) => setQ(e.target.value)} placeholder={isAr ? 'ابحث في منتجاتك المعروضة لإضافتها…' : 'Search your live products to add…'} />
        <ul className="mt-2 grid max-h-64 gap-1 overflow-y-auto sm:grid-cols-2">
          {shown.map((p) => (
            <li key={p._id}>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50">
                <input type="checkbox" checked={data.featuredProducts.includes(p._id)} onChange={() => toggleFeatured(p._id)} className="h-4 w-4 rounded" />
                <span className="flex-1 truncate">{isAr ? p.nameAr : p.nameEn}</span>
                <span className="text-xs tabular-nums text-slate-500">{formatPrice(p.price)}</span>
              </label>
            </li>
          ))}
        </ul>
      </section>

      <div className="sticky bottom-3 flex justify-end">
        <button type="button" disabled={busy || uploading} onClick={save} className="rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg disabled:opacity-50">{busy ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'حفظ التصميم' : 'Save design')}</button>
      </div>
    </div>
  );
}
