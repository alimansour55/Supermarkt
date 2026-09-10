import { getDirections } from './googleMaps.service.js';

/**
 * Driving route with road geometry + ETA. Prefers Google Directions (when the
 * API key has billing enabled) and falls back to the public OSRM demo server,
 * which needs no key. Same return shape as `getDirections`.
 *
 * For production traffic, enable billing on the Google key or point
 * `OSRM_BASE_URL` at a self-hosted OSRM instance.
 */

const OSRM_BASE = (process.env.OSRM_BASE_URL || 'https://router.project-osrm.org').replace(/\/$/, '');

function formatDuration(seconds) {
  if (seconds == null) return '';
  const mins = Math.max(1, Math.round(seconds / 60));
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

function formatDistance(meters) {
  if (meters == null) return '';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

async function getOsrmRoute({ originLat, originLng, destLat, destLng }) {
  const coords = `${originLng},${originLat};${destLng},${destLat}`;
  const url = `${OSRM_BASE}/route/v1/driving/${coords}?overview=full&geometries=geojson`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const data = await res.json();
    const route = data.routes?.[0];
    if (!route?.geometry?.coordinates?.length) return null;

    const path = route.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
    return {
      etaSeconds: route.duration != null ? Math.round(route.duration) : null,
      etaText: formatDuration(route.duration),
      distanceText: formatDistance(route.distance),
      distanceMeters: route.distance != null ? Math.round(route.distance) : null,
      polyline: '',
      path,
      source: 'osrm',
    };
  } catch (err) {
    console.warn('[osrm] route failed:', err.message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function getDrivingRoute({ originLat, originLng, destLat, destLng }) {
  if ([originLat, originLng, destLat, destLng].some((v) => v == null || Number.isNaN(Number(v)))) {
    return null;
  }

  try {
    const google = await getDirections({ originLat, originLng, destLat, destLng });
    if (google?.path?.length >= 2) return { ...google, source: 'google' };
  } catch (err) {
    console.warn('[route] Google Directions failed, trying OSRM:', err.message);
  }

  return getOsrmRoute({ originLat, originLng, destLat, destLng });
}
