import { buildAddressSearchVariants, rankAddressSuggestions } from './addressQuery';

const PHOTON_URL = 'https://photon.komoot.io/api/';
const EGYPT_BBOX = '24.698,22.0,36.894,31.668';

function mapPhotonFeature(feature) {
  const props = feature.properties || {};
  const [lng, lat] = feature.geometry?.coordinates || [];
  const main = props.name || props.street || props.city || props.district || '';
  const secondaryParts = [
    props.district || props.suburb,
    props.city || props.town,
    props.state,
    props.country,
  ].filter(Boolean);
  const description = [main, ...secondaryParts].filter(Boolean).join(', ');

  return {
    description: description || main,
    placeId: `photon:${props.osm_type || 'node'}:${props.osm_id || props.osm_key || main}`,
    mainText: main,
    secondaryText: [...new Set(secondaryParts)].join('، '),
    lat: Number(lat),
    lng: Number(lng),
    formattedAddress: description || main,
    source: 'photon',
  };
}

export async function fetchPhotonSuggestions(input, { lat, lng } = {}) {
  const query = String(input || '').trim();
  if (query.length < 2) return [];

  const biasLat = lat ?? 30.0444;
  const biasLng = lng ?? 31.2357;

  const variants = buildAddressSearchVariants(query);
  const groups = await Promise.all(
    variants.map(async (variant) => {
      const params = new URLSearchParams({
        q: variant,
        limit: '10',
        bbox: EGYPT_BBOX,
        lat: String(biasLat),
        lon: String(biasLng),
      });

      const response = await fetch(`${PHOTON_URL}?${params}`, {
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`Photon search failed (${response.status})`);
      }

      const data = await response.json();
      const features = Array.isArray(data?.features) ? data.features : [];
      return features
        .map(mapPhotonFeature)
        .filter((item) => item.mainText && Number.isFinite(item.lat) && Number.isFinite(item.lng));
    }),
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

export function parsePhotonSelection(item) {
  if (!item || item.lat == null || item.lng == null) return null;

  return {
    lat: Number(item.lat),
    lng: Number(item.lng),
    formattedAddress: item.formattedAddress || item.description || '',
    placeId: item.placeId || '',
    street: item.mainText || '',
    building: '',
    floor: '',
    area: item.secondaryText?.split('،')[0]?.trim() || item.secondaryText?.split(',')[0]?.trim() || '',
    city: item.secondaryText?.split('،')[1]?.trim() || item.secondaryText?.split(',')[1]?.trim() || '',
    governorate: item.secondaryText?.split('،')[2]?.trim() || item.secondaryText?.split(',')[2]?.trim() || '',
  };
}
