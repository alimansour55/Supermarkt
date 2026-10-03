import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, MapPin, Plus, Save, Trash2 } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { adminApi } from '../adminApi';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Loader from '../../components/ui/Loader';
import { EmptyState, PageHeader, useConfirm, useToast } from '../components';
import FreeDeliveryMethodsField from '../components/FreeDeliveryMethodsField';
import TimeSlotsEditor from '../components/TimeSlotsEditor';
import GoogleMapPicker from '../../components/maps/GoogleMapPicker';
import { parseFreeDeliveryMethodsFromApi } from '../../utils/freeDelivery';
import { formatLeadMinutesLabel } from '../../utils/deliveryLeadTime';
import { haversineKm } from '../../utils/zoneDistance';

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
  timeSlots: defaultSlots,
};

const toForm = (zone = {}) => ({
  ...emptyForm,
  ...zone,
  freeDeliveryMethods: parseFreeDeliveryMethodsFromApi(zone.freeDeliveryMethods),
  freeDeliveryOverride: zone.freeDeliveryOverride === true,
  centerLat: zone.centerLat ?? '',
  centerLng: zone.centerLng ?? '',
  radiusKm: zone.radiusKm ?? 8,
  timeSlots: zone.timeSlots?.length ? zone.timeSlots : defaultSlots,
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
  const [coverageAreas, setCoverageAreas] = useState([]);
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
        const gate = s.locationGate || {};
        const areas = Array.isArray(gate.coverageAreas)
          ? gate.coverageAreas
            .map((a) => ({ lat: Number(a.lat), lng: Number(a.lng), radiusKm: Number(a.radiusKm), label: a.label }))
            .filter((a) => Number.isFinite(a.lat) && Number.isFinite(a.lng) && Number.isFinite(a.radiusKm) && a.radiusKm > 0)
          : [];
        setCoverageAreas(areas);
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

  const updateZoneCenter = ({ lat, lng }) => setForm((prev) => ({
    ...prev,
    centerLat: lat,
    centerLng: lng,
  }));

  const hasCenterPin = form.centerLat !== '' && form.centerLat != null
    && form.centerLng !== '' && form.centerLng != null;

  // The nearest configured coverage circle to this zone's center — used both to decide
  // whether the zone sits inside ANY circle (they don't have to be adjacent) and, if not,
  // to report how far outside the closest one it is.
  const nearestCoverageArea = hasCenterPin && coverageAreas.length
    ? coverageAreas.reduce((best, area) => {
      const distanceKm = haversineKm({ lat: Number(form.centerLat), lng: Number(form.centerLng) }, area);
      const excessKm = distanceKm - area.radiusKm;
      return !best || excessKm < best.excessKm ? { area, distanceKm, excessKm } : best;
    }, null)
    : null;
  const outsideUmbrella = coverageAreas.length > 0 && (!nearestCoverageArea || nearestCoverageArea.excessKm > 0);

  const payload = () => {
    if (!hasCenterPin) {
      throw new Error(isAr
        ? 'حدّد نطاق المنطقة على الخريطة أولاً — لا يمكن حفظ منطقة بدون نطاق جغرافي.'
        : 'Set the zone\'s extent on the map first — a zone cannot be saved without a geographic extent.');
    }
    if (outsideUmbrella) {
      const excess = Math.round(nearestCoverageArea.excessKm);
      throw new Error(isAr
        ? `هذا المركز خارج كل دوائر التغطية (أقرب دائرة أبعد بـ ${excess} كم) — منطقة التوصيل لا يمكن أن تتجاوز منطقة التغطية. عدّل الموقع هنا أو أضف/وسّع دائرة من صفحة «منطقة التغطية».`
        : `This center is outside every coverage circle (the closest one is ${excess} km away) — a delivery zone cannot extend past the coverage area. Move it here or add/widen a circle on the Coverage area page.`);
    }
    const rest = { ...form };
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
      centerLat: Number(form.centerLat),
      centerLng: Number(form.centerLng),
      radiusKm: Math.max(0.3, Number(form.radiusKm) || 8),
      timeSlots: form.timeSlots || [],
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
                  {(zone.centerLat == null || zone.centerLng == null) && (
                    <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-red-600">
                      <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden />
                      {isAr ? 'بدون نطاق جغرافي — مخفية عن العملاء' : 'No geographic extent — hidden from customers'}
                    </p>
                  )}
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

            <div className="md:col-span-2 space-y-3 rounded-xl border border-border bg-slate-50/80 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-text">
                    {isAr ? 'نطاق المنطقة على الخريطة' : 'Zone extent on the map'}
                  </p>
                  <p className="mt-0.5 text-xs text-text-muted">
                    {isAr
                      ? 'ابحث عن العنوان أو انقر على الخريطة لتحديد مركز هذه المنطقة تحديداً — يُستخدم لمطابقة دبوس العميل بها ولحساب أسعارها ومواعيدها. يجب أن يقع هذا النطاق داخل «منطقة التغطية» العامة.'
                      : 'Search an address or click the map to set this specific zone\'s center — used to match a customer\'s pin to it and to price/schedule it. This extent must fall inside the general "Coverage area."'}
                  </p>
                </div>
                <label className="flex shrink-0 items-center gap-2 text-xs font-semibold text-text">
                  {isAr ? 'نصف القطر (كم)' : 'Radius (km)'}
                  <input
                    type="number"
                    min="0.3"
                    max="50"
                    step="0.5"
                    value={form.radiusKm}
                    onChange={(e) => update('radiusKm', e.target.value)}
                    className="w-20 rounded-lg border border-border bg-white px-2 py-1 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
                  />
                </label>
              </div>
              <GoogleMapPicker
                lat={form.centerLat === '' ? null : form.centerLat}
                lng={form.centerLng === '' ? null : form.centerLng}
                onChange={updateZoneCenter}
                isAr={isAr}
                radiusMeters={Number(form.radiusKm) * 1000}
                onRadiusChange={(meters) => update('radiusKm', Math.round((meters / 1000) * 10) / 10)}
                radiusMinMeters={300}
                radiusMaxMeters={50000}
                showCurrentLocation={false}
              />
              {hasCenterPin ? (
                <div className="flex items-center justify-between gap-2 text-xs text-text-muted">
                  <span>
                    {isAr ? 'الإحداثيات:' : 'Coordinates:'}{' '}
                    {Number(form.centerLat).toFixed(6)}, {Number(form.centerLng).toFixed(6)}
                  </span>
                  <button
                    type="button"
                    onClick={() => updateZoneCenter({ lat: '', lng: '' })}
                    className="font-medium text-red-600 hover:underline"
                  >
                    {isAr ? 'إزالة الدبوس' : 'Clear pin'}
                  </button>
                </div>
              ) : null}
              {outsideUmbrella && (
                <p className="flex items-start gap-2 text-xs font-semibold text-red-700">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  {isAr
                    ? `هذا المركز خارج كل دوائر التغطية — أقرب دائرة أبعد بـ ${Math.round(nearestCoverageArea.excessKm)} كم. عدّل مركز الدائرة ليقع داخل إحدى دوائر التغطية (صفحة «منطقة التغطية») حتى يمكن حفظ هذه المنطقة.`
                    : `This center is outside every coverage circle — the closest one is ${Math.round(nearestCoverageArea.excessKm)} km away. Move the circle inside one of the coverage circles (the Coverage area page) before this zone can be saved.`}
                </p>
              )}
              {!hasCenterPin && (
                <p className="flex items-start gap-2 text-xs font-semibold text-red-700">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  {isAr
                    ? 'مطلوب: حدّد مركز المنطقة على الخريطة — منطقة بلا نطاق جغرافي لا يمكن حفظها أو ظهورها للعملاء.'
                    : 'Required: set the zone\'s center on the map — a zone with no geographic extent cannot be saved or shown to customers.'}
                </p>
              )}
            </div>

            <Input label={isAr ? 'الحد الأدنى للطلب' : 'Minimum order'} type="number" min="0" value={form.minimumOrder} onChange={(e) => update('minimumOrder', e.target.value)} />
            <Input label={isAr ? 'حد التوصيل المجاني' : 'Free delivery threshold'} type="number" min="0" value={form.freeDeliveryThreshold} onChange={(e) => update('freeDeliveryThreshold', e.target.value)} />

            <label className="md:col-span-2 flex items-center gap-2 text-sm font-semibold text-text">
              <input type="checkbox" checked={form.isActive} onChange={(e) => update('isActive', e.target.checked)} />
              {isAr ? 'المنطقة نشطة — تظهر للعملاء' : 'Zone active — visible to customers'}
            </label>

            <div className="md:col-span-2 space-y-2 rounded-xl border border-sky-200 bg-sky-50/50 p-3">
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={form.leadTimeOverride === true}
                  onChange={(e) => update('leadTimeOverride', e.target.checked)}
                />
                <span>
                  <span className="font-semibold text-text">
                    {isAr ? 'تخصيص مهلة التجهيز لهذه المنطقة' : 'Custom prep lead time for this zone'}
                  </span>
                  <span className="mt-1 block text-xs text-text-muted">{zoneLeadHint}</span>
                </span>
              </label>
            </div>

            {[
              {
                key: 'scheduled',
                title: isAr ? 'التوصيل العادي' : 'Standard delivery',
                available: form.scheduledAvailable,
                setAvailable: (v) => update('scheduledAvailable', v),
                fee: form.scheduledFee,
                setFee: (v) => update('scheduledFee', v),
                leadValue: zoneLeadEditable ? form.scheduledMinLeadMinutes : storeSettings.scheduledMinLeadMinutes,
                setLead: (v) => update('scheduledMinLeadMinutes', v),
                duration: form.estimatedScheduled,
                setDuration: (v) => update('estimatedScheduled', v),
              },
              {
                key: 'express',
                title: isAr ? 'التوصيل السريع' : 'Express delivery',
                available: form.expressAvailable,
                setAvailable: (v) => update('expressAvailable', v),
                fee: form.expressFee,
                setFee: (v) => update('expressFee', v),
                leadValue: zoneLeadEditable ? form.expressMinLeadMinutes : storeSettings.expressMinLeadMinutes,
                setLead: (v) => update('expressMinLeadMinutes', v),
                duration: form.estimatedExpress,
                setDuration: (v) => update('estimatedExpress', v),
              },
            ].map((method) => {
              const suggestedDuration = formatLeadMinutesLabel(method.leadValue, isAr ? 'ar' : 'en');
              return (
                <div
                  key={method.key}
                  className={`md:col-span-2 space-y-3 rounded-xl border p-4 transition-opacity ${
                    method.available ? 'border-border bg-white' : 'border-border bg-slate-50 opacity-70'
                  }`}
                >
                  <label className="flex items-center gap-2 text-sm font-bold text-text">
                    <input
                      type="checkbox"
                      checked={method.available}
                      onChange={(e) => method.setAvailable(e.target.checked)}
                    />
                    {method.title}
                    <span className="font-normal text-text-muted">
                      {isAr ? '— متاح في هذه المنطقة' : '— offered in this zone'}
                    </span>
                  </label>

                  <div className="grid gap-4 md:grid-cols-3">
                    <Input
                      label={isAr ? 'رسوم التوصيل' : 'Delivery fee'}
                      type="number"
                      min="0"
                      step="0.01"
                      disabled={!method.available}
                      value={method.fee}
                      onChange={(e) => method.setFee(e.target.value)}
                    />
                    <Input
                      label={isAr ? 'مهلة التجهيز (دقائق)' : 'Prep lead time (minutes)'}
                      type="number"
                      min="0"
                      max="1440"
                      disabled={!method.available || zoneLeadDisabled}
                      value={method.leadValue}
                      onChange={(e) => method.setLead(e.target.value)}
                    />
                    <div>
                      <Input
                        label={isAr ? 'النص الظاهر للعميل' : 'Customer-facing ETA text'}
                        disabled={!method.available}
                        value={method.duration}
                        onChange={(e) => method.setDuration(e.target.value)}
                        placeholder={suggestedDuration}
                      />
                      {method.available && method.duration !== suggestedDuration && (
                        <button
                          type="button"
                          onClick={() => method.setDuration(suggestedDuration)}
                          className="mt-1 text-xs font-medium text-primary-700 hover:underline"
                        >
                          {isAr ? `استخدم "${suggestedDuration}" (من مهلة التجهيز)` : `Use "${suggestedDuration}" (from lead time)`}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

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

            <TimeSlotsEditor
              isAr={isAr}
              value={form.timeSlots}
              onChange={(slots) => update('timeSlots', slots)}
            />
          </div>

          {(!hasCenterPin || outsideUmbrella) && (
            <p className="mt-4 flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
              {!hasCenterPin
                ? (isAr ? 'لا يمكن الحفظ قبل تحديد نطاق المنطقة على الخريطة.' : 'Cannot save until the zone\'s extent is set on the map.')
                : (isAr ? 'لا يمكن الحفظ — المركز خارج منطقة التغطية.' : 'Cannot save — the center is outside the coverage area.')}
            </p>
          )}

          <Button type="submit" className="mt-4" disabled={saving || !hasCenterPin || outsideUmbrella}>
            <Save className="h-4 w-4" />
            {saving ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'حفظ' : 'Save')}
          </Button>
        </form>
      </div>
    </div>
  );
}
