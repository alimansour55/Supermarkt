/** Great-circle distance in km between two { lat, lng } points. */
export function haversineKm(a, b) {
  if (!a || !b || a.lat == null || a.lng == null || b.lat == null || b.lng == null) {
    return Infinity;
  }
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(Number(b.lat) - Number(a.lat));
  const dLng = toRad(Number(b.lng) - Number(a.lng));
  const lat1 = toRad(Number(a.lat));
  const lat2 = toRad(Number(b.lat));
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** True when at least one zone carries usable center coordinates. */
export function anyZoneHasCoords(zones) {
  return Array.isArray(zones)
    && zones.some((z) => z?.centerLat != null && z?.centerLng != null);
}

/**
 * The active zone whose circular coverage (centerLat/Lng + radiusKm) contains `point`.
 * Returns the closest matching zone, or `null` when the point is outside every zone.
 */
export function findCoveringZone(zones, point) {
  if (!Array.isArray(zones) || !point || point.lat == null || point.lng == null) return null;
  let best = null;
  for (const zone of zones) {
    if (zone?.isActive === false) continue;
    if (zone?.centerLat == null || zone?.centerLng == null) continue;
    const radius = Number(zone.radiusKm) > 0 ? Number(zone.radiusKm) : 8;
    const distanceKm = haversineKm(
      { lat: point.lat, lng: point.lng },
      { lat: zone.centerLat, lng: zone.centerLng },
    );
    if (distanceKm <= radius && (!best || distanceKm < best.distanceKm)) {
      best = { zone, distanceKm };
    }
  }
  return best ? best.zone : null;
}
