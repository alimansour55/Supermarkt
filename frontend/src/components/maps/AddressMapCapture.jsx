import { useCallback, useEffect, useState } from 'react';
import { deliveryZoneService } from '../../services/apiServices';
import { parseOsmSelection } from '../../utils/osmGeocode';
import { parsePhotonSelection } from '../../utils/photonGeocode';
import { parseGeocodeResult, parseGooglePlace, normalizeGpsAddress } from '../../utils/parseGooglePlace';
import { getGeolocationErrorMessage, getGeolocationProgressMessage, getGeolocationAccuracyWarning, useCurrentGeolocation } from '../../hooks/useCurrentGeolocation';
import Input from '../ui/Input';
import AddressSearchInput from './AddressSearchInput';
import { InteractiveMapCanvas } from './InteractiveGoogleMap';
import CurrentLocationButton from './CurrentLocationButton';

const DEFAULT_CENTER = { lat: 30.0444, lng: 31.2357 };

export default function AddressMapCapture({
  value,
  onChange,
  deliveryZone,
  isAr = false,
  showManualFields = true,
  enableMap = true,
}) {
  const [zoneWarning, setZoneWarning] = useState('');
  const [livePin, setLivePin] = useState(null);
  const [gpsAccuracy, setGpsAccuracy] = useState(null);
  const [gpsWarning, setGpsWarning] = useState('');
  const { locate, loading: locating, error: locateError, progress: locateProgress, setError: setLocateError, clearError: clearLocateError } = useCurrentGeolocation();

  useEffect(() => {
    if (value?.lat != null && value?.lng != null && !locating) {
      setLivePin({ lat: Number(value.lat), lng: Number(value.lng) });
    }
  }, [value?.lat, value?.lng, locating]);

  const position = livePin ?? (value?.lat != null && value?.lng != null
    ? { lat: Number(value.lat), lng: Number(value.lng) }
    : null);

  const center = position || DEFAULT_CENTER;
  const zoom = position
    ? (gpsAccuracy != null && gpsAccuracy > 350 ? 14 : gpsAccuracy != null && gpsAccuracy > 120 ? 15 : 16)
    : 11;

  const geocode = useCallback(async (payload) => {
    const { data } = await deliveryZoneService.geocode({ ...payload, language: isAr ? 'ar' : 'en' });
    return data.data;
  }, [isAr]);

  const applyPatch = useCallback((patch) => {
    onChange?.({ ...value, ...patch });
  }, [onChange, value]);

  const checkZone = useCallback(async (next) => {
    if (!deliveryZone?.id || next.lat == null || next.lng == null) {
      setZoneWarning('');
      return;
    }
    try {
      await deliveryZoneService.validateAddress({
        deliveryZoneId: deliveryZone.id,
        formattedAddress: next.formattedAddress,
        street: next.street,
        area: next.area,
        city: next.city,
        lat: next.lat,
        lng: next.lng,
      });
      setZoneWarning('');
    } catch (err) {
      setZoneWarning(
        err.response?.data?.message
        || (isAr
          ? 'الموقع قد يكون خارج منطقة التوصيل المختارة.'
          : 'Location may be outside the selected delivery area.'),
      );
    }
  }, [deliveryZone?.id, isAr]);

  const applyResolvedAddress = useCallback(async (next) => {
    onChange?.(next);
    await checkZone(next);
  }, [checkZone, onChange]);

  const handlePlaceSelect = useCallback(async (item) => {
    if (item.source === 'google' && item.placeId) {
      try {
        const { data } = await deliveryZoneService.resolvePlace({ placeId: item.placeId });
        const parsed = parseGeocodeResult(data.data, { deliveryZone, isAr, existing: value });
        const next = {
          ...value,
          ...parsed,
          street: parsed.street || item.mainText || parsed.formattedAddress || '',
          locationSource: 'search',
          gpsConfirmed: true,
          city: parsed.city || value?.city || (isAr ? deliveryZone?.cityAr : deliveryZone?.cityEn) || '',
          area: parsed.area || item.secondaryText || value?.area || (isAr ? deliveryZone?.areaAr : deliveryZone?.areaEn) || '',
          governorate: parsed.governorate || value?.governorate || deliveryZone?.cityEn || '',
        };
        await applyResolvedAddress(next);
        return;
      } catch {
        setZoneWarning(isAr ? 'تعذر تحديد العنوان المختار.' : 'Could not resolve the selected address.');
        return;
      }
    }

    if (item.lat != null && item.lng != null && ['osm', 'photon', 'local'].includes(item.source)) {
      const next = {
        ...value,
        lat: item.lat,
        lng: item.lng,
        formattedAddress: item.formattedAddress || item.description || '',
        placeId: item.placeId || '',
        street: item.mainText || '',
        area: item.secondaryText || value?.area || '',
        city: value?.city || (isAr ? deliveryZone?.cityAr : deliveryZone?.cityEn) || '',
        governorate: value?.governorate || deliveryZone?.cityEn || '',
        locationSource: 'search',
        gpsConfirmed: true,
      };
      await applyResolvedAddress(next);
      return;
    }

    if (item.deliveryZoneId || String(item.placeId || '').startsWith('zone:')) {
      try {
        const { data } = await deliveryZoneService.geocode({
          address: item.description || `${item.mainText}, ${item.secondaryText}`,
        });
        const parsed = parseGeocodeResult(data.data, { deliveryZone, isAr, existing: value });
        const next = {
          ...value,
          ...parsed,
          locationSource: 'search',
          gpsConfirmed: true,
          city: parsed.city || item.secondaryText || value?.city || (isAr ? deliveryZone?.cityAr : deliveryZone?.cityEn) || '',
          area: parsed.area || item.mainText || value?.area || (isAr ? deliveryZone?.areaAr : deliveryZone?.areaEn) || '',
          governorate: parsed.governorate || value?.governorate || deliveryZone?.cityEn || '',
        };
        await applyResolvedAddress(next);
        return;
      } catch {
        setZoneWarning(isAr ? 'تعذر تحديد المنطقة المختارة.' : 'Could not resolve the selected area.');
        return;
      }
    }

    if (item.source === 'photon' && item.lat != null && item.lng != null) {
      const parsed = parsePhotonSelection(item);
      if (parsed?.lat != null && parsed?.lng != null) {
        await applyResolvedAddress({ ...value, ...parsed, locationSource: 'search', gpsConfirmed: true });
        return;
      }
    }

    if (item.osmResult) {
      const parsed = parseOsmSelection(item);
      if (parsed?.lat != null && parsed?.lng != null) {
        await applyResolvedAddress({ ...value, ...parsed, locationSource: 'search', gpsConfirmed: true });
        return;
      }
    }

    if (item.googlePlace) {
      const parsed = parseGooglePlace(item.googlePlace);
      await applyResolvedAddress({
        ...value,
        ...parsed,
        locationSource: 'search',
        gpsConfirmed: true,
        city: parsed.city || value?.city || (isAr ? deliveryZone?.cityAr : deliveryZone?.cityEn) || '',
        area: parsed.area || value?.area || (isAr ? deliveryZone?.areaAr : deliveryZone?.areaEn) || '',
        governorate: parsed.governorate || value?.governorate || deliveryZone?.cityEn || '',
      });
      return;
    }

    try {
      if (item.placeId) {
        const { data } = await deliveryZoneService.resolvePlace({ placeId: item.placeId });
        const parsed = parseGeocodeResult(data.data, { deliveryZone, isAr, existing: value });
        await applyResolvedAddress({
          ...value,
          ...parsed,
          locationSource: 'search',
          gpsConfirmed: true,
        });
        return;
      }

      const { data } = await deliveryZoneService.geocode({ address: item.description || item.mainText });
      const parsed = parseGeocodeResult(data.data, { deliveryZone, isAr, existing: value });
      await applyResolvedAddress({
        ...value,
        ...parsed,
        locationSource: 'search',
        gpsConfirmed: true,
      });
    } catch {
      setZoneWarning(isAr ? 'تعذر تحديد العنوان المختار.' : 'Could not resolve the selected address.');
    }
  }, [applyResolvedAddress, deliveryZone, isAr, value]);

  const handleMapUpdate = useCallback(async (lat, lng, { fromGps = false } = {}) => {
    const pinLat = Number(lat);
    const pinLng = Number(lng);
    setLivePin({ lat: pinLat, lng: pinLng });

    if (!fromGps) {
      setGpsAccuracy(null);
      setGpsWarning('');
    }

    const pinOnly = {
      lat: pinLat,
      lng: pinLng,
      building: value?.building || '',
      floor: value?.floor || '',
      locationSource: fromGps ? 'gps' : 'map',
      gpsConfirmed: fromGps,
    };

    onChange?.({
      ...value,
      ...pinOnly,
      street: fromGps ? (value?.street || '') : value?.street,
    });

    try {
      const result = await geocode({ lat: pinLat, lng: pinLng });
      const parsed = normalizeGpsAddress(parseGeocodeResult(result, {
        isAr,
        keepPinCoords: true,
        existing: {
          lat: pinLat,
          lng: pinLng,
          building: value?.building || '',
          floor: value?.floor || '',
          locationSource: fromGps ? 'gps' : 'map',
        },
      }));

      await applyResolvedAddress({
        ...parsed,
        lat: pinLat,
        lng: pinLng,
        building: value?.building || parsed.building || '',
        floor: value?.floor || '',
        locationSource: fromGps ? 'gps' : 'map',
        gpsConfirmed: true,
      });
    } catch {
      await applyResolvedAddress({
        lat: pinLat,
        lng: pinLng,
        street: value?.street || '',
        building: value?.building || '',
        floor: value?.floor || '',
        area: value?.area || '',
        city: value?.city || '',
        governorate: value?.governorate || '',
        formattedAddress: value?.formattedAddress || '',
        placeId: value?.placeId || '',
        locationSource: fromGps ? 'gps' : 'map',
        gpsConfirmed: true,
      });
      if (fromGps) {
        setZoneWarning(isAr ? 'تم تحديد موقعك على الخريطة.' : 'Your location is pinned on the map.');
      }
    }
  }, [applyResolvedAddress, geocode, isAr, onChange, value]);

  const handleUseCurrentLocation = useCallback(async () => {
    clearLocateError();
    setZoneWarning('');
    setGpsWarning('');

    try {
      const coords = await locate({
        onProgress: (next) => {
          if (next?.lat != null && next?.lng != null) {
            // Show the live moving pin while GPS/network location is refining.
            setLivePin({ lat: Number(next.lat), lng: Number(next.lng) });
          }
        },
      });
      setGpsAccuracy(coords.accuracy ?? null);
      setGpsWarning(getGeolocationAccuracyWarning(coords, isAr));
      setLivePin({ lat: coords.lat, lng: coords.lng });
      onChange?.({
        ...value,
        lat: coords.lat,
        lng: coords.lng,
        locationSource: 'gps',
        gpsConfirmed: true,
      });
      void handleMapUpdate(coords.lat, coords.lng, { fromGps: true });
    } catch (err) {
      setGpsAccuracy(null);
      setGpsWarning('');
      setLivePin(
        value?.lat != null && value?.locationSource !== 'gps'
          ? { lat: Number(value.lat), lng: Number(value.lng) }
          : null,
      );
      // Keep any manually selected pin/address instead of wiping user input when GPS fails.
      onChange?.({
        ...value,
        locationSource: value?.locationSource || '',
        gpsConfirmed: Boolean(value?.gpsConfirmed),
      });
      setLocateError(getGeolocationErrorMessage(err, isAr));
    }
  }, [clearLocateError, handleMapUpdate, isAr, locate, onChange, setLocateError, value]);

  useEffect(() => {
    if (value?.lat != null && value?.lng != null && deliveryZone?.id) {
      checkZone(value);
    }
  }, [deliveryZone?.id]);

  if (!enableMap) {
    return (
      <div className="space-y-4">
        {showManualFields && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Input
                label={isAr ? 'الشارع' : 'Street'}
                value={value?.street || ''}
                onChange={(e) => applyPatch({ street: e.target.value })}
                required
                placeholder={isAr ? 'اسم الشارع' : 'Street name'}
              />
            </div>
            <Input
              label={isAr ? 'رقم العمارة' : 'Building'}
              value={value?.building || ''}
              onChange={(e) => applyPatch({ building: e.target.value })}
            />
            <Input
              label={isAr ? 'الدور / الشقة' : 'Floor / Apt'}
              value={value?.floor || ''}
              onChange={(e) => applyPatch({ floor: e.target.value })}
            />
          </div>
        )}
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-text-muted">
          {isAr
            ? 'التوصيل بالعنوان النصي فقط — تحديد الموقع على الخريطة غير مفعّل في هذا المتجر.'
            : 'Text address delivery only — map pinning is disabled for this store.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <CurrentLocationButton
        isAr={isAr}
        loading={locating}
        statusText={locating ? getGeolocationProgressMessage(locateProgress, isAr) : ''}
        onClick={handleUseCurrentLocation}
      />
      {locateError && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{locateError}</p>
      )}
      {gpsWarning && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{gpsWarning}</p>
      )}

      <div className="relative">
        <div className="absolute inset-0 flex items-center" aria-hidden>
          <div className="w-full border-t border-slate-200" />
        </div>
        <div className="relative flex justify-center text-xs uppercase tracking-wide text-text-muted">
          <span className="bg-white px-2">{isAr ? 'أو' : 'or'}</span>
        </div>
      </div>

      <AddressSearchInput
        isAr={isAr}
        deliveryZone={deliveryZone}
        zoneAnchor={position ? { lat: position.lat, lng: position.lng } : null}
        onSelect={handlePlaceSelect}
      />

      {showManualFields && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Input
              id="checkout-street-input"
              label={isAr ? 'الشارع' : 'Street'}
              value={value?.street || ''}
              onChange={(e) => applyPatch({ street: e.target.value })}
              required
              placeholder={isAr ? 'اسم الشارع' : 'Street name'}
            />
          </div>
          <Input
            label={isAr ? 'رقم العمارة' : 'Building'}
            value={value?.building || ''}
            onChange={(e) => applyPatch({ building: e.target.value })}
          />
          <Input
            label={isAr ? 'الدور / الشقة' : 'Floor / Apt'}
            value={value?.floor || ''}
            onChange={(e) => applyPatch({ floor: e.target.value })}
          />
        </div>
      )}

      <InteractiveMapCanvas
        center={center}
        zoom={zoom}
        position={position}
        accuracyMeters={gpsAccuracy}
        isAr={isAr}
        heightClass="h-64 sm:h-72"
        onClick={(event) => {
          const lat = event.detail?.latLng?.lat;
          const lng = event.detail?.latLng?.lng;
          if (lat != null && lng != null) handleMapUpdate(lat, lng);
        }}
        onDragEnd={(event) => {
          const lat = event.latLng?.lat?.();
          const lng = event.latLng?.lng?.();
          if (lat != null && lng != null) handleMapUpdate(lat, lng);
        }}
      />

      <p className="text-xs text-text-muted">
        {isAr
          ? 'استخدم موقعك الحالي، أو ابحث واختر من الاقتراحات، أو حرّك الدبوس على الخريطة.'
          : 'Use current location, search and pick a suggestion, or drag the pin on the map.'}
      </p>

      {value?.gpsConfirmed && value?.locationSource === 'gps' && value?.lat != null && !gpsWarning && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
          {isAr
            ? '✓ تم تحديد موقعك الحالي على الخريطة. سيظهر للإدارة وللمندوب.'
            : '✓ Your current location is on the map for staff and your driver.'}
        </p>
      )}

      {value?.locationSource === 'gps' && value?.lat != null && value?.lng != null && (
        <p className="rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-900">
          {isAr
            ? `موقعك الحالي المباشر: ${Number(value.lat).toFixed(5)}, ${Number(value.lng).toFixed(5)}`
            : `Your current live location: ${Number(value.lat).toFixed(5)}, ${Number(value.lng).toFixed(5)}`}
          {Number.isFinite(gpsAccuracy) ? ` (±${Math.round(gpsAccuracy)}m)` : ''}
        </p>
      )}

      {value?.formattedAddress && value?.lat != null && (
        <p className="text-xs text-slate-600">
          {isAr ? 'العنوان على الخريطة:' : 'Mapped address:'}{' '}
          {value.formattedAddress}
        </p>
      )}

      {zoneWarning && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{zoneWarning}</p>
      )}

      {deliveryZone && (
        <p className="text-xs text-text-muted">
          {isAr ? 'منطقة التوصيل:' : 'Delivery area:'}{' '}
          <span className="font-medium text-text">
            {isAr ? deliveryZone.nameAr : deliveryZone.nameEn}
          </span>
        </p>
      )}
    </div>
  );
}
