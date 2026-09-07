/** Deep links when embedded Google Maps is unavailable */
export function buildGoogleMapsDestinationUrl(lat, lng) {
  if (lat == null || lng == null) return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${lat},${lng}`)}`;
}

export function buildGoogleMapsDirectionsUrl({
  destination,
  driver,
}) {
  const destLat = destination?.lat;
  const destLng = destination?.lng;
  if (destLat == null || destLng == null) return null;

  const params = new URLSearchParams({
    api: '1',
    destination: `${destLat},${destLng}`,
  });

  if (driver?.lat != null && driver?.lng != null) {
    params.set('origin', `${driver.lat},${driver.lng}`);
  }

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function buildGoogleMapsSearchUrl(query) {
  if (!query?.trim()) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query.trim())}`;
}
