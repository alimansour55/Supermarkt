import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useOutletContext, useParams } from '../../app/router';
import {
  ArrowLeft, ArrowRight, Copy, DollarSign, ExternalLink, FileText, FolderTree, Image as ImageIcon, Info, Layers, ListChecks,
} from 'lucide-react';
import { useToast } from '../../components/ui/Toast';
import { categoryService } from '../../services/apiServices';
import { fetchBrands } from '../../services/brandApi';
import { sellerApi } from '../../services/sellerApi';
import { LISTING_STATUS, apiError } from '../sellerLabels';
import StatusBadge from '../StatusBadge';
import { Field, SectionHeader, errorInputCls, inputCls } from '../product-form/ui';
import MediaSection, { MAX_MEDIA } from '../product-form/MediaSection';
import PricingSection from '../product-form/PricingSection';
import VariantsSection from '../product-form/VariantsSection';
import CategoriesSection from '../product-form/CategoriesSection';
import DetailsSection from '../product-form/DetailsSection';
import PreviewPanel from '../product-form/PreviewPanel';
import { qualityChecks } from '../product-form/productQuality';
import { PageSkeleton } from '../ui';

const EMPTY = {
  nameAr: '', nameEn: '', descriptionAr: '', descriptionEn: '',
  category: '', categorySuggestion: '', sellerCategories: [],
  brand: '', size: '', unit: 'piece',
  price: '', oldPrice: '', stock: '0', sku: '', barcode: '',
  fulfilledBy: '', searchKeywordsAr: [], searchKeywordsEn: [],
  variants: [], specs: [], media: [],
};

const SECTION_ORDER = ['basics', 'media', 'pricing', 'variants', 'categories', 'details'];

function toForm(p) {
  return {
    nameAr: p.nameAr || '',
    nameEn: p.nameEn || '',
    descriptionAr: p.descriptionAr || '',
    descriptionEn: p.descriptionEn || '',
    category: String(p.categoryId?._id || p.categoryId || ''),
    categorySuggestion: p.categorySuggestion || '',
    sellerCategories: (p.sellerCategories || []).map(String),
    brand: p.brand || '',
    size: p.size || '',
    unit: p.unit || 'piece',
    price: p.price != null ? String(p.price) : '',
    oldPrice: p.oldPrice ? String(p.oldPrice) : '',
    stock: String(p.stock ?? 0),
    sku: p.sku || '',
    barcode: p.barcode || '',
    fulfilledBy: p.fulfilledBy || '',
    searchKeywordsAr: p.searchKeywordsAr || [],
    searchKeywordsEn: p.searchKeywordsEn || [],
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
    nameAr: f.nameAr.trim(),
    nameEn: f.nameEn.trim(),
    descriptionAr: f.descriptionAr,
    descriptionEn: f.descriptionEn,
    category: f.category || '',
    categorySuggestion: f.category ? '' : f.categorySuggestion,
    sellerCategories: f.sellerCategories,
    brand: f.brand,
    size: f.size,
    unit: f.unit,
    price: f.price === '' ? undefined : Number(f.price),
    oldPrice: f.oldPrice === '' ? null : Number(f.oldPrice),
    stock: Number(f.stock || 0),
    sku: f.sku,
    barcode: f.barcode,
    ...(f.fulfilledBy ? { fulfilledBy: f.fulfilledBy } : {}),
    searchKeywordsAr: f.searchKeywordsAr,
    searchKeywordsEn: f.searchKeywordsEn,
    variants: f.variants.map((v) => ({
      ...v,
      // One language is enough — the other falls back to it.
      valueAr: v.valueAr.trim() || v.valueEn.trim(),
      valueEn: v.valueEn.trim() || v.valueAr.trim(),
      price: v.price === '' ? undefined : Number(v.price),
      stock: Number(v.stock || 0),
    })),
    specs: f.specs.filter((s) => (s.keyAr || s.keyEn) && (s.valueAr || s.valueEn)),
    media: f.media,
  };
}

/** Field errors keyed by field; `submit` adds the checks a reviewer would reject on. */
function validate(f, isAr, { submit }) {
  const e = {};
  if (!f.nameAr.trim()) e.nameAr = isAr ? 'أدخل الاسم بالعربية' : 'Enter the Arabic name';
  if (!f.nameEn.trim()) e.nameEn = isAr ? 'أدخل الاسم بالإنجليزية' : 'Enter the English name';
  if (!(Number(f.price) > 0)) e.price = isAr ? 'أدخل سعراً أكبر من صفر' : 'Enter a price above zero';
  if (f.oldPrice !== '' && Number(f.oldPrice) <= Number(f.price)) {
    e.oldPrice = isAr ? 'يجب أن يكون أعلى من سعر البيع' : 'Must be higher than the selling price';
  }
  if (f.barcode && !/^\d{8,14}$/.test(f.barcode.trim())) e.barcode = isAr ? 'الباركود من 8 إلى 14 رقماً' : 'Barcodes are 8–14 digits';
  if (f.variants.some((v) => !(v.valueAr.trim() || v.valueEn.trim()) || !(Number(v.price) > 0))) {
    e.variants = isAr ? 'كل نوع يحتاج قيمة وسعراً أكبر من صفر' : 'Every variant needs a value and a price above zero';
  }
  if (submit && !f.media.length) e.media = isAr ? 'أضف صورة واحدة على الأقل قبل الإرسال' : 'Add at least one photo before submitting';
  return e;
}

const FIELD_SECTION = {
  nameAr: 'basics', nameEn: 'basics', media: 'media', price: 'pricing', oldPrice: 'pricing', barcode: 'pricing', variants: 'variants',
};

export default function SellerProductFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const toast = useToast();
  const { seller, isAr, me } = useOutletContext();
  const topRef = useRef(null);

  const [form, setForm] = useState(EMPTY);
  const [product, setProduct] = useState(null);
  const [categories, setCategories] = useState([]);
  const [sections, setSections] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [active, setActive] = useState('basics');
  const [errors, setErrors] = useState({});
  const [baseline, setBaseline] = useState(() => JSON.stringify(EMPTY));

  const loadInto = useCallback((next) => {
    setForm(next);
    setBaseline(JSON.stringify(next));
    setErrors({});
  }, []);

  useEffect(() => {
    categoryService.getAll().then(({ data }) => setCategories(data.data || [])).catch(() => setCategories([]));
    sellerApi.listCategories().then(({ data }) => setSections(data.data || [])).catch(() => setSections([]));
    fetchBrands().then((list) => setBrands(Array.isArray(list) ? list : [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isEdit) {
      loadInto({ ...EMPTY, fulfilledBy: seller.defaultFulfillment || 'seller' });
      setProduct(null);
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
        loadInto(toForm(merged));
      })
      .catch(() => toast.error(isAr ? 'المنتج غير موجود' : 'Product not found'))
      .finally(() => setLoading(false));
  }, [id, isEdit, seller.defaultFulfillment, isAr, toast, loadInto]);

  const dirty = JSON.stringify(form) !== baseline;

  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const set = useCallback((key) => (e) => {
    const value = e?.target ? e.target.value : e;
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  }, []);

  const live = product && ['approved', 'paused'].includes(product.listingStatus);
  const reviewsEdits = live && me.marketplace.reviewContentEdits && !seller.autoApproveListings;
  const canSubmit = !product || ['draft', 'rejected'].includes(product.listingStatus);
  const storeHeld = product?.fulfilledBy === 'store' && form.fulfilledBy === 'store';
  const allowed = seller.allowedFulfillment || ['seller'];

  const commissionRate = useMemo(() => {
    const rule = (seller.categoryCommissions || []).find((r) => String(r.category?._id || r.category) === String(form.category));
    return rule?.rate ?? seller.commissionRate ?? me.marketplace.defaultCommissionRate ?? 0;
  }, [seller, me, form.category]);

  const brandNames = useMemo(
    () => [...new Set(brands.map((b) => (isAr ? b.nameAr || b.name : b.nameEn || b.name)).filter(Boolean))],
    [brands, isAr],
  );

  const checks = useMemo(() => qualityChecks(form), [form]);
  const errorSections = useMemo(() => new Set(Object.entries(errors).filter(([, v]) => v).map(([k]) => FIELD_SECTION[k])), [errors]);

  const SECTIONS = [
    { id: 'basics', label: isAr ? 'المعلومات الأساسية' : 'Basics', Icon: Info },
    { id: 'media', label: isAr ? 'الصور' : 'Photos', Icon: ImageIcon, badge: form.media.length || null },
    { id: 'pricing', label: isAr ? 'السعر والمخزون' : 'Price & stock', Icon: DollarSign },
    { id: 'variants', label: isAr ? 'الأنواع' : 'Variants', Icon: Layers, badge: form.variants.length || null },
    { id: 'categories', label: isAr ? 'الأقسام' : 'Categories', Icon: FolderTree, badge: form.sellerCategories.length || null },
    { id: 'details', label: isAr ? 'المواصفات والبحث' : 'Specs & search', Icon: ListChecks },
  ];

  const go = (section) => {
    setActive(section);
    requestAnimationFrame(() => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const upload = async (files) => {
    setUploading(true);
    try {
      const { data } = await sellerApi.uploadMedia(files);
      setForm((f) => ({ ...f, media: [...f.media, ...data.data].slice(0, MAX_MEDIA) }));
      setErrors((prev) => ({ ...prev, media: undefined }));
    } catch (err) {
      toast.error(apiError(err, isAr ? 'تعذّر رفع الصور' : 'Upload failed'));
    } finally {
      setUploading(false);
    }
  };

  const save = async ({ submit = false, another = false } = {}) => {
    const found = validate(form, isAr, { submit });
    setErrors(found);
    const firstBad = SECTION_ORDER.find((s) => Object.entries(found).some(([k, v]) => v && FIELD_SECTION[k] === s));
    if (firstBad) {
      go(firstBad);
      toast.error(isAr ? 'راجع الحقول المحددة بالأحمر' : 'Check the fields highlighted in red');
      return;
    }

    setSaving(true);
    try {
      const payload = toPayload(form);
      // Warehouse stock is the store's to change — never send a (possibly stale) value back.
      if (product?.fulfilledBy === 'store') delete payload.stock;
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
      setBaseline(JSON.stringify(form));
      if (another) {
        // Keep the choices that usually repeat for the next product.
        loadInto({
          ...EMPTY,
          fulfilledBy: form.fulfilledBy,
          unit: form.unit,
          brand: form.brand,
          category: form.category,
          sellerCategories: form.sellerCategories,
        });
        go('basics');
        return;
      }
      navigate('/seller-center/products');
    } catch (err) {
      toast.error(apiError(err, isAr ? 'تعذّر الحفظ' : 'Save failed'));
    } finally {
      setSaving(false);
    }
  };

  // Ctrl/Cmd+S saves (as a draft for new products).
  const saveRef = useRef(save);
  useEffect(() => { saveRef.current = save; });
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveRef.current({});
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const discard = async () => {
    setSaving(true);
    try {
      const { data } = await sellerApi.discardChanges(id);
      setProduct(data.data);
      loadInto(toForm({ ...data.data, categoryId: data.data.categoryId }));
      toast.success(isAr ? 'تم إلغاء التعديلات المعلقة' : 'Pending edits discarded');
    } catch (err) {
      toast.error(apiError(err, isAr ? 'تعذّر الإلغاء' : 'Could not discard'));
    } finally {
      setSaving(false);
    }
  };

  const duplicate = async () => {
    if (dirty && !window.confirm(isAr ? 'لديك تغييرات غير محفوظة. المتابعة بدون حفظ؟' : 'You have unsaved changes. Continue without saving?')) return;
    try {
      const { data } = await sellerApi.duplicateProduct(id);
      toast.success(isAr ? 'تم إنشاء نسخة كمسودة — أضف الصور' : 'Copy created as a draft — add photos');
      setBaseline(JSON.stringify(form));
      navigate(`/seller-center/products/${data.data._id}`);
    } catch (err) {
      toast.error(apiError(err, isAr ? 'تعذّر النسخ' : 'Could not duplicate'));
    }
  };

  if (loading) return <PageSkeleton />;

  const Back = isAr ? ArrowRight : ArrowLeft;
  const Next = isAr ? ArrowLeft : ArrowRight;
  const index = SECTION_ORDER.indexOf(active);
  const sellerName = isAr ? seller.nameAr : seller.nameEn;

  return (
    <div ref={topRef} className="scroll-mt-20 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/seller-center/products" className="rounded-lg p-2 ring-1 ring-slate-200 hover:bg-white" aria-label={isAr ? 'رجوع' : 'Back'}>
          <Back className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-bold">
            {isEdit ? (isAr ? form.nameAr || 'تعديل منتج' : form.nameEn || 'Edit product') : (isAr ? 'منتج جديد' : 'New product')}
          </h1>
          {product?.sku && <p className="text-xs text-slate-500" dir="ltr">{product.sku}</p>}
        </div>
        {product && <StatusBadge map={LISTING_STATUS} value={product.listingStatus} isAr={isAr} />}
        {product?.isActive && product.slug && (
          <a href={`/${isAr ? 'ar' : 'en'}/products/${product.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold ring-1 ring-slate-200 hover:bg-white">
            <ExternalLink className="h-3.5 w-3.5" />{isAr ? 'عرض في المتجر' : 'View in store'}
          </a>
        )}
        {isEdit && (
          <button type="button" onClick={duplicate} className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold ring-1 ring-slate-200 hover:bg-white">
            <Copy className="h-3.5 w-3.5" />{isAr ? 'نسخ كمنتج جديد' : 'Duplicate'}
          </button>
        )}
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
      {product?.sellerPromotion && (
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-900">
          {isAr ? 'هذا المنتج في عرض نشط — لا يمكن تعديل السعر حتى ينتهي العرض، وسيعود السعر الأصلي تلقائياً.' : "This product is in an active promotion — its price can't change until the promotion ends, then the original price comes back automatically."}
        </div>
      )}
      {reviewsEdits && !product?.pendingChangesAt && (
        <div className="flex gap-2 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {isAr
            ? 'هذا المنتج معروض. تغييرات السعر والمخزون وأقسام متجرك تُطبق فوراً، أما الاسم والوصف والصور وقسم المنصة فتُراجع قبل ظهورها.'
            : 'This product is live. Price, stock and your store sections apply instantly; name, description, photos and marketplace category are reviewed before they show.'}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[13rem_minmax(0,1fr)_17rem] lg:items-start">
        <nav className="flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm lg:sticky lg:top-20 lg:flex-col">
          {SECTIONS.map(({ id: sid, label: text, Icon, badge }) => {
            const on = active === sid;
            return (
              <button
                key={sid}
                type="button"
                onClick={() => go(sid)}
                className={`relative flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition lg:w-full ${on ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                <span className="whitespace-nowrap">{text}</span>
                {errorSections.has(sid) ? (
                  <span className={`ms-auto h-2 w-2 rounded-full ${on ? 'bg-white' : 'bg-red-500'}`} aria-label={isAr ? 'خطأ' : 'Has errors'} />
                ) : badge ? (
                  <span className={`ms-auto rounded-full px-1.5 text-[11px] font-bold ${on ? 'bg-white/20' : 'bg-slate-100 text-slate-600'}`}>{badge}</span>
                ) : null}
              </button>
            );
          })}
        </nav>

        <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          {active === 'basics' && (
            <div>
              <SectionHeader
                title={isAr ? 'المعلومات الأساسية' : 'Basics'}
                description={isAr ? 'اسم واضح يبدأ بالعلامة ثم النوع ثم الحجم — مثال: «نحلة عسل سدر 500 جم».' : 'A clear name: brand, then product, then size — e.g. "Nahla Sidr Honey 500 g".'}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={isAr ? 'الاسم بالعربية *' : 'Arabic name *'} error={errors.nameAr} counter={`${form.nameAr.length}/150`}>
                  <input className={`${inputCls} ${errors.nameAr ? errorInputCls : ''}`} value={form.nameAr} onChange={set('nameAr')} dir="rtl" maxLength={150} />
                </Field>
                <Field label={isAr ? 'الاسم بالإنجليزية *' : 'English name *'} error={errors.nameEn} counter={`${form.nameEn.length}/150`}>
                  <input className={`${inputCls} ${errors.nameEn ? errorInputCls : ''}`} value={form.nameEn} onChange={set('nameEn')} dir="ltr" maxLength={150} />
                </Field>
                <Field label={isAr ? 'العلامة التجارية' : 'Brand'} hint={isAr ? 'اختر من القائمة أو اكتب علامتك' : 'Pick from the list or type your own'}>
                  <input className={inputCls} value={form.brand} onChange={set('brand')} list="seller-brands" maxLength={80} />
                  <datalist id="seller-brands">{brandNames.map((b) => <option key={b} value={b} />)}</datalist>
                </Field>
                <div className="hidden sm:block" />
                <Field label={isAr ? 'الوصف بالعربية' : 'Arabic description'} counter={`${form.descriptionAr.length}/5000`}>
                  <textarea rows={7} className={inputCls} value={form.descriptionAr} onChange={set('descriptionAr')} dir="rtl" maxLength={5000} placeholder={isAr ? 'المميزات، طريقة الاستخدام، المكونات…' : 'Features, how to use, ingredients…'} />
                </Field>
                <Field label={isAr ? 'الوصف بالإنجليزية' : 'English description'} counter={`${form.descriptionEn.length}/5000`}>
                  <textarea rows={7} className={inputCls} value={form.descriptionEn} onChange={set('descriptionEn')} dir="ltr" maxLength={5000} placeholder="Features, how to use, ingredients…" />
                </Field>
              </div>
            </div>
          )}
          {active === 'media' && (
            <MediaSection media={form.media} onChange={set('media')} onUpload={upload} uploading={uploading} isAr={isAr} error={errors.media} />
          )}
          {active === 'pricing' && (
            <PricingSection
              form={form}
              set={set}
              errors={errors}
              isAr={isAr}
              commissionRate={commissionRate}
              allowedFulfillment={allowed}
              storeHeld={storeHeld}
              hasVariants={form.variants.length > 0}
              isEdit={isEdit}
            />
          )}
          {active === 'variants' && (
            <VariantsSection form={form} setForm={setForm} isAr={isAr} storeHeld={storeHeld} errors={errors} />
          )}
          {active === 'categories' && (
            <CategoriesSection
              form={form}
              set={set}
              isAr={isAr}
              sections={sections}
              onSectionCreated={(c) => setSections((prev) => [...prev, c])}
              marketplaceCategories={categories}
              live={live}
            />
          )}
          {active === 'details' && <DetailsSection form={form} setForm={setForm} set={set} isAr={isAr} />}

          <div className="mt-8 flex items-center justify-between border-t border-slate-100 pt-4">
            <button type="button" disabled={index === 0} onClick={() => go(SECTION_ORDER[index - 1])} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold ring-1 ring-slate-200 hover:bg-slate-50 disabled:invisible">
              <Back className="h-4 w-4" />{isAr ? 'السابق' : 'Previous'}
            </button>
            <span className="text-xs text-slate-400">{index + 1} / {SECTION_ORDER.length}</span>
            <button type="button" disabled={index === SECTION_ORDER.length - 1} onClick={() => go(SECTION_ORDER[index + 1])} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold ring-1 ring-slate-200 hover:bg-slate-50 disabled:invisible">
              {isAr ? 'التالي' : 'Next'}<Next className="h-4 w-4" />
            </button>
          </div>
        </div>

        <aside className="lg:sticky lg:top-20">
          <PreviewPanel form={form} isAr={isAr} sellerName={sellerName} checks={checks} onJump={go} />
        </aside>
      </div>

      <div className="sticky bottom-3 z-20 rounded-2xl border border-slate-200 bg-white/95 shadow-xl backdrop-blur">
        <div className="flex flex-wrap items-center justify-end gap-2 px-4 py-3">
          <span className="me-auto flex items-center gap-1.5 text-xs text-slate-500">
            <FileText className="h-3.5 w-3.5" aria-hidden />
            {dirty ? (isAr ? 'تغييرات غير محفوظة · Ctrl+S للحفظ' : 'Unsaved changes · Ctrl+S to save') : (isAr ? 'لا توجد تغييرات' : 'All changes saved')}
          </span>
          {canSubmit ? (
            <>
              {!isEdit && (
                <button type="button" disabled={saving || uploading} onClick={() => save({ another: true })} className="hidden rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 sm:block">
                  {isAr ? 'حفظ وإضافة آخر' : 'Save & add another'}
                </button>
              )}
              <button type="button" disabled={saving || uploading} onClick={() => save()} className="rounded-xl px-4 py-2.5 text-sm font-semibold ring-1 ring-slate-300 hover:bg-slate-50 disabled:opacity-50">
                {isAr ? 'حفظ كمسودة' : 'Save draft'}
              </button>
              <button type="button" disabled={saving || uploading} onClick={() => save({ submit: true })} className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-indigo-700 disabled:opacity-50">
                {saving ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'حفظ وإرسال للمراجعة' : 'Save & submit for review')}
              </button>
            </>
          ) : (
            <button type="button" disabled={saving || uploading || !dirty} onClick={() => save()} className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-indigo-700 disabled:opacity-50">
              {saving ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'حفظ التغييرات' : 'Save changes')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
