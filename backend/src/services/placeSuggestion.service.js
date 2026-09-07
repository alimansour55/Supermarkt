import { getPlaceSuggestions } from './googleMaps.service.js';
import { getOsmSuggestions } from './osmGeocode.service.js';
import { getPhotonSuggestions } from './photonGeocode.service.js';
import { searchDeliveryZoneSuggestions } from './deliveryZone.service.js';

const CACHE_TTL_MS = 5 * 60 * 1000;
const EMPTY_CACHE_TTL_MS = 60 * 1000;
const GOOGLE_COOLDOWN_MS = 30 * 60 * 1000;

const cache = new Map();
let googleDisabledUntil = 0;

function cacheKey(query, language) {
  return `${language}:${query.trim().toLowerCase()}`;
}

function readCache(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry;
}

function writeCache(key, data, source, googleError = null) {
  const ttl = data.length ? CACHE_TTL_MS : EMPTY_CACHE_TTL_MS;
  cache.set(key, {
    data,
    source,
    googleError,
    expiresAt: Date.now() + ttl,
  });
  if (cache.size > 500) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
}

function isQuotaError(error) {
  const message = String(error?.message || error?.code || '').toLowerCase();
  return message.includes('quota exceeded')
    || message.includes('resource_exhausted')
    || message.includes('rate limit')
    || error?.code === 'QUOTA_EXCEEDED';
}

function isGoogleAvailable() {
  return Date.now() >= googleDisabledUntil;
}

function disableGoogleTemporarily() {
  googleDisabledUntil = Date.now() + GOOGLE_COOLDOWN_MS;
}

function dedupeSuggestions(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = [
      item.placeId,
      item.description?.trim().toLowerCase(),
      item.mainText?.trim().toLowerCase(),
    ].filter(Boolean).join('|');
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function mergeSuggestions(...groups) {
  return dedupeSuggestions(groups.flat().filter(Boolean));
}

function classifyGoogleError(error) {
  const message = String(error?.message || '').toLowerCase();
  const code = error?.code || '';
  if (code === 'QUOTA_EXCEEDED' || message.includes('quota')) return 'quota';
  if (code === 'MAPS_NOT_CONFIGURED') return 'not_configured';
  if (code === 'MAPS_REQUEST_DENIED' || message.includes('blocked') || message.includes('not authorized')) {
    return 'blocked';
  }
  return null;
}

/**
 * Multi-source address suggestions with cache, Google quota circuit-breaker,
 * and free OSM + delivery-zone fallbacks.
 */
export async function getAddressSuggestions(input, { language = 'ar', biasLat, biasLng } = {}) {
  const query = String(input || '').trim();
  if (query.length < 2) {
    return { data: [], source: 'none', googleError: null };
  }

  const key = cacheKey(query, language);
  const cached = readCache(key);
  if (cached) {
    return { data: cached.data, source: cached.source, googleError: cached.googleError || null };
  }

  const local = await searchDeliveryZoneSuggestions(query, { language });

  let google = [];
  let googleError = null;
  if (isGoogleAvailable()) {
    try {
      google = await getPlaceSuggestions(query, { language, biasLat, biasLng });
    } catch (error) {
      googleError = classifyGoogleError(error);
      if (isQuotaError(error)) {
        disableGoogleTemporarily();
        googleError = 'quota';
        console.warn('[placeSuggestion] Google quota exceeded — using OSM/local fallbacks for 30 min');
      } else if (error.code !== 'MAPS_NOT_CONFIGURED') {
        console.warn('[placeSuggestion] Google failed:', error.message);
      }
    }
  } else {
    googleError = 'quota';
  }

  if (google.length) {
    const data = mergeSuggestions(google, local);
    writeCache(key, data, 'google', null);
    return { data, source: 'google', googleError: null };
  }

  let osm = [];
  let photon = [];
  try {
    [osm, photon] = await Promise.all([
      getOsmSuggestions(query, { language }),
      getPhotonSuggestions(query, { language, lat: biasLat, lng: biasLng }),
    ]);
  } catch (error) {
    console.warn('[placeSuggestion] Open geocoder failed:', error.message);
  }

  const openMap = mergeSuggestions(photon, osm);
  const data = mergeSuggestions(openMap, local);
  const source = photon.length ? 'photon' : (osm.length ? 'osm' : (local.length ? 'local' : 'none'));
  writeCache(key, data, source, googleError);
  return { data, source, googleError };
}
