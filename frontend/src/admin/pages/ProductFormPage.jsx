import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { adminApi } from '../adminApi';
import ProductImageGallery from '../components/ProductImageGallery';
import {
  hasValidationErrors,
  validateProductForm,
} from '../utils/productFormValidation';
import { localizeAdminApiError } from '../constants/productCategoryErrors';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Textarea from '../../components/ui/Textarea';
import Loader from '../../components/ui/Loader';
import ProductCatalogFields from '../components/ProductCatalogFields';
import ProductCategoryPicker from '../components/ProductCategoryPicker';
import BrandFilterSelect from '../components/BrandFilterSelect';
import { buildCategorySelectionFromLeaf, categoryHasChildren, getCategoryBreadcrumb } from '../../utils/categoryHelpers';
import { isVideoUrl } from '../../utils/imageHelpers';
import { adminNewProductUrl } from '../utils/adminProductRoutes';

const emptyForm = {
  nameAr: '',
  nameEn: '',
  slug: '',
  descriptionAr: '',
  descriptionEn: '',
  price: '',
  wholesalePrice: '',
  oldPrice: '',
  category: '',
  mainCategory: '',
  subCategory: '',
  brand: '',
  stock: 0,
  unit: 'piece',
  emoji: '🛍️',
  isFeatured: false,
  isOffer: false,
  isBestSeller: false,
  isOurProduct: false,
  isActive: true,
  sku: '',
  barcode: '',
  variants: [],
  specs: [],
  frequentlyBoughtTogether: [],
  similarProducts: [],
};

const ALL_FIELDS = [
  'nameAr', 'nameEn', 'mainCategory', 'subCategory', 'price', 'wholesalePrice', 'stock', 'oldPrice',
];

/** Defaults kept after “Save & add another”; category and product identity are cleared. */
function buildFormForAnother(previous) {
  return {
    ...emptyForm,
    brand: previous.brand || emptyForm.brand,
    unit: previous.unit || emptyForm.unit,
    emoji: previous.emoji || emptyForm.emoji,
    isActive: previous.isActive !== false,
    wholesalePrice: previous.wholesalePrice !== '' && previous.wholesalePrice != null
      ? previous.wholesalePrice
      : '',
    category: '',
    mainCategory: '',
    subCategory: '',
  };
}

function formatDateTime(value, isAr) {
  if (!value) return '';
  return new Date(value).toLocaleString(isAr ? 'ar-EG' : 'en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function mapImagesFromProduct(p) {
  return (p.images || [])
    .filter((img) => typeof img === 'string' && img.startsWith('http'))
    .map((url, index) => ({
      url,
      publicId: p.cloudinaryPublicIds?.[index] || null,
      type: p.mediaTypes?.[index] || (isVideoUrl(url) ? 'video' : 'image'),
    }));
}

export default function ProductFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const prefillCategoryId = searchParams.get('category') || '';
  const { language } = useLanguage();
  const isAr = language === 'ar';

  const [form, setForm] = useState(emptyForm);
  const [categories, setCategories] = useState([]);
  const [meta, setMeta] = useState({ updatedAt: null, stockUpdatedAt: null, stockHistory: [] });
  const [allProducts, setAllProducts] = useState([]);
  const [images, setImages] = useState([]);
  const [files, setFiles] = useState([]);
  const [removingImage, setRemovingImage] = useState(null);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [categoryPickerKey, setCategoryPickerKey] = useState(0);
  const [brands, setBrands] = useState([]);

  const safeCategories = Array.isArray(categories) ? categories : [];

  useEffect(() => {
    adminApi.getCategories({ limit: 500 })
      .then(({ data }) => setCategories(Array.isArray(data.data) ? data.data : []))
      .catch(() => setCategories([]));
    adminApi.getProducts({ limit: 300 })
      .then(({ data }) => setAllProducts(Array.isArray(data.data) ? data.data : []))
      .catch(() => setAllProducts([]));
    adminApi.getBrands({ limit: 500, isActive: 'true' })
      .then(({ data }) => setBrands(Array.isArray(data.data) ? data.data : []))
      .catch(() => setBrands([]));
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    adminApi.getProduct(id)
      .then(({ data }) => {
        const p = data?.data;
        if (!p?._id) {
          setSubmitError(isAr ? 'المنتج غير موجود أو تم حذفه' : 'Product not found or was deleted');
          return;
        }
        const leafId = p.subCategory || p.categoryId || p.category || '';
        setForm({
          nameAr: p.nameAr || p.name || '',
          nameEn: p.nameEn || '',
          slug: p.slug || '',
          descriptionAr: p.descriptionAr || p.description || '',
          descriptionEn: p.descriptionEn || '',
          price: p.price,
          wholesalePrice: p.wholesalePrice ?? '',
          oldPrice: p.oldPrice || '',
          mainCategory: p.mainCategory || '',
          subCategory: leafId,
          category: leafId,
          brand: p.brand || '',
          stock: p.stock,
          unit: p.unit || 'piece',
          emoji: p.emoji || '🛍️',
          isFeatured: p.isFeatured || false,
          isOffer: p.isOffer || false,
          isBestSeller: p.isBestSeller || false,
          isOurProduct: p.isOurProduct || false,
          isActive: p.isActive !== false,
          sku: p.sku || '',
          barcode: p.barcode || '',
          variants: p.variants || [],
          specs: p.specs || [],
          frequentlyBoughtTogether: (p.frequentlyBoughtTogether || []).map(String),
          similarProducts: (p.similarProducts || []).map(String),
          _id: p._id,
        });
        setImages(mapImagesFromProduct(p));
        setMeta({
          updatedAt: p.updatedAt,
          stockUpdatedAt: p.stockUpdatedAt,
          stockHistory: p.stockHistory || [],
        });
      })
      .catch((err) => {
        setSubmitError(err.response?.data?.message || (isAr ? 'تعذر تحميل المنتج' : 'Could not load product'));
      })
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  useEffect(() => {
    if (!form.subCategory || form.mainCategory || !safeCategories.length) return;
    const selection = buildCategorySelectionFromLeaf(safeCategories, form.subCategory);
    if (selection.level1) {
      setForm((f) => ({ ...f, mainCategory: String(selection.level1) }));
    }
  }, [form.subCategory, form.mainCategory, safeCategories]);

  useEffect(() => {
    if (isEdit || !prefillCategoryId || !safeCategories.length) return;
    const selection = buildCategorySelectionFromLeaf(safeCategories, prefillCategoryId);
    if (!selection.leafId) return;
    setForm((f) => {
      if (f.subCategory) return f;
      return {
        ...f,
        mainCategory: selection.level1 ? String(selection.level1) : '',
        subCategory: String(selection.leafId),
        category: String(selection.leafId),
      };
    });
  }, [isEdit, prefillCategoryId, safeCategories]);

  const touch = (field) => setTouched((t) => ({ ...t, [field]: true }));

  useEffect(() => {
    if (!Object.keys(touched).length) return;
    setFieldErrors(validateProductForm(form, isAr, safeCategories));
  }, [form, touched, isAr, safeCategories]);

  const showError = (field) => (touched[field] ? fieldErrors[field] : undefined);

  const handleReorder = useCallback((newImages) => {
    setImages(newImages);
    if (isEdit && id) {
      adminApi.reorderProductImages(id, newImages).catch(() => {});
    }
  }, [isEdit, id]);

  const handleRemoveImage = async (entry) => {
    if (!isEdit || !entry.publicId) {
      setImages((prev) => prev.filter((img) => img.url !== entry.url));
      return;
    }

    setRemovingImage(entry.publicId);
    setSubmitError('');
    try {
      const { data } = await adminApi.removeProductImage(id, entry.publicId);
      setImages(mapImagesFromProduct(data.data));
    } catch (err) {
      setSubmitError(err.response?.data?.message || (isAr ? 'تعذر حذف الصورة' : 'Failed to remove image'));
    } finally {
      setRemovingImage(null);
    }
  };

  const resetForAnother = () => {
    setForm((prev) => buildFormForAnother(prev));
    setCategoryPickerKey((k) => k + 1);
    setImages([]);
    setFiles([]);
    setMeta({ updatedAt: null, stockUpdatedAt: null, stockHistory: [] });
    setFieldErrors({});
    setTouched({});
    setSubmitError('');
    if (prefillCategoryId) {
      navigate(adminNewProductUrl(), { replace: true });
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCategoryChange = useCallback(({ mainCategory, subCategory }) => {
    setForm((f) => {
      if (String(f.mainCategory) === String(mainCategory) && String(f.subCategory) === String(subCategory)) {
        return f;
      }
      return {
        ...f,
        mainCategory,
        subCategory,
        category: subCategory,
      };
    });
  }, []);

  const handleSave = async (addAnother = false) => {
    const errors = validateProductForm(form, isAr, safeCategories);
    setFieldErrors(errors);
    setTouched(Object.fromEntries(ALL_FIELDS.map((f) => [f, true])));
    if (hasValidationErrors(errors)) return;

    setSaving(true);
    setSubmitError('');
    try {
      const mainCategory = form.mainCategory || (form.subCategory
        ? String(buildCategorySelectionFromLeaf(safeCategories, form.subCategory).level1 || '')
        : '');
      const payload = {
        ...form,
        mainCategory,
        subCategory: form.subCategory,
        category: form.subCategory,
        price: Number(form.price),
        wholesalePrice: form.wholesalePrice !== '' && form.wholesalePrice != null
          ? Number(form.wholesalePrice)
          : 0,
        oldPrice: form.oldPrice ? Number(form.oldPrice) : null,
        stock: Number(form.stock),
        variants: (form.variants || []).map((v) => ({
          ...v,
          price: v.price !== '' && v.price != null ? Number(v.price) : Number(form.price),
          wholesalePrice: v.wholesalePrice !== '' && v.wholesalePrice != null ? Number(v.wholesalePrice) : 0,
          stock: Number(v.stock || 0),
        })),
        specs: form.specs || [],
        frequentlyBoughtTogether: form.frequentlyBoughtTogether || [],
        similarProducts: form.similarProducts || [],
      };

      let productId = id;
      if (isEdit) {
        const { data } = await adminApi.updateProduct(id, payload);
        productId = data.data._id;
        setMeta({
          updatedAt: data.data.updatedAt,
          stockUpdatedAt: data.data.stockUpdatedAt,
          stockHistory: data.data.stockHistory || [],
        });
      } else {
        const { data } = await adminApi.createProduct(payload);
        productId = data.data._id;
      }

      if (files.length) {
        await adminApi.uploadImages(productId, files);
      }

      if (addAnother && !isEdit) {
        resetForAnother();
        return;
      }

      navigate('/admin/products');
    } catch (err) {
      setSubmitError(localizeAdminApiError(
        err,
        isAr,
        'Could not save the product — check the form and try again.',
        'تعذّر حفظ المنتج — تحقق من النموذج وحاول مرة أخرى.',
      ));
    } finally {
      setSaving(false);
    }
  };

  const sellPrice = Number(form.price) || 0;
  const wholesale = Number(form.wholesalePrice) || 0;
  const unitProfit = sellPrice - wholesale;
  const marginPct = sellPrice > 0 ? Math.round((unitProfit / sellPrice) * 1000) / 10 : 0;

  const prefillCategory = prefillCategoryId && !isEdit
    ? safeCategories.find((c) => String(c._id) === String(prefillCategoryId))
    : null;
  const prefillBreadcrumb = prefillCategory
    ? getCategoryBreadcrumb(prefillCategory, safeCategories, isAr)
    : '';

  if (loading) {
    return <div className="flex justify-center py-20"><Loader size="lg" /></div>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {isEdit && meta.updatedAt && (
        <p className="text-sm text-text-muted">
          {isAr ? 'آخر تحديث للمنتج:' : 'Product last updated:'}{' '}
          <span className="font-medium text-text">{formatDateTime(meta.updatedAt, isAr)}</span>
          {meta.stockUpdatedAt && (
            <>
              {' · '}
              {isAr ? 'آخر تغيير للمخزون:' : 'Stock last changed:'}{' '}
              <span className="font-medium text-text">{formatDateTime(meta.stockUpdatedAt, isAr)}</span>
            </>
          )}
        </p>
      )}

      <form
        onSubmit={(e) => { e.preventDefault(); handleSave(false); }}
        className="space-y-6 rounded-2xl border border-border bg-white p-6 shadow-sm"
        noValidate
      >
        {prefillBreadcrumb && form.subCategory && (
          <div className="rounded-xl border border-primary-200 bg-primary-50 px-3 py-2.5 text-sm text-primary-900">
            {isAr
              ? `القسم مُعبّأ مسبقًا: ${prefillBreadcrumb}`
              : `Category pre-filled: ${prefillBreadcrumb}`}
            {categoryHasChildren(safeCategories, form.subCategory) && (
              <p className="mt-1 text-xs text-amber-800">
                {isAr
                  ? 'هذا القسم له أقسام فرعية — اختر مستوى أعمق قبل الحفظ.'
                  : 'This category has children — pick a deeper subcategory before saving.'}
              </p>
            )}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label={isAr ? 'الاسم (عربي)' : 'Name (Arabic)'}
            name="nameAr"
            value={form.nameAr}
            onChange={(e) => set('nameAr', e.target.value)}
            onBlur={() => touch('nameAr')}
            error={showError('nameAr')}
            required
          />
          <Input
            label={isAr ? 'الاسم (إنجليزي)' : 'Name (English)'}
            name="nameEn"
            value={form.nameEn}
            onChange={(e) => set('nameEn', e.target.value)}
            onBlur={() => touch('nameEn')}
            error={showError('nameEn')}
            required
          />
          <Input label="Slug" value={form.slug} onChange={(e) => set('slug', e.target.value)} />
          <div>
            <BrandFilterSelect
              brands={brands}
              value={form.brand || ''}
              onChange={(v) => set('brand', v)}
              isAr={isAr}
              label={isAr ? 'العلامة التجارية' : 'Brand'}
              placeholder={isAr ? 'اختر علامة تجارية…' : 'Select a brand…'}
              maxOptions={200}
            />
            <p className="mt-1.5 text-xs text-text-muted">
              {isAr ? (
                <>
                  القائمة من{' '}
                  <Link to="/admin/brands" className="font-semibold text-primary-600 hover:underline">
                    {isAr ? 'العلامات التجارية' : 'Brands'}
                  </Link>
                  {' '}— يجب أن تطابق قيمة الفلتر في المنتج.
                </>
              ) : (
                <>
                  Options come from{' '}
                  <Link to="/admin/brands" className="font-semibold text-primary-600 hover:underline">
                    Brands
                  </Link>
                  {' '}— must match the product filter value.
                </>
              )}
            </p>
          </div>
          <Input
            label={isAr ? 'سعر البيع' : 'Selling price'}
            name="price"
            type="number"
            step="0.01"
            min="0"
            value={form.price}
            onChange={(e) => set('price', e.target.value)}
            onBlur={() => touch('price')}
            error={showError('price')}
            required
          />
          <Input
            label={isAr ? 'سعر الجملة' : 'Wholesale price'}
            name="wholesalePrice"
            type="number"
            step="0.01"
            min="0"
            value={form.wholesalePrice}
            onChange={(e) => set('wholesalePrice', e.target.value)}
            onBlur={() => touch('wholesalePrice')}
            error={showError('wholesalePrice')}
          />
          <Input
            label={isAr ? 'السعر القديم (عرض)' : 'Old price (promo)'}
            name="oldPrice"
            type="number"
            step="0.01"
            min="0"
            value={form.oldPrice}
            onChange={(e) => set('oldPrice', e.target.value)}
            onBlur={() => touch('oldPrice')}
            error={showError('oldPrice')}
          />
          {(sellPrice > 0 || wholesale > 0) && (
            <div className="sm:col-span-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              <p className="font-semibold">{isAr ? 'الربح للوحدة' : 'Profit per unit'}</p>
              <p className="mt-1">
                {isAr ? 'الفرق (بيع − جملة):' : 'Margin (sell − wholesale):'}{' '}
                <span className="font-bold">{unitProfit >= 0 ? '+' : ''}{unitProfit.toFixed(2)} EGP</span>
                {sellPrice > 0 && (
                  <span className="text-emerald-800">
                    {' '}
                    ({marginPct}% {isAr ? 'من سعر البيع' : 'of selling price'})
                  </span>
                )}
              </p>
            </div>
          )}
          <div>
            <Input
              label={isAr ? 'المخزون' : 'Stock'}
              name="stock"
              type="number"
              min="0"
              value={form.stock}
              onChange={(e) => set('stock', e.target.value)}
              onBlur={() => touch('stock')}
              error={showError('stock')}
              required
            />
            {isEdit && meta.stockHistory?.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer text-xs font-medium text-primary-600">
                  {isAr ? 'سجل المخزون' : 'Stock history'}
                </summary>
                <ul className="mt-2 space-y-1 rounded-lg bg-slate-50 p-2 text-xs text-text-muted">
                  {meta.stockHistory.slice(0, 8).map((entry, i) => (
                    <li key={i}>
                      {entry.previousStock} → {entry.stock}
                      {' · '}
                      {formatDateTime(entry.changedAt, isAr)}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
          <Input label={isAr ? 'الوحدة' : 'Unit'} value={form.unit} onChange={(e) => set('unit', e.target.value)} />
          <Input label="Emoji" value={form.emoji} onChange={(e) => set('emoji', e.target.value)} />
        </div>

        <ProductCategoryPicker
          key={categoryPickerKey}
          categories={safeCategories}
          value={form.subCategory}
          onChange={handleCategoryChange}
          subCategoryError={showError('subCategory')}
          onTouchSubCategory={() => touch('subCategory')}
          isAr={isAr}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Textarea
            label={isAr ? 'الوصف (عربي)' : 'Description (Arabic)'}
            name="descriptionAr"
            rows={4}
            value={form.descriptionAr}
            onChange={(e) => set('descriptionAr', e.target.value)}
          />
          <Textarea
            label={isAr ? 'الوصف (إنجليزي)' : 'Description (English)'}
            name="descriptionEn"
            rows={4}
            value={form.descriptionEn}
            onChange={(e) => set('descriptionEn', e.target.value)}
          />
        </div>

        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} />
            {isAr ? 'نشط' : 'Active'}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isOffer} onChange={(e) => set('isOffer', e.target.checked)} />
            {isAr ? 'عرض' : 'Offer'}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isFeatured} onChange={(e) => set('isFeatured', e.target.checked)} />
            {isAr ? 'وصل حديثاً 🆕' : 'New arrival 🆕'}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isBestSeller} onChange={(e) => set('isBestSeller', e.target.checked)} />
            {isAr ? 'الأكثر مبيعاً ⭐' : 'Best seller ⭐'}
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-primary-200 bg-primary-50 px-3 py-2 text-sm font-medium text-primary-900">
            <input type="checkbox" checked={form.isOurProduct} onChange={(e) => set('isOurProduct', e.target.checked)} />
            {isAr ? 'منتجنا (علامتنا التجارية)' : 'Our product (house brand)'}
          </label>
        </div>

        <ProductCatalogFields
          form={form}
          set={set}
          isAr={isAr}
          products={allProducts}
          categories={safeCategories}
          productId={id}
        />

        <div>
          <label className="mb-2 block text-sm font-medium">{isAr ? 'صور وفيديو المنتج' : 'Product images & video'}</label>
          <ProductImageGallery
            images={images}
            pendingFiles={files}
            onImagesChange={setImages}
            onPendingFilesChange={setFiles}
            onRemoveImage={handleRemoveImage}
            onReorder={handleReorder}
            removingId={removingImage}
            isAr={isAr}
            disabled={saving}
          />
        </div>

        {submitError && <p className="text-sm text-red-600">{submitError}</p>}

        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? <Loader size="sm" /> : (isAr ? 'حفظ' : 'Save')}
          </Button>
          {!isEdit && (
            <Button
              type="button"
              variant="secondary"
              disabled={saving}
              onClick={() => handleSave(true)}
            >
              {isAr ? 'حفظ وإضافة آخر' : 'Save & add another'}
            </Button>
          )}
          <Button type="button" variant="secondary" onClick={() => navigate('/admin/products')}>
            {isAr ? 'إلغاء' : 'Cancel'}
          </Button>
        </div>
      </form>
    </div>
  );
}
