import Order from '../models/Order.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import {
  assertDriverCanShareLocation,
  completeOrderTracking,
  ensureOrderTracking,
  isActiveDriverTrackingStatus,
  updateDriverTrackingLocation,
} from '../services/deliveryTracking.service.js';
import { pushStatusHistory } from '../services/orderManagement.service.js';
import {
  applyDeliveryFailureReason,
  clearDeliveryFailureReason,
  getDeliveryFailureReasonForLang,
} from '../constants/deliveryFailureReasons.js';
import { notifyOrderStatusChange } from '../utils/sendEmail.js';
import { notifyOrderTimeline } from '../services/orderNotification.service.js';
import { notifyCustomerDriverLocation, notifyCustomerOrderStatus } from '../services/orderTrackingNotify.service.js';
import { buildTrackingSnapshot } from '../services/deliveryTracking.service.js';
import { awardPointsForOrder } from '../services/loyalty.service.js';
import { logAudit } from '../services/auditLog.service.js';
import { getGpsDeliveryEnabled, getDriverSettings } from '../services/storeSettings.service.js';
import User from '../models/User.js';

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

async function finalizeDriverOrderStatus(order, nextStatus, { driverId, failurePayload } = {}) {
  const previousStatus = order.orderStatus;
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

  order.orderStatus = nextStatus;
  if (nextStatus === 'delivered') {
    order.deliveredAt = new Date();
    if (order.paymentMethod === 'cod' && order.paymentStatus === 'pending') {
      order.paymentStatus = 'paid';
    }
  }

  await completeOrderTracking(order._id);
  pushStatusHistory(order, nextStatus, { changedBy: driverId, note: statusNote });
  await order.save();

  try {
    await awardPointsForOrder(order);
  } catch (err) {
    console.error('Loyalty award skipped:', err.message);
  }

  try {
    await notifyOrderStatusChange(order._id, nextStatus, previousStatus);
  } catch (err) {
    console.error('Order status email failed:', err.message);
  }

  try {
    const populated = await Order.findById(order._id).populate('user', 'name email phone');
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

  return { previousStatus, nextStatus };
}

export const getDriverDeliveries = asyncHandler(async (req, res) => {
  const flags = await getDriverOrderFlags();
  const orders = await Order.find({
    assignedDriver: req.user._id,
    orderStatus: 'out_for_delivery',
  })
    .populate('user', 'name')
    .sort({ assignedDriverAt: -1, createdAt: -1 })
    .limit(50);

  res.json({
    success: true,
    data: orders.map((order) => formatDriverOrder(order, flags)),
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

  order.trackingEnabled = true;
  await order.save();
  await ensureOrderTracking(order);

  const tracking = await updateDriverTrackingLocation(order._id, {
    lat,
    lng,
    heading,
    speed,
    status: status || 'en_route',
  });

  if (!tracking) {
    throw new AppError('Tracking record not found for this order', 404);
  }

  const populated = await Order.findById(order._id)
    .populate('user', 'name email phone')
    .populate('assignedDriver', 'name phone')
    .populate('fulfillmentLocationId');

  if (populated?.user) {
    const snapshot = await buildTrackingSnapshot(populated, { forCustomer: true });
    notifyCustomerDriverLocation(
      populated,
      populated.user,
      tracking,
      {
        etaText: snapshot?.route?.etaText || '',
        etaSeconds: snapshot?.route?.etaSeconds || null,
      },
    ).catch((err) => console.error('Driver location notify failed:', err.message));
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
});

export const completeDriverDelivery = asyncHandler(async (req, res) => {
  const order = await loadDriverOrder(req.params.id, req.user._id);
  if (!order) throw new AppError('Delivery not found', 404);

  const { previousStatus, nextStatus } = await finalizeDriverOrderStatus(order, 'delivered', {
    driverId: req.user._id,
  });

  await logAudit({
    req,
    action: 'driver_complete_delivery',
    entityType: 'order',
    entityId: order._id,
    entityLabel: order.orderNumber,
    changes: { orderStatus: { from: previousStatus, to: nextStatus } },
  });

  const refreshed = await loadDriverOrder(order._id, req.user._id);
  res.json({ success: true, data: formatDriverOrder(refreshed) });
});

export const failDriverDelivery = asyncHandler(async (req, res) => {
  const order = await loadDriverOrder(req.params.id, req.user._id);
  if (!order) throw new AppError('Delivery not found', 404);

  const { deliveryFailureReasonKey, deliveryFailureReason } = req.body;
  const { previousStatus, nextStatus } = await finalizeDriverOrderStatus(order, 'delivery_failed', {
    driverId: req.user._id,
    failurePayload: { deliveryFailureReasonKey, deliveryFailureReason },
  });

  await logAudit({
    req,
    action: 'driver_fail_delivery',
    entityType: 'order',
    entityId: order._id,
    entityLabel: order.orderNumber,
    changes: {
      orderStatus: { from: previousStatus, to: nextStatus },
      deliveryFailureReason: getDeliveryFailureReasonForLang(order, 'ar'),
    },
  });

  const refreshed = await loadDriverOrder(order._id, req.user._id);
  res.json({ success: true, data: formatDriverOrder(refreshed) });
});
