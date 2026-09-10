import DeliveryTracking from '../models/DeliveryTracking.js';
import Order from '../models/Order.js';
import FulfillmentLocation from '../models/FulfillmentLocation.js';
import {
  HIDE_TRACKING_MAP_MS,
  STALE_DRIVER_LOCATION_MS,
} from '../constants/deliveryTracking.js';
import { geocodeAddress, haversineMeters } from './googleMaps.service.js';
import { getOsmSuggestions } from './osmGeocode.service.js';
import { getDrivingRoute } from './osrmRoute.service.js';
import { getGpsDeliveryEnabled } from './storeSettings.service.js';
import { pathLengthMeters, snapToPath } from '../utils/geoPath.js';
import { formatAddressForGeocoding } from '../utils/addressGeo.js';

const DEFAULT_ORIGIN = { lat: 30.0444, lng: 31.2357 };

/** How often the customer app should re-poll the tracking snapshot. */
export const TRACKING_POLL_INTERVAL_MS = 9000;

/** Recompute the route once the driver strays this far off the cached polyline. */
const ROUTE_RECOMPUTE_DRIFT_M = 150;

/** ...or once the cached route is older than this (safety net for detours). */
const ROUTE_RECOMPUTE_MAX_AGE_MS = 120 * 1000;

/** Remaining distance / ETA at or below which the driver is "arriving". */
const ARRIVING_DISTANCE_M = 150;
const ARRIVING_ETA_SECONDS = 90;

export { STALE_DRIVER_LOCATION_MS, HIDE_TRACKING_MAP_MS };

export function isDriverLocationStale(updatedAt, now = Date.now()) {
  if (!updatedAt) return true;
  const ts = new Date(updatedAt).getTime();
  if (Number.isNaN(ts)) return true;
  return now - ts > STALE_DRIVER_LOCATION_MS;
}

export function isTrackingMapVisible(updatedAt, now = Date.now()) {
  if (!updatedAt) return false;
  const ts = new Date(updatedAt).getTime();
  if (Number.isNaN(ts)) return false;
  return now - ts <= HIDE_TRACKING_MAP_MS;
}

/** True when we have (or can look up) a delivery destination for the order. */
export function hasResolvableDestination(order) {
  const addr = order?.shippingAddress || {};
  if (addr.lat != null && addr.lng != null) return true;
  // A text address we can geocode is enough — resolveDestination() will look it up.
  return Boolean(
    (addr.formattedAddress && addr.formattedAddress.trim())
    || (addr.street && addr.street.trim())
    || (addr.area && addr.area.trim()),
  );
}

export function canShowOrderTracking(order, { gpsDeliveryEnabled = true } = {}) {
  if (!gpsDeliveryEnabled) return false;
  if (!order) return false;
  return order.orderStatus === 'out_for_delivery'
    && Boolean(order.assignedDriver)
    && order.trackingEnabled === true
    && hasResolvableDestination(order);
}

/**
 * Delivery destination coordinates. Uses the saved map pin, then Google geocoding,
 * then the free OSM (Nominatim) fallback. A successful lookup is written back onto
 * the order so it only happens once.
 */
export async function resolveDestination(order) {
  const addr = order.shippingAddress || {};
  if (addr.lat != null && addr.lng != null) {
    return { lat: addr.lat, lng: addr.lng, formattedAddress: addr.formattedAddress || '' };
  }

  const geocoded = await geocodeAddress(addr).catch(() => null);
  let resolved = geocoded
    ? { lat: geocoded.lat, lng: geocoded.lng, formattedAddress: geocoded.formattedAddress }
    : null;

  if (!resolved) {
    const query = formatAddressForGeocoding(addr);
    if (query) {
      const hits = await getOsmSuggestions(query, { language: 'ar' }).catch(() => []);
      const hit = hits.find((h) => Number.isFinite(h.lat) && Number.isFinite(h.lng));
      if (hit) {
        resolved = { lat: hit.lat, lng: hit.lng, formattedAddress: hit.formattedAddress || addr.formattedAddress || '' };
      }
    }
  }

  if (resolved && order._id) {
    await Order.updateOne(
      { _id: order._id },
      {
        $set: {
          'shippingAddress.lat': resolved.lat,
          'shippingAddress.lng': resolved.lng,
          ...(resolved.formattedAddress
            ? { 'shippingAddress.formattedAddress': resolved.formattedAddress }
            : {}),
        },
      },
    ).catch(() => {});
  }

  return resolved;
}

export async function resolveOrigin(order) {
  if (order.fulfillmentLocationId) {
    const location = order.fulfillmentLocationId._id
      ? order.fulfillmentLocationId
      : await FulfillmentLocation.findById(order.fulfillmentLocationId).lean();
    if (location?.lat != null && location?.lng != null) {
      return { lat: location.lat, lng: location.lng, name: location.name };
    }
  }

  return { ...DEFAULT_ORIGIN, name: 'Origin' };
}

export async function ensureOrderTracking(order) {
  if (!order.assignedDriver) return null;

  const gpsDeliveryEnabled = await getGpsDeliveryEnabled();
  if (!gpsDeliveryEnabled) return null;

  order.trackingEnabled = true;

  const existing = await DeliveryTracking.findOne({ orderId: order._id });
  if (existing?.lat != null && existing?.lng != null) {
    return existing;
  }

  const origin = await resolveOrigin(order);
  const tracking = await DeliveryTracking.findOneAndUpdate(
    { orderId: order._id },
    {
      driverId: order.assignedDriver._id || order.assignedDriver,
      lat: origin.lat,
      lng: origin.lng,
      status: 'en_route',
      updatedAt: new Date(),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  return tracking;
}

export async function completeOrderTracking(orderId) {
  await DeliveryTracking.findOneAndUpdate(
    { orderId },
    { status: 'completed', updatedAt: new Date() },
  );
}

export async function updateDriverTrackingLocation(orderId, {
  lat,
  lng,
  heading = null,
  speed = null,
  status = 'en_route',
}) {
  const tracking = await DeliveryTracking.findOneAndUpdate(
    { orderId },
    {
      lat: Number(lat),
      lng: Number(lng),
      heading: heading != null && !Number.isNaN(Number(heading)) ? Number(heading) : null,
      speed: speed != null && !Number.isNaN(Number(speed)) ? Number(speed) : null,
      status,
      updatedAt: new Date(),
    },
    { new: true, upsert: false },
  );
  return tracking;
}

export async function assertDriverCanShareLocation(order, driverId) {
  const gpsDeliveryEnabled = await getGpsDeliveryEnabled();
  if (!gpsDeliveryEnabled) {
    const err = new Error('Live GPS delivery is disabled in store settings');
    err.statusCode = 403;
    throw err;
  }

  if (!order) {
    const err = new Error('Order not found');
    err.statusCode = 404;
    throw err;
  }

  if (order.orderStatus !== 'out_for_delivery') {
    const err = new Error('Location sharing is only allowed while the order is out for delivery');
    err.statusCode = 400;
    throw err;
  }

  const assignedId = order.assignedDriver?._id || order.assignedDriver;
  if (!assignedId || String(assignedId) !== String(driverId)) {
    const err = new Error('You are not assigned to this delivery');
    err.statusCode = 403;
    throw err;
  }
}

export function isActiveDriverTrackingStatus(orderStatus) {
  return orderStatus === 'out_for_delivery';
}

/**
 * Driving route driver → destination, served from the cache on `DeliveryTracking`.
 * The cached polyline stays valid as the driver progresses ALONG it — we only
 * recompute when the driver leaves the route (snapped distance-to-path exceeds a
 * threshold) or the cache ages out. Returns the full route plus the
 * remaining-distance / remaining-ETA for the driver's current position.
 */
export async function resolveRoute(order, tracking, driver, destination) {
  if (!driver || !destination) return null;

  const cachedPath = Array.isArray(tracking?.routePath) ? tracking.routePath : [];
  const ageMs = tracking?.routeComputedAt
    ? Date.now() - new Date(tracking.routeComputedAt).getTime()
    : Infinity;

  let snapped = cachedPath.length >= 2
    ? snapToPath({ lat: driver.lat, lng: driver.lng }, cachedPath)
    : null;
  const offRoute = !snapped || snapped.distance > ROUTE_RECOMPUTE_DRIFT_M;
  // A destination change also invalidates the cache.
  const destMoved = tracking?.routePath?.length
    ? haversineMeters(
      cachedPath[cachedPath.length - 1].lat,
      cachedPath[cachedPath.length - 1].lng,
      destination.lat,
      destination.lng,
    ) > 120
    : true;

  const cacheUsable = cachedPath.length >= 2
    && ageMs < ROUTE_RECOMPUTE_MAX_AGE_MS
    && !offRoute
    && !destMoved;

  let path = cachedPath;
  let polyline = tracking?.routePolyline || '';
  let totalEtaSeconds = tracking?.routeEtaSeconds ?? null;
  let totalDistanceMeters = tracking?.routeDistanceMeters ?? null;
  let distanceText = tracking?.routeDistanceText || '';

  if (!cacheUsable) {
    const fresh = await getDrivingRoute({
      originLat: driver.lat,
      originLng: driver.lng,
      destLat: destination.lat,
      destLng: destination.lng,
    });
    if (fresh?.path?.length >= 2) {
      path = fresh.path;
      polyline = fresh.polyline || '';
      totalEtaSeconds = fresh.etaSeconds ?? null;
      totalDistanceMeters = fresh.distanceMeters ?? pathLengthMeters(path);
      distanceText = fresh.distanceText || '';
      snapped = snapToPath({ lat: driver.lat, lng: driver.lng }, path);
      await DeliveryTracking.updateOne(
        { orderId: order._id },
        {
          $set: {
            routePath: path,
            routePolyline: polyline,
            routeEtaSeconds: totalEtaSeconds,
            routeDistanceMeters: totalDistanceMeters,
            routeDistanceText: distanceText,
            routeComputedAt: new Date(),
            routeComputedFrom: { lat: driver.lat, lng: driver.lng },
          },
        },
      );
    }
  }

  if (!path || path.length < 2) return null;

  const total = totalDistanceMeters || pathLengthMeters(path);
  const along = snapped?.distanceAlong ?? 0;
  const remainingMeters = Math.max(0, total - along);
  const remainingEtaSeconds = total > 0 && totalEtaSeconds != null
    ? Math.round(totalEtaSeconds * (remainingMeters / total))
    : totalEtaSeconds;

  return {
    path,
    polyline,
    etaSeconds: remainingEtaSeconds,
    etaText: formatEtaText(remainingEtaSeconds),
    distanceText,
    distanceMeters: Math.round(remainingMeters),
    totalDistanceMeters: Math.round(total),
    totalEtaSeconds,
  };
}

function formatEtaText(seconds) {
  if (seconds == null) return '';
  const mins = Math.max(1, Math.round(seconds / 60));
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

function computeArrivalState(order, driver, route) {
  if (order.orderStatus === 'delivered') return 'delivered';
  if (!driver) return 'preparing';
  const remaining = route?.distanceMeters ?? null;
  const eta = route?.etaSeconds ?? null;
  if (driver.status === 'arrived' || (remaining != null && remaining < 60)) return 'arrived';
  if ((remaining != null && remaining <= ARRIVING_DISTANCE_M)
    || (eta != null && eta <= ARRIVING_ETA_SECONDS)) return 'arriving';
  return 'on_the_way';
}

export async function buildTrackingSnapshot(order, { forCustomer = false, gpsDeliveryEnabled } = {}) {
  const gpsEnabled = gpsDeliveryEnabled ?? await getGpsDeliveryEnabled();
  if (!gpsEnabled) {
    return {
      trackingEnabled: false,
      canTrack: false,
      mapVisible: false,
      driverStale: true,
      arrivalState: 'preparing',
      pollIntervalMs: TRACKING_POLL_INTERVAL_MS,
      origin: null,
      destination: null,
      driver: null,
      driverInfo: null,
      route: null,
      estimatedDeliveryAt: null,
      trackingMeta: {
        staleWarningMs: STALE_DRIVER_LOCATION_MS,
        mapHideMs: HIDE_TRACKING_MAP_MS,
        gpsDeliveryEnabled: false,
      },
    };
  }

  const destination = await resolveDestination(order);
  const origin = await resolveOrigin(order).catch(() => null);
  const tracking = await DeliveryTracking.findOne({ orderId: order._id }).lean();

  const driverUpdatedAt = tracking?.updatedAt || null;
  const driverStale = isDriverLocationStale(driverUpdatedAt);
  const mapVisible = !forCustomer || isTrackingMapVisible(driverUpdatedAt);

  const driver = tracking?.lat != null && tracking?.lng != null
    ? {
      lat: tracking.lat,
      lng: tracking.lng,
      heading: tracking.heading,
      speed: tracking.speed,
      status: tracking.status,
      updatedAt: tracking.updatedAt,
      stale: driverStale,
    }
    : null;

  let route = null;
  let estimatedDeliveryAt = order.estimatedDeliveryAt || null;

  if (driver && destination && mapVisible) {
    route = await resolveRoute(order, tracking, driver, destination);

    if (route?.etaSeconds != null) {
      driver.etaSeconds = route.etaSeconds;
      driver.distanceMeters = route.distanceMeters;
      estimatedDeliveryAt = new Date(Date.now() + route.etaSeconds * 1000);
      await Order.updateOne({ _id: order._id }, { estimatedDeliveryAt });
    }
  }

  const assigned = order.assignedDriver && typeof order.assignedDriver === 'object'
    ? order.assignedDriver
    : null;

  return {
    trackingEnabled: order.trackingEnabled === true,
    canTrack: canShowOrderTracking(order, { gpsDeliveryEnabled: gpsEnabled }),
    mapVisible,
    driverStale,
    orderStatus: order.orderStatus,
    orderNumber: order.orderNumber,
    arrivalState: computeArrivalState(order, mapVisible ? driver : null, route),
    pollIntervalMs: TRACKING_POLL_INTERVAL_MS,
    origin: origin && origin.lat != null
      ? { lat: origin.lat, lng: origin.lng, name: origin.name || '' }
      : null,
    destination,
    driver: mapVisible ? driver : null,
    driverInfo: assigned ? { name: assigned.name || '', phone: assigned.phone || '' } : null,
    route: mapVisible ? route : null,
    estimatedDeliveryAt: mapVisible ? estimatedDeliveryAt : null,
    trackingMeta: {
      staleWarningMs: STALE_DRIVER_LOCATION_MS,
      mapHideMs: HIDE_TRACKING_MAP_MS,
    },
  };
}

function formatDestinationFromOrder(order) {
  const addr = order.shippingAddress || {};
  if (addr.lat == null || addr.lng == null) return null;
  return {
    lat: Number(addr.lat),
    lng: Number(addr.lng),
    formattedAddress: addr.formattedAddress || '',
  };
}

function formatDriverLocationFromTracking(tracking) {
  if (!tracking || tracking.lat == null || tracking.lng == null) return null;
  return {
    lat: Number(tracking.lat),
    lng: Number(tracking.lng),
    heading: tracking.heading,
    speed: tracking.speed,
    status: tracking.status,
    updatedAt: tracking.updatedAt,
    stale: isDriverLocationStale(tracking.updatedAt),
  };
}

export function buildAdminLiveDeliveryRow(order, tracking) {
  const assigned = order.assignedDriver;
  const driverUser = assigned && typeof assigned === 'object'
    ? assigned
    : null;

  return {
    orderId: order._id,
    orderNumber: order.orderNumber,
    orderStatus: order.orderStatus,
    phone: order.phone,
    alternatePhone: order.alternatePhone || '',
    customerName: order.user?.name || '',
    destination: formatDestinationFromOrder(order),
    driver: driverUser
      ? {
        _id: driverUser._id,
        name: driverUser.name,
        phone: driverUser.phone,
        location: formatDriverLocationFromTracking(tracking),
      }
      : null,
    trackingEnabled: order.trackingEnabled === true,
    assignedDriverAt: order.assignedDriverAt,
  };
}

export async function fetchAdminLiveDeliveries() {
  const gpsDeliveryEnabled = await getGpsDeliveryEnabled();
  if (!gpsDeliveryEnabled) return [];

  const orders = await Order.find({
    orderStatus: 'out_for_delivery',
    assignedDriver: { $ne: null },
  })
    .populate('assignedDriver', 'name phone')
    .populate('user', 'name phone')
    .sort({ assignedDriverAt: -1, createdAt: -1 })
    .limit(100)
    .lean();

  if (!orders.length) return [];

  const orderIds = orders.map((o) => o._id);
  const trackings = await DeliveryTracking.find({ orderId: { $in: orderIds } }).lean();
  const trackingByOrderId = new Map(trackings.map((t) => [String(t.orderId), t]));

  return orders.map((order) => buildAdminLiveDeliveryRow(
    order,
    trackingByOrderId.get(String(order._id)),
  ));
}

export async function buildAdminOrderTrackingPayload(order) {
  const tracking = await DeliveryTracking.findOne({ orderId: order._id }).lean();
  const snapshot = await buildTrackingSnapshot(order, { forCustomer: false });

  return {
    ...snapshot,
    orderId: order._id,
    orderNumber: order.orderNumber,
    orderStatus: order.orderStatus,
    driverInfo: order.assignedDriver
      ? {
        _id: order.assignedDriver._id,
        name: order.assignedDriver.name,
        phone: order.assignedDriver.phone,
      }
      : null,
    locationStale: tracking ? isDriverLocationStale(tracking.updatedAt) : true,
    driverUpdatedAt: tracking?.updatedAt || null,
  };
}
