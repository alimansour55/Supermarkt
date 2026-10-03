import { useEffect, useMemo, useRef, useState } from 'react';
import { Globe2, Image as ImageIcon, MessageSquareQuote, Store, X } from 'lucide-react';
import Input from '../../../components/ui/Input';
import Textarea from '../../../components/ui/Textarea';
import ProductImage from '../../../components/ui/ProductImage';
import SettingsFormShell from '../../components/SettingsFormShell';
import { useStoreSettingsForm } from '../../hooks/useStoreSettingsForm';

function SettingsSection({ icon: Icon, color, title, subtitle, children }) {
  return (
    <section className="rounded-2xl border border-border bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-center gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${color}`}>
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <h2 className="font-bold">{title}</h2>
          {subtitle && <p className="text-sm text-text-muted">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function BrandImageField({
  label, helpText, previewSrc, isNew, onPick, onClear, urlValue, onUrlChange, isAr,
}) {
  const [showUrlInput, setShowUrlInput] = useState(Boolean(urlValue));
  const [broken, setBroken] = useState(false);
  const [lastPreviewSrc, setLastPreviewSrc] = useState(previewSrc);
  const inputRef = useRef(null);

  if (previewSrc !== lastPreviewSrc) {
    setLastPreviewSrc(previewSrc);
    setBroken(false);
  }

  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-text">{label}</p>
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="relative flex h-24 w-24 shrink-0 flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-border bg-slate-50 text-text-muted transition-colors hover:border-primary-400 hover:bg-primary-50 hover:text-primary-600"
        >
          {previewSrc ? (
            <ProductImage
              key={previewSrc}
              src={previewSrc}
              alt={label}
              className="h-full w-full"
              imgClassName="h-full w-full object-contain p-2.5"
              onError={() => setBroken(true)}
            />
          ) : (
            <>
              <ImageIcon className="h-5 w-5" aria-hidden />
              <span className="mt-1 text-[10px] font-medium">{isAr ? 'رفع' : 'Upload'}</span>
            </>
          )}
          {isNew && (
            <span className="absolute inset-x-0 bottom-0 bg-primary-600/90 py-0.5 text-center text-[9px] font-medium text-white">
              {isAr ? 'جديد' : 'New'}
            </span>
          )}
        </button>

        <div className="min-w-0 flex-1 space-y-1.5 pt-0.5">
          <p className="text-xs text-text-muted">{helpText}</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold">
            {previewSrc && (
              <button
                type="button"
                onClick={onClear}
                className="inline-flex items-center gap-1 text-red-600 hover:text-red-700"
              >
                <X className="h-3 w-3" aria-hidden />
                {isAr ? 'إزالة' : 'Remove'}
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowUrlInput((v) => !v)}
              className="text-primary-700 hover:text-primary-800"
            >
              {showUrlInput
                ? (isAr ? 'إخفاء رابط الصورة' : 'Hide image link')
                : (isAr ? 'أو الصق رابط صورة' : 'Or paste an image link')}
            </button>
          </div>
          {showUrlInput && (
            <Input
              value={urlValue}
              onChange={onUrlChange}
              placeholder="https://example.com/logo.png"
              inputClassName="py-2 text-xs"
              dir="ltr"
            />
          )}
          {broken && (
            <p className="text-xs font-medium text-danger-600">
              {isAr
                ? 'تعذر تحميل هذه الصورة — تأكد أنها رابط صورة مباشر (وليس رابط صفحة بحث)'
                : "Couldn't load this image — make sure it's a direct image link, not a search results page"}
            </p>
          )}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => onPick(e.target.files?.[0] || null)}
      />
    </div>
  );
}

export default function StoreIdentitySettingsPage() {
  const {
    settings,
    loading,
    saving,
    save,
    update,
    updateNested,
    logoFile,
    setLogoFile,
    faviconFile,
    setFaviconFile,
    isAr,
  } = useStoreSettingsForm();

  const logoPreview = useMemo(
    () => (logoFile ? URL.createObjectURL(logoFile) : settings?.logoUrl),
    [logoFile, settings?.logoUrl],
  );

  const faviconPreview = useMemo(
    () => (faviconFile ? URL.createObjectURL(faviconFile) : settings?.faviconUrl),
    [faviconFile, settings?.faviconUrl],
  );

  useEffect(() => () => {
    if (logoFile && logoPreview?.startsWith('blob:')) URL.revokeObjectURL(logoPreview);
    if (faviconFile && faviconPreview?.startsWith('blob:')) URL.revokeObjectURL(faviconPreview);
  }, [faviconFile, faviconPreview, logoFile, logoPreview]);

  if (!settings) {
    return <SettingsFormShell isAr={isAr} loading={loading} saving={saving} onSubmit={save} />;
  }

  return (
    <SettingsFormShell isAr={isAr} loading={loading} saving={saving} onSubmit={save}>
      <SettingsSection
        icon={Store}
        color="bg-primary-50 text-primary-700"
        title={isAr ? 'الأساسيات' : 'Basics'}
        subtitle={isAr ? 'اسم المتجر والعملة كما تظهر للعميل' : 'Store name and currency, as shown to customers'}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Input label={isAr ? 'اسم المتجر (عربي)' : 'Store name AR'} value={settings.storeNameAr} onChange={(e) => update('storeNameAr', e.target.value)} required />
          <Input label={isAr ? 'اسم المتجر (EN)' : 'Store name EN'} value={settings.storeNameEn} onChange={(e) => update('storeNameEn', e.target.value)} required />
          <Input label={isAr ? 'العملة' : 'Currency'} value={settings.currency} onChange={(e) => update('currency', e.target.value)} className="md:col-span-1" />
        </div>
      </SettingsSection>

      <SettingsSection
        icon={Globe2}
        color="bg-teal-50 text-teal-700"
        title={isAr ? 'SEO عام للموقع' : 'Site-wide SEO'}
        subtitle={isAr ? 'العناوين والوصف الافتراضي والتتبع (العنوان يظهر في تبويب المتصفح، ويستخدم اسم المتجر تلقائيًا إذا تُرك فارغًا)' : 'Default meta tags and tracking IDs (the title shows in the browser tab, and falls back to the store name if left blank)'}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Input
            label={isAr ? 'العنوان الافتراضي (عربي)' : 'Default title AR'}
            value={settings.seo.defaultTitleAr}
            onChange={(e) => updateNested('seo', 'defaultTitleAr', e.target.value)}
            placeholder={isAr ? 'اتركه فارغًا لاستخدام اسم المتجر' : 'Leave blank to use the store name'}
          />
          <Input
            label={isAr ? 'العنوان الافتراضي (EN)' : 'Default title EN'}
            value={settings.seo.defaultTitleEn}
            onChange={(e) => updateNested('seo', 'defaultTitleEn', e.target.value)}
            placeholder={isAr ? 'اتركه فارغًا لاستخدام اسم المتجر' : 'Leave blank to use the store name'}
          />
          <Textarea label={isAr ? 'الوصف (عربي)' : 'Description AR'} rows={3} value={settings.seo.defaultDescriptionAr} onChange={(e) => updateNested('seo', 'defaultDescriptionAr', e.target.value)} />
          <Textarea label={isAr ? 'الوصف (EN)' : 'Description EN'} rows={3} value={settings.seo.defaultDescriptionEn} onChange={(e) => updateNested('seo', 'defaultDescriptionEn', e.target.value)} />
          <Input label={isAr ? 'صورة OG' : 'OG image URL'} value={settings.seo.ogImageUrl} onChange={(e) => updateNested('seo', 'ogImageUrl', e.target.value)} />
          <Input label="Google Analytics ID" value={settings.seo.googleAnalyticsId} onChange={(e) => updateNested('seo', 'googleAnalyticsId', e.target.value)} />
          <Input label="Facebook Pixel ID" value={settings.seo.facebookPixelId} onChange={(e) => updateNested('seo', 'facebookPixelId', e.target.value)} />
          <label className="flex items-center gap-2 text-sm md:col-span-2">
            <input type="checkbox" checked={settings.seo.robotsIndex} onChange={(e) => updateNested('seo', 'robotsIndex', e.target.checked)} />
            {isAr ? 'السماح للفهرسة (robots index)' : 'Allow search indexing (robots index)'}
          </label>
        </div>
      </SettingsSection>

      <SettingsSection
        icon={ImageIcon}
        color="bg-violet-50 text-violet-700"
        title={isAr ? 'الشعار والأيقونة' : 'Logo & favicon'}
        subtitle={isAr ? 'يظهر الشعار في أعلى المتجر، والأيقونة في تبويب المتصفح' : 'The logo shows in the storefront header, the favicon in the browser tab'}
      >
        <div className="grid gap-6 md:grid-cols-2">
          <BrandImageField
            label={isAr ? 'شعار المتجر' : 'Store logo'}
            helpText={isAr ? 'مربع أو مستطيل بخلفية شفافة يظهر بوضوح (PNG أو SVG)' : 'A square or wide image with a transparent background works best (PNG or SVG)'}
            previewSrc={logoPreview}
            isNew={Boolean(logoFile)}
            onPick={(file) => setLogoFile(file)}
            onClear={() => { setLogoFile(null); update('logoUrl', ''); }}
            urlValue={settings.logoUrl}
            onUrlChange={(e) => update('logoUrl', e.target.value)}
            isAr={isAr}
          />
          <BrandImageField
            label={isAr ? 'أيقونة المتجر (Favicon)' : 'Favicon'}
            helpText={isAr ? 'صورة مربعة صغيرة (32×32 أو أكبر) تظهر في تبويب المتصفح' : 'A small square image (32×32 or larger) shown in the browser tab'}
            previewSrc={faviconPreview}
            isNew={Boolean(faviconFile)}
            onPick={(file) => setFaviconFile(file)}
            onClear={() => { setFaviconFile(null); update('faviconUrl', ''); }}
            urlValue={settings.faviconUrl}
            onUrlChange={(e) => update('faviconUrl', e.target.value)}
            isAr={isAr}
          />
        </div>
      </SettingsSection>

      <SettingsSection
        icon={MessageSquareQuote}
        color="bg-amber-50 text-amber-700"
        title={isAr ? 'الشعار النصي' : 'Tagline'}
        subtitle={isAr ? 'جملة قصيرة تظهر بجانب اسم المتجر أو في الفوتر (اختياري)' : 'A short line shown near the store name or in the footer (optional)'}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Textarea label={isAr ? 'الشعار النصي (عربي)' : 'Tagline AR'} value={settings.taglineAr} onChange={(e) => update('taglineAr', e.target.value)} rows={2} />
          <Textarea label={isAr ? 'الشعار النصي (EN)' : 'Tagline EN'} value={settings.taglineEn} onChange={(e) => update('taglineEn', e.target.value)} rows={2} />
        </div>
      </SettingsSection>
    </SettingsFormShell>
  );
}
