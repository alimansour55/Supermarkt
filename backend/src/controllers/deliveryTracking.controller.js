import Order from '../models/Order.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import {
  HIDE_TRACKING_MAP_MS,
  STALE_DRIVER_LOCATION_MS,
  buildAdminOrderTrackingPayload,
  buildTrackingSnapshot,
  canShowOrderTracking,
  ensureOrderTracking,
  fetchAdminLiveDeliveries,
  updateDriverTrackingLocation,
} from '../services/deliveryTracking.service.js';
import { getGpsDeliveryEnabled } from '../services/storeSettings.service.js';
import { logAudit } from '../services/auditLog.service.js';
import {
  notifyCustomerDriverLocation,
  notifyCustomerTrackingLive,
} from '../services/orderTrackingNotify.service.js';

export const getCustomerOrderTracking = asyncHandler(async (req, res) => {
  const order = await Order.findOne({ _id: req.params.id, user: req.user._id })
    .populate('assignedDriver', 'name phone')
    .populate('fulfillmentLocationId');

  if (!order) throw new AppError('Order not found', 404);

  const gpsDeliveryEnabled = await getGpsDeliveryEnabled();
  if (!gpsDeliveryEnabled) {
    throw new AppError('Live map tracking is disabled for this store', 404);
  }

  const eligible = order.orderStatus === 'out_for_delivery'
    && Boolean(order.assignedDriver)
    && order.trackingEnabled === true;

  if (!eligible && !canShowOrderTracking(order, { gpsDeliveryEnabled })) {
    throw new AppError('Live tracking is not available for this order', 404);
  }

  const data = await buildTrackingSnapshot(order, { forCustomer: true, gpsDeliveryEnabled });
  res.json({ success: true, data });
});

export const updateAdminOrderTracking = asyncHandler(async (req, res) => {
  const gpsDeliveryEnabled = await getGpsDeliveryEnabled();
  if (!gpsDeliveryEnabled) {
    throw new AppError('Live GPS delivery is disabled in store settings', 403);
  }

  const order = await Order.findById(req.params.id)
    .populate('assignedDriver', 'name phone')
    .populate('fulfillmentLocationId');

  if (!order) throw new AppError('Order not found', 404);
  if (!order.assignedDriver) throw new AppError('Assign a driver before updating tracking', 400);

  const { lat, lng, heading, speed, status } = req.body;
  if (lat == null || lng == null) {
    throw new AppError('Latitude and longitude are required', 400);
  }

  order.trackingEnabled = true;
  await order.save();
  await ensureOrderTracking(order);

  const tracking = await updateDriverTrackingLocation(order._id, {
    lat,
    lng,
    heading,
    speed,
    status,
  });

  await logAudit({
    req,
    action: 'update_tracking',
    entityType: 'order',
    entityId: order._id,
    entityLabel: order.orderNumber,
    changes: { lat, lng, status: status || 'en_route' },
  });

  const data = await buildTrackingSnapshot(order);

  const populated = await Order.findById(order._id)
    .populate('user', 'name email phone')
    .populate('assignedDriver', 'name phone')
    .populate('fulfillmentLocationId');

  if (populated?.user) {
    notifyCustomerDriverLocation(
      populated,
      populated.user,
      tracking,
      {
        etaText: data?.route?.etaText || '',
        etaSeconds: data?.route?.etaSeconds || null,
      },
    ).catch((err) => console.error('Admin tracking notify failed:', err.message));
    notifyCustomerTrackingLive(populated, populated.user)
      .catch((err) => console.error('Tracking live notify failed:', err.message));
  }

  res.json({ success: true, tracking, data });
});

export const getAdminLiveDeliveries = asyncHandler(async (req, res) => {
  const gpsDeliveryEnabled = await getGpsDeliveryEnabled();
  const data = gpsDeliveryEnabled ? await fetchAdminLiveDeliveries() : [];
  const staleCount = data.filter((row) => row.driver?.location?.stale).length;

  res.json({
    success: true,
    data,
    meta: {
      count: data.length,
      staleCount,
      staleThresholdMs: STALE_DRIVER_LOCATION_MS,
      mapHideMs: HIDE_TRACKING_MAP_MS,
      gpsDeliveryEnabled,
    },
  });
});

export const getAdminOrderTracking = asyncHandler(async (req, res) => {
  const gpsDeliveryEnabled = await getGpsDeliveryEnabled();
  if (!gpsDeliveryEnabled) {
    throw new AppError('Live GPS delivery is disabled in store settings', 403);
  }

  const order = await Order.findById(req.params.id)
    .populate('assignedDriver', 'name phone')
    .populate('fulfillmentLocationId');

  if (!order) throw new AppError('Order not found', 404);

  if (order.orderStatus !== 'out_for_delivery') {
    throw new AppError('Live tracking is only available for out-for-delivery orders', 400);
  }

  if (!order.assignedDriver) {
    throw new AppError('Assign a driver to view live tracking', 400);
  }

  const data = await buildAdminOrderTrackingPayload(order);
  res.json({ success: true, data });
});
