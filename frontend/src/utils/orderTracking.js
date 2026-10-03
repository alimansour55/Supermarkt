export function canTrackOrder(order, settings) {
  if (settings && settings.gpsDeliveryEnabled === false) return false;
  if (!order) return false;
  if (order.canTrack === true) return true;
  const status = order.orderStatus || order.status;
  return status === 'out_for_delivery'
    && Boolean(order.assignedDriver)
    && order.trackingEnabled === true
    && order.shippingAddress?.lat != null
    && order.shippingAddress?.lng != null;
}

export const STALE_DRIVER_LOCATION_MS = 2 * 60 * 1000;

export const HIDE_TRACKING_MAP_MS = (() => {
  const mins = Number(import.meta.env.VITE_TRACKING_MAP_HIDE_MINUTES);
  if (Number.isFinite(mins) && mins > 0) return mins * 60 * 1000;
  return 5 * 60 * 1000;
})();

export function isDriverLocationStale(updatedAt, now = Date.now()) {
  if (!updatedAt) return true;
  const ts = new Date(updatedAt).getTime();
  if (Number.isNaN(ts)) return true;
  return now - ts > STALE_DRIVER_LOCATION_MS;
}

export function formatLocationAge(updatedAt, isAr) {
  if (!updatedAt) return isAr ? 'غير معروف' : 'Unknown';
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(updatedAt).getTime()) / 1000));
  if (diffSec < 60) return isAr ? `منذ ${diffSec} ث` : `${diffSec}s ago`;
  const mins = Math.floor(diffSec / 60);
  return isAr ? `منذ ${mins} د` : `${mins}m ago`;
}
export function formatEta(isoDate, isAr) {
  if (!isoDate) return '';
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString(isAr ? 'ar-EG' : 'en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Straight-line distance in km between two {lat,lng} points. */
export function haversineKm(a, b) {
  if (!a || !b || a.lat == null || a.lng == null || b.lat == null || b.lng == null) return null;
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function formatDistanceKm(km, isAr) {
  if (km == null || Number.isNaN(km)) return '';
  if (km < 1) {
    const m = Math.round(km * 1000);
    return isAr ? `${m} م` : `${m} m`;
  }
  return isAr ? `${km.toFixed(1)} كم` : `${km.toFixed(1)} km`;
}
