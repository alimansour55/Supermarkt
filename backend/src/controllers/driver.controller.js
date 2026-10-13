import Order from '../models/Order.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import {
  assertDriverCanShareLocation,
  completeOrderTracking,
  ensureOrderTracking,
  estimateRemainingRoute,
  isActiveDriverTrackingStatus,
  updateDriverTrackingLocation,
} from '../services/deliveryTracking.service.js';
import {
  applyDeliveryFailureReason,
  clearDeliveryFailureReason,
  getDeliveryFailureReasonForLang,
} from '../constants/deliveryFailureReasons.js';
import { notifyOrderStatusChange } from '../utils/sendEmail.js';
import { notifyOrderTimeline } from '../services/orderNotification.service.js';
import { notifyCustomerDriverLocation, notifyCustomerOrderStatus } from '../services/orderTrackingNotify.service.js';
import { awardPointsForOrder } from '../services/loyalty.service.js';
import { logAudit } from '../services/auditLog.service.js';
import { getGpsDeliveryEnabled, getDriverSettings } from '../services/storeSettings.service.js';
import User from '../models/User.js';
import { CLOUDINARY_FOLDERS, deleteFromCloudinary, uploadFileToCloudinary } from '../utils/cloudinaryUpload.js';

/** Statuses a driver can see before dispatch — assigned ahead of time, not yet on the road. */
const DRIVER_UPCOMING_STATUSES = ['pending', 'confirmed', 'preparing'];

function formatDriverItems(items = []) {
  return items.map((item) => ({
    nameAr: item.nameAr,
    nameEn: item.nameEn,
    quantity: item.quantity,
    image: item.image,
    unit: item.unit,
    price: item.price,
    variantLabelAr: item.variantLabelAr,
    variantLabelEn: item.variantLabelEn,
  }));
}

export function formatDriverOrder(order, {
  gpsDeliveryEnabled = true,
  pickingChecklistEnabled = true,
  cashCalculatorEnabled = true,
} = {}) {
  const raw = order.toObject?.() ?? order;
  const user = raw.user && typeof raw.user === 'object' ? raw.user : null;
  const items = formatDriverItems(raw.items);

  return {
    _id: raw._id,
    orderNumber: raw.orderNumber,
    orderStatus: raw.orderStatus,
    customerName: user?.name || null,
    phone: raw.phone,
    alternatePhone: raw.alternatePhone || '',
    notes: raw.notes,
    subtotal: raw.subtotal,
    deliveryFee: raw.deliveryFee,
    discount: raw.discount,
    total: raw.total,
    paymentMethod: raw.paymentMethod,
    paymentStatus: raw.paymentStatus,
    items,
    itemCount: items.reduce((sum, item) => sum + (item.quantity || 0), 0),
    trackingEnabled: raw.trackingEnabled === true,
    gpsDeliveryEnabled,
    pickingChecklistEnabled,
    cashCalculatorEnabled,
    canShareLocation: gpsDeliveryEnabled && isActiveDriverTrackingStatus(raw.orderStatus),
    canComplete: raw.orderStatus === 'out_for_delivery',
    shippingAddress: raw.shippingAddress,
    deliveryZoneNameAr: raw.deliveryZoneNameAr,
    deliveryZoneNameEn: raw.deliveryZoneNameEn,
    deliveryTimeSlot: raw.deliveryTimeSlot,
    deliveryMethod: raw.deliveryMethod,
    assignedDriverAt: raw.assignedDriverAt,
    createdAt: raw.createdAt,
    deliveredAt: raw.deliveredAt || null,
    deliveryProofPhoto: raw.deliveryProofPhoto?.url || null,
  };
}

function formatDriverHistoryOrder(order) {
  const raw = order.toObject?.() ?? order;
  const user = raw.user && typeof raw.user === 'object' ? raw.user : null;

  return {
    _id: raw._id,
    orderNumber: raw.orderNumber,
    orderStatus: raw.orderStatus,
    customerName: user?.name || null,
    total: raw.total,
    paymentMethod: raw.paymentMethod,
    paymentStatus: raw.paymentStatus,
    itemCount: (raw.items || []).reduce((sum, item) => sum + (item.quantity || 0), 0),
    shippingAddress: raw.shippingAddress,
    deliveredAt: raw.deliveredAt || null,
    deliveryFailureReasonAr: raw.deliveryFailureReasonAr || '',
    deliveryFailureReasonEn: raw.deliveryFailureReasonEn || '',
    deliveryProofPhoto: raw.deliveryProofPhoto?.url || null,
  };
}

async function getDriverOrderFlags() {
  const [gpsDeliveryEnabled, driverSettings] = await Promise.all([
    getGpsDeliveryEnabled(),
    getDriverSettings(),
  ]);
  return {
    gpsDeliveryEnabled,
    pickingChecklistEnabled: driverSettings.pickingChecklistEnabled !== false,
    cashCalculatorEnabled: driverSettings.cashCalculatorEnabled !== false,
  };
}

async function loadDriverOrder(orderId, driverId) {
  return Order.findOne({
    _id: orderId,
    assignedDriver: driverId,
  }).populate('user', 'name');
}

/**
 * Move a driver's out-for-delivery order to `delivered` / `delivery_failed`.
 *
 * The write is a single conditional update (`orderStatus: 'out_for_delivery'`), so a
 * double tap, a network retry or a concurrent admin change can only apply it once.
 * Side effects (loyalty, emails, SMS, review request) run only for the request that
 * actually changed the status. A repeat of an already-applied transition returns
 * `changed: false` instead of an error, so client retries are safe.
 */
async function finalizeDriverOrderStatus(order, nextStatus, { driverId, failurePayload, proofPhoto } = {}) {
  const previousStatus = order.orderStatus;
  if (previousStatus === nextStatus) {
    return { previousStatus, nextStatus, changed: false, order };
  }
  if (previousStatus !== 'out_for_delivery') {
    throw new AppError('Only out-for-delivery orders can be updated by the driver', 400);
  }

  let statusNote = '';
  if (nextStatus === 'delivery_failed') {
    const applied = applyDeliveryFailureReason(order, failurePayload || {});
    if (!applied.ok) {
      throw new AppError(applied.message, 400);
    }
    statusNote = getDeliveryFailureReasonForLang(order, 'ar');
  } else {
    clearDeliveryFailureReason(order);
  }

  const now = new Date();
  const set = {
    orderStatus: nextStatus,
    deliveryFailureReasonKey: order.deliveryFailureReasonKey,
    deliveryFailureReasonAr: order.deliveryFailureReasonAr,
    deliveryFailureReasonEn: order.deliveryFailureReasonEn,
  };
  if (nextStatus === 'delivered') {
    set.deliveredAt = now;
    if (order.paymentMethod === 'cod' && order.paymentStatus === 'pending') {
      set.paymentStatus = 'paid';
    }
  }
  if (proofPhoto) {
    set.deliveryProofPhoto = proofPhoto;
  }

  const updated = await Order.findOneAndUpdate(
    { _id: order._id, assignedDriver: driverId, orderStatus: 'out_for_delivery' },
    {
      $set: set,
      $push: {
        statusHistory: { status: nextStatus, changedAt: now, note: statusNote, changedBy: driverId },
      },
    },
    { new: true, runValidators: true },
  ).populate('user', 'name');

  if (!updated) {
    // Another request got there first — idempotent if it reached the same status.
    const current = await loadDriverOrder(order._id, driverId);
    if (current?.orderStatus === nextStatus) {
      return { previousStatus, nextStatus, changed: false, order: current };
    }
    throw new AppError('This delivery was already updated — refresh to see its current status', 409);
  }

  await completeOrderTracking(updated._id);

  try {
    await awardPointsForOrder(updated);
  } catch (err) {
    console.error('Loyalty award skipped:', err.message);
  }

  try {
    await notifyOrderStatusChange(updated._id, nextStatus, previousStatus);
  } catch (err) {
    console.error('Order status email failed:', err.message);
  }

  try {
    const populated = await Order.findById(updated._id).populate('user', 'name email phone');
    await notifyOrderTimeline(populated, populated.user, nextStatus);
    await notifyCustomerOrderStatus(populated, populated.user, nextStatus, previousStatus)
      .catch((err) => console.error('Order tracking notify failed:', err.message));
    if (nextStatus === 'delivered') {
      const { sendReviewRequest } = await import('../services/reviewRequest.service.js');
      await sendReviewRequest(populated, populated.user, 'ar').catch((err) => {
        console.error('Review request failed:', err.message);
      });
    }
  } catch (err) {
    console.error('Order status SMS failed:', err.message);
  }

  return { previousStatus, nextStatus, changed: true, order: updated };
}

export const getDriverDeliveries = asyncHandler(async (req, res) => {
  const flags = await getDriverOrderFlags();
  const orders = await Order.find({
    assignedDriver: req.user._id,
    orderStatus: { $in: ['out_for_delivery', ...DRIVER_UPCOMING_STATUSES] },
  })
    .populate('user', 'name')
    .sort({ assignedDriverAt: -1, createdAt: -1 })
    .limit(50);

  res.json({
    success: true,
    data: orders.map((order) => formatDriverOrder(order, flags)),
  });
});

export const getDriverHistory = asyncHandler(async (req, res) => {
  const orders = await Order.find({
    assignedDriver: req.user._id,
    orderStatus: { $in: ['delivered', 'delivery_failed'] },
  })
    .populate('user', 'name')
    .sort({ deliveredAt: -1, updatedAt: -1 })
    .limit(100);

  res.json({
    success: true,
    data: orders.map(formatDriverHistoryOrder),
  });
});

export const getDriverDeliveryById = asyncHandler(async (req, res) => {
  const order = await loadDriverOrder(req.params.id, req.user._id);

  if (!order) {
    throw new AppError('Delivery not found', 404);
  }

  const flags = await getDriverOrderFlags();
  res.json({ success: true, data: formatDriverOrder(order, flags) });
});

export const getDriverConfig = asyncHandler(async (req, res) => {
  const driverSettings = await getDriverSettings();
  res.json({
    success: true,
    data: {
      availabilityEnabled: driverSettings.availabilityEnabled !== false,
      pickingChecklistEnabled: driverSettings.pickingChecklistEnabled !== false,
      cashCalculatorEnabled: driverSettings.cashCalculatorEnabled !== false,
      driverAvailable: req.user.driverAvailable !== false,
    },
  });
});

export const updateDriverAvailability = asyncHandler(async (req, res) => {
  const driverSettings = await getDriverSettings();
  if (driverSettings.availabilityEnabled === false) {
    throw new AppError('Availability control is disabled by the store', 403);
  }

  const available = req.body.available === true || req.body.available === 'true';
  await User.updateOne(
    { _id: req.user._id },
    { $set: { driverAvailable: available, driverAvailableAt: new Date() } },
  );

  res.json({ success: true, data: { driverAvailable: available } });
});

export const updateDriverOrderLocation = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);

  try {
    await assertDriverCanShareLocation(order, req.user._id);
  } catch (err) {
    throw new AppError(err.message, err.statusCode || 403);
  }

  const { lat, lng, heading, speed, status } = req.body;
  if (lat == null || lng == null) {
    throw new AppError('Latitude and longitude are required', 400);
  }

  const point = {
    lat,
    lng,
    heading,
    speed,
    status: status || 'en_route',
  };

  // Hot path (every ~20 s per driver): one write in the common case. The order and
  // tracking record are only touched again when tracking has not started yet.
  let tracking = await updateDriverTrackingLocation(order._id, point);
  if (!tracking) {
    if (!order.trackingEnabled) {
      await Order.updateOne({ _id: order._id }, { $set: { trackingEnabled: true } });
      order.trackingEnabled = true;
    }
    await ensureOrderTracking(order);
    tracking = await updateDriverTrackingLocation(order._id, point);
  }

  if (!tracking) {
    throw new AppError('Tracking record not found for this order', 404);
  }

  res.json({
    success: true,
    data: {
      lat: tracking.lat,
      lng: tracking.lng,
      heading: tracking.heading,
      speed: tracking.speed,
      status: tracking.status,
      updatedAt: tracking.updatedAt,
    },
  });

  // Customer notices (throttled in-app update, first-location and "nearby" SMS) run
  // after the response so a slow route lookup or SMS gateway never delays the driver.
  notifyCustomerAfterPing(order._id, tracking)
    .catch((err) => console.error('Driver location notify failed:', err.message));
});

async function notifyCustomerAfterPing(orderId, tracking) {
  const order = await Order.findById(orderId).populate('user', 'name email phone');
  if (!order?.user) return;
  const route = await estimateRemainingRoute(order, tracking).catch(() => null);
  await notifyCustomerDriverLocation(order, order.user, tracking, {
    etaText: route?.etaText || '',
    etaSeconds: route?.etaSeconds ?? null,
  });
}

export const completeDriverDelivery = asyncHandler(async (req, res) => {
  const order = await loadDriverOrder(req.params.id, req.user._id);
  if (!order) throw new AppError('Delivery not found', 404);

  const flags = await getDriverOrderFlags();
  if (order.orderStatus === 'delivered') {
    // Retry of a completion that already went through.
    res.json({ success: true, data: formatDriverOrder(order, flags) });
    return;
  }
  if (order.orderStatus !== 'out_for_delivery') {
    throw new AppError('Only out-for-delivery orders can be updated by the driver', 400);
  }

  // Upload only once the order is known to be completable, and clean up if the
  // completion does not go through, so failed attempts leave no orphan photos.
  let proofPhoto = null;
  if (req.file) {
    const uploaded = await uploadFileToCloudinary(req.file, CLOUDINARY_FOLDERS.deliveryProofs);
    proofPhoto = { url: uploaded.url, publicId: uploaded.publicId };
  }

  let result;
  try {
    result = await finalizeDriverOrderStatus(order, 'delivered', {
      driverId: req.user._id,
      proofPhoto,
    });
  } catch (err) {
    if (proofPhoto?.publicId) await deleteFromCloudinary(proofPhoto.publicId);
    throw err;
  }
  if (!result.changed && proofPhoto?.publicId) {
    await deleteFromCloudinary(proofPhoto.publicId);
  }

  if (result.changed) {
    await logAudit({
      req,
      action: 'driver_complete_delivery',
      entityType: 'order',
      entityId: order._id,
      entityLabel: order.orderNumber,
      changes: { orderStatus: { from: result.previousStatus, to: result.nextStatus } },
    });
  }

  res.json({ success: true, data: formatDriverOrder(result.order, flags) });
});

export const failDriverDelivery = asyncHandler(async (req, res) => {
  const order = await loadDriverOrder(req.params.id, req.user._id);
  if (!order) throw new AppError('Delivery not found', 404);

  const { deliveryFailureReasonKey, deliveryFailureReason } = req.body;
  const result = await finalizeDriverOrderStatus(order, 'delivery_failed', {
    driverId: req.user._id,
    failurePayload: { deliveryFailureReasonKey, deliveryFailureReason },
  });

  if (result.changed) {
    await logAudit({
      req,
      action: 'driver_fail_delivery',
      entityType: 'order',
      entityId: order._id,
      entityLabel: order.orderNumber,
      changes: {
        orderStatus: { from: result.previousStatus, to: result.nextStatus },
        deliveryFailureReason: getDeliveryFailureReasonForLang(result.order, 'ar'),
      },
    });
  }

  const flags = await getDriverOrderFlags();
  res.json({ success: true, data: formatDriverOrder(result.order, flags) });
});
