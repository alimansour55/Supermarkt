import { haversineMeters } from '../services/googleMaps.service.js';

/**
 * Geometry helpers for a driving route expressed as an ordered list of
 * `{ lat, lng }` vertices. Shared by the live-tracking service (route cache /
 * remaining distance) and the dev driver simulator.
 */

const toRad = (deg) => (deg * Math.PI) / 180;
const toDeg = (rad) => (rad * 180) / Math.PI;

/** Initial bearing from A to B, degrees clockwise from north (0–360). */
export function bearingDegrees(aLat, aLng, bLat, bLng) {
  const dLng = toRad(bLng - aLng);
  const y = Math.sin(dLng) * Math.cos(toRad(bLat));
  const x = Math.cos(toRad(aLat)) * Math.sin(toRad(bLat))
    - Math.sin(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Total length of the path in metres. */
export function pathLengthMeters(path = []) {
  let total = 0;
  for (let i = 1; i < path.length; i += 1) {
    total += haversineMeters(path[i - 1].lat, path[i - 1].lng, path[i].lat, path[i].lng);
  }
  return total;
}

/**
 * Project `point` onto the polyline, returning the closest on-route point, the
 * index of the segment it fell on, and how far along the whole path that is.
 */
export function snapToPath(point, path = []) {
  if (!path.length) return null;
  if (path.length === 1) {
    return { lat: path[0].lat, lng: path[0].lng, segmentIndex: 0, distanceAlong: 0 };
  }

  let best = null;
  let cumulative = 0;

  for (let i = 1; i < path.length; i += 1) {
    const a = path[i - 1];
    const b = path[i];
    const segLen = haversineMeters(a.lat, a.lng, b.lat, b.lng);

    // Local planar approximation is fine at delivery scale.
    const ax = 0;
    const ay = 0;
    const scaleX = Math.cos(toRad(a.lat));
    const bx = (b.lng - a.lng) * scaleX;
    const by = b.lat - a.lat;
    const px = (point.lng - a.lng) * scaleX;
    const py = point.lat - a.lat;

    const segSq = bx * bx + by * by;
    let t = segSq > 0 ? ((px - ax) * bx + (py - ay) * by) / segSq : 0;
    t = Math.max(0, Math.min(1, t));

    const projLat = a.lat + by * t;
    const projLng = a.lng + (b.lng - a.lng) * t;
    const d = haversineMeters(point.lat, point.lng, projLat, projLng);

    if (!best || d < best.distance) {
      best = {
        lat: projLat,
        lng: projLng,
        segmentIndex: i - 1,
        distance: d,
        distanceAlong: cumulative + segLen * t,
      };
    }
    cumulative += segLen;
  }

  return best;
}

/** The `{ lat, lng }` that sits `meters` along the path from its start. */
export function pointAtDistanceAlong(path = [], meters) {
  if (!path.length) return null;
  if (meters <= 0) return { lat: path[0].lat, lng: path[0].lng };

  let remaining = meters;
  for (let i = 1; i < path.length; i += 1) {
    const a = path[i - 1];
    const b = path[i];
    const segLen = haversineMeters(a.lat, a.lng, b.lat, b.lng);
    if (remaining <= segLen || i === path.length - 1) {
      const t = segLen > 0 ? Math.min(1, remaining / segLen) : 1;
      return {
        lat: a.lat + (b.lat - a.lat) * t,
        lng: a.lng + (b.lng - a.lng) * t,
        bearing: bearingDegrees(a.lat, a.lng, b.lat, b.lng),
        segmentIndex: i - 1,
      };
    }
    remaining -= segLen;
  }

  const last = path[path.length - 1];
  return { lat: last.lat, lng: last.lng, bearing: 0, segmentIndex: path.length - 1 };
}
