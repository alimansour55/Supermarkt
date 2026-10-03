import { haversineKm } from './zoneDistance';

/** Great-circle distance in meters between two { lat, lng } points. */
export function haversineMeters(a, b) {
  return haversineKm(a, b) * 1000;
}

/** Initial bearing in degrees (0-360, 0 = north) from `from` towards `to`. */
export function bearingDegrees(from, to) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const toDeg = (rad) => (rad * 180) / Math.PI;
  const lat1 = toRad(from.lat);
  const lat2 = toRad(to.lat);
  const dLng = toRad(to.lng - from.lng);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Point at `distanceMeters` from `from`, along `bearingDeg` (0 = north, 90 = east). */
export function destinationPoint(from, bearingDeg, distanceMeters) {
  const EARTH_RADIUS_M = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const toDeg = (rad) => (rad * 180) / Math.PI;
  const delta = distanceMeters / EARTH_RADIUS_M;
  const theta = toRad(bearingDeg);
  const phi1 = toRad(from.lat);
  const lambda1 = toRad(from.lng);
  const phi2 = Math.asin(
    Math.sin(phi1) * Math.cos(delta) + Math.cos(phi1) * Math.sin(delta) * Math.cos(theta),
  );
  const lambda2 = lambda1 + Math.atan2(
    Math.sin(theta) * Math.sin(delta) * Math.cos(phi1),
    Math.cos(delta) - Math.sin(phi1) * Math.sin(phi2),
  );
  return { lat: toDeg(phi2), lng: ((toDeg(lambda2) + 540) % 360) - 180 };
}

/** Clamp a radius in meters to a sane, configurable range. */
export function clampRadiusMeters(meters, min = 300, max = 50000) {
  if (!Number.isFinite(meters)) return min;
  return Math.min(Math.max(meters, min), max);
}

/**
 * Web-Mercator zoom level that keeps a circle of `radiusMeters` (centered at `latDeg`)
 * within roughly `targetPx` screen pixels — so a resize handle on its edge stays reachable
 * instead of drifting off-screen for a wide-radius zone.
 */
export function fitZoomForRadius(radiusMeters, latDeg, targetPx = 220) {
  if (!Number.isFinite(radiusMeters) || radiusMeters <= 0) return 13;
  const latRad = (latDeg * Math.PI) / 180;
  const z = Math.log2((targetPx * 156543.03392 * Math.cos(latRad)) / (2 * radiusMeters));
  return Math.min(18, Math.max(3, Math.floor(z)));
}
