import { Phone } from 'lucide-react';
import Input from '../../../components/ui/Input';
import SettingsFormShell from '../../components/SettingsFormShell';
import { useStoreSettingsForm } from '../../hooks/useStoreSettingsForm';

export default function StoreContactSettingsPage() {
  const { settings, loading, saving, save, update, updateNested, isAr } = useStoreSettingsForm();

  if (!settings) {
    return <SettingsFormShell isAr={isAr} loading={loading} saving={saving} onSubmit={save} />;
  }

  return (
    <SettingsFormShell isAr={isAr} loading={loading} saving={saving} onSubmit={save}>
      <section className="rounded-2xl border border-border bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
            <Phone className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h2 className="font-bold">{isAr ? 'التواصل والروابط' : 'Contact & links'}</h2>
            <p className="text-sm text-text-muted">
              {isAr ? 'بيانات الدعم ووسائل التواصل — تظهر في الموقع والتذييل' : 'Support details and social links — shown on site and footer'}
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Input label={isAr ? 'هاتف الدعم' : 'Support phone'} value={settings.supportPhone} onChange={(e) => update('supportPhone', e.target.value)} />
          <Input label={isAr ? 'بريد الدعم' : 'Support email'} type="email" value={settings.supportEmail} onChange={(e) => update('supportEmail', e.target.value)} />
          <Input label="WhatsApp URL" value={settings.whatsappUrl} onChange={(e) => update('whatsappUrl', e.target.value)} />
        </div>

        <details className="mt-6 rounded-xl border border-border bg-slate-50/40 p-4">
          <summary className="cursor-pointer text-sm font-semibold">
            {isAr ? 'تفاصيل إضافية — الموقع ووعد التوصيل' : 'Advanced — location and delivery promise'}
          </summary>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Input label={isAr ? 'الموقع الافتراضي (عربي)' : 'Default location AR'} value={settings.defaultLocationAr} onChange={(e) => update('defaultLocationAr', e.target.value)} />
            <Input label={isAr ? 'الموقع الافتراضي (EN)' : 'Default location EN'} value={settings.defaultLocationEn} onChange={(e) => update('defaultLocationEn', e.target.value)} />
            <Input label={isAr ? 'وعد التوصيل (عربي)' : 'Delivery promise AR'} value={settings.deliveryPromiseAr} onChange={(e) => update('deliveryPromiseAr', e.target.value)} />
            <Input label={isAr ? 'وعد التوصيل (EN)' : 'Delivery promise EN'} value={settings.deliveryPromiseEn} onChange={(e) => update('deliveryPromiseEn', e.target.value)} />
          </div>
        </details>

        <details className="mt-4 rounded-xl border border-border bg-slate-50/40 p-4">
          <summary className="cursor-pointer text-sm font-semibold">
            {isAr ? 'تفاصيل إضافية — وسائل التواصل والتطبيقات' : 'Advanced — social media and apps'}
          </summary>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Input label="Facebook" value={settings.socialLinks.facebook} onChange={(e) => updateNested('socialLinks', 'facebook', e.target.value)} />
            <Input label="Instagram" value={settings.socialLinks.instagram} onChange={(e) => updateNested('socialLinks', 'instagram', e.target.value)} />
            <Input label="X / Twitter" value={settings.socialLinks.x} onChange={(e) => updateNested('socialLinks', 'x', e.target.value)} />
            <Input label="YouTube" value={settings.socialLinks.youtube} onChange={(e) => updateNested('socialLinks', 'youtube', e.target.value)} />
            <Input label="App Store" value={settings.appLinks.appStore} onChange={(e) => updateNested('appLinks', 'appStore', e.target.value)} />
            <Input label="Google Play" value={settings.appLinks.googlePlay} onChange={(e) => updateNested('appLinks', 'googlePlay', e.target.value)} />
            <Input label="AppGallery" value={settings.appLinks.appGallery} onChange={(e) => updateNested('appLinks', 'appGallery', e.target.value)} />
            <label className="flex items-center gap-2 text-sm md:col-span-2">
              <input type="checkbox" checked={settings.isActive} onChange={(e) => update('isActive', e.target.checked)} />
              {isAr ? 'الإعدادات نشطة' : 'Settings active'}
            </label>
          </div>
        </details>
      </section>
    </SettingsFormShell>
  );
}
