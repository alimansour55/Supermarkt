import { buildAddressSearchVariants, rankAddressSuggestions } from '../utils/addressQuery.js';
import { structureGeocodePayload } from '../utils/addressGeo.js';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

/** Egypt bounding box for Nominatim viewbox: left,top,right,bottom = minLon,maxLat,maxLon,minLat */
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
      secondaryText: [...new Set(secondaryParts)].join(', '),
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
      'User-Agent': 'MarketPlusSupermarket/1.0 (address search)',
    },
  });

  if (!response.ok) {
    if (response.status === 429) {
      console.warn('[osmGeocode] Nominatim rate limit — try again in a moment');
      return [];
    }
    throw new Error(`OSM search failed (${response.status})`);
  }

  const rows = await response.json();
  if (!Array.isArray(rows)) return [];
  return rows.map(mapOsmRow);
}

/**
 * OpenStreetMap address suggestions (free fallback when Google Places is unavailable).
 */
export async function getOsmSuggestions(input, { language = 'ar' } = {}) {
  const query = String(input || '').trim();
  if (query.length < 2) return [];

  const variants = buildAddressSearchVariants(query, language);
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

const NOMINATIM_REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse';

/**
 * Reverse geocode coordinates via OpenStreetMap (free fallback).
 */
export async function reverseGeocodeOsm(lat, lng, { language = 'ar' } = {}) {
  const latitude = Number(lat);
  const longitude = Number(lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const params = new URLSearchParams({
    lat: String(latitude),
    lon: String(longitude),
    format: 'json',
    addressdetails: '1',
    zoom: '18',
    'accept-language': language === 'en' ? 'en' : 'ar,en',
  });

  const response = await fetch(`${NOMINATIM_REVERSE_URL}?${params}`, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'MarketPlusSupermarket/1.0 (address reverse geocode)',
    },
  });

  if (!response.ok) return null;

  const row = await response.json();
  if (!row || row.error) return null;

  const address = row.address || {};
  const area = address.suburb
    || address.neighbourhood
    || address.city_district
    || address.quarter
    || address.state_district
    || '';
  const street = address.road
    || address.pedestrian
    || address.footway
    || address.residential
    || address.hamlet
    || row.name
    || '';
  const building = address.house_number || '';
  const city = address.city || address.town || address.village || address.municipality || '';
  const governorate = address.state || '';

  return structureGeocodePayload({
    lat: latitude,
    lng: longitude,
    formattedAddress: row.display_name || '',
    placeId: row.osm_id ? `osm:${row.osm_type}:${row.osm_id}` : '',
    addressComponents: [street, area, city, governorate].filter(Boolean),
    street,
    building,
    area,
    city,
    governorate,
    source: 'osm',
  });
}
