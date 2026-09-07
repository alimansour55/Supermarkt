import { formatAddressForGeocoding, structureGeocodePayload } from '../utils/addressGeo.js';

const GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';
const DIRECTIONS_URL = 'https://maps.googleapis.com/maps/api/directions/json';
const PLACES_AUTOCOMPLETE_URL = 'https://maps.googleapis.com/maps/api/place/autocomplete/json';
const PLACES_AUTOCOMPLETE_NEW_URL = 'https://places.googleapis.com/v1/places:autocomplete';
const PLACES_DETAILS_NEW_URL = 'https://places.googleapis.com/v1/places';

const EGYPT_LOCATION_BIAS = {
  circle: {
    center: { latitude: 30.0444, longitude: 31.2357 },
    radius: 120_000,
  },
};

function getApiKey() {
  return process.env.GOOGLE_MAPS_API_KEY?.trim() || '';
}

/**
 * Geocode a structured address or raw query string.
 * @returns {{ lat: number, lng: number, formattedAddress: string, placeId: string } | null}
 */
export async function geocodeAddress(input) {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn('[googleMaps] GOOGLE_MAPS_API_KEY is not set — skipping geocode');
    return null;
  }

  const address = typeof input === 'string' ? input.trim() : formatAddressForGeocoding(input);
  if (!address) return null;

  const params = new URLSearchParams({
    address,
    key: apiKey,
    region: 'eg',
    language: 'ar',
  });

  const response = await fetch(`${GEOCODE_URL}?${params}`);
  if (!response.ok) {
    throw new Error(`Geocoding request failed (${response.status})`);
  }

  const data = await response.json();
  if (data.status !== 'OK' || !data.results?.length) {
    return null;
  }

  const result = data.results[0];
  const { lat, lng } = result.geometry?.location || {};
  if (lat == null || lng == null) return null;

  const addressComponents = result.address_components || [];

  return structureGeocodePayload({
    lat,
    lng,
    formattedAddress: result.formatted_address || address,
    placeId: result.place_id || '',
    addressComponents,
  });
}

const LOCATION_TYPE_RANK = {
  ROOFTOP: 0,
  RANGE_INTERPOLATED: 1,
  GEOMETRIC_CENTER: 2,
  APPROXIMATE: 3,
};

function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

const RESULT_TYPE_RANK = {
  subpremise: 0,
  premise: 1,
  street_address: 2,
  establishment: 3,
  point_of_interest: 4,
  route: 5,
  neighborhood: 6,
  sublocality: 7,
  locality: 8,
};

function resultTypeRank(types = []) {
  let best = 9;
  for (const type of types) {
    const rank = RESULT_TYPE_RANK[type];
    if (rank != null && rank < best) best = rank;
  }
  return best;
}

function pickBestReverseResult(results, inputLat, inputLng) {
  if (!results?.length) return null;

  let best = results[0];
  let bestScore = Infinity;

  for (const row of results) {
    const rowLat = row.geometry?.location?.lat;
    const rowLng = row.geometry?.location?.lng;
    if (rowLat == null || rowLng == null) continue;

    const dist = haversineMeters(inputLat, inputLng, rowLat, rowLng);
    const typeRank = LOCATION_TYPE_RANK[row.geometry?.location_type] ?? 4;
    const addressTypeRank = resultTypeRank(row.types);
    const score = dist * 1.4 + typeRank * 35 + addressTypeRank * 18;

    if (score < bestScore) {
      bestScore = score;
      best = row;
    }
  }

  return best;
}

async function fetchReverseGeocode(lat, lng, language) {
  const apiKey = getApiKey();
  const params = new URLSearchParams({
    latlng: `${lat},${lng}`,
    key: apiKey,
    language,
    region: 'eg',
  });

  const response = await fetch(`${GEOCODE_URL}?${params}`);
  if (!response.ok) {
    throw new Error(`Reverse geocoding request failed (${response.status})`);
  }

  return response.json();
}

function mergeGeocodePayloads(primary, secondary) {
  if (!secondary) return primary;
  return structureGeocodePayload({
    ...primary,
    street: primary.street || secondary.street || '',
    building: primary.building || secondary.building || '',
    area: primary.area || secondary.area || '',
    city: primary.city || secondary.city || '',
    governorate: primary.governorate || secondary.governorate || '',
    formattedAddress: primary.formattedAddress || secondary.formattedAddress || '',
    placeId: primary.placeId || secondary.placeId || '',
  });
}

/**
 * Reverse geocode coordinates to a formatted address.
 * @returns {{ lat: number, lng: number, formattedAddress: string, placeId: string } | null}
 */
export async function reverseGeocode(lat, lng) {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn('[googleMaps] GOOGLE_MAPS_API_KEY is not set — skipping reverse geocode');
    return null;
  }

  const inputLat = Number(lat);
  const inputLng = Number(lng);
  if (!Number.isFinite(inputLat) || !Number.isFinite(inputLng)) {
    return null;
  }

  const [arData, enData] = await Promise.all([
    fetchReverseGeocode(inputLat, inputLng, 'ar').catch(() => ({ status: 'ERROR', results: [] })),
    fetchReverseGeocode(inputLat, inputLng, 'en').catch(() => ({ status: 'ERROR', results: [] })),
  ]);

  const arResults = arData.status === 'OK' ? arData.results || [] : [];
  const enResults = enData.status === 'OK' ? enData.results || [] : [];
  const mergedResults = [...arResults];
  const seenIds = new Set(arResults.map((row) => row.place_id).filter(Boolean));

  for (const row of enResults) {
    if (row.place_id && seenIds.has(row.place_id)) continue;
    mergedResults.push(row);
  }

  if (!mergedResults.length) return null;

  const result = pickBestReverseResult(mergedResults, inputLat, inputLng);
  if (!result) return null;

  const addressComponents = result.address_components || [];
  const primary = structureGeocodePayload({
    lat: inputLat,
    lng: inputLng,
    formattedAddress: result.formatted_address || '',
    placeId: result.place_id || '',
    addressComponents,
  });

  const enResult = pickBestReverseResult(enResults, inputLat, inputLng);
  if (!enResult || enResult.place_id === result.place_id) {
    return primary;
  }

  const secondary = structureGeocodePayload({
    lat: inputLat,
    lng: inputLng,
    formattedAddress: enResult.formatted_address || '',
    placeId: enResult.place_id || '',
    addressComponents: enResult.address_components || [],
  });

  return mergeGeocodePayloads(primary, secondary);
}

/** True when server-side Google Maps geocoding is configured. */
export function isGoogleMapsConfigured() {
  return Boolean(getApiKey());
}

/**
 * Address / place suggestions as the user types (Places Autocomplete).
 * Tries Places API (New) first, then legacy Autocomplete.
 * @returns {Array<{ description: string, placeId: string, mainText: string, secondaryText: string }>}
 */
function buildLocationBias(biasLat, biasLng) {
  if (biasLat != null && biasLng != null && !Number.isNaN(Number(biasLat)) && !Number.isNaN(Number(biasLng))) {
    return {
      circle: {
        center: { latitude: Number(biasLat), longitude: Number(biasLng) },
        radius: 25_000,
      },
    };
  }
  return EGYPT_LOCATION_BIAS;
}

export async function getPlaceSuggestions(input, { language = 'ar', biasLat, biasLng } = {}) {
  const apiKey = getApiKey();
  if (!apiKey) {
    const err = new Error('GOOGLE_MAPS_API_KEY is not configured on the server');
    err.code = 'MAPS_NOT_CONFIGURED';
    throw err;
  }

  const query = String(input || '').trim();
  if (query.length < 2) return [];

  try {
    const fromNew = await fetchNewPlaceSuggestions(query, apiKey, language, biasLat, biasLng);
    if (fromNew.length) return fromNew;
  } catch (error) {
    if (error.code === 'QUOTA_EXCEEDED' || error.code === 'MAPS_REQUEST_DENIED') throw error;
  }

  const fromLegacy = await fetchLegacyPlaceSuggestions(query, apiKey, language, biasLat, biasLng);
  if (fromLegacy.length) return fromLegacy;

  return [];
}

function isQuotaExceededMessage(message) {
  const text = String(message || '').toLowerCase();
  return text.includes('quota exceeded')
    || text.includes('resource_exhausted')
    || text.includes('rate limit');
}

async function fetchNewPlaceSuggestions(query, apiKey, language, biasLat, biasLng) {
  try {
    const response = await fetch(PLACES_AUTOCOMPLETE_NEW_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'suggestions.placePrediction.place,suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat',
      },
      body: JSON.stringify({
        input: query,
        includedRegionCodes: ['eg'],
        languageCode: language === 'en' ? 'en' : 'ar',
        locationBias: buildLocationBias(biasLat, biasLng),
      }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      const message = body.error?.message || `Places API error (${response.status})`;
      if (isQuotaExceededMessage(message)) {
        const err = new Error(message);
        err.code = 'QUOTA_EXCEEDED';
        throw err;
      }
      if (response.status === 403 && message.toLowerCase().includes('blocked')) {
        const err = new Error(
          'Places API (New) is not enabled for the backend API key — add it in Google Cloud Console → Credentials → API restrictions',
        );
        err.code = 'MAPS_REQUEST_DENIED';
        throw err;
      }
      console.warn('[googleMaps] Places API (New) autocomplete:', response.status, message);
      return [];
    }

    const data = await response.json();
    return (data.suggestions || [])
      .map((entry) => entry.placePrediction)
      .filter(Boolean)
      .map((prediction) => ({
        // Some Places API (New) responses provide "place" (resource name) instead of "placeId".
        description: prediction.text?.text || '',
        placeId: prediction.placeId || String(prediction.place || '').replace(/^places\//, ''),
        mainText: prediction.structuredFormat?.mainText?.text || prediction.text?.text || '',
        secondaryText: prediction.structuredFormat?.secondaryText?.text || '',
        source: 'google',
      }));
  } catch (error) {
    if (error.code === 'MAPS_REQUEST_DENIED' || error.code === 'QUOTA_EXCEEDED') throw error;
    console.warn('[googleMaps] Places API (New) autocomplete failed:', error.message);
    return [];
  }
}

async function fetchLegacyPlaceSuggestions(query, apiKey, language, biasLat, biasLng) {
  const bias = buildLocationBias(biasLat, biasLng);
  const center = bias.circle?.center;
  const params = new URLSearchParams({
    input: query,
    key: apiKey,
    components: 'country:eg',
    language,
    location: `${center?.latitude ?? 30.0444},${center?.longitude ?? 31.2357}`,
    radius: String(bias.circle?.radius ?? 120000),
    strictbounds: 'false',
  });

  const response = await fetch(`${PLACES_AUTOCOMPLETE_URL}?${params}`);
  if (!response.ok) {
    throw new Error(`Places autocomplete request failed (${response.status})`);
  }

  const data = await response.json();
  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    console.warn('[googleMaps] Legacy Places autocomplete status:', data.status, data.error_message);
    if (isQuotaExceededMessage(data.error_message)) {
      const err = new Error(data.error_message || 'Google Places quota exceeded');
      err.code = 'QUOTA_EXCEEDED';
      throw err;
    }
    if (data.status === 'REQUEST_DENIED') {
      const err = new Error(
        data.error_message
        || 'Google Places API is not enabled or billing is not active for this API key',
      );
      err.code = 'MAPS_REQUEST_DENIED';
      throw err;
    }
    return [];
  }

  return (data.predictions || []).map((prediction) => ({
    description: prediction.description || '',
    placeId: prediction.place_id || '',
    mainText: prediction.structured_formatting?.main_text || prediction.description || '',
    secondaryText: prediction.structured_formatting?.secondary_text || '',
    source: 'google',
  }));
}

/**
 * Resolve a Google place_id to coordinates and formatted address.
 * @returns {{ lat: number, lng: number, formattedAddress: string, placeId: string } | null}
 */
export async function geocodePlaceId(placeId) {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  const id = String(placeId || '').trim().replace(/^places\//, '');
  if (!id) return null;

  try {
    const fromNew = await fetchPlaceDetailsNew(id, apiKey);
    if (fromNew) return fromNew;
  } catch {
    // fall through to legacy geocode
  }

  const params = new URLSearchParams({
    place_id: id,
    key: apiKey,
    language: 'ar',
  });

  const response = await fetch(`${GEOCODE_URL}?${params}`);
  if (!response.ok) {
    throw new Error(`Place geocode request failed (${response.status})`);
  }

  const data = await response.json();
  if (data.status !== 'OK' || !data.results?.length) return null;

  const result = data.results[0];
  const { lat, lng } = result.geometry?.location || {};
  if (lat == null || lng == null) return null;

  return {
    lat,
    lng,
    formattedAddress: result.formatted_address || '',
    placeId: result.place_id || id,
    addressComponents: (result.address_components || []).map((c) => c.long_name),
  };
}

async function fetchPlaceDetailsNew(placeId, apiKey) {
  const response = await fetch(`${PLACES_DETAILS_NEW_URL}/${encodeURIComponent(placeId)}`, {
    headers: {
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'id,displayName,formattedAddress,location,addressComponents',
      'Accept-Language': 'ar',
    },
  });

  if (!response.ok) return null;

  const data = await response.json();
  const lat = data.location?.latitude;
  const lng = data.location?.longitude;
  if (lat == null || lng == null) return null;

  return {
    lat,
    lng,
    formattedAddress: data.formattedAddress || data.displayName?.text || '',
    placeId: data.id || placeId,
    addressComponents: (data.addressComponents || []).map((c) => c.longText || c.long_name || ''),
  };
}

/**
 * Driving directions between two coordinates.
 * @returns {{ etaSeconds: number, etaText: string, distanceText: string, polyline: string, path: Array<{lat,lng}> } | null}
 */
export async function getDirections({ originLat, originLng, destLat, destLng }) {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  if ([originLat, originLng, destLat, destLng].some((v) => v == null || Number.isNaN(Number(v)))) {
    return null;
  }

  const params = new URLSearchParams({
    origin: `${originLat},${originLng}`,
    destination: `${destLat},${destLng}`,
    key: apiKey,
    mode: 'driving',
    language: 'ar',
    region: 'eg',
  });

  const response = await fetch(`${DIRECTIONS_URL}?${params}`);
  if (!response.ok) {
    throw new Error(`Directions request failed (${response.status})`);
  }

  const data = await response.json();
  if (data.status !== 'OK' || !data.routes?.length) {
    return null;
  }

  const leg = data.routes[0].legs?.[0];
  const polyline = data.routes[0].overview_polyline?.points || '';

  const { decodePolyline } = await import('../utils/polyline.js');

  return {
    etaSeconds: leg?.duration?.value ?? null,
    etaText: leg?.duration?.text ?? '',
    distanceText: leg?.distance?.text ?? '',
    polyline,
    path: decodePolyline(polyline),
  };
}
