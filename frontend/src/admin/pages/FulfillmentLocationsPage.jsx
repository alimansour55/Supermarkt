import { useEffect, useMemo, useState } from 'react';
import { MapPin, Plus, Save, Star, Trash2, Warehouse } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { adminApi } from '../adminApi';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Loader from '../../components/ui/Loader';
import GoogleMapPicker from '../../components/maps/GoogleMapPicker';
import { EmptyState, PageHeader, useConfirm, useToast } from '../components';

const emptyForm = {
  name: '',
  address: '',
  lat: null,
  lng: null,
  formattedAddress: '',
  placeId: '',
  isDefault: false,
  deliveryZones: [],
  isActive: true,
};

const toForm = (location = {}) => ({
  ...emptyForm,
  ...location,
  deliveryZones: Array.isArray(location.deliveryZones)
    ? location.deliveryZones.map((z) => String(z))
    : [],
});

export default function FulfillmentLocationsPage() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const toast = useToast();
  const confirm = useConfirm();

  const [locations, setLocations] = useState([]);
  const [zones, setZones] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const selectedLocation = useMemo(
    () => locations.find((loc) => loc.id === selectedId || loc._id === selectedId),
    [locations, selectedId],
  );

  const zoneLabel = (zone) => (isAr ? zone.areaAr || zone.cityAr : zone.areaEn || zone.cityEn)
    || zone.slug
    || zone.id;

  const load = () => {
    setLoading(true);
    Promise.all([
      adminApi.getFulfillmentLocations(),
      adminApi.getDeliveryZones(),
    ])
      .then(([locationsRes, zonesRes]) => {
        setLocations(locationsRes.data.data || []);
        setZones(zonesRes.data.data || []);
      })
      .catch(() => toast.error(isAr ? 'تعذر تحميل مواقع الشحن' : 'Failed to load fulfillment locations'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const selectNew = () => {
    setSelectedId(null);
    setForm(emptyForm);
  };

  const selectLocation = (location) => {
    const id = location.id || location._id;
    setSelectedId(id);
    setForm(toForm(location));
  };

  const toggleZone = (zoneId) => {
    const id = String(zoneId);
    setForm((prev) => {
      const has = prev.deliveryZones.includes(id);
      return {
        ...prev,
        deliveryZones: has
          ? prev.deliveryZones.filter((z) => z !== id)
          : [...prev.deliveryZones, id],
      };
    });
  };

  const handleMapChange = (patch) => {
    setForm((prev) => ({
      ...prev,
      lat: patch.lat,
      lng: patch.lng,
      formattedAddress: patch.formattedAddress ?? prev.formattedAddress,
      placeId: patch.placeId ?? prev.placeId,
      address: patch.address || patch.formattedAddress || prev.address,
    }));
  };

  const geocode = async (payload) => {
    const { data } = await adminApi.geocodeFulfillmentLocation({
      ...payload,
      language: isAr ? 'ar' : 'en',
    });
    return data.data;
  };

  const save = async (event) => {
    event.preventDefault();
    if (!form.name.trim()) {
      toast.error(isAr ? 'اسم الموقع مطلوب' : 'Location name is required');
      return;
    }
    if (form.lat == null || form.lng == null) {
      toast.error(isAr ? 'حدد الموقع على الخريطة' : 'Pick a location on the map');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        address: form.address.trim() || form.formattedAddress.trim(),
        lat: form.lat,
        lng: form.lng,
        formattedAddress: form.formattedAddress,
        placeId: form.placeId,
        isDefault: form.isDefault,
        deliveryZones: form.deliveryZones,
        isActive: form.isActive,
      };

      if (selectedId) {
        await adminApi.updateFulfillmentLocation(selectedId, payload);
        toast.success(isAr ? 'تم تحديث الموقع' : 'Location updated');
      } else {
        await adminApi.createFulfillmentLocation(payload);
        toast.success(isAr ? 'تم إضافة الموقع' : 'Location created');
      }
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || (isAr ? 'تعذر الحفظ' : 'Save failed'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!selectedId) return;
    const ok = await confirm({
      title: isAr ? 'حذف موقع الشحن؟' : 'Delete fulfillment location?',
      message: isAr ? 'لن يُستخدم هذا الموقع للطلبات الجديدة.' : 'This location will no longer be used for new orders.',
      confirmLabel: isAr ? 'حذف' : 'Delete',
      variant: 'danger',
    });
    if (!ok) return;

    try {
      await adminApi.deleteFulfillmentLocation(selectedId);
      toast.success(isAr ? 'تم الحذف' : 'Deleted');
      selectNew();
      load();
    } catch {
      toast.error(isAr ? 'تعذر الحذف' : 'Delete failed');
    }
  };

  if (loading) return <Loader />;

  return (
    <div className="space-y-6">
      <PageHeader
        title={isAr ? 'مواقع الشحن' : 'Fulfillment locations'}
        subtitle={isAr
          ? 'حدد من أين تُشحن الطلبات — مستودع لكل منطقة أو موقع افتراضي.'
          : 'Set where orders ship from — one warehouse per zone or a default origin.'}
        actions={(
          <Button type="button" onClick={selectNew}>
            <Plus className="h-4 w-4" />
            {isAr ? 'موقع جديد' : 'New location'}
          </Button>
        )}
      />

      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <section className="rounded-2xl border border-border bg-white p-4 shadow-sm">
          <h2 className="mb-3 font-bold">{isAr ? 'المواقع' : 'Locations'}</h2>
          {locations.length === 0 ? (
            <EmptyState
              icon={Warehouse}
              title={isAr ? 'لا توجد مواقع بعد' : 'No locations yet'}
              description={isAr ? 'أضف مستودعاً أو فرعاً لبدء الشحن.' : 'Add a warehouse or branch to start shipping.'}
            />
          ) : (
            <ul className="space-y-2">
              {locations.map((location) => {
                const id = location.id || location._id;
                const active = id === selectedId;
                return (
                  <li key={id}>
                    <button
                      type="button"
                      onClick={() => selectLocation(location)}
                      className={`w-full rounded-xl border px-3 py-2.5 text-start transition ${
                        active ? 'border-primary-300 bg-primary-50' : 'border-border hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" />
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-text">{location.name}</p>
                          <p className="truncate text-xs text-text-muted">{location.address}</p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {location.isDefault && (
                              <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                                <Star className="h-3 w-3" />
                                {isAr ? 'افتراضي' : 'Default'}
                              </span>
                            )}
                            {!location.isActive && (
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                                {isAr ? 'غير نشط' : 'Inactive'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <form onSubmit={save} className="space-y-5 rounded-2xl border border-border bg-white p-6 shadow-sm">
          <h2 className="font-bold">
            {selectedLocation
              ? (isAr ? 'تعديل الموقع' : 'Edit location')
              : (isAr ? 'موقع شحن جديد' : 'New fulfillment location')}
          </h2>

          <Input
            label={isAr ? 'اسم الموقع' : 'Location name'}
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            placeholder={isAr ? 'مثال: مستودع المعادي' : 'e.g. Maadi warehouse'}
            required
          />
          <p className="-mt-3 text-xs text-text-muted">
            {isAr
              ? 'اسم داخلي للمستودع — للعنوان الفعلي استخدم البحث أدناه واختر من الاقتراحات.'
              : 'Internal warehouse label — for the real address, use search below and pick a suggestion.'}
          </p>

          <Input
            label={isAr ? 'العنوان' : 'Address'}
            value={form.address}
            onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
            placeholder={isAr ? 'الشارع، المبنى، المنطقة' : 'Street, building, area'}
            required
          />

          <GoogleMapPicker
            lat={form.lat}
            lng={form.lng}
            onChange={handleMapChange}
            onGeocode={geocode}
            isAr={isAr}
          />

          {(form.lat != null && form.lng != null) && (
            <p className="text-xs text-text-muted">
              {isAr ? 'الإحداثيات:' : 'Coordinates:'}{' '}
              {Number(form.lat).toFixed(6)}, {Number(form.lng).toFixed(6)}
            </p>
          )}

          <div>
            <p className="mb-2 text-sm font-medium text-text">
              {isAr ? 'مناطق التوصيل المرتبطة (اختياري)' : 'Linked delivery zones (optional)'}
            </p>
            <p className="mb-3 text-xs text-text-muted">
              {isAr
                ? 'طلبات هذه المناطق تُشحن من هذا الموقع. بدون ربط، يُستخدم الموقع الافتراضي فقط.'
                : 'Orders in these zones ship from this location. Unlinked zones use the default location.'}
            </p>
            {zones.length === 0 ? (
              <p className="text-sm text-text-muted">
                {isAr ? 'أضف مناطق توصيل أولاً من صفحة مناطق التوصيل.' : 'Add delivery zones first from Delivery zones.'}
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {zones.map((zone) => {
                  const zoneId = String(zone.id || zone._id);
                  const checked = form.deliveryZones.includes(zoneId);
                  return (
                    <label
                      key={zoneId}
                      className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${
                        checked ? 'border-primary-400 bg-primary-50 text-primary-800' : 'border-border'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="rounded border-border text-primary-600"
                        checked={checked}
                        onChange={() => toggleZone(zoneId)}
                      />
                      {zoneLabel(zone)}
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="rounded border-border text-primary-600"
              checked={form.isDefault}
              onChange={(e) => setForm((prev) => ({ ...prev, isDefault: e.target.checked }))}
            />
            {isAr ? 'الموقع الافتراضي (يُستخدم عند عدم وجود ربط بمنطقة)' : 'Default origin (used when no zone match)'}
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="rounded border-border text-primary-600"
              checked={form.isActive}
              onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
            />
            {isAr ? 'نشط' : 'Active'}
          </label>

          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            <Button type="submit" loading={saving}>
              <Save className="h-4 w-4" />
              {isAr ? 'حفظ' : 'Save'}
            </Button>
            {selectedId && (
              <Button type="button" variant="danger" onClick={remove}>
                <Trash2 className="h-4 w-4" />
                {isAr ? 'حذف' : 'Delete'}
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
