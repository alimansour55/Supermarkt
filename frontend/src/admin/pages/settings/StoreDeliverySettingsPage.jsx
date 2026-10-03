import { Link } from '../../../app/router';
import { ChevronLeft, Truck, MapPin, Navigation, Radar, Users, Zap } from 'lucide-react';
import Input from '../../../components/ui/Input';
import OsmMapCanvas from '../../../components/maps/OsmMapCanvas';
import SettingToggleCard from '../../components/SettingToggleCard';
import SettingsFormShell from '../../components/SettingsFormShell';
import FreeDeliveryMethodsField from '../../components/FreeDeliveryMethodsField';
import FreeDeliveryBannerFields from '../../components/FreeDeliveryBannerFields';
import { useStoreSettingsForm } from '../../hooks/useStoreSettingsForm';
import { DEFAULT_LOCATION_GATE, DEFAULT_DRIVER_SETTINGS } from '../../utils/storeSettingsDefaults';

export default function StoreDeliverySettingsPage() {
  const {
    settings, loading, saving, save, update, updateNested, isAr,
  } = useStoreSettingsForm();
  const gate = settings?.locationGate || DEFAULT_LOCATION_GATE;
  const driver = settings?.driverSettings || DEFAULT_DRIVER_SETTINGS;
  const gateCenter = {
    lat: Number(gate.mapCenterLat) || DEFAULT_LOCATION_GATE.mapCenterLat,
    lng: Number(gate.mapCenterLng) || DEFAULT_LOCATION_GATE.mapCenterLng,
  };

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

          <SettingToggleCard
            accent="sky"
            checked={gate.enabled === true}
            onChange={(v) => updateNested('locationGate', 'enabled', v)}
            title={isAr ? 'نافذة اختيار الموقع عند فتح المتجر' : 'Startup location picker popup'}
            description={isAr
              ? 'عند التفعيل: تظهر نافذة تطلب من الزائر تحديد منطقته على خريطة (حلوان افتراضياً) عند أول زيارة، ولا تتكرر في صفحة الدفع بعد الاختيار.'
              : 'When on: first-time visitors see a popup to pick their area on a map (Helwan by default); checkout no longer asks for the area again.'}
          />
        </div>

        {gate.enabled === true && (
          <details className="mt-4 rounded-xl border border-sky-200 bg-sky-50/40 p-4" open>
            <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
              <Navigation className="h-4 w-4 text-sky-600" aria-hidden />
              {isAr ? 'إعدادات نافذة اختيار الموقع' : 'Location picker popup settings'}
            </summary>

            <label className="mt-4 flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={gate.mandatory !== false}
                onChange={(e) => updateNested('locationGate', 'mandatory', e.target.checked)}
              />
              <span>
                <span className="font-semibold text-text">
                  {isAr ? 'إلزامي — يحجب التصفح حتى يختار الزائر منطقته' : 'Mandatory — block browsing until an area is chosen'}
                </span>
                <span className="mt-1 block text-xs text-text-muted">
                  {isAr
                    ? 'عند الإيقاف يمكن للزائر إغلاق النافذة والمتابعة بالمنطقة الافتراضية.'
                    : 'When off, the visitor can dismiss the popup and continue with the default area.'}
                </span>
              </span>
            </label>

            <div className="mt-3 flex items-start gap-3 rounded-xl border border-primary-200 bg-primary-50/40 p-4 text-sm">
              <Radar className="mt-0.5 h-5 w-5 shrink-0 text-primary-700" aria-hidden />
              <span>
                <span className="font-semibold text-text">
                  {isAr ? 'منطقة التغطية أصبحت صفحة مستقلة' : 'Coverage area now has its own page'}
                </span>
                <span className="mt-1 block text-xs text-text-muted">
                  {isAr
                    ? 'تفعيل التغطية، ودائرة المظلة العامة (المركز ونصف القطر) انتقلا إلى صفحة مستقلة، منفصلة عن مناطق التوصيل.'
                    : 'Enforcing coverage, and the general umbrella circle (center + radius), moved to their own page — separate from delivery zones.'}
                </span>
                <Link
                  to="/admin/coverage-area"
                  className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-primary-700 hover:text-primary-800"
                >
                  {isAr ? 'فتح صفحة منطقة التغطية' : 'Open the Coverage area page'}
                  <ChevronLeft className="h-4 w-4 rtl:rotate-180" aria-hidden />
                </Link>
              </span>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Input
                label={isAr ? 'العنوان (عربي)' : 'Title (Arabic)'}
                value={gate.titleAr || ''}
                onChange={(e) => updateNested('locationGate', 'titleAr', e.target.value)}
              />
              <Input
                label={isAr ? 'العنوان (إنجليزي)' : 'Title (English)'}
                value={gate.titleEn || ''}
                onChange={(e) => updateNested('locationGate', 'titleEn', e.target.value)}
              />
              <Input
                label={isAr ? 'الوصف (عربي)' : 'Subtitle (Arabic)'}
                value={gate.subtitleAr || ''}
                onChange={(e) => updateNested('locationGate', 'subtitleAr', e.target.value)}
              />
              <Input
                label={isAr ? 'الوصف (إنجليزي)' : 'Subtitle (English)'}
                value={gate.subtitleEn || ''}
                onChange={(e) => updateNested('locationGate', 'subtitleEn', e.target.value)}
              />
              <Input
                label={isAr ? 'خط عرض مركز الخريطة' : 'Map center latitude'}
                type="number"
                step="0.0001"
                value={gate.mapCenterLat ?? ''}
                onChange={(e) => updateNested('locationGate', 'mapCenterLat', e.target.value)}
              />
              <Input
                label={isAr ? 'خط طول مركز الخريطة' : 'Map center longitude'}
                type="number"
                step="0.0001"
                value={gate.mapCenterLng ?? ''}
                onChange={(e) => updateNested('locationGate', 'mapCenterLng', e.target.value)}
              />
              <Input
                label={isAr ? 'تقريب الخريطة (3–18)' : 'Map zoom (3–18)'}
                type="number"
                min="3"
                max="18"
                value={gate.mapZoom ?? 12}
                onChange={(e) => updateNested('locationGate', 'mapZoom', e.target.value)}
              />
            </div>

            <p className="mt-4 mb-2 text-xs font-medium text-text-muted">
              {isAr ? 'اضغط على الخريطة لضبط المركز' : 'Click the map to set the center'}
            </p>
            <OsmMapCanvas
              center={gateCenter}
              zoom={Number(gate.mapZoom) || 12}
              position={gateCenter}
              heightClass="h-56"
              onClick={(lat, lng) => {
                updateNested('locationGate', 'mapCenterLat', Number(lat.toFixed(5)));
                updateNested('locationGate', 'mapCenterLng', Number(lng.toFixed(5)));
              }}
              onDragEnd={(lat, lng) => {
                updateNested('locationGate', 'mapCenterLat', Number(lat.toFixed(5)));
                updateNested('locationGate', 'mapCenterLng', Number(lng.toFixed(5)));
              }}
            />
          </details>
        )}

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

      <section className="rounded-2xl border border-sky-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
            <Users className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h2 className="font-bold">{isAr ? 'المناديب والتعيين التلقائي' : 'Drivers & automatic dispatch'}</h2>
            <p className="text-sm text-text-muted">
              {isAr
                ? 'تعيين المناديب تلقائياً وأدوات تطبيق المندوب'
                : 'Auto-assign drivers and control the driver app tools'}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <SettingToggleCard
            accent="sky"
            checked={driver.autoAssignEnabled === true}
            onChange={(v) => updateNested('driverSettings', 'autoAssignEnabled', v)}
            title={isAr ? 'التعيين التلقائي للمناديب' : 'Automatic driver assignment'}
            description={isAr
              ? 'عند التفعيل: يختار النظام مندوباً تلقائياً عند تحويل الطلب إلى «في الطريق» بدون مندوب. التعيين اليدوي يظل متاحاً.'
              : 'When on: the system picks a driver automatically the moment an order becomes "Out for delivery" with no driver. Manual assignment still works.'}
          />

          {driver.autoAssignEnabled === true && (
            <details className="rounded-xl border border-sky-200 bg-sky-50/40 p-4" open>
              <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
                <Zap className="h-4 w-4 text-sky-600" aria-hidden />
                {isAr ? 'قواعد التوزيع' : 'Distribution rules'}
              </summary>
              <div className="mt-4 max-w-xs">
                <Input
                  label={isAr ? 'الحد الأقصى للطلبات النشطة لكل مندوب (0 = بلا حد)' : 'Max active orders per driver (0 = no limit)'}
                  type="number"
                  min="0"
                  max="50"
                  value={driver.autoAssignMaxActive ?? 0}
                  onChange={(e) => updateNested('driverSettings', 'autoAssignMaxActive', e.target.value)}
                />
                <p className="mt-2 text-xs text-text-muted">
                  {isAr
                    ? 'يتخطى النظام أي مندوب وصل لهذا العدد من الطلبات الجارية، ويختار الأقل انشغالاً.'
                    : 'The system skips any driver already at this many in-progress orders and picks the least busy.'}
                </p>
              </div>
            </details>
          )}

          <SettingToggleCard
            accent="emerald"
            checked={driver.availabilityEnabled !== false}
            onChange={(v) => updateNested('driverSettings', 'availabilityEnabled', v)}
            title={isAr ? 'حالة المندوب (متصل / غير متصل)' : 'Driver online / offline status'}
            description={isAr
              ? 'عند التفعيل: يبدّل المندوب حالته من التطبيق، ولا يستلم الطلبات التلقائية إلا المناديب المتصلون.'
              : 'When on: drivers flip their own availability in the app, and only online drivers receive auto-assigned orders.'}
          />

          <SettingToggleCard
            accent="violet"
            checked={driver.pickingChecklistEnabled !== false}
            onChange={(v) => updateNested('driverSettings', 'pickingChecklistEnabled', v)}
            title={isAr ? 'قائمة تجهيز الطلب للمندوب' : 'Picking checklist for the driver'}
            description={isAr
              ? 'إظهار قائمة تحديد أصناف الطلب في شاشة التوصيل.'
              : 'Show the item-by-item picking checklist on the delivery screen.'}
          />

          <SettingToggleCard
            accent="amber"
            checked={driver.cashCalculatorEnabled !== false}
            onChange={(v) => updateNested('driverSettings', 'cashCalculatorEnabled', v)}
            title={isAr ? 'حاسبة الباقي للدفع عند الاستلام' : 'Cash-on-delivery change calculator'}
            description={isAr
              ? 'إظهار حاسبة المبلغ المستلم والباقي للعميل في شاشة التوصيل.'
              : 'Show the amount-received / change-due calculator on the delivery screen.'}
          />
        </div>
      </section>
    </SettingsFormShell>
  );
}
