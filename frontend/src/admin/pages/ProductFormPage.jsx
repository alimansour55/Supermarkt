import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { adminApi } from '../adminApi';
import ProductImageGallery from '../components/ProductImageGallery';
import {
  hasValidationErrors,
  validateProductForm,
} from '../utils/productFormValidation';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Textarea from '../../components/ui/Textarea';
import Loader from '../../components/ui/Loader';

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
  subCategory: '',
  brand: 'MarketPlus',
  stock: 0,
  unit: 'piece',
  emoji: '🛍️',
  isFeatured: false,
  isOffer: false,
  isActive: true,
};

const ALL_FIELDS = [
  'nameAr', 'nameEn', 'category', 'price', 'wholesalePrice', 'stock', 'oldPrice',
];

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
    }));
}

export default function ProductFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { language } = useLanguage();
  const isAr = language === 'ar';

  const [form, setForm] = useState(emptyForm);
  const [meta, setMeta] = useState({ updatedAt: null, stockUpdatedAt: null, stockHistory: [] });
  const [categories, setCategories] = useState([]);
  const [images, setImages] = useState([]);
  const [files, setFiles] = useState([]);
  const [removingImage, setRemovingImage] = useState(null);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [touched, setTouched] = useState({});

  useEffect(() => {
    adminApi.getCategories({ limit: 200 }).then(({ data }) => setCategories(data.data));
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    adminApi.getProduct(id)
      .then(({ data }) => {
        const p = data.data;
        setForm({
          nameAr: p.nameAr || p.name || '',
          nameEn: p.nameEn || '',
          slug: p.slug || '',
          descriptionAr: p.descriptionAr || p.description || '',
          descriptionEn: p.descriptionEn || '',
          price: p.price,
          wholesalePrice: p.wholesalePrice ?? '',
          oldPrice: p.oldPrice || '',
          category: p.categoryId || p.category || '',
          subCategory: p.subCategory || '',
          brand: p.brand || 'MarketPlus',
          stock: p.stock,
          unit: p.unit || 'piece',
          emoji: p.emoji || '🛍️',
          isFeatured: p.isFeatured || false,
          isOffer: p.isOffer || false,
          isActive: p.isActive !== false,
        });
        setImages(mapImagesFromProduct(p));
        setMeta({
          updatedAt: p.updatedAt,
          stockUpdatedAt: p.stockUpdatedAt,
          stockHistory: p.stockHistory || [],
        });
      })
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const touch = (field) => setTouched((t) => ({ ...t, [field]: true }));

  useEffect(() => {
    if (!Object.keys(touched).length) return;
    setFieldErrors(validateProductForm(form, isAr));
  }, [form, touched, isAr]);

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
    setForm(emptyForm);
    setImages([]);
    setFiles([]);
    setMeta({ updatedAt: null, stockUpdatedAt: null, stockHistory: [] });
    setFieldErrors({});
    setTouched({});
    setSubmitError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSave = async (addAnother = false) => {
    const errors = validateProductForm(form, isAr);
    setFieldErrors(errors);
    setTouched(Object.fromEntries(ALL_FIELDS.map((f) => [f, true])));
    if (hasValidationErrors(errors)) return;

    setSaving(true);
    setSubmitError('');
    try {
      const payload = {
        ...form,
        price: Number(form.price),
        wholesalePrice: form.wholesalePrice !== '' && form.wholesalePrice != null
          ? Number(form.wholesalePrice)
          : 0,
        oldPrice: form.oldPrice ? Number(form.oldPrice) : null,
        stock: Number(form.stock),
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
      setSubmitError(err.response?.data?.message || (isAr ? 'حدث خطأ' : 'Something went wrong'));
    } finally {
      setSaving(false);
    }
  };

  const parentCategories = categories.filter((c) => !c.parentCategory);
  const subCategories = categories.filter((c) => c.parentCategory);

  const selectErrorClass = (field) =>
    showError(field) ? 'border-red-400 focus:border-red-400' : '';

  const sellPrice = Number(form.price) || 0;
  const wholesale = Number(form.wholesalePrice) || 0;
  const unitProfit = sellPrice - wholesale;
  const marginPct = sellPrice > 0 ? Math.round((unitProfit / sellPrice) * 1000) / 10 : 0;

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
          <Input label={isAr ? 'العلامة التجارية' : 'Brand'} value={form.brand} onChange={(e) => set('brand', e.target.value)} />
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

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium">{isAr ? 'القسم' : 'Category'}</label>
            <select
              className={[
                'w-full rounded-xl border border-border px-4 py-2.5',
                selectErrorClass('category'),
              ].join(' ')}
              value={form.category}
              onChange={(e) => set('category', e.target.value)}
              onBlur={() => touch('category')}
              required
            >
              <option value="">{isAr ? 'اختر' : 'Select'}</option>
              {parentCategories.map((c) => (
                <option key={c._id} value={c._id}>{isAr ? c.nameAr : c.nameEn}</option>
              ))}
            </select>
            {showError('category') && (
              <p className="mt-1 text-sm text-red-600">{showError('category')}</p>
            )}
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">{isAr ? 'قسم فرعي' : 'Subcategory'}</label>
            <select
              className="w-full rounded-xl border border-border px-4 py-2.5"
              value={form.subCategory}
              onChange={(e) => set('subCategory', e.target.value)}
            >
              <option value="">{isAr ? 'بدون' : 'None'}</option>
              {subCategories.map((c) => (
                <option key={c._id} value={c._id}>{isAr ? c.nameAr : c.nameEn}</option>
              ))}
            </select>
          </div>
        </div>

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
            {isAr ? 'مميز' : 'Featured'}
          </label>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">{isAr ? 'صور المنتج' : 'Product images'}</label>
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
