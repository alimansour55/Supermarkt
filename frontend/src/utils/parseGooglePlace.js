/** Parse Google Places result (legacy or Places API New) into structured address fields. */
export function parseGooglePlace(place) {
  if (!place) {
    return {
      street: '',
      building: '',
      floor: '',
      area: '',
      city: '',
      governorate: '',
      lat: null,
      lng: null,
      formattedAddress: '',
      placeId: '',
    };
  }

  // Places API (New) — Place class from PlaceAutocompleteElement
  if (place.location || place.formattedAddress || place.id) {
    const components = place.addressComponents || [];
    const get = (type) => {
      const comp = components.find((c) => c.types?.includes(type));
      return comp?.longText || comp?.long_name || '';
    };
    const streetNumber = get('street_number');
    const route = get('route');
    const lat = typeof place.location?.lat === 'function'
      ? place.location.lat()
      : place.location?.lat;
    const lng = typeof place.location?.lng === 'function'
      ? place.location.lng()
      : place.location?.lng;
    const displayName = typeof place.displayName === 'string'
      ? place.displayName
      : place.displayName?.text || '';

    return {
      street: [route, streetNumber].filter(Boolean).join(' ') || displayName || '',
      building: streetNumber,
      floor: '',
      area: get('sublocality') || get('neighborhood') || get('administrative_area_level_2'),
      city: get('locality') || get('administrative_area_level_1'),
      governorate: get('administrative_area_level_1'),
      lat: lat ?? null,
      lng: lng ?? null,
      formattedAddress: place.formattedAddress || '',
      placeId: place.id || '',
    };
  }

  // Legacy Places Autocomplete
  const components = place?.address_components || [];
  const get = (type) => components.find((c) => c.types?.includes(type))?.long_name || '';
  const streetNumber = get('street_number');
  const route = get('route');

  const lat = typeof place?.geometry?.location?.lat === 'function'
    ? place.geometry.location.lat()
    : place?.geometry?.location?.lat;
  const lng = typeof place?.geometry?.location?.lng === 'function'
    ? place.geometry.location.lng()
    : place?.geometry?.location?.lng;

  return {
    street: [route, streetNumber].filter(Boolean).join(' ') || place?.name || '',
    building: streetNumber,
    floor: '',
    area: get('sublocality') || get('neighborhood') || get('administrative_area_level_2'),
    city: get('locality') || get('administrative_area_level_1'),
    governorate: get('administrative_area_level_1'),
    lat: lat ?? null,
    lng: lng ?? null,
    formattedAddress: place?.formatted_address || '',
    placeId: place?.place_id || '',
  };
}

/** Extract lat/lng from legacy or new Google Place object. */
export function readGooglePlaceCoords(place) {
  if (!place) return { lat: null, lng: null };

  if (place.location) {
    const lat = typeof place.location.lat === 'function' ? place.location.lat() : place.location.lat;
    const lng = typeof place.location.lng === 'function' ? place.location.lng() : place.location.lng;
    return { lat: lat ?? null, lng: lng ?? null };
  }

  const legacy = place.geometry?.location;
  if (!legacy) return { lat: null, lng: null };
  return {
    lat: typeof legacy.lat === 'function' ? legacy.lat() : legacy.lat,
    lng: typeof legacy.lng === 'function' ? legacy.lng() : legacy.lng,
  };
}

export const emptyAddressCapture = () => ({
  street: '',
  building: '',
  floor: '',
  city: '',
  governorate: '',
  area: '',
  postalCode: '',
  lat: null,
  lng: null,
  formattedAddress: '',
  placeId: '',
  locationSource: '',
  gpsConfirmed: false,
});

export function hasAddressPin(address) {
  return address?.lat != null && address?.lng != null;
}

const COUNTRY_TOKENS = new Set(['مصر', 'egypt', 'جمهورية مصر العربية', 'arab republic of egypt']);

function splitFormattedAddress(formatted) {
  return String(formatted || '')
    .split(/[,،]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !COUNTRY_TOKENS.has(part.toLowerCase()));
}

/** Fill missing street/area from reverse-geocode data (common in Egypt). */
export function normalizeGpsAddress(parsed = {}) {
  const result = { ...parsed };
  const parts = splitFormattedAddress(result.formattedAddress);
  const city = String(result.city || '').trim();
  const area = String(result.area || '').trim();
  let street = String(result.street || '').trim();

  if (!street && parts.length) {
    street = parts.find((part) => part !== city && part !== area) || parts[0] || '';
  }

  if (!street && area && area !== city) {
    street = area;
  }

  if (!street && city) {
    street = city;
  }

  if (!result.area && parts.length > 1) {
    result.area = parts.find((part) => part !== street && part !== city) || parts[1] || area;
  }

  if (!result.city && parts.length) {
    result.city = parts.find((part) => part !== street) || city || parts[parts.length - 1] || '';
  }

  if (!result.formattedAddress && (street || result.area || result.city)) {
    result.formattedAddress = [street, result.area, result.city].filter(Boolean).join('، ');
  }

  result.street = street;
  return result;
}

export function isGpsAddressResolvable(parsed = {}) {
  const normalized = normalizeGpsAddress(parsed);
  return Boolean(
    normalized.street?.trim()
    || normalized.formattedAddress?.trim()
    || normalized.area?.trim()
    || normalized.city?.trim(),
  );
}

/** Build address fields from backend geocode / reverse-geocode result. */
export function parseGeocodeResult(result, { deliveryZone, isAr, existing = {}, keepPinCoords = false } = {}) {
  if (!result) return existing;

  const formatted = result.formattedAddress || '';
  const parts = splitFormattedAddress(formatted);

  const pinLat = keepPinCoords && existing.lat != null
    ? Number(existing.lat)
    : (result.lat ?? existing.lat ?? null);
  const pinLng = keepPinCoords && existing.lng != null
    ? Number(existing.lng)
    : (result.lng ?? existing.lng ?? null);

  if (keepPinCoords) {
    const parsed = {
      lat: pinLat,
      lng: pinLng,
      formattedAddress: formatted,
      placeId: result.placeId || '',
      street: result.street || parts[0] || '',
      building: result.building || existing.building || '',
      floor: existing.floor || '',
      area: result.area || parts[1] || '',
      city: result.city || parts[2] || '',
      governorate: result.governorate || '',
      locationSource: existing.locationSource || 'gps',
      gpsConfirmed: false,
    };
    return normalizeGpsAddress(parsed);
  }

  const zoneCity = isAr ? deliveryZone?.cityAr : deliveryZone?.cityEn;
  const zoneArea = isAr ? deliveryZone?.areaAr : deliveryZone?.areaEn;

  const parsed = {
    ...existing,
    lat: pinLat,
    lng: pinLng,
    formattedAddress: formatted,
    placeId: result.placeId || existing.placeId || '',
    street: result.street || existing.street || parts[0] || '',
    building: result.building || existing.building || '',
    floor: existing.floor || '',
    area: result.area || existing.area || parts[1] || zoneArea || '',
    city: result.city || existing.city || parts[2] || zoneCity || '',
    governorate: result.governorate || existing.governorate || deliveryZone?.cityEn || '',
    locationSource: existing.locationSource || 'gps',
  };

  return normalizeGpsAddress(parsed);
}
