import { useEffect, useMemo } from 'react';
import { Settings } from 'lucide-react';
import Input from '../../../components/ui/Input';
import Textarea from '../../../components/ui/Textarea';
import SettingsFormShell from '../../components/SettingsFormShell';
import { useStoreSettingsForm } from '../../hooks/useStoreSettingsForm';

function ImagePreview({ label, src }) {
  if (!src) return null;
  return (
    <div className="rounded-xl border border-border bg-slate-50 p-3">
      <p className="mb-2 text-xs font-medium text-text-muted">{label}</p>
      <img src={src} alt="" className="h-16 max-w-full object-contain" />
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
      <section className="rounded-2xl border border-border bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
            <Settings className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h2 className="font-bold">{isAr ? 'هوية المتجر' : 'Store identity'}</h2>
            <p className="text-sm text-text-muted">
              {isAr ? 'الاسم والشعار والعملة — الأساسيات التي يراها العميل' : 'Name, logo, and currency — what customers see first'}
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Input label={isAr ? 'اسم المتجر (عربي)' : 'Store name AR'} value={settings.storeNameAr} onChange={(e) => update('storeNameAr', e.target.value)} required />
          <Input label={isAr ? 'اسم المتجر (EN)' : 'Store name EN'} value={settings.storeNameEn} onChange={(e) => update('storeNameEn', e.target.value)} required />
          <Input label={isAr ? 'العملة' : 'Currency'} value={settings.currency} onChange={(e) => update('currency', e.target.value)} />
        </div>

        <details className="mt-6 rounded-xl border border-border bg-slate-50/40 p-4">
          <summary className="cursor-pointer text-sm font-semibold">
            {isAr ? 'تفاصيل إضافية — الشعار والشعار النصي' : 'Advanced — logo and tagline'}
          </summary>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Textarea label={isAr ? 'الشعار النصي (عربي)' : 'Tagline AR'} value={settings.taglineAr} onChange={(e) => update('taglineAr', e.target.value)} rows={2} />
            <Textarea label={isAr ? 'الشعار النصي (EN)' : 'Tagline EN'} value={settings.taglineEn} onChange={(e) => update('taglineEn', e.target.value)} rows={2} />
            <Input label={isAr ? 'رابط الشعار' : 'Logo URL'} value={settings.logoUrl} onChange={(e) => update('logoUrl', e.target.value)} />
            <Input label={isAr ? 'رابط الأيقونة' : 'Favicon URL'} value={settings.faviconUrl} onChange={(e) => update('faviconUrl', e.target.value)} />
            <div>
              <label className="mb-1.5 block text-sm font-medium">{isAr ? 'رفع شعار' : 'Upload logo'}</label>
              <input type="file" accept="image/*" onChange={(e) => setLogoFile(e.target.files?.[0] || null)} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">{isAr ? 'رفع أيقونة' : 'Upload favicon'}</label>
              <input type="file" accept="image/*" onChange={(e) => setFaviconFile(e.target.files?.[0] || null)} />
            </div>
            <ImagePreview label={isAr ? 'معاينة الشعار' : 'Logo preview'} src={logoPreview} />
            <ImagePreview label={isAr ? 'معاينة الأيقونة' : 'Favicon preview'} src={faviconPreview} />
          </div>
        </details>
      </section>
    </SettingsFormShell>
  );
}
