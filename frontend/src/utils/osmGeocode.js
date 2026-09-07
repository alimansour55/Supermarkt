import { buildAddressSearchVariants, rankAddressSuggestions } from './addressQuery';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const EGYPT_VIEWBOX = '24.698,31.668,36.894,22.0';

function mapOsmRow(row) {
    const address = row.address || {};
    const main = row.name
      || address.road
      || address.neighbourhood
      || address.suburb
      || address.city
      || row.display_name?.split(',')[0]
      || '';
    const secondaryParts = [
      address.suburb || address.neighbourhood,
      address.city || address.town || address.village,
      address.state,
    ].filter(Boolean);

    return {
      description: row.display_name || main,
      placeId: `osm:${row.osm_type}:${row.osm_id}`,
      mainText: main,
      secondaryText: [...new Set(secondaryParts)].join('، '),
      lat: Number(row.lat),
      lng: Number(row.lon),
      formattedAddress: row.display_name || '',
      source: 'osm',
      osmResult: row,
    };
}

async function fetchOsmVariant(searchQuery, language) {
  const params = new URLSearchParams({
    q: searchQuery,
    format: 'json',
    addressdetails: '1',
    limit: '8',
    countrycodes: 'eg',
    viewbox: EGYPT_VIEWBOX,
    bounded: '0',
    'accept-language': language === 'en' ? 'en' : 'ar,en',
  });

  const response = await fetch(`${NOMINATIM_URL}?${params}`, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'MarketPlusSupermarket/1.0 (address search; contact: support@marketplus.com)',
    },
  });

  if (!response.ok) {
    throw new Error(`OSM search failed (${response.status})`);
  }

  const rows = await response.json();
  if (!Array.isArray(rows)) return [];
  return rows.map(mapOsmRow);
}

/**
 * Free address suggestions (Egypt-focused) when Google Places is unavailable.
 * @see https://operations.osmfoundation.org/policies/nominatim/
 */
export async function fetchOsmSuggestions(input, { language = 'ar' } = {}) {
  const query = String(input || '').trim();
  if (query.length < 2) return [];

  const variants = buildAddressSearchVariants(query);
  const groups = await Promise.all(
    variants.map((variant) => fetchOsmVariant(variant, language).catch(() => [])),
  );

  const seen = new Set();
  const merged = groups.flat().filter((item) => {
    const key = item.placeId || item.description;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return rankAddressSuggestions(merged, query);
}

export function parseOsmSelection(item) {
  const row = item?.osmResult;
  if (!row) return null;

  const address = row.address || {};
  const lat = Number(row.lat);
  const lng = Number(row.lon);

  return {
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    formattedAddress: row.display_name || item.description || '',
    placeId: item.placeId || '',
    street: address.road || row.name || '',
    building: address.house_number || '',
    floor: '',
    area: address.suburb || address.neighbourhood || address.city_district || '',
    city: address.city || address.town || address.village || address.state || '',
    governorate: address.state || '',
  };
}
