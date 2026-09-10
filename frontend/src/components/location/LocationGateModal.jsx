import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Check, Crosshair, MapPin, PencilLine, Search, X } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useLocation } from '../../context/LocationContext';
import { useStoreSettings } from '../../context/StoreSettingsContext';
import { useAuth } from '../../context/AuthContext';
import { deliveryZoneService, authService } from '../../services/apiServices';
import { getGeolocationErrorMessage } from '../../hooks/useCurrentGeolocation';
import { getApproximatePosition } from '../../utils/approxLocate';
import { anyZoneHasCoords, findCoveringZone, nearestZone } from '../../utils/zoneDistance';
import { markLocationGateDismissed } from '../../utils/locationGate';
import OsmMapCanvas from '../maps/OsmMapCanvas';

const HELWAN = { lat: 29.8453, lng: 31.3339 };

const NOT_COVERED = {
  ar: 'عذراً! لا نغطي هذه المنطقة.',
  en: 'Sorry! We do not deliver to this area.',
};

/**
 * Startup "choose your delivery area" popup (HyperOne-style).
 * Visibility is decided by the parent; this component renders nothing when `open` is false.
 */
export default function LocationGateModal({ open }) {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const { settings } = useStoreSettings();
  const { user, refreshUser } = useAuth();
  const {
    locations, location, confirmLocation, closeGate, confirmed,
    pin: savedPin, manualAddress: savedManual,
  } = useLocation();

  const gate = settings?.locationGate || {};
  const mandatory = gate.mandatory !== false;
  const enforceCoverage = gate.enforceCoverage !== false;
  const dismissible = !mandatory || confirmed;
  const title = (isAr ? gate.titleAr : gate.titleEn) || (isAr ? 'اختر منطقتك' : 'Choose your area');
  const subtitle = (isAr ? gate.subtitleAr : gate.subtitleEn) || '';
  const mapCenter = useMemo(() => ({
    lat: Number.isFinite(Number(gate.mapCenterLat)) ? Number(gate.mapCenterLat) : HELWAN.lat,
    lng: Number.isFinite(Number(gate.mapCenterLng)) ? Number(gate.mapCenterLng) : HELWAN.lng,
  }), [gate.mapCenterLat, gate.mapCenterLng]);
  const mapZoom = Number.isFinite(Number(gate.mapZoom)) ? Number(gate.mapZoom) : 12;

  const [search, setSearch] = useState('');
  const [selectedZoneId, setSelectedZoneId] = useState(location?.id || '');
  const [zoneTouched, setZoneTouched] = useState(false);
  const [pin, setPin] = useState(
    savedPin?.lat != null ? { lat: savedPin.lat, lng: savedPin.lng } : null,
  );
  const [pinSource, setPinSource] = useState(savedPin?.source || null);
  const [formattedAddress, setFormattedAddress] = useState(savedPin?.formattedAddress || '');
  const [geoError, setGeoError] = useState('');
  const [coverageError, setCoverageError] = useState('');
  const [resolving, setResolving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [locating, setLocating] = useState(false);
  const listRef = useRef(null);

  // 'area' = pick a zone / drop a pin; 'manual' = type the full address by hand.
  const [mode, setMode] = useState('area');
  const [manual, setManual] = useState(() => ({
    governorate: savedManual?.governorate || '',
    city: savedManual?.city || '',
    area: savedManual?.area || '',
    street: savedManual?.street || '',
    building: savedManual?.building || '',
    floor: savedManual?.floor || '',
  }));
  const [manualError, setManualError] = useState('');
  const [manualSaving, setManualSaving] = useState(false);

  const handleClose = useCallback(() => {
    if (!dismissible) return;
    if (!confirmed) markLocationGateDismissed();
    closeGate();
  }, [dismissible, confirmed, closeGate]);

  const reverseGeocode = useCallback(async (lat, lng) => {
    try {
      const { data } = await deliveryZoneService.geocode({ lat, lng, language });
      return data?.data?.formattedAddress || '';
    } catch {
      return '';
    }
  }, [language]);

  /** Derive the delivery zone from a dropped pin + apply the coverage rule. */
  const resolvePinZone = useCallback((point) => {
    const covering = findCoveringZone(locations, point);
    if (covering?.id) {
      setSelectedZoneId(covering.id);
      setZoneTouched(false);
      setCoverageError('');
      return;
    }
    if (enforceCoverage && anyZoneHasCoords(locations)) {
      setCoverageError(isAr ? NOT_COVERED.ar : NOT_COVERED.en);
      return;
    }
    const near = nearestZone(locations, point);
    if (near?.zone?.id) setSelectedZoneId(near.zone.id);
    setCoverageError('');
  }, [locations, enforceCoverage, isAr]);

  const applyPin = useCallback(async (lat, lng, source = 'map') => {
    const point = { lat: Number(lat), lng: Number(lng) };
    setPin(point);
    setPinSource(source);
    setGeoError('');
    resolvePinZone(point);
    setResolving(true);
    const addr = await reverseGeocode(point.lat, point.lng);
    setFormattedAddress(addr);
    setResolving(false);
  }, [resolvePinZone, reverseGeocode]);

  // Re-check coverage for a restored pin once zones are loaded / when reopened.
  useEffect(() => {
    if (!open || !pin) return;
    resolvePinZone(pin);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, locations]);

  // Default the selection to the current/first zone (only while the user has not
  // picked one and there is no pin driving it).
  useEffect(() => {
    if (!open || zoneTouched || pin) return;
    const fallback = location?.id || locations[0]?.id || '';
    if (fallback && !locations.some((z) => z.id === selectedZoneId)) {
      setSelectedZoneId(fallback);
    }
  }, [open, zoneTouched, pin, location?.id, locations, selectedZoneId]);

  useEffect(() => {
    if (!open) return undefined;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [open, handleClose]);

  // Each time the popup opens, start on the area view and re-seed the manual form
  // from whatever the customer saved last.
  useEffect(() => {
    if (!open) return;
    setMode('area');
    setManualError('');
    if (savedManual) {
      setManual({
        governorate: savedManual.governorate || '',
        city: savedManual.city || '',
        area: savedManual.area || '',
        street: savedManual.street || '',
        building: savedManual.building || '',
        floor: savedManual.floor || '',
      });
    }
  }, [open, savedManual]);

  const filteredZones = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return locations;
    return locations.filter((zone) => {
      const ar = (zone.nameAr || '').toLowerCase();
      const en = (zone.nameEn || '').toLowerCase();
      return ar.includes(q) || en.includes(q);
    });
  }, [locations, search]);

  const selectedZone = useMemo(
    () => locations.find((z) => z.id === selectedZoneId) || null,
    [locations, selectedZoneId],
  );

  const handleUseMyLocation = useCallback(async () => {
    if (locating) return;
    setGeoError('');
    setLocating(true);
    try {
      const coords = await getApproximatePosition();
      await applyPin(coords.lat, coords.lng, 'gps');
    } catch (err) {
      setGeoError(getGeolocationErrorMessage(err, isAr));
    } finally {
      setLocating(false);
    }
  }, [applyPin, isAr, locating]);

  // Manual area pick — the pin (if any) no longer applies.
  const pickZone = (zoneId) => {
    setSelectedZoneId(zoneId);
    setZoneTouched(true);
    setPin(null);
    setPinSource(null);
    setFormattedAddress('');
    setCoverageError('');
  };

  const pinBlocked = Boolean(pin) && Boolean(coverageError) && enforceCoverage;
  const canConfirm = !submitting && Boolean(selectedZoneId) && !pinBlocked;

  const handleConfirm = async () => {
    if (!canConfirm) return;
    setSubmitting(true);
    let nextPin = null;
    if (pin) {
      let addr = formattedAddress;
      if (!addr) addr = await reverseGeocode(pin.lat, pin.lng);
      nextPin = {
        lat: pin.lat, lng: pin.lng, formattedAddress: addr || '', source: pinSource || 'map',
      };
    }
    confirmLocation({ zoneId: selectedZoneId, pin: nextPin });
    setSubmitting(false);
  };

  const updateManual = (key) => (e) => {
    setManual((prev) => ({ ...prev, [key]: e.target.value }));
    setManualError('');
  };

  const canConfirmManual = !manualSaving && Boolean(selectedZoneId) && Boolean(manual.street.trim());

  const handleManualConfirm = async () => {
    if (!selectedZoneId) {
      setManualError(isAr ? 'اختر منطقة التوصيل أولاً.' : 'Choose a delivery area first.');
      return;
    }
    const street = manual.street.trim();
    if (!street) {
      setManualError(isAr ? 'من فضلك أدخل اسم الشارع.' : 'Please enter your street.');
      return;
    }
    setManualSaving(true);
    setManualError('');

    const zoneCity = (isAr ? selectedZone?.cityAr : selectedZone?.cityEn) || '';
    const zoneArea = (isAr ? selectedZone?.areaAr : selectedZone?.areaEn) || '';
    const city = manual.city.trim() || zoneCity;
    const area = manual.area.trim() || zoneArea || city;
    const governorate = manual.governorate.trim() || zoneCity;
    const building = manual.building.trim();
    const floor = manual.floor.trim();
    const address = {
      street,
      building,
      floor,
      city,
      area,
      governorate,
      locationSource: 'manual',
      formattedAddress: [street, building, area, city].filter(Boolean).join('، '),
    };

    if (user) {
      try {
        await authService.addAddress({
          label: 'Home',
          ...address,
          isDefault: true,
          deliveryZoneId: selectedZoneId,
          lang: language,
        });
        await refreshUser();
      } catch {
        // Non-fatal: the address is still kept in this browser for checkout.
      }
    }

    confirmLocation({ zoneId: selectedZoneId, pin: null, address });
    setManualSaving(false);
  };

  const openManual = () => {
    setManualError('');
    setMode('manual');
  };

  const backToArea = () => {
    setManualError('');
    setMode('area');
  };

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[130] flex items-end justify-center sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="location-gate-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px]"
        aria-label={isAr ? 'إغلاق' : 'Close'}
        onClick={handleClose}
        tabIndex={dismissible ? 0 : -1}
      />

      <div className="relative flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl ring-1 ring-slate-200 sm:rounded-3xl">
        <div className="relative shrink-0 bg-gradient-to-br from-primary-600 to-primary-800 px-5 py-4 text-white">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary-100">
                <MapPin className="h-3.5 w-3.5" aria-hidden />
                {isAr ? 'منطقة التوصيل' : 'Delivery area'}
              </p>
              <h2 id="location-gate-title" className="mt-1 text-lg font-bold">{title}</h2>
              {subtitle && <p className="mt-1 text-sm text-primary-100">{subtitle}</p>}
            </div>
            {dismissible && (
              <button
                type="button"
                onClick={handleClose}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 hover:bg-white/20"
                aria-label={isAr ? 'إغلاق' : 'Close'}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          {mode === 'area' && (
          <div className="space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={isAr ? 'ابحث عن منطقتك…' : 'Search your area…'}
              className="w-full rounded-xl border border-border bg-surface py-3 pe-3 ps-10 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
              autoComplete="off"
            />
          </div>

          <ul ref={listRef} className="max-h-52 space-y-1 overflow-y-auto rounded-xl border border-border p-1" role="listbox">
            {filteredZones.length === 0 ? (
              <li className="px-3 py-6 text-center text-sm text-text-muted">
                {isAr ? 'لا توجد مناطق مطابقة' : 'No matching areas'}
              </li>
            ) : (
              filteredZones.map((zone) => {
                const active = zone.id === selectedZoneId && !pinBlocked;
                return (
                  <li key={zone.id} role="option" aria-selected={active}>
                    <button
                      type="button"
                      onClick={() => pickZone(zone.id)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-start text-sm transition-colors ${
                        active ? 'bg-primary-50 font-semibold text-primary-800' : 'text-text hover:bg-surface'
                      }`}
                    >
                      <MapPin className={`h-4 w-4 shrink-0 ${active ? 'text-primary-600' : 'text-text-muted'}`} aria-hidden />
                      <span className="min-w-0 flex-1 truncate">{isAr ? zone.nameAr : zone.nameEn}</span>
                      {active && <Check className="h-4 w-4 shrink-0 text-primary-600" aria-hidden />}
                    </button>
                  </li>
                );
              })
            )}
          </ul>

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-medium text-text-muted">
              {isAr ? 'أو حدّد موقعك على الخريطة' : 'Or pin your spot on the map'}
            </p>
            <button
              type="button"
              onClick={handleUseMyLocation}
              disabled={locating}
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-primary-200 bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-700 hover:bg-primary-100 disabled:opacity-60"
            >
              <Crosshair className={`h-3.5 w-3.5 ${locating ? 'animate-spin' : ''}`} aria-hidden />
              {locating
                ? (isAr ? 'جارٍ تحديد موقعك…' : 'Locating…')
                : (isAr ? 'موقعي الحالي' : 'Use my location')}
            </button>
          </div>

          <OsmMapCanvas
            center={mapCenter}
            zoom={pin ? Math.max(mapZoom, 15) : mapZoom}
            position={pin}
            heightClass="h-52"
            onClick={(lat, lng) => applyPin(lat, lng, 'map')}
            onDragEnd={(lat, lng) => applyPin(lat, lng, 'map')}
          />

          {geoError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{geoError}</p>
          )}
          {coverageError && (
            <p className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>
                {coverageError}
                {' '}
                <span className="font-normal">
                  {isAr ? 'جرّب موقعاً أقرب أو اختر منطقة من القائمة.' : 'Try a nearby spot or pick an area from the list.'}
                </span>
              </span>
            </p>
          )}
          {resolving && (
            <p className="text-xs text-text-muted">{isAr ? 'جارٍ تحديد العنوان…' : 'Resolving address…'}</p>
          )}
          {formattedAddress && !resolving && !coverageError && (
            <p className="text-xs text-slate-600">
              {isAr ? 'العنوان على الخريطة: ' : 'Mapped address: '}{formattedAddress}
            </p>
          )}
          </div>
          )}

          {mode === 'manual' && (
          <div className="space-y-3">
            <p className="text-xs text-text-muted">
              {isAr
                ? 'أدخل تفاصيل عنوانك يدوياً — سيُحفظ لطلباتك وحسابك.'
                : 'Type your address details by hand — it is saved for your orders and account.'}
            </p>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-text">{isAr ? 'منطقة التوصيل' : 'Delivery area'}</span>
              <select
                value={selectedZoneId}
                onChange={(e) => { setSelectedZoneId(e.target.value); setZoneTouched(true); setManualError(''); }}
                className="w-full rounded-xl border border-border bg-surface px-3 py-3 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
              >
                <option value="" disabled>{isAr ? 'اختر المنطقة…' : 'Choose an area…'}</option>
                {locations.map((zone) => (
                  <option key={zone.id} value={zone.id}>{isAr ? zone.nameAr : zone.nameEn}</option>
                ))}
              </select>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-text">{isAr ? 'المحافظة' : 'Governorate'}</span>
                <input
                  type="text"
                  value={manual.governorate}
                  onChange={updateManual('governorate')}
                  className="w-full rounded-xl border border-border bg-surface px-3 py-3 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-text">{isAr ? 'المدينة' : 'City'}</span>
                <input
                  type="text"
                  value={manual.city}
                  onChange={updateManual('city')}
                  className="w-full rounded-xl border border-border bg-surface px-3 py-3 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-text">{isAr ? 'المنطقة / الحي' : 'District / neighbourhood'}</span>
              <input
                type="text"
                value={manual.area}
                onChange={updateManual('area')}
                className="w-full rounded-xl border border-border bg-surface px-3 py-3 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-text">
                {isAr ? 'الشارع' : 'Street'} <span className="text-red-500">*</span>
              </span>
              <input
                type="text"
                value={manual.street}
                onChange={updateManual('street')}
                placeholder={isAr ? 'اسم الشارع والعلامة المميزة' : 'Street name and a nearby landmark'}
                className="w-full rounded-xl border border-border bg-surface px-3 py-3 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-text">{isAr ? 'رقم المبنى' : 'Building'}</span>
                <input
                  type="text"
                  value={manual.building}
                  onChange={updateManual('building')}
                  className="w-full rounded-xl border border-border bg-surface px-3 py-3 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-text">{isAr ? 'الدور / الشقة' : 'Floor / flat'}</span>
                <input
                  type="text"
                  value={manual.floor}
                  onChange={updateManual('floor')}
                  className="w-full rounded-xl border border-border bg-surface px-3 py-3 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
                />
              </label>
            </div>

            {manualError && (
              <p className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>{manualError}</span>
              </p>
            )}
            {!user && (
              <p className="text-[11px] text-text-muted">
                {isAr
                  ? 'سجّل الدخول لحفظ هذا العنوان في حسابك بشكل دائم.'
                  : 'Sign in to keep this address on your account permanently.'}
              </p>
            )}
          </div>
          )}
        </div>

        <div className="shrink-0 space-y-2 border-t border-border bg-white p-4 safe-bottom">
          <div className="flex items-center gap-2 rounded-xl bg-surface px-3 py-2 text-sm">
            <MapPin className="h-4 w-4 shrink-0 text-primary-600" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-text-muted">
              {(() => {
                if (mode === 'manual') {
                  const typed = [manual.street.trim(), manual.area.trim(), manual.city.trim()]
                    .filter(Boolean).join('، ');
                  const zoneLabel = selectedZone ? (isAr ? selectedZone.nameAr : selectedZone.nameEn) : '';
                  return (
                    <>
                      {isAr ? 'التوصيل إلى: ' : 'Delivering to: '}
                      <span className="font-semibold text-text">
                        {typed || zoneLabel || (isAr ? 'عنوان يدوي' : 'Manual address')}
                      </span>
                    </>
                  );
                }
                if (pin && !pinBlocked) {
                  const pinnedLabel = formattedAddress?.trim()
                    || (resolving
                      ? (isAr ? 'جارٍ تحديد عنوان موقعك…' : 'Resolving your address…')
                      : (isAr ? 'موقعك المحدَّد على الخريطة' : 'Your pinned location'));
                  return (
                    <>
                      {isAr ? 'التوصيل إلى: ' : 'Delivering to: '}
                      <span className="font-semibold text-text">{pinnedLabel}</span>
                    </>
                  );
                }
                if (selectedZone && !pinBlocked) {
                  return (
                    <>
                      {isAr ? 'التوصيل إلى: ' : 'Delivering to: '}
                      <span className="font-semibold text-text">{isAr ? selectedZone.nameAr : selectedZone.nameEn}</span>
                    </>
                  );
                }
                return isAr ? 'لم تختر منطقة بعد' : 'No area selected yet';
              })()}
            </span>
          </div>
          <div className="flex gap-2">
            {mode === 'area' ? (
              <>
                <button
                  type="button"
                  onClick={openManual}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <PencilLine className="h-4 w-4" aria-hidden />
                  {isAr ? 'إدخال يدوي' : 'Enter manually'}
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={!canConfirm}
                  className="flex-[1.5] rounded-xl bg-primary-600 px-4 py-3 text-sm font-bold text-white shadow-md shadow-primary-600/25 hover:bg-primary-700 disabled:opacity-60"
                >
                  {submitting
                    ? (isAr ? 'جارٍ الحفظ…' : 'Saving…')
                    : (isAr ? 'تحديد الموقع' : 'Select location')}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={backToArea}
                  className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  {isAr ? 'رجوع' : 'Back'}
                </button>
                <button
                  type="button"
                  onClick={handleManualConfirm}
                  disabled={!canConfirmManual}
                  className="flex-[1.5] rounded-xl bg-primary-600 px-4 py-3 text-sm font-bold text-white shadow-md shadow-primary-600/25 hover:bg-primary-700 disabled:opacity-60"
                >
                  {manualSaving
                    ? (isAr ? 'جارٍ الحفظ…' : 'Saving…')
                    : (isAr ? 'حفظ العنوان' : 'Save address')}
                </button>
              </>
            )}
          </div>
          {dismissible && confirmed && (
            <button
              type="button"
              onClick={handleClose}
              className="w-full py-1 text-center text-xs font-medium text-text-muted hover:text-text"
            >
              {isAr ? 'المتابعة بدون تغيير' : 'Keep current area'}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
