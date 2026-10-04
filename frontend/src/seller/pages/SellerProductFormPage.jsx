import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useOutletContext, useParams } from '../../app/router';
import { ArrowLeft, ArrowRight, ImagePlus, Info, Plus, Trash2, X } from 'lucide-react';
import Loader from '../../components/ui/Loader';
import { useToast } from '../../components/ui/Toast';
import CategoryBrowsePicker from '../../admin/components/CategoryBrowsePicker';
import { categoryService } from '../../services/apiServices';
import { fetchBrands } from '../../services/brandApi';
import { sellerApi } from '../../services/sellerApi';
import { FULFILLMENT, LISTING_STATUS, apiError, label } from '../sellerLabels';
import StatusBadge from '../StatusBadge';

const VARIANT_TYPES = {
  weight: { ar: 'الوزن', en: 'Weight' },
  size: { ar: 'الحجم', en: 'Size' },
  flavor: { ar: 'النكهة', en: 'Flavor' },
  pack_count: { ar: 'عدد القطع', en: 'Pack count' },
};

const EMPTY = {
  nameAr: '', nameEn: '', descriptionAr: '', descriptionEn: '',
  category: '', brand: '', size: '', unit: 'piece', unitAr: '', unitEn: '',
  price: '', oldPrice: '', stock: '0', sku: '', barcode: '',
  fulfilledBy: '', searchKeywordsAr: '', searchKeywordsEn: '',
  variants: [], specs: [], media: [],
};

function toForm(p) {
  return {
    nameAr: p.nameAr || '',
    nameEn: p.nameEn || '',
    descriptionAr: p.descriptionAr || '',
    descriptionEn: p.descriptionEn || '',
    category: String(p.categoryId?._id || p.categoryId || ''),
    brand: p.brand || '',
    size: p.size || '',
    unit: p.unit || 'piece',
    unitAr: p.unitAr || '',
    unitEn: p.unitEn || '',
    price: p.price != null ? String(p.price) : '',
    oldPrice: p.oldPrice != null ? String(p.oldPrice) : '',
    stock: String(p.stock ?? 0),
    sku: p.sku || '',
    barcode: p.barcode || '',
    fulfilledBy: p.fulfilledBy || '',
    searchKeywordsAr: (p.searchKeywordsAr || []).join(', '),
    searchKeywordsEn: (p.searchKeywordsEn || []).join(', '),
    variants: (p.variants || []).map((v) => ({
      _id: v._id, type: v.type || 'size', valueAr: v.valueAr || '', valueEn: v.valueEn || '',
      price: v.price != null ? String(v.price) : '', stock: String(v.stock ?? 0), sku: v.sku || '',
    })),
    specs: (p.specs || []).map((s) => ({ keyAr: s.keyAr || '', keyEn: s.keyEn || '', valueAr: s.valueAr || '', valueEn: s.valueEn || '' })),
    media: p.media || [],
  };
}

function toPayload(f) {
  return {
    nameAr: f.nameAr,
    nameEn: f.nameEn,
    descriptionAr: f.descriptionAr,
    descriptionEn: f.descriptionEn,
    category: f.category || undefined,
    brand: f.brand,
    size: f.size,
    unit: f.unit,
    unitAr: f.unitAr,
    unitEn: f.unitEn,
    price: f.price === '' ? undefined : Number(f.price),
    oldPrice: f.oldPrice === '' ? null : Number(f.oldPrice),
    stock: Number(f.stock || 0),
    sku: f.sku,
    barcode: f.barcode,
    ...(f.fulfilledBy ? { fulfilledBy: f.fulfilledBy } : {}),
    searchKeywordsAr: f.searchKeywordsAr,
    searchKeywordsEn: f.searchKeywordsEn,
    variants: f.variants.map((v) => ({ ...v, price: v.price === '' ? undefined : Number(v.price), stock: Number(v.stock || 0) })),
    specs: f.specs.filter((s) => s.keyAr || s.keyEn),
    media: f.media,
  };
}

function Field({ label: text, children, hint, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-sm font-medium text-slate-800">{text}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

const inputCls = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100';

function Section({ title, children }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 font-bold">{title}</h2>
      {children}
    </section>
  );
}

export default function SellerProductFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const toast = useToast();
  const { seller, isAr, me } = useOutletContext();

  const [form, setForm] = useState(EMPTY);
  const [product, setProduct] = useState(null);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    categoryService.getAll().then(({ data }) => setCategories(data.data || [])).catch(() => setCategories([]));
    fetchBrands().then((list) => setBrands(Array.isArray(list) ? list : [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isEdit) {
      setForm({ ...EMPTY, fulfilledBy: seller.defaultFulfillment || 'seller' });
      return;
    }
    setLoading(true);
    sellerApi.getProduct(id)
      .then(({ data }) => {
        setProduct(data.data);
        // Show the seller what they last submitted, including edits still under review.
        const pending = data.data.pendingChanges || {};
        const merged = { ...data.data, ...pending, media: data.data.pendingMedia || data.data.media };
        if (pending.category) merged.categoryId = pending.category;
        setForm(toForm(merged));
      })
      .catch(() => toast.error(isAr ? 'المنتج غير موجود' : 'Product not found'))
      .finally(() => setLoading(false));
  }, [id, isEdit, seller.defaultFulfillment, isAr, toast]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e?.target ? e.target.value : e }));
  const setRow = (key, index, field, value) => setForm((f) => ({
    ...f,
    [key]: f[key].map((row, i) => (i === index ? { ...row, [field]: value } : row)),
  }));
  const addRow = (key, row) => setForm((f) => ({ ...f, [key]: [...f[key], row] }));
  const removeRow = (key, index) => setForm((f) => ({ ...f, [key]: f[key].filter((_, i) => i !== index) }));

  const live = product && ['approved', 'paused'].includes(product.listingStatus);
  const reviewsEdits = live && me.marketplace.reviewContentEdits && !seller.autoApproveListings;
  const canSubmit = !product || ['draft', 'rejected'].includes(product.listingStatus);
  const allowed = seller.allowedFulfillment || ['seller'];

  const brandNames = useMemo(
    () => [...new Set(brands.map((b) => (isAr ? b.nameAr || b.name : b.nameEn || b.name)).filter(Boolean))],
    [brands, isAr],
  );

  const onFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    setUploading(true);
    try {
      const { data } = await sellerApi.uploadMedia(files);
      setForm((f) => ({ ...f, media: [...f.media, ...data.data].slice(0, 12) }));
    } catch (err) {
      toast.error(apiError(err, isAr ? 'تعذّر رفع الصور' : 'Upload failed'));
    } finally {
      setUploading(false);
    }
  };

  const save = async (submit) => {
    if (!form.nameAr.trim() || !form.nameEn.trim()) return toast.error(isAr ? 'أدخل الاسم بالعربية والإنجليزية' : 'Enter the Arabic and English names');
    if (!(Number(form.price) > 0)) return toast.error(isAr ? 'أدخل سعراً صحيحاً' : 'Enter a valid price');
    if (!form.category) return toast.error(isAr ? 'اختر القسم' : 'Choose a category');

    setSaving(true);
    try {
      const payload = toPayload(form);
      if (!isEdit) {
        await sellerApi.createProduct({ ...payload, submit });
        toast.success(submit
          ? (isAr ? 'تم إرسال المنتج للمراجعة' : 'Product submitted for review')
          : (isAr ? 'تم حفظ المسودة' : 'Draft saved'));
      } else {
        const { data } = await sellerApi.updateProduct(id, payload);
        if (submit && ['draft', 'rejected'].includes(data.data.listingStatus)) {
          await sellerApi.submitProduct(id);
        }
        toast.success(data.pendingReview
          ? (isAr ? 'تم الحفظ — السعر والمخزون فعّالان الآن، وباقي التعديلات بانتظار المراجعة' : 'Saved — price and stock are live; other edits wait for review')
          : (isAr ? 'تم الحفظ' : 'Saved'));
      }
      navigate('/seller-center/products');
    } catch (err) {
      toast.error(apiError(err, isAr ? 'تعذّر الحفظ' : 'Save failed'));
    } finally {
      setSaving(false);
    }
  };

  const discard = async () => {
    setSaving(true);
    try {
      const { data } = await sellerApi.discardChanges(id);
      setProduct(data.data);
      setForm(toForm(data.data));
      toast.success(isAr ? 'تم إلغاء التعديلات المعلقة' : 'Pending edits discarded');
    } catch (err) {
      toast.error(apiError(err, isAr ? 'تعذّر الإلغاء' : 'Could not discard'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex min-h-[40vh] items-center justify-center"><Loader size="lg" /></div>;

  const Back = isAr ? ArrowRight : ArrowLeft;

  return (
    <div className="space-y-5 pb-24">
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/seller-center/products" className="rounded-lg p-2 ring-1 ring-slate-200 hover:bg-white" aria-label={isAr ? 'رجوع' : 'Back'}>
          <Back className="h-4 w-4" />
        </Link>
        <h1 className="text-2xl font-bold">{isEdit ? (isAr ? 'تعديل منتج' : 'Edit product') : (isAr ? 'منتج جديد' : 'New product')}</h1>
        {product && <StatusBadge map={LISTING_STATUS} value={product.listingStatus} isAr={isAr} />}
      </div>

      {product?.listingStatus === 'rejected' && product.reviewNote && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          <p className="font-semibold">{isAr ? 'ملاحظات المراجعة:' : 'Reviewer notes:'}</p>
          <p className="mt-1">{product.reviewNote}</p>
        </div>
      )}
      {product?.pendingChangesAt && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <span>{isAr ? 'لديك تعديلات بانتظار المراجعة. يرى العملاء النسخة المعتمدة حتى تتم الموافقة.' : 'You have edits waiting for review. Customers see the approved version until then.'}</span>
          <button type="button" disabled={saving} onClick={discard} className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold ring-1 ring-amber-300 hover:bg-amber-100">
            {isAr ? 'إلغاء التعديلات' : 'Discard edits'}
          </button>
        </div>
      )}
      {reviewsEdits && !product?.pendingChangesAt && (
        <div className="flex gap-2 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {isAr
            ? 'هذا المنتج معروض. تغييرات السعر والمخزون تُطبق فوراً، أما الاسم والوصف والصور والقسم فتُراجع قبل ظهورها.'
            : 'This product is live. Price and stock changes apply instantly; name, description, images and category are reviewed before they show.'}
        </div>
      )}

      <Section title={isAr ? 'المعلومات الأساسية' : 'Basics'}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={isAr ? 'الاسم بالعربية *' : 'Arabic name *'}><input className={inputCls} value={form.nameAr} onChange={set('nameAr')} dir="rtl" /></Field>
          <Field label={isAr ? 'الاسم بالإنجليزية *' : 'English name *'}><input className={inputCls} value={form.nameEn} onChange={set('nameEn')} dir="ltr" /></Field>
          <Field label={isAr ? 'الوصف بالعربية' : 'Arabic description'}><textarea rows={4} className={inputCls} value={form.descriptionAr} onChange={set('descriptionAr')} dir="rtl" /></Field>
          <Field label={isAr ? 'الوصف بالإنجليزية' : 'English description'}><textarea rows={4} className={inputCls} value={form.descriptionEn} onChange={set('descriptionEn')} dir="ltr" /></Field>
          <Field label={isAr ? 'العلامة التجارية' : 'Brand'}>
            <input className={inputCls} value={form.brand} onChange={set('brand')} list="seller-brands" />
            <datalist id="seller-brands">{brandNames.map((b) => <option key={b} value={b} />)}</datalist>
          </Field>
          <Field label={isAr ? 'الحجم / العبوة' : 'Size / pack'} hint={isAr ? 'مثال: 500 جم' : 'e.g. 500 g'}><input className={inputCls} value={form.size} onChange={set('size')} /></Field>
        </div>
      </Section>

      <Section title={isAr ? 'القسم *' : 'Category *'}>
        <CategoryBrowsePicker categories={categories} value={form.category} onChange={set('category')} isAr={isAr} leafOnly />
      </Section>

      <Section title={isAr ? 'الصور' : 'Images'}>
        <div className="flex flex-wrap gap-3">
          {form.media.map((m, i) => (
            <div key={`${m.url}-${i}`} className="relative">
              {m.type === 'video'
                ? <video src={m.url} className="h-24 w-24 rounded-xl object-cover ring-1 ring-slate-200" muted />
                : <img src={m.url} alt="" className="h-24 w-24 rounded-xl object-cover ring-1 ring-slate-200" />}
              {i === 0 && <span className="absolute bottom-1 start-1 rounded bg-black/60 px-1.5 text-[10px] text-white">{isAr ? 'رئيسية' : 'Main'}</span>}
              <button type="button" onClick={() => removeRow('media', i)} className="absolute -end-2 -top-2 rounded-full bg-white p-1 shadow ring-1 ring-slate-200" aria-label={isAr ? 'إزالة' : 'Remove'}>
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {form.media.length < 12 && (
            <button type="button" disabled={uploading} onClick={() => fileRef.current?.click()} className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-300 text-xs text-slate-500 hover:border-indigo-400 hover:text-indigo-600">
              {uploading ? <Loader size="sm" /> : <ImagePlus className="h-6 w-6" />}
              {isAr ? 'إضافة' : 'Add'}
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*,video/mp4,video/webm" multiple hidden onChange={onFiles} />
        </div>
        <p className="mt-2 text-xs text-slate-500">{isAr ? 'استخدم صوراً واضحة بخلفية بيضاء. أول صورة هي الصورة الرئيسية.' : 'Use clear photos on a white background. The first image is the main one.'}</p>
      </Section>

      <Section title={isAr ? 'السعر والمخزون' : 'Price & stock'}>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={isAr ? 'السعر (ج.م) *' : 'Price (EGP) *'}><input type="number" min="0" step="0.01" className={inputCls} value={form.price} onChange={set('price')} dir="ltr" /></Field>
          <Field label={isAr ? 'السعر قبل الخصم' : 'Price before discount'} hint={isAr ? 'اتركه فارغاً إن لم يوجد خصم' : 'Leave empty if no discount'}><input type="number" min="0" step="0.01" className={inputCls} value={form.oldPrice} onChange={set('oldPrice')} dir="ltr" /></Field>
          <Field label={isAr ? 'المخزون المتاح' : 'Stock available'}><input type="number" min="0" className={inputCls} value={form.stock} onChange={set('stock')} dir="ltr" disabled={form.variants.length > 0} /></Field>
          <Field label="SKU" hint={isAr ? 'يُنشأ تلقائياً إن تُرك فارغاً' : 'Generated if left empty'}><input className={inputCls} value={form.sku} onChange={set('sku')} dir="ltr" /></Field>
          <Field label={isAr ? 'الباركود' : 'Barcode'}><input className={inputCls} value={form.barcode} onChange={set('barcode')} dir="ltr" /></Field>
          <Field label={isAr ? 'وحدة البيع' : 'Selling unit'}>
            <select className={inputCls} value={form.unit} onChange={set('unit')}>
              {['piece', 'kg', 'g', 'l', 'ml', 'pack', 'box'].map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </Field>
        </div>
        {allowed.length > 1 && (
          <div className="mt-4">
            <span className="mb-1 block text-sm font-medium text-slate-800">{isAr ? 'من يشحن هذا المنتج؟' : 'Who ships this product?'}</span>
            <div className="flex flex-wrap gap-2">
              {allowed.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => set('fulfilledBy')(mode)}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold ring-1 ${form.fulfilledBy === mode ? 'bg-indigo-600 text-white ring-indigo-600' : 'bg-white ring-slate-200'}`}
                >
                  {label(FULFILLMENT, mode, isAr)}
                </button>
              ))}
            </div>
          </div>
        )}
      </Section>

      <Section title={isAr ? 'الأنواع (اختياري)' : 'Variants (optional)'}>
        {form.variants.length > 0 && (
          <div className="mb-3 space-y-2">
            {form.variants.map((v, i) => (
              <div key={v._id || i} className="grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-6">
                <select className={inputCls} value={v.type} onChange={(e) => setRow('variants', i, 'type', e.target.value)}>
                  {Object.keys(VARIANT_TYPES).map((t) => <option key={t} value={t}>{label(VARIANT_TYPES, t, isAr)}</option>)}
                </select>
                <input className={inputCls} placeholder={isAr ? 'القيمة (عربي)' : 'Value (Arabic)'} value={v.valueAr} onChange={(e) => setRow('variants', i, 'valueAr', e.target.value)} />
                <input className={inputCls} placeholder={isAr ? 'القيمة (إنجليزي)' : 'Value (English)'} value={v.valueEn} onChange={(e) => setRow('variants', i, 'valueEn', e.target.value)} />
                <input className={inputCls} type="number" min="0" placeholder={isAr ? 'السعر' : 'Price'} value={v.price} onChange={(e) => setRow('variants', i, 'price', e.target.value)} />
                <input className={inputCls} type="number" min="0" placeholder={isAr ? 'المخزون' : 'Stock'} value={v.stock} onChange={(e) => setRow('variants', i, 'stock', e.target.value)} />
                <button type="button" onClick={() => removeRow('variants', i)} className="justify-self-end rounded-lg p-2 text-red-600 hover:bg-red-50" aria-label={isAr ? 'حذف' : 'Remove'}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
        <button type="button" onClick={() => addRow('variants', { type: 'size', valueAr: '', valueEn: '', price: form.price, stock: '0', sku: '' })} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold text-indigo-700 ring-1 ring-indigo-200 hover:bg-indigo-50">
          <Plus className="h-4 w-4" />{isAr ? 'إضافة نوع' : 'Add variant'}
        </button>
      </Section>

      <Section title={isAr ? 'المواصفات والبحث' : 'Specifications & search'}>
        {form.specs.map((s, i) => (
          <div key={i} className="mb-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
            <input className={inputCls} placeholder={isAr ? 'الخاصية (عربي)' : 'Property (Arabic)'} value={s.keyAr} onChange={(e) => setRow('specs', i, 'keyAr', e.target.value)} />
            <input className={inputCls} placeholder={isAr ? 'القيمة (عربي)' : 'Value (Arabic)'} value={s.valueAr} onChange={(e) => setRow('specs', i, 'valueAr', e.target.value)} />
            <input className={inputCls} placeholder={isAr ? 'الخاصية (إنجليزي)' : 'Property (English)'} value={s.keyEn} onChange={(e) => setRow('specs', i, 'keyEn', e.target.value)} />
            <input className={inputCls} placeholder={isAr ? 'القيمة (إنجليزي)' : 'Value (English)'} value={s.valueEn} onChange={(e) => setRow('specs', i, 'valueEn', e.target.value)} />
            <button type="button" onClick={() => removeRow('specs', i)} className="justify-self-end rounded-lg p-2 text-red-600 hover:bg-red-50" aria-label={isAr ? 'حذف' : 'Remove'}><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
        <button type="button" onClick={() => addRow('specs', { keyAr: '', keyEn: '', valueAr: '', valueEn: '' })} className="mb-4 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold text-indigo-700 ring-1 ring-indigo-200 hover:bg-indigo-50">
          <Plus className="h-4 w-4" />{isAr ? 'إضافة مواصفة' : 'Add specification'}
        </button>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={isAr ? 'كلمات بحث (عربي)' : 'Search keywords (Arabic)'} hint={isAr ? 'افصل بينها بفاصلة' : 'Comma separated'}><input className={inputCls} value={form.searchKeywordsAr} onChange={set('searchKeywordsAr')} /></Field>
          <Field label={isAr ? 'كلمات بحث (إنجليزي)' : 'Search keywords (English)'} hint={isAr ? 'افصل بينها بفاصلة' : 'Comma separated'}><input className={inputCls} value={form.searchKeywordsEn} onChange={set('searchKeywordsEn')} dir="ltr" /></Field>
        </div>
      </Section>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-end gap-2 px-4 py-3">
          {canSubmit ? (
            <>
              <button type="button" disabled={saving || uploading} onClick={() => save(false)} className="rounded-xl px-4 py-2.5 text-sm font-semibold ring-1 ring-slate-300 hover:bg-slate-50 disabled:opacity-50">
                {isAr ? 'حفظ كمسودة' : 'Save draft'}
              </button>
              <button type="button" disabled={saving || uploading} onClick={() => save(true)} className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-indigo-700 disabled:opacity-50">
                {saving ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'حفظ وإرسال للمراجعة' : 'Save & submit for review')}
              </button>
            </>
          ) : (
            <button type="button" disabled={saving || uploading} onClick={() => save(false)} className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-indigo-700 disabled:opacity-50">
              {saving ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'حفظ التغييرات' : 'Save changes')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
