import { useCallback } from 'react';
import InteractiveGoogleMap from './InteractiveGoogleMap';
import AddressSearchInput from './AddressSearchInput';
import { deliveryZoneService } from '../../services/apiServices';
import { parseOsmSelection } from '../../utils/osmGeocode';
import { parseGeocodeResult, readGooglePlaceCoords } from '../../utils/parseGooglePlace';

const DEFAULT_CENTER = { lat: 30.0444, lng: 31.2357 };

export default function GoogleMapPicker({
  lat,
  lng,
  onChange,
  onGeocode,
  isAr = false,
  heightClass = 'h-72',
  suggestPlaces,
}) {
  const position = lat != null && lng != null
    ? { lat: Number(lat), lng: Number(lng) }
    : null;

  const center = position || DEFAULT_CENTER;
  const zoom = position ? 16 : 11;

  const applyGeocodeResult = useCallback((result, fallbackAddress = '') => {
    onChange?.({
      lat: result.lat,
      lng: result.lng,
      formattedAddress: result.formattedAddress,
      placeId: result.placeId,
      address: result.formattedAddress || fallbackAddress,
    });
  }, [onChange]);

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

  const handleDragEnd = useCallback(async (event) => {
    const nextLat = event.latLng?.lat?.();
    const nextLng = event.latLng?.lng?.();
    if (nextLat == null || nextLng == null) return;

    const base = { lat: nextLat, lng: nextLng };
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
      onChange?.(base);
    }
  }, [onChange, onGeocode]);

  const handleMapClick = useCallback(async (event) => {
    const nextLat = event.detail?.latLng?.lat;
    const nextLng = event.detail?.latLng?.lng;
    if (nextLat == null || nextLng == null) return;

    const base = { lat: nextLat, lng: nextLng };
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
      onChange?.(base);
    }
  }, [onChange, onGeocode]);

  return (
    <div className="space-y-3">
      <AddressSearchInput
        isAr={isAr}
        onSelect={handleSuggestionSelect}
        suggestPlaces={suggestPlaces}
      />

      <InteractiveGoogleMap
        center={center}
        zoom={zoom}
        position={position}
        onClick={handleMapClick}
        onDragEnd={handleDragEnd}
        isAr={isAr}
        heightClass={heightClass}
      />

      <p className="text-xs text-text-muted">
        {isAr
          ? 'ابحث عن العنوان واختر من القائمة، أو انقر على الخريطة أو اسحب الدبوس.'
          : 'Search and pick from suggestions, or click the map / drag the pin.'}
      </p>
    </div>
  );
}
