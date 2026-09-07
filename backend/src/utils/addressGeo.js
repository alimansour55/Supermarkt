/** Extract geo fields from a request body or address object. */
export function pickGeoFields(source = {}) {
  const result = {};

  if (source.lat != null && source.lat !== '') {
    const lat = Number(source.lat);
    if (!Number.isNaN(lat)) result.lat = lat;
  }
  if (source.lng != null && source.lng !== '') {
    const lng = Number(source.lng);
    if (!Number.isNaN(lng)) result.lng = lng;
  }
  if (source.formattedAddress != null) {
    result.formattedAddress = String(source.formattedAddress || '').trim();
  }
  if (source.placeId != null) {
    result.placeId = String(source.placeId || '').trim();
  }
  if (source.locationSource != null) {
    result.locationSource = String(source.locationSource || '').trim();
  }

  return result;
}

/** Build a single-line address string for geocoding from structured fields. */
export function formatAddressForGeocoding(address = {}) {
  return [
    address.street,
    address.building,
    address.floor,
    address.area,
    address.city,
    address.governorate,
    address.postalCode,
  ]
    .filter(Boolean)
    .join(', ');
}

function componentNames(components = []) {
  if (!Array.isArray(components)) return [];
  return components.map((c) => {
    if (typeof c === 'string') return c;
    return c.long_name || c.longText || c.short_name || '';
  }).filter(Boolean);
}

function pickGoogleComponent(components, type) {
  const row = components.find((c) => c?.types?.includes(type));
  return row?.long_name || row?.longText || '';
}

/** Normalize reverse-geocode payloads with structured address fields for clients. */
export function structureGeocodePayload(result = {}) {
  if (!result || result.lat == null || result.lng == null) return result;

  const rawComponents = result.addressComponents || [];
  const names = componentNames(rawComponents);
  const hasTypedComponents = rawComponents.some((c) => Array.isArray(c?.types));

  let street = result.street || '';
  let building = result.building || '';
  let area = result.area || '';
  let city = result.city || '';
  let governorate = result.governorate || '';

  if (hasTypedComponents) {
    const route = pickGoogleComponent(rawComponents, 'route');
    const streetNumber = pickGoogleComponent(rawComponents, 'street_number');
    street = street || [route, streetNumber].filter(Boolean).join(' ')
      || pickGoogleComponent(rawComponents, 'premise')
      || pickGoogleComponent(rawComponents, 'establishment')
      || pickGoogleComponent(rawComponents, 'neighborhood');
    building = building || streetNumber;
    area = area || pickGoogleComponent(rawComponents, 'administrative_area_level_3')
      || pickGoogleComponent(rawComponents, 'sublocality_level_1')
      || pickGoogleComponent(rawComponents, 'sublocality')
      || pickGoogleComponent(rawComponents, 'neighborhood')
      || pickGoogleComponent(rawComponents, 'administrative_area_level_2');
    city = city || pickGoogleComponent(rawComponents, 'locality')
      || pickGoogleComponent(rawComponents, 'administrative_area_level_1');
    governorate = governorate || pickGoogleComponent(rawComponents, 'administrative_area_level_1');
  }

  const parts = String(result.formattedAddress || '').split(/[,،]/).map((p) => p.trim()).filter(Boolean);
  street = street || parts[0] || '';
  area = area || parts[1] || '';
  city = city || parts[2] || '';
  governorate = governorate || parts[3] || '';

  if (!street && area && area !== city) {
    street = area;
  }
  if (!street && city) {
    street = city;
  }

  return {
    ...result,
    addressComponents: names.length ? names : rawComponents,
    street,
    building,
    area,
    city,
    governorate,
  };
}
