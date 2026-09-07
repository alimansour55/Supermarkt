import { useEffect, useState } from 'react';
import { MapPin, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useLocation } from '../context/LocationContext';
import { authService } from '../services/apiServices';
import { AccountPageLayout } from '../components/account/AccountSidebar';
import LocationSelector from '../components/layout/LocationSelector';
import AddressMapCapture from '../components/maps/AddressMapCapture';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Loader from '../components/ui/Loader';
import { useStoreSettings } from '../context/StoreSettingsContext';
import { isGpsDeliveryEnabled } from '../utils/gpsDelivery';
import { emptyAddressCapture, hasAddressPin } from '../utils/parseGooglePlace';

const LABELS = [
  { value: 'Home', labelAr: 'المنزل', labelEn: 'Home' },
  { value: 'Work', labelAr: 'العمل', labelEn: 'Work' },
  { value: 'Other', labelAr: 'أخرى', labelEn: 'Other' },
];

function formatAddressLine(address, isAr) {
  return [
    address.street,
    address.building,
    address.floor,
    address.area || address.city,
    address.governorate,
  ].filter(Boolean).join(isAr ? '، ' : ', ');
}

export default function MyAddressesPage() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const { settings } = useStoreSettings();
  const gpsMapEnabled = isGpsDeliveryEnabled(settings);
  const { user, refreshUser } = useAuth();
  const { location } = useLocation();
  const [addresses, setAddresses] = useState(user?.addresses || []);
  const [loading, setLoading] = useState(!user?.addresses);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    label: 'Home',
    isDefault: false,
    postalCode: '',
    ...emptyAddressCapture(),
  });

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await authService.getMe();
      setAddresses(data.user?.addresses || []);
    } catch (err) {
      setError(err.response?.data?.message || (isAr ? 'تعذر تحميل العناوين' : 'Could not load addresses'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm({
      label: 'Home',
      isDefault: addresses.length === 0,
      postalCode: '',
      ...emptyAddressCapture(),
      city: location?.cityEn || '',
      governorate: location?.cityEn || '',
      area: location?.areaEn || '',
    });
    setFormOpen(true);
    setError('');
  };

  const openEdit = (address) => {
    setEditingId(address._id);
    setForm({
      label: address.label || 'Home',
      street: address.street || '',
      building: address.building || '',
      floor: address.floor || '',
      city: address.city || '',
      governorate: address.governorate || '',
      area: address.area || '',
      postalCode: address.postalCode || '',
      lat: address.lat ?? null,
      lng: address.lng ?? null,
      formattedAddress: address.formattedAddress || '',
      placeId: address.placeId || '',
      isDefault: Boolean(address.isDefault),
    });
    setFormOpen(true);
    setError('');
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (gpsMapEnabled && !hasAddressPin(form)) {
      setError(isAr
        ? 'يرجى تحديد موقع التوصيل على الخريطة أو البحث عن عنوانك.'
        : 'Please pin your delivery location on the map or search for your address.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const payload = {
        label: form.label,
        street: form.street.trim(),
        building: form.building,
        floor: form.floor,
        city: form.city.trim() || location?.cityEn || '',
        governorate: form.governorate.trim() || location?.cityEn || '',
        area: form.area.trim() || location?.areaEn || form.city.trim(),
        postalCode: form.postalCode,
        lat: form.lat,
        lng: form.lng,
        formattedAddress: form.formattedAddress,
        placeId: form.placeId,
        isDefault: form.isDefault,
        deliveryZoneId: location?.id,
        lang: language,
      };
      const { data } = editingId
        ? await authService.updateAddress(editingId, payload)
        : await authService.addAddress(payload);
      setAddresses(data.user?.addresses || []);
      await refreshUser();
      setFormOpen(false);
      setEditingId(null);
    } catch (err) {
      setError(err.response?.data?.message || (isAr ? 'تعذر حفظ العنوان' : 'Could not save address'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(isAr ? 'حذف هذا العنوان؟' : 'Delete this address?')) return;
    setSaving(true);
    setError('');
    try {
      const { data } = await authService.deleteAddress(id);
      setAddresses(data.user?.addresses || []);
      await refreshUser();
      if (editingId === id) {
        setFormOpen(false);
        setEditingId(null);
      }
    } catch (err) {
      setError(err.response?.data?.message || (isAr ? 'تعذر الحذف' : 'Could not delete'));
    } finally {
      setSaving(false);
    }
  };

  const handleSetDefault = async (id) => {
    setSaving(true);
    setError('');
    try {
      const { data } = await authService.updateAddress(id, { isDefault: true, lang: language });
      setAddresses(data.user?.addresses || []);
      await refreshUser();
    } catch (err) {
      setError(err.response?.data?.message || (isAr ? 'تعذر التحديث' : 'Could not update'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AccountPageLayout title={isAr ? 'العناوين' : 'Addresses'}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-text-muted">
            {gpsMapEnabled
              ? (isAr
                ? 'احفظ عناوين التوصيل مع موقع دقيق على الخريطة.'
                : 'Save delivery addresses with an accurate map pin.')
              : (isAr
                ? 'احفظ عناوين التوصيل النصية — تحديد الموقع على الخريطة غير مفعّل.'
                : 'Save text delivery addresses — map pinning is disabled for this store.')}
          </p>
          <Button type="button" size="sm" onClick={openCreate} disabled={saving}>
            <Plus className="h-4 w-4" aria-hidden />
            {isAr ? 'إضافة عنوان' : 'Add address'}
          </Button>
        </div>

        {error && (
          <p className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader />
          </div>
        ) : !addresses.length && !formOpen ? (
          <div className="rounded-2xl border border-dashed border-border bg-slate-50 px-6 py-12 text-center">
            <MapPin className="mx-auto h-10 w-10 text-primary-400" aria-hidden />
            <p className="mt-4 font-semibold text-text">
              {isAr ? 'لا توجد عناوين محفوظة' : 'No saved addresses'}
            </p>
            <Button type="button" className="mt-4" onClick={openCreate}>
              {isAr ? 'أضف عنوانك الأول' : 'Add your first address'}
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {addresses.map((address) => {
              const label = LABELS.find((item) => item.value === address.label);
              return (
                <article
                  key={address._id}
                  className={`rounded-2xl border p-4 ${
                    address.isDefault ? 'border-primary-300 bg-primary-50/40' : 'border-border bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-text">
                          {label ? (isAr ? label.labelAr : label.labelEn) : address.label}
                        </p>
                        {address.isDefault && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary-100 px-2 py-0.5 text-[10px] font-bold text-primary-700">
                            <Star className="h-3 w-3 fill-current" aria-hidden />
                            {isAr ? 'افتراضي' : 'Default'}
                          </span>
                        )}
                      </div>
                      <p className="mt-2 text-sm text-text-muted">{formatAddressLine(address, isAr)}</p>
                      {address.lat != null && address.lng != null && (
                        <p className="mt-1 text-[11px] text-text-muted">
                          {isAr ? 'موقع محدد على الخريطة' : 'Pinned on map'}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {!address.isDefault && (
                      <Button type="button" variant="secondary" size="sm" disabled={saving} onClick={() => handleSetDefault(address._id)}>
                        {isAr ? 'تعيين كافتراضي' : 'Set default'}
                      </Button>
                    )}
                    <Button type="button" variant="secondary" size="sm" disabled={saving} onClick={() => openEdit(address)}>
                      <Pencil className="h-4 w-4" aria-hidden />
                      {isAr ? 'تعديل' : 'Edit'}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="border-red-200 text-red-700 hover:bg-red-50"
                      disabled={saving}
                      onClick={() => handleDelete(address._id)}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                      {isAr ? 'حذف' : 'Delete'}
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {formOpen && (
          <section className="rounded-2xl border border-border bg-white p-6">
            <h2 className="mb-4 text-lg font-bold text-text">
              {editingId
                ? (isAr ? 'تعديل العنوان' : 'Edit address')
                : (isAr ? 'إضافة عنوان جديد' : 'Add new address')}
            </h2>
            <form onSubmit={handleSave} className="space-y-4">
              <LocationSelector variant="form" />

              <label className="block">
                <span className="mb-1 block text-sm font-medium">{isAr ? 'نوع العنوان' : 'Address label'}</span>
                <select
                  value={form.label}
                  onChange={(e) => setForm((prev) => ({ ...prev, label: e.target.value }))}
                  className="w-full rounded-xl border border-border px-3 py-2.5 text-sm outline-none focus:border-primary-400"
                >
                  {LABELS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {isAr ? item.labelAr : item.labelEn}
                    </option>
                  ))}
                </select>
              </label>

              <AddressMapCapture
                value={form}
                onChange={(next) => setForm((prev) => ({ ...prev, ...next }))}
                deliveryZone={location}
                isAr={isAr}
                enableMap={gpsMapEnabled}
              />

              <Input
                label={isAr ? 'الرمز البريدي' : 'Postal code'}
                value={form.postalCode}
                onChange={(e) => setForm((prev) => ({ ...prev, postalCode: e.target.value }))}
              />

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.isDefault}
                  onChange={(e) => setForm((prev) => ({ ...prev, isDefault: e.target.checked }))}
                  className="rounded border-border accent-primary-600"
                />
                <span className="text-sm">{isAr ? 'استخدام كعنوان افتراضي' : 'Use as default address'}</span>
              </label>

              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={saving}>
                  {saving ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'حفظ' : 'Save')}
                </Button>
                <Button type="button" variant="ghost" onClick={() => { setFormOpen(false); setEditingId(null); }}>
                  {isAr ? 'إلغاء' : 'Cancel'}
                </Button>
              </div>
            </form>
          </section>
        )}
      </div>
    </AccountPageLayout>
  );
}
