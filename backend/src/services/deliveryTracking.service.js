import DeliveryTracking from '../models/DeliveryTracking.js';
import Order from '../models/Order.js';
import FulfillmentLocation from '../models/FulfillmentLocation.js';
import {
  HIDE_TRACKING_MAP_MS,
  STALE_DRIVER_LOCATION_MS,
} from '../constants/deliveryTracking.js';
import { geocodeAddress, getDirections } from './googleMaps.service.js';
import { getGpsDeliveryEnabled } from './storeSettings.service.js';

const DEFAULT_ORIGIN = { lat: 30.0444, lng: 31.2357 };

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

export function canShowOrderTracking(order, { gpsDeliveryEnabled = true } = {}) {
  if (!gpsDeliveryEnabled) return false;
  if (!order) return false;
  return order.orderStatus === 'out_for_delivery'
    && Boolean(order.assignedDriver)
    && order.trackingEnabled === true
    && order.shippingAddress?.lat != null
    && order.shippingAddress?.lng != null;
}

async function resolveDestination(order) {
  const addr = order.shippingAddress || {};
  if (addr.lat != null && addr.lng != null) {
    return { lat: addr.lat, lng: addr.lng, formattedAddress: addr.formattedAddress || '' };
  }

  const geocoded = await geocodeAddress(addr);
  if (geocoded) {
    return { lat: geocoded.lat, lng: geocoded.lng, formattedAddress: geocoded.formattedAddress };
  }

  return null;
}

async function resolveOrigin(order) {
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

export async function buildTrackingSnapshot(order, { forCustomer = false, gpsDeliveryEnabled } = {}) {
  const gpsEnabled = gpsDeliveryEnabled ?? await getGpsDeliveryEnabled();
  if (!gpsEnabled) {
    return {
      trackingEnabled: false,
      canTrack: false,
      mapVisible: false,
      driverStale: true,
      destination: null,
      driver: null,
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
    route = await getDirections({
      originLat: driver.lat,
      originLng: driver.lng,
      destLat: destination.lat,
      destLng: destination.lng,
    });

    if (route?.etaSeconds) {
      estimatedDeliveryAt = new Date(Date.now() + route.etaSeconds * 1000);
      if (!order.estimatedDeliveryAt) {
        await Order.updateOne({ _id: order._id }, { estimatedDeliveryAt });
      }
    }
  }

  return {
    trackingEnabled: order.trackingEnabled === true,
    canTrack: canShowOrderTracking(order, { gpsDeliveryEnabled: gpsEnabled }),
    mapVisible,
    driverStale,
    destination,
    driver: mapVisible ? driver : null,
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
