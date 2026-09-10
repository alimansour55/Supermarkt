import { useEffect, useMemo, useState } from 'react';
import { MapPin, Plus, Save, Trash2 } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { adminApi } from '../adminApi';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Textarea from '../../components/ui/Textarea';
import Loader from '../../components/ui/Loader';
import { EmptyState, PageHeader, useConfirm, useToast } from '../components';
import FreeDeliveryMethodsField from '../components/FreeDeliveryMethodsField';
import { parseFreeDeliveryMethodsFromApi } from '../../utils/freeDelivery';

const defaultSlots = [
  { labelAr: 'صباحا (9-12)', labelEn: 'Morning (9-12)', from: '09:00', to: '12:00', isActive: true },
  { labelAr: 'مساء (2-6)', labelEn: 'Afternoon (2-6)', from: '14:00', to: '18:00', isActive: true },
  { labelAr: 'ليلا (6-9)', labelEn: 'Evening (6-9)', from: '18:00', to: '21:00', isActive: true },
];

const emptyForm = {
  cityAr: '',
  cityEn: '',
  areaAr: '',
  areaEn: '',
  scheduledFee: 29.99,
  expressFee: 49.99,
  minimumOrder: 0,
  freeDeliveryThreshold: 500,
  freeDeliveryOverride: false,
  freeDeliveryMethods: ['scheduled', 'recurring'],
  scheduledAvailable: true,
  expressAvailable: true,
  estimatedScheduled: '4-6 hours',
  estimatedExpress: 'within 2 hours',
  priority: 0,
  centerLat: '',
  centerLng: '',
  radiusKm: 8,
  isActive: true,
  leadTimeOverride: false,
  scheduledMinLeadMinutes: 120,
  expressMinLeadMinutes: 120,
  timeSlotsText: JSON.stringify(defaultSlots, null, 2),
};

const toForm = (zone = {}) => ({
  ...emptyForm,
  ...zone,
  freeDeliveryMethods: parseFreeDeliveryMethodsFromApi(zone.freeDeliveryMethods),
  freeDeliveryOverride: zone.freeDeliveryOverride === true,
  centerLat: zone.centerLat ?? '',
  centerLng: zone.centerLng ?? '',
  radiusKm: zone.radiusKm ?? 8,
  timeSlotsText: JSON.stringify(zone.timeSlots?.length ? zone.timeSlots : defaultSlots, null, 2),
});

export default function DeliveryZonesPage() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const toast = useToast();
  const confirm = useConfirm();
  const [zones, setZones] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [storeSettings, setStoreSettings] = useState({
    freeDeliveryEnabled: true,
    freeDeliveryMethods: ['scheduled', 'recurring'],
    scheduledMinLeadMinutes: 120,
    expressMinLeadMinutes: 120,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const globalFreeDeliveryEnabled = storeSettings?.freeDeliveryEnabled !== false;
  const zoneMethodsEditable = form.freeDeliveryOverride === true;
  const zoneMethodsDisabled = !zoneMethodsEditable;

  const zoneLeadEditable = form.leadTimeOverride === true;
  const zoneLeadDisabled = !zoneLeadEditable;

  const zoneLeadHint = useMemo(() => {
    if (zoneLeadEditable) {
      return isAr
        ? 'إعدادات هذه المنطقة لها الأولوية على الإعداد العام.'
        : 'This zone\'s lead times override the global configuration.';
    }
    return isAr
      ? `معطّل — يُستخدم الإعداد العام (${storeSettings.scheduledMinLeadMinutes} / ${storeSettings.expressMinLeadMinutes} دقيقة).`
      : `Disabled — using global settings (${storeSettings.scheduledMinLeadMinutes} / ${storeSettings.expressMinLeadMinutes} min).`;
  }, [isAr, storeSettings.expressMinLeadMinutes, storeSettings.scheduledMinLeadMinutes, zoneLeadEditable]);

  const zoneMethodsHint = useMemo(() => {
    if (zoneMethodsEditable) {
      return isAr
        ? 'إعدادات هذه المنطقة لها الأولوية على الإعداد العام.'
        : 'This zone\'s settings override the global configuration.';
    }
    if (globalFreeDeliveryEnabled) {
      return isAr
        ? 'معطّل — يُستخدم الإعداد العام من إعدادات المتجر.'
        : 'Disabled — using global settings from Store Settings.';
    }
    return isAr
      ? 'فعّل الإعداد العام أو تخصيص هذه المنطقة لتفعيل التوصيل المجاني.'
      : 'Enable global free delivery or turn on zone override below.';
  }, [globalFreeDeliveryEnabled, isAr, zoneMethodsEditable]);

  const selectedZone = useMemo(
    () => zones.find((zone) => zone.id === selectedId || zone._id === selectedId),
    [selectedId, zones],
  );

  const load = () => {
    setLoading(true);
    Promise.all([
      adminApi.getDeliveryZones(),
      adminApi.getStoreSettings(),
    ])
      .then(([zonesRes, settingsRes]) => {
        setZones(zonesRes.data.data || []);
        const s = settingsRes.data.data || {};
        setStoreSettings({
          freeDeliveryEnabled: s.freeDeliveryEnabled !== false,
          freeDeliveryMethods: parseFreeDeliveryMethodsFromApi(s.freeDeliveryMethods),
          scheduledMinLeadMinutes: Number(s.scheduledMinLeadMinutes) || 120,
          expressMinLeadMinutes: Number(s.expressMinLeadMinutes) || 120,
        });
      })
      .catch(() => toast.error(isAr ? 'تعذر تحميل مناطق التوصيل' : 'Could not load delivery zones'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    setForm(selectedZone ? toForm(selectedZone) : emptyForm);
  }, [selectedZone]);

  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const payload = () => {
    let timeSlots;
    try {
      timeSlots = JSON.parse(form.timeSlotsText || '[]');
    } catch {
      throw new Error(isAr ? 'صيغة مواعيد التوصيل غير صحيحة' : 'Invalid time slots JSON');
    }
    const rest = { ...form };
    delete rest.timeSlotsText;
    delete rest.slug;
    return {
      ...rest,
      scheduledFee: Number(form.scheduledFee) || 0,
      expressFee: Number(form.expressFee) || 0,
      minimumOrder: Number(form.minimumOrder) || 0,
      freeDeliveryThreshold: Number(form.freeDeliveryThreshold) || 0,
      freeDeliveryOverride: form.freeDeliveryOverride === true,
      freeDeliveryMethods: parseFreeDeliveryMethodsFromApi(form.freeDeliveryMethods),
      priority: Number(form.priority) || 0,
      centerLat: form.centerLat === '' || form.centerLat == null ? null : Number(form.centerLat),
      centerLng: form.centerLng === '' || form.centerLng == null ? null : Number(form.centerLng),
      radiusKm: Math.max(0, Number(form.radiusKm) || 8),
      timeSlots,
    };
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = payload();
      let saved;
      if (selectedZone) {
        const { data } = await adminApi.updateDeliveryZone(selectedZone._id || selectedZone.id, body);
        saved = data.data;
      } else {
        const { data } = await adminApi.createDeliveryZone(body);
        saved = data.data;
      }
      toast.success(isAr ? 'تم حفظ منطقة التوصيل' : 'Delivery zone saved');
      const savedId = saved?.id || saved?._id;
      setZones((prev) => {
        const exists = prev.some((z) => (z.id || z._id) === savedId);
        if (exists) {
          return prev.map((z) => ((z.id || z._id) === savedId ? saved : z));
        }
        return [saved, ...prev];
      });
      setSelectedId(savedId);
      setForm(toForm(saved));
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || (isAr ? 'تعذر الحفظ' : 'Could not save'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (zone) => {
    const ok = await confirm({
      title: isAr ? 'حذف منطقة التوصيل؟' : 'Delete delivery zone?',
      message: isAr ? 'سيتم حذف المنطقة من خيارات العملاء.' : 'Customers will no longer see this area.',
      confirmLabel: isAr ? 'حذف' : 'Delete',
      variant: 'danger',
    });
    if (!ok) return;
    await adminApi.deleteDeliveryZone(zone._id || zone.id);
    toast.success(isAr ? 'تم الحذف' : 'Deleted');
    if (selectedId === zone.id || selectedId === zone._id) setSelectedId(null);
    load();
  };

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-border bg-white">
        <Loader size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        action={(
          <Button type="button" onClick={() => setSelectedId(null)}>
            <Plus className="h-4 w-4" />
            {isAr ? 'منطقة جديدة' : 'New zone'}
          </Button>
        )}
      />

      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <section className="rounded-2xl border border-border bg-white p-4 shadow-sm">
          <h2 className="mb-3 font-bold">{isAr ? 'المناطق' : 'Zones'}</h2>
          {zones.length === 0 ? (
            <EmptyState title={isAr ? 'لا توجد مناطق بعد' : 'No zones yet'} />
          ) : (
            <div className="space-y-2">
              {zones.map((zone) => (
                <button
                  key={zone.id}
                  type="button"
                  onClick={() => setSelectedId(zone.id)}
                  className={`w-full rounded-xl border px-3 py-3 text-start text-sm ${
                    selectedId === zone.id ? 'border-primary-500 bg-primary-50' : 'border-border hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{isAr ? zone.nameAr : zone.nameEn}</span>
                    <span className={zone.isActive ? 'text-primary-700' : 'text-text-muted'}>
                      {zone.isActive ? (isAr ? 'نشط' : 'Active') : (isAr ? 'متوقف' : 'Inactive')}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-text-muted">
                    {isAr ? 'عادي' : 'Standard'}: {zone.scheduledFee} EGP · {isAr ? 'سريع' : 'Express'}: {zone.expressAvailable ? `${zone.expressFee} EGP` : 'Off'}
                  </p>
                </button>
              ))}
            </div>
          )}
        </section>

        <form onSubmit={save} className="rounded-2xl border border-border bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
                <MapPin className="h-5 w-5" />
              </span>
              <h2 className="font-bold">{selectedZone ? (isAr ? 'تعديل منطقة' : 'Edit zone') : (isAr ? 'إضافة منطقة' : 'Add zone')}</h2>
            </div>
            {selectedZone && (
              <button type="button" onClick={() => remove(selectedZone)} className="rounded-xl p-2 text-red-600 hover:bg-red-50">
                <Trash2 className="h-5 w-5" />
              </button>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Input label={isAr ? 'المدينة عربي' : 'City AR'} value={form.cityAr} onChange={(e) => update('cityAr', e.target.value)} required />
            <Input label={isAr ? 'City EN' : 'City EN'} value={form.cityEn} onChange={(e) => update('cityEn', e.target.value)} required />
            <Input label={isAr ? 'المنطقة عربي' : 'Area AR'} value={form.areaAr} onChange={(e) => update('areaAr', e.target.value)} required />
            <Input label={isAr ? 'Area EN' : 'Area EN'} value={form.areaEn} onChange={(e) => update('areaEn', e.target.value)} required />
            <Input label={isAr ? 'الأولوية' : 'Priority'} type="number" value={form.priority} onChange={(e) => update('priority', e.target.value)} />
            <Input label={isAr ? 'خط عرض مركز المنطقة' : 'Zone center latitude'} type="number" step="0.0001" value={form.centerLat} onChange={(e) => update('centerLat', e.target.value)} placeholder={isAr ? 'لمطابقة الدبوس بالمنطقة' : 'For pin → zone matching'} />
            <Input label={isAr ? 'خط طول مركز المنطقة' : 'Zone center longitude'} type="number" step="0.0001" value={form.centerLng} onChange={(e) => update('centerLng', e.target.value)} />
            <Input label={isAr ? 'نصف قطر المنطقة (كم)' : 'Zone radius (km)'} type="number" min="0" step="0.5" value={form.radiusKm} onChange={(e) => update('radiusKm', e.target.value)} />
            <Input label={isAr ? 'رسوم التوصيل العادي' : 'Standard delivery fee'} type="number" min="0" step="0.01" value={form.scheduledFee} onChange={(e) => update('scheduledFee', e.target.value)} />
            <Input label={isAr ? 'رسوم التوصيل السريع' : 'Express delivery fee'} type="number" min="0" step="0.01" value={form.expressFee} onChange={(e) => update('expressFee', e.target.value)} />
            <Input label={isAr ? 'الحد الأدنى للطلب' : 'Minimum order'} type="number" min="0" value={form.minimumOrder} onChange={(e) => update('minimumOrder', e.target.value)} />
            <Input label={isAr ? 'حد التوصيل المجاني' : 'Free delivery threshold'} type="number" min="0" value={form.freeDeliveryThreshold} onChange={(e) => update('freeDeliveryThreshold', e.target.value)} />

            <div className="md:col-span-2 space-y-3 rounded-xl border border-border bg-slate-50/80 p-4">
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={form.freeDeliveryOverride === true}
                  onChange={(e) => update('freeDeliveryOverride', e.target.checked)}
                />
                <span>
                  <span className="font-semibold text-text">
                    {isAr ? 'تخصيص التوصيل المجاني لهذه المنطقة' : 'Custom free delivery for this zone'}
                  </span>
                  <span className="mt-1 block text-xs text-text-muted">
                    {isAr
                      ? 'عند التفعيل تُطبَّق الطرق أدناه على هذه المنطقة فقط (أولوية أعلى من الإعداد العام).'
                      : 'When on, methods below apply to this zone only (overrides global).'}
                  </span>
                </span>
              </label>

              <FreeDeliveryMethodsField
                isAr={isAr}
                disabled={zoneMethodsDisabled}
                value={zoneMethodsEditable
                  ? form.freeDeliveryMethods
                  : (globalFreeDeliveryEnabled ? storeSettings.freeDeliveryMethods : [])}
                onChange={(methods) => update('freeDeliveryMethods', methods)}
                hint={zoneMethodsHint}
              />

              {globalFreeDeliveryEnabled && !zoneMethodsEditable && (
                <p className="text-xs font-medium text-emerald-700">
                  {isAr ? '✓ الإعداد العام مفعّل — هذه المنطقة تتبع إعدادات المتجر.' : '✓ Global free delivery is on — this zone follows Store Settings.'}
                </p>
              )}
            </div>

            <div className="md:col-span-2 space-y-3 rounded-xl border border-sky-200 bg-sky-50/50 p-4">
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={form.leadTimeOverride === true}
                  onChange={(e) => update('leadTimeOverride', e.target.checked)}
                />
                <span>
                  <span className="font-semibold text-text">
                    {isAr ? 'تخصيص مهلة التوصيل لهذه المنطقة' : 'Custom delivery lead time for this zone'}
                  </span>
                  <span className="mt-1 block text-xs text-text-muted">
                    {isAr
                      ? 'عند التفعيل تُطبَّق القيم أدناه على هذه المنطقة فقط (أولوية أعلى من الإعداد العام).'
                      : 'When on, values below apply to this zone only (overrides global).'}
                  </span>
                </span>
              </label>
              <p className="text-xs text-text-muted">{zoneLeadHint}</p>
              <div className="grid gap-4 md:grid-cols-2">
                <Input
                  label={isAr ? 'مهلة التوصيل العادي (دقائق)' : 'Standard lead time (minutes)'}
                  type="number"
                  min="0"
                  max="1440"
                  disabled={zoneLeadDisabled}
                  value={zoneLeadEditable ? form.scheduledMinLeadMinutes : storeSettings.scheduledMinLeadMinutes}
                  onChange={(e) => update('scheduledMinLeadMinutes', e.target.value)}
                />
                <Input
                  label={isAr ? 'مهلة التوصيل السريع (دقائق)' : 'Express lead time (minutes)'}
                  type="number"
                  min="0"
                  max="1440"
                  disabled={zoneLeadDisabled}
                  value={zoneLeadEditable ? form.expressMinLeadMinutes : storeSettings.expressMinLeadMinutes}
                  onChange={(e) => update('expressMinLeadMinutes', e.target.value)}
                />
              </div>
            </div>

            <Input label={isAr ? 'مدة التوصيل العادي' : 'Standard delivery duration'} value={form.estimatedScheduled} onChange={(e) => update('estimatedScheduled', e.target.value)} />
            <Input label={isAr ? 'مدة التوصيل السريع' : 'Express delivery duration'} value={form.estimatedExpress} onChange={(e) => update('estimatedExpress', e.target.value)} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.scheduledAvailable} onChange={(e) => update('scheduledAvailable', e.target.checked)} />
              {isAr ? 'التوصيل العادي' : 'Standard delivery'}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.expressAvailable} onChange={(e) => update('expressAvailable', e.target.checked)} />
              {isAr ? 'التوصيل السريع' : 'Express delivery'}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.isActive} onChange={(e) => update('isActive', e.target.checked)} />
              {isAr ? 'المنطقة نشطة' : 'Zone active'}
            </label>
            <div className="md:col-span-2">
              <Textarea label={isAr ? 'مواعيد التوصيل JSON' : 'Time slots JSON'} rows={8} value={form.timeSlotsText} onChange={(e) => update('timeSlotsText', e.target.value)} />
            </div>
          </div>

          <Button type="submit" className="mt-5" disabled={saving}>
            <Save className="h-4 w-4" />
            {saving ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'حفظ' : 'Save')}
          </Button>
        </form>
      </div>
    </div>
  );
}
