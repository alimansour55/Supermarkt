import { useCallback, useState } from 'react';
import { X } from 'lucide-react';
import InteractiveGoogleMap from './InteractiveGoogleMap';
import AddressSearchInput from './AddressSearchInput';
import CurrentLocationButton from './CurrentLocationButton';
import {
  getGeolocationAccuracyWarning,
  getGeolocationErrorMessage,
  getGeolocationProgressMessage,
  useCurrentGeolocation,
} from '../../hooks/useCurrentGeolocation';
import { deliveryZoneService } from '../../services/apiServices';
import { parseOsmSelection } from '../../utils/osmGeocode';
import { parseGeocodeResult, readGooglePlaceCoords } from '../../utils/parseGooglePlace';
import { fitZoomForRadius } from '../../utils/geoCircle';
import GeoErrorNotice from '../location/GeoErrorNotice';

const DEFAULT_CENTER = { lat: 30.0444, lng: 31.2357 };

export default function GoogleMapPicker({
  lat,
  lng,
  onChange,
  onGeocode,
  isAr = false,
  heightClass = 'h-72',
  suggestPlaces,
  showCurrentLocation = true,
  radiusMeters = null,
  onRadiusChange = null,
  radiusMinMeters = 300,
  radiusMaxMeters = 50000,
}) {
  const {
    locate,
    loading: locating,
    error: locateError,
    progress: locateProgress,
    setError: setLocateError,
    clearError: clearLocateError,
  } = useCurrentGeolocation();

  const [livePin, setLivePin] = useState(null);
  const [gpsAccuracy, setGpsAccuracy] = useState(null);
  const [gpsWarning, setGpsWarning] = useState('');
  const [locateErrorCode, setLocateErrorCode] = useState(null);

  const savedPosition = lat != null && lng != null
    ? { lat: Number(lat), lng: Number(lng) }
    : null;
  const position = (locating && livePin) ? livePin : (savedPosition || livePin);

  const center = position || DEFAULT_CENTER;
  const zoom = position
    ? (onRadiusChange
      ? fitZoomForRadius(radiusMeters, position.lat)
      : (gpsAccuracy != null && gpsAccuracy > 350 ? 14 : gpsAccuracy != null && gpsAccuracy > 120 ? 15 : 16))
    : 11;

  const applyGeocodeResult = useCallback((result, fallbackAddress = '') => {
    onChange?.({
      lat: result.lat,
      lng: result.lng,
      formattedAddress: result.formattedAddress,
      placeId: result.placeId,
      address: result.formattedAddress || fallbackAddress,
    });
  }, [onChange]);

  const resolveCoords = useCallback(async (nextLat, nextLng, { fromGps = false } = {}) => {
    const base = { lat: nextLat, lng: nextLng };
    if (!fromGps) {
      setGpsAccuracy(null);
      setGpsWarning('');
    }
    if (!onGeocode) {
      onChange?.(base);
      return;
    }
    try {
      const result = await onGeocode({ lat: nextLat, lng: nextLng });
      onChange?.({
        ...base,
        formattedAddress: result.formattedAddress,
        placeId: result.placeId,
        address: result.formattedAddress || '',
      });
    } catch {
      // Coordinates still usable — admin can type the address by hand.
      onChange?.(base);
    }
  }, [onChange, onGeocode]);

  const handleSuggestionSelect = useCallback(async (item) => {
    if ((item.lat != null && item.lng != null) || item.osmResult) {
      if (item.lat != null && item.lng != null) {
        applyGeocodeResult({
          lat: item.lat,
          lng: item.lng,
          formattedAddress: item.formattedAddress || item.description || '',
          placeId: item.placeId || '',
        }, item.formattedAddress || item.description || '');
        return;
      }
      const parsed = parseOsmSelection(item);
      if (parsed?.lat != null && parsed?.lng != null) {
        applyGeocodeResult({
          lat: parsed.lat,
          lng: parsed.lng,
          formattedAddress: parsed.formattedAddress,
          placeId: parsed.placeId,
        }, parsed.formattedAddress || item.description || '');
        return;
      }
    }

    if (item.googlePlace) {
      const place = item.googlePlace;
      const coords = readGooglePlaceCoords(place);
      applyGeocodeResult({
        lat: coords.lat,
        lng: coords.lng,
        formattedAddress: place.formattedAddress || place.formatted_address || '',
        placeId: place.id || place.place_id || '',
      }, place.formattedAddress || place.formatted_address || item.description || '');
      return;
    }

    if (item.placeId) {
      try {
        const { data } = await deliveryZoneService.resolvePlace({ placeId: item.placeId });
        const parsed = parseGeocodeResult(data.data);
        applyGeocodeResult({
          lat: parsed.lat,
          lng: parsed.lng,
          formattedAddress: parsed.formattedAddress,
          placeId: parsed.placeId,
        }, parsed.formattedAddress || item.description || '');
        return;
      } catch {
        // fall through to server geocode
      }
    }

    if (!onGeocode) return;
    try {
      const result = await onGeocode(
        item.placeId
          ? { placeId: item.placeId }
          : { address: item.description || item.mainText },
      );
      applyGeocodeResult(result, item.description || item.mainText || '');
    } catch {
      // Parent may show toast; map still usable via click/drag
    }
  }, [applyGeocodeResult, onGeocode]);

  const handleDragEnd = useCallback((event) => {
    const nextLat = event.latLng?.lat?.();
    const nextLng = event.latLng?.lng?.();
    if (nextLat == null || nextLng == null) return;
    setLivePin({ lat: nextLat, lng: nextLng });
    void resolveCoords(nextLat, nextLng);
  }, [resolveCoords]);

  const handleMapClick = useCallback((event) => {
    const nextLat = event.detail?.latLng?.lat;
    const nextLng = event.detail?.latLng?.lng;
    if (nextLat == null || nextLng == null) return;
    setLivePin({ lat: nextLat, lng: nextLng });
    void resolveCoords(nextLat, nextLng);
  }, [resolveCoords]);

  const handleUseCurrentLocation = useCallback(async () => {
    clearLocateError();
    setLocateErrorCode(null);
    setGpsWarning('');
    try {
      const coords = await locate({
        onProgress: (next) => {
          if (next?.lat != null && next?.lng != null) {
            setLivePin({ lat: Number(next.lat), lng: Number(next.lng) });
          }
        },
      });
      setGpsAccuracy(coords.accuracy ?? null);
      setGpsWarning(getGeolocationAccuracyWarning(coords, isAr));
      setLivePin({ lat: coords.lat, lng: coords.lng });
      await resolveCoords(coords.lat, coords.lng, { fromGps: true });
    } catch (err) {
      setGpsAccuracy(null);
      setLocateError(getGeolocationErrorMessage(err, isAr));
      setLocateErrorCode(err?.code ?? err?.name ?? null);
    }
  }, [clearLocateError, isAr, locate, resolveCoords, setLocateError]);

  const clearPin = useCallback(() => {
    setLivePin(null);
    setGpsAccuracy(null);
    setGpsWarning('');
    clearLocateError();
    setLocateErrorCode(null);
    onChange?.({ lat: null, lng: null, formattedAddress: '', placeId: '' });
  }, [clearLocateError, onChange]);

  return (
    <div className="space-y-3">
      {showCurrentLocation && (
        <>
          <CurrentLocationButton
            isAr={isAr}
            loading={locating}
            statusText={locating ? getGeolocationProgressMessage(locateProgress, isAr) : ''}
            onClick={handleUseCurrentLocation}
          />
          <GeoErrorNotice
            message={locateError}
            code={locateErrorCode}
            isAr={isAr}
            onRetry={handleUseCurrentLocation}
            retrying={locating}
          />
          {gpsWarning && !locateError && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{gpsWarning}</p>
          )}

          <div className="relative py-1">
            <div className="absolute inset-0 flex items-center" aria-hidden>
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase tracking-wide text-text-muted">
              <span className="bg-white px-2">{isAr ? 'أو' : 'or'}</span>
            </div>
          </div>
        </>
      )}

      <AddressSearchInput
        isAr={isAr}
        onSelect={handleSuggestionSelect}
        suggestPlaces={suggestPlaces}
      />

      <div className="relative">
        <InteractiveGoogleMap
          center={center}
          zoom={zoom}
          position={position}
          accuracyMeters={gpsAccuracy}
          radiusMeters={onRadiusChange ? radiusMeters : null}
          onRadiusChange={onRadiusChange}
          radiusMinMeters={radiusMinMeters}
          radiusMaxMeters={radiusMaxMeters}
          onClick={handleMapClick}
          onDragEnd={handleDragEnd}
          isAr={isAr}
          heightClass={heightClass}
        />
        {onRadiusChange && position && (
          <div className="pointer-events-none absolute start-3 top-3 rounded-full bg-white/95 px-3 py-1.5 text-xs font-bold text-primary-700 shadow-md ring-1 ring-primary-100">
            {isAr
              ? `نطاق التغطية: ${(Number(radiusMeters) / 1000).toFixed(1)} كم`
              : `Coverage radius: ${(Number(radiusMeters) / 1000).toFixed(1)} km`}
          </div>
        )}
      </div>

      <div className="flex items-start justify-between gap-3">
        <p className="text-xs text-text-muted">
          {onRadiusChange
            ? (isAr
              ? 'اسحب الدبوس لنقل مركز المنطقة، أو اسحب المقبض الأزرق على حافة الدائرة لتوسيع أو تصغير نطاق التغطية.'
              : 'Drag the pin to move the zone center, or drag the blue handle on the circle\'s edge to widen or shrink the coverage radius.')
            : (isAr
              ? 'استخدم موقعك الحالي، أو ابحث عن العنوان واختر من القائمة، أو انقر على الخريطة أو اسحب الدبوس.'
              : 'Use your current location, search and pick a suggestion, or click the map / drag the pin.')}
        </p>
        {position && (
          <button
            type="button"
            onClick={clearPin}
            className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-text-muted transition hover:bg-red-50 hover:text-red-700"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
            {isAr ? 'مسح التحديد' : 'Clear pin'}
          </button>
        )}
      </div>
    </div>
  );
}
