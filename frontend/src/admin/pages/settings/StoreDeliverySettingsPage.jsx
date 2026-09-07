import { Truck, MapPin } from 'lucide-react';
import Input from '../../../components/ui/Input';
import SettingToggleCard from '../../components/SettingToggleCard';
import SettingsFormShell from '../../components/SettingsFormShell';
import FreeDeliveryMethodsField from '../../components/FreeDeliveryMethodsField';
import FreeDeliveryBannerFields from '../../components/FreeDeliveryBannerFields';
import { useStoreSettingsForm } from '../../hooks/useStoreSettingsForm';

export default function StoreDeliverySettingsPage() {
  const { settings, loading, saving, save, update, isAr } = useStoreSettingsForm();

  if (!settings) {
    return <SettingsFormShell isAr={isAr} loading={loading} saving={saving} onSubmit={save} />;
  }

  return (
    <SettingsFormShell isAr={isAr} loading={loading} saving={saving} onSubmit={save}>
      <section className="rounded-2xl border border-emerald-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
            <Truck className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h2 className="font-bold">{isAr ? 'التوصيل' : 'Delivery'}</h2>
            <p className="text-sm text-text-muted">
              {isAr ? 'خيارات عامة للتوصيل — التفاصيل في الأقسام المطوية' : 'General delivery options — details in collapsed sections'}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <SettingToggleCard
            accent="emerald"
            checked={settings.freeDeliveryEnabled !== false}
            onChange={(v) => update('freeDeliveryEnabled', v)}
            title={isAr ? 'التوصيل المجاني' : 'Free delivery'}
            description={isAr
              ? 'عند التفعيل: يُطبَّق التوصيل المجاني على كل المناطق حسب الحد المحدّد.'
              : 'When on: free delivery applies to all zones based on the threshold you set.'}
          />

          <SettingToggleCard
            accent="violet"
            checked={settings.gpsDeliveryEnabled !== false}
            onChange={(v) => update('gpsDeliveryEnabled', v)}
            title={isAr ? 'التوصيل بالخريطة والتتبع المباشر' : 'Map pin & live GPS tracking'}
            description={isAr
              ? 'عند الإيقاف: لا خريطة في الدفع أو العناوين، ولا تتبع مباشر للعميل، ولا مشاركة موقع من المندوب.'
              : 'When off: no map at checkout or saved addresses, no live customer tracking, and drivers cannot share GPS.'}
          />
        </div>

        <details className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50/30 p-4">
          <summary className="cursor-pointer text-sm font-semibold">
            {isAr ? 'تفاصيل التوصيل المجاني' : 'Free delivery details'}
          </summary>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Input
              label={isAr ? 'حد التوصيل المجاني' : 'Free delivery threshold'}
              type="number"
              min="0"
              disabled={settings.freeDeliveryEnabled === false}
              value={settings.freeDeliveryThreshold}
              onChange={(e) => update('freeDeliveryThreshold', e.target.value)}
            />
            <FreeDeliveryMethodsField
              isAr={isAr}
              disabled={settings.freeDeliveryEnabled === false}
              value={settings.freeDeliveryMethods}
              onChange={(methods) => update('freeDeliveryMethods', methods)}
            />
            <div className="md:col-span-2">
              <FreeDeliveryBannerFields
                isAr={isAr}
                value={settings.freeDeliveryBanner}
                onChange={(banner) => update('freeDeliveryBanner', banner)}
              />
            </div>
          </div>
        </details>

        <details className="mt-4 rounded-xl border border-violet-200 bg-violet-50/30 p-4">
          <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
            <MapPin className="h-4 w-4 text-violet-600" aria-hidden />
            {isAr ? 'تفاصيل مهلة التوصيل' : 'Delivery lead time details'}
          </summary>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Input
              label={isAr ? 'التوصيل العادي / الدوري (دقائق)' : 'Standard / recurring (minutes)'}
              type="number"
              min="0"
              max="1440"
              value={settings.scheduledMinLeadMinutes}
              onChange={(e) => update('scheduledMinLeadMinutes', e.target.value)}
            />
            <Input
              label={isAr ? 'التوصيل السريع (دقائق)' : 'Express delivery (minutes)'}
              type="number"
              min="0"
              max="1440"
              value={settings.expressMinLeadMinutes}
              onChange={(e) => update('expressMinLeadMinutes', e.target.value)}
            />
          </div>
        </details>
      </section>
    </SettingsFormShell>
  );
}
