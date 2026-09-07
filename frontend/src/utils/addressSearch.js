import { deliveryZoneService } from '../services/apiServices';
import { fetchOsmSuggestions } from './osmGeocode';
import { fetchPhotonSuggestions } from './photonGeocode';
import { rankAddressSuggestions } from './addressQuery';

const MIN_QUERY = 2;

function dedupeItems(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = item.placeId || `${item.mainText}|${item.secondaryText}|${item.lat}|${item.lng}`;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildBiasedQuery(trimmed, language, deliveryZone) {
  const zoneSuffix = deliveryZone
    ? (language === 'ar'
      ? `${deliveryZone.areaAr || ''} ${deliveryZone.cityAr || ''}`.trim()
      : `${deliveryZone.areaEn || ''} ${deliveryZone.cityEn || ''}`.trim())
    : '';
  const zoneInQuery = zoneSuffix && trimmed.toLowerCase().includes(zoneSuffix.toLowerCase().slice(0, 4));
  return zoneSuffix && !zoneInQuery ? `${trimmed}, ${zoneSuffix}, Egypt` : trimmed;
}

async function fetchServerSuggestions({ query, language, deliveryZone, zoneAnchor }) {
  const { data } = await deliveryZoneService.suggestPlaces({
    query,
    language,
    deliveryZoneId: deliveryZone?.id,
    biasLat: zoneAnchor?.lat,
    biasLng: zoneAnchor?.lng,
  });

  return {
    items: Array.isArray(data.data) ? data.data : [],
    source: data.source || 'server',
    mapsConfigured: data.mapsConfigured,
    googleError: data.googleError || null,
  };
}

async function fetchOpenMapSuggestions({ query, language, zoneAnchor }) {
  const [photonItems, osmItems] = await Promise.all([
    fetchPhotonSuggestions(query, { language, lat: zoneAnchor?.lat, lng: zoneAnchor?.lng }).catch(() => []),
    fetchOsmSuggestions(query, { language }).catch(() => []),
  ]);

  return dedupeItems([...photonItems, ...osmItems]);
}

/**
 * Address suggestions: backend (Google + OSM + Photon) plus client open-map fallbacks in parallel.
 */
export async function resolveAddressSuggestions({
  query,
  language,
  deliveryZone,
  zoneAnchor,
}) {
  const trimmed = String(query || '').trim();
  if (trimmed.length < MIN_QUERY) {
    return { items: [], source: 'none', usedFallback: false };
  }

  const biasedQuery = buildBiasedQuery(trimmed, language, deliveryZone);
  const lang = language === 'en' ? 'en' : 'ar';

  let serverMeta;

  const [serverResult, openMapItems] = await Promise.all([
    fetchServerSuggestions({
      query: biasedQuery,
      language: lang,
      deliveryZone,
      zoneAnchor,
    }).catch((err) => {
      if (err.response?.status === 429) {
        return { items: [], rateLimited: true };
      }
      return { items: [] };
    }),
    fetchOpenMapSuggestions({ query: biasedQuery, language: lang, zoneAnchor }),
  ]);

  if (serverResult.rateLimited) {
    const items = rankAddressSuggestions(openMapItems, trimmed);
    if (items.length) {
      return {
        items,
        source: 'photon',
        usedFallback: true,
        rateLimited: true,
        mapsConfigured: true,
        googleError: null,
      };
    }
    return { items: [], source: 'rate_limited', usedFallback: false, rateLimited: true };
  }

  serverMeta = {
    source: serverResult.source || 'server',
    mapsConfigured: serverResult.mapsConfigured,
    googleError: serverResult.googleError || null,
  };

  const merged = rankAddressSuggestions(
    dedupeItems([...(serverResult.items || []), ...openMapItems]),
    trimmed,
  );

  if (merged.length) {
    const usedFallback = serverMeta.source !== 'google'
      || ['osm', 'local', 'photon'].includes(serverMeta.source)
      || (serverResult.items?.length || 0) === 0;
    return {
      items: merged,
      source: serverResult.items?.length ? serverMeta.source : (openMapItems.length ? 'photon' : serverMeta.source),
      usedFallback,
      mapsConfigured: serverMeta.mapsConfigured,
      googleError: serverMeta.googleError,
    };
  }

  return {
    items: [],
    source: 'none',
    usedFallback: false,
    mapsConfigured: serverMeta.mapsConfigured,
    googleError: serverMeta.googleError,
  };
}

export { MIN_QUERY as ADDRESS_SEARCH_MIN_QUERY };
