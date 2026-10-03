import { useEffect, useState } from 'react';
import { Eye, Upload, X } from 'lucide-react';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Textarea from '../../components/ui/Textarea';
import ToggleSwitch from './ToggleSwitch';
import { useToast } from './index';
import { brandProductHref, getBrandLabel } from '../../utils/shopBrandHelpers';

const EMPTY_FORM = {
  nameAr: '',
  nameEn: '',
  queryValue: '',
  logo: '',
  descriptionAr: '',
  descriptionEn: '',
  sortOrder: 0,
  isActive: true,
  isFeatured: false,
};

function FormBlock({ title, description, children }) {
  return (
    <div className="rounded-2xl border border-border bg-white p-4 sm:p-5">
      <div className="mb-4">
        <h3 className="text-sm font-bold text-text">{title}</h3>
        {description && <p className="mt-1 text-xs text-text-muted">{description}</p>}
      </div>
      {children}
    </div>
  );
}

function BrandPreviewCard({ form, logoPreview, isAr, productCount }) {
  const label = getBrandLabel({ nameAr: form.nameAr, nameEn: form.nameEn }, isAr) || (isAr ? 'اسم العلامة' : 'Brand name');
  const filterValue = form.queryValue || form.nameEn || '—';

  return (
    <div className="space-y-4 lg:sticky lg:top-4">
      <div className="rounded-2xl border border-border bg-slate-50 p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-bold text-text">
          <Eye className="h-4 w-4 text-primary-600" aria-hidden />
          {isAr ? 'معاينة مباشرة' : 'Live preview'}
        </div>

        <div className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-white p-5 text-center shadow-sm">
          {logoPreview || form.logo ? (
            <img src={logoPreview || form.logo} alt="" className="h-14 w-20 object-contain" />
          ) : (
            <span className="text-4xl leading-none">🏷️</span>
          )}
          <p className="line-clamp-2 text-sm font-bold text-text">{label}</p>
          <div className="flex flex-wrap justify-center gap-1">
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${form.isActive ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}`}>
              {form.isActive ? (isAr ? 'نشط' : 'Active') : (isAr ? 'مخفي' : 'Hidden')}
            </span>
            {form.isFeatured && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                {isAr ? 'مميز' : 'Featured'}
              </span>
            )}
          </div>
        </div>

        <div className="mt-3 space-y-1.5 rounded-xl border border-dashed border-border bg-white px-3 py-2 text-xs text-text-muted">
          <p className="flex justify-between gap-2">
            <span className="font-semibold text-text">{isAr ? 'فلتر المنتجات:' : 'Product filter:'}</span>
            <code dir="ltr" className="truncate">{filterValue}</code>
          </p>
          {typeof productCount === 'number' && (
            <p className="flex justify-between gap-2">
              <span className="font-semibold text-text">{isAr ? 'منتجات مرتبطة:' : 'Linked products:'}</span>
              <a
                href={brandProductHref(filterValue)}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-primary-600 hover:underline"
              >
                {productCount}
              </a>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function BrandFormModal({ open, isAr, brand, onClose, onSaved, createBrand, updateBrand }) {
  const toast = useToast();
  const isEditing = Boolean(brand?._id);

  const [form, setForm] = useState(EMPTY_FORM);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [clearLogo, setClearLogo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    if (brand) {
      setForm({
        nameAr: brand.nameAr || '',
        nameEn: brand.nameEn || '',
        queryValue: brand.queryValue || '',
        logo: brand.logo || '',
        descriptionAr: brand.descriptionAr || '',
        descriptionEn: brand.descriptionEn || '',
        sortOrder: brand.sortOrder ?? 0,
        isActive: brand.isActive !== false,
        isFeatured: !!brand.isFeatured,
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setLogoFile(null);
    setLogoPreview(brand?.logo || '');
    setClearLogo(false);
    setError('');
  }, [open, brand]);

  useEffect(() => {
    if (!open) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape' && !saving) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose, saving]);

  const patch = (updates) => setForm((prev) => ({ ...prev, ...updates }));

  const handleLogoFile = (file) => {
    if (!file) return;
    setLogoFile(file);
    setClearLogo(false);
    setLogoPreview(URL.createObjectURL(file));
  };

  const handleLogoUrl = (value) => {
    patch({ logo: value });
    setLogoPreview(value);
    setLogoFile(null);
    setClearLogo(false);
  };

  const handleRemoveLogo = () => {
    setClearLogo(true);
    setLogoFile(null);
    setLogoPreview('');
    patch({ logo: '' });
  };

  const buildPayload = () => {
    const base = { ...form, sortOrder: Number(form.sortOrder) || 0 };
    if (logoFile || clearLogo) {
      const fd = new FormData();
      Object.entries(base).forEach(([key, value]) => {
        if (value !== undefined && value !== null) fd.append(key, String(value));
      });
      if (logoFile) fd.append('logo', logoFile);
      if (clearLogo) fd.append('clearLogo', 'true');
      return fd;
    }
    return base;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.nameAr.trim() || !form.nameEn.trim()) {
      setError(isAr ? 'الاسم بالعربي والإنجليزي مطلوبان' : 'Arabic and English names are required');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const payload = buildPayload();
      if (isEditing) await updateBrand(brand._id, payload);
      else await createBrand(payload);
      toast.success(isAr ? 'تم حفظ العلامة' : 'Brand saved');
      onSaved();
    } catch (err) {
      const message = err.response?.data?.message || err.message || (isAr ? 'تعذر الحفظ' : 'Could not save');
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-900/55 p-0 sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0"
        aria-label={isAr ? 'إغلاق' : 'Close'}
        onClick={saving ? undefined : onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="brand-editor-title"
        className="relative flex max-h-[96vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-3xl border border-border bg-slate-50 shadow-2xl sm:rounded-3xl"
      >
        <div className="flex shrink-0 items-start justify-between border-b border-border bg-white px-5 py-4 sm:px-6">
          <div>
            <h2 id="brand-editor-title" className="text-lg font-bold text-text sm:text-xl">
              {isEditing ? (isAr ? 'تعديل العلامة التجارية' : 'Edit brand') : (isAr ? 'علامة تجارية جديدة' : 'New brand')}
            </h2>
            <p className="mt-1 text-sm text-text-muted">
              {isAr
                ? 'الاسم، الشعار، وربطها بمنتجاتها — كل شيء في مكان واحد'
                : 'Name, logo, and its product link — all in one place'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl p-2 text-text-muted hover:bg-slate-100 disabled:opacity-50"
            aria-label={isAr ? 'إغلاق' : 'Close'}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto px-5 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="space-y-5">
              {error && (
                <div className="rounded-xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
                  {error}
                </div>
              )}

              <FormBlock title={isAr ? 'الاسم' : 'Name'}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input label={isAr ? 'الاسم (عربي)' : 'Name (AR)'} value={form.nameAr} onChange={(e) => patch({ nameAr: e.target.value })} required />
                  <Input label={isAr ? 'الاسم (EN)' : 'Name (EN)'} value={form.nameEn} onChange={(e) => patch({ nameEn: e.target.value })} required dir="ltr" />
                </div>
              </FormBlock>

              <FormBlock
                title={isAr ? 'شعار العلامة' : 'Brand logo'}
                description={isAr ? 'ارفع صورة أو الصق رابطاً (اختياري).' : 'Upload or paste an image URL (optional).'}
              >
                <div className="rounded-xl border border-border bg-slate-50/80 p-3">
                  <div className="flex gap-2">
                    <input
                      className="min-w-0 flex-1 rounded-xl border border-border bg-white px-3 py-2 text-sm"
                      dir="ltr"
                      placeholder="https://..."
                      value={form.logo || ''}
                      onChange={(e) => handleLogoUrl(e.target.value)}
                    />
                    <label className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-xl border border-primary-200 bg-primary-50 px-3 py-2 text-xs font-semibold text-primary-700 hover:bg-primary-100">
                      <Upload className="h-3.5 w-3.5" />
                      {isAr ? 'رفع' : 'Upload'}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleLogoFile(e.target.files?.[0] || null)}
                      />
                    </label>
                  </div>
                  {(logoPreview || form.logo) && !clearLogo && (
                    <div className="mt-3 flex items-center gap-3">
                      <img src={logoPreview || form.logo} alt="" className="h-16 w-16 rounded-xl border border-border bg-white object-contain p-1" />
                      <Button type="button" variant="secondary" size="sm" onClick={handleRemoveLogo}>
                        {isAr ? 'إزالة الشعار' : 'Remove logo'}
                      </Button>
                    </div>
                  )}
                </div>
              </FormBlock>

              <FormBlock
                title={isAr ? 'فلتر المنتجات' : 'Product filter'}
                description={isAr ? 'القيمة التي تُطابق حقل brand في المنتجات لعرضها هنا.' : 'The value matched against a product’s brand field.'}
              >
                <Input
                  value={form.queryValue}
                  onChange={(e) => patch({ queryValue: e.target.value })}
                  placeholder={form.nameEn || 'Juhayna'}
                  dir="ltr"
                />
                <div className="mt-3 rounded-xl bg-violet-50 px-4 py-3 text-xs text-violet-950">
                  {isAr
                    ? 'يجب أن تطابق هذه القيمة حقل brand في المنتجات تماماً (غير حساسة لحالة الأحرف) — مثل Juhayna أو Pampers. اتركها فارغة لاستخدام الاسم الإنجليزي تلقائياً.'
                    : 'Must match a product’s brand field exactly (case-insensitive) — e.g. Juhayna or Pampers. Leave blank to default to the English name.'}
                </div>
              </FormBlock>

              <FormBlock title={isAr ? 'تفاصيل إضافية' : 'Additional details'}>
                <Input label={isAr ? 'الترتيب' : 'Sort order'} type="number" value={form.sortOrder} onChange={(e) => patch({ sortOrder: e.target.value })} className="sm:max-w-[220px]" />
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Textarea label={isAr ? 'وصف (عربي)' : 'Description (AR)'} value={form.descriptionAr} onChange={(e) => patch({ descriptionAr: e.target.value })} rows={2} />
                  <Textarea label={isAr ? 'وصف (EN)' : 'Description (EN)'} value={form.descriptionEn} onChange={(e) => patch({ descriptionEn: e.target.value })} rows={2} />
                </div>
              </FormBlock>

              <FormBlock title={isAr ? 'الظهور' : 'Visibility'}>
                <div className="space-y-3">
                  <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-border bg-white px-4 py-3">
                    <span>
                      <span className="block text-sm font-semibold text-text">{isAr ? 'نشطة على الموقع' : 'Active on storefront'}</span>
                      <span className="block text-xs text-text-muted">{isAr ? 'إخفاؤها يمنع ظهورها لكن يُبقيها في لوحة التحكم' : 'Hiding keeps it in admin but off the storefront'}</span>
                    </span>
                    <ToggleSwitch checked={form.isActive} onChange={(checked) => patch({ isActive: checked })} ariaLabel={isAr ? 'نشطة على الموقع' : 'Active on storefront'} />
                  </label>
                  <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-border bg-white px-4 py-3">
                    <span>
                      <span className="block text-sm font-semibold text-text">{isAr ? 'مميزة' : 'Featured'}</span>
                      <span className="block text-xs text-text-muted">{isAr ? 'تُفضّل في صف العلامات على الرئيسية' : 'Preferred in the homepage brand row'}</span>
                    </span>
                    <ToggleSwitch checked={form.isFeatured} onChange={(checked) => patch({ isFeatured: checked })} ariaLabel={isAr ? 'مميزة' : 'Featured'} />
                  </label>
                </div>
              </FormBlock>
            </div>

            <BrandPreviewCard form={form} logoPreview={logoPreview} isAr={isAr} productCount={isEditing ? brand.productCount : null} />
          </div>

          <div className="flex shrink-0 flex-wrap justify-end gap-3 border-t border-border bg-white px-5 py-4 sm:px-6">
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
              {isAr ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button type="submit" loading={saving}>
              {saving ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'حفظ العلامة' : 'Save brand')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
