import Order from '../models/Order.js';
import DeliveryTracking from '../models/DeliveryTracking.js';
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
import { pushStatusHistory } from '../services/orderManagement.service.js';
import {
  applyDeliveryFailureReason,
  clearDeliveryFailureReason,
  getDeliveryFailureReasonForLang,
} from '../constants/deliveryFailureReasons.js';
import { notifyOrderStatusChange } from '../utils/sendEmail.js';
import { notifyOrderTimeline } from '../services/orderNotification.service.js';
import {
  notifyCustomerDriverArrived,
  notifyCustomerDriverLocation,
  notifyCustomerOrderStatus,
  notifyCustomerTrackingLive,
} from '../services/orderTrackingNotify.service.js';
import { awardPointsForOrder } from '../services/loyalty.service.js';
import { logAudit } from '../services/auditLog.service.js';
import { createNotification } from '../services/notification.service.js';
import { getGpsDeliveryEnabled, getDriverSettings } from '../services/storeSettings.service.js';
import { releaseAssignment } from '../services/deliveryDispatch.service.js';
import {
  CONTACT_FAILURE_REASONS,
  MAX_PIN_FAILURES,
  PICKUP_ORDER_STATUSES,
  PRE_PICKUP_STAGES,
  contactAttemptCount,
  distanceToDestination,
  ensureDeliveryRun,
  isDeliveryPinRequired,
  isProofPhotoRequired,
} from '../services/deliveryRun.service.js';
import {
  codAmountDue,
  getDriverCashSummary,
  recordCodCollection,
  roundMoney,
} from '../services/driverCash.service.js';
import User from '../models/User.js';
import { getDriverStats } from '../services/driverStats.service.js';
import { CLOUDINARY_FOLDERS, deleteFromCloudinary, uploadFileToCloudinary } from '../utils/cloudinaryUpload.js';

/** Statuses a driver can see before dispatch — assigned ahead of time, not yet on the road. */
const DRIVER_UPCOMING_STATUSES = ['pending', 'confirmed', 'preparing'];
const TERMINAL_STATUSES = ['delivered', 'delivery_failed', 'cancelled', 'refunded'];

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

/** Stage of the delivery run; orders from before runs existed get the equivalent stage. */
function effectiveStage(raw) {
  if (raw.delivery?.stage) return raw.delivery.stage;
  if (raw.orderStatus === 'delivered') return 'delivered';
  if (raw.orderStatus === 'delivery_failed') return 'failed';
  return raw.orderStatus === 'out_for_delivery' ? 'picked_up' : 'assigned';
}

export function formatDriverOrder(order, flags = {}) {
  const {
    gpsDeliveryEnabled = true,
    pickingChecklistEnabled = true,
    cashCalculatorEnabled = true,
    settings = {},
  } = flags;
  const raw = order.toObject?.() ?? order;
  const user = raw.user && typeof raw.user === 'object' ? raw.user : null;
  const items = formatDriverItems(raw.items);
  const stage = effectiveStage(raw);
  const isTerminal = TERMINAL_STATUSES.includes(raw.orderStatus);
  const onTheRoad = raw.orderStatus === 'out_for_delivery';
  const prePickup = PRE_PICKUP_STAGES.includes(stage);
  const run = raw.delivery || {};

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
    cashDue: codAmountDue(raw),
    items,
    itemCount: items.reduce((sum, item) => sum + (item.quantity || 0), 0),
    trackingEnabled: raw.trackingEnabled === true,
    gpsDeliveryEnabled,
    pickingChecklistEnabled,
    cashCalculatorEnabled,
    delivery: {
      stage,
      assignedAt: run.assignedAt || raw.assignedDriverAt || null,
      acceptedAt: run.acceptedAt || null,
      pickedUpAt: run.pickedUpAt || null,
      enRouteAt: run.enRouteAt || null,
      arrivedAt: run.arrivedAt || null,
      pickedItems: run.pickedItems || null,
      missingItems: run.missingItems || null,
      contactAttempts: contactAttemptCount(raw),
      cashCollected: run.cashCollected ?? null,
      changeGiven: run.changeGiven ?? null,
    },
    canAccept: !isTerminal && stage === 'assigned',
    canReject: !isTerminal && prePickup && settings.allowReject !== false,
    canPickup: !isTerminal && prePickup && PICKUP_ORDER_STATUSES.includes(raw.orderStatus),
    canArrive: onTheRoad && !['arrived', 'delivered', 'failed'].includes(stage),
    canShareLocation: gpsDeliveryEnabled && isActiveDriverTrackingStatus(raw.orderStatus),
    canComplete: onTheRoad,
    canReturn: raw.orderStatus === 'delivery_failed' && stage === 'failed',
    requirements: {
      deliveryPin: onTheRoad && isDeliveryPinRequired(raw, settings),
      pinLocked: (run.pinFailures || 0) >= MAX_PIN_FAILURES,
      proofPhoto: isProofPhotoRequired(raw, settings),
      cashAmount: settings.cashTrackingEnabled !== false && codAmountDue(raw) > 0,
      geofenceMeters: gpsDeliveryEnabled ? Number(settings.geofenceMeters) || 0 : 0,
      minContactAttempts: Number(settings.failMinContactAttempts) || 0,
      contactFailureReasons: CONTACT_FAILURE_REASONS,
    },
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
    cashCollected: raw.delivery?.cashCollected ?? null,
    stage: effectiveStage(raw),
    canReturn: raw.orderStatus === 'delivery_failed' && effectiveStage(raw) === 'failed',
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
    settings: driverSettings,
  };
}

async function loadDriverOrder(orderId, driverId) {
  return Order.findOne({
    _id: orderId,
    assignedDriver: driverId,
  }).populate('user', 'name');
}

async function loadOwnedOrderOr404(req) {
  const order = await loadDriverOrder(req.params.id, req.user._id);
  if (!order) throw new AppError('Delivery not found', 404);
  return order;
}

async function respondWithOrder(res, orderId, driverId) {
  const [order, flags] = await Promise.all([loadDriverOrder(orderId, driverId), getDriverOrderFlags()]);
  if (!order) throw new AppError('Delivery not found', 404);
  res.json({ success: true, data: formatDriverOrder(order, flags) });
}

function alertStore({ titleAr, titleEn, messageAr, messageEn, order }) {
  return createNotification({
    type: 'delivery_alert',
    titleAr,
    titleEn,
    messageAr,
    messageEn,
    link: `/admin/orders?order=${order._id}`,
    data: { orderId: order._id, orderNumber: order.orderNumber },
  }).catch((err) => console.error('Delivery alert failed:', err.message));
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
async function finalizeDriverOrderStatus(order, nextStatus, {
  driverId, failurePayload, proofPhoto, deliverySet = {},
} = {}) {
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

  await ensureDeliveryRun(order);

  const now = new Date();
  const set = {
    orderStatus: nextStatus,
    deliveryFailureReasonKey: order.deliveryFailureReasonKey,
    deliveryFailureReasonAr: order.deliveryFailureReasonAr,
    deliveryFailureReasonEn: order.deliveryFailureReasonEn,
    'delivery.stage': nextStatus === 'delivered' ? 'delivered' : 'failed',
  };
  for (const [key, value] of Object.entries(deliverySet)) {
    set[`delivery.${key}`] = value;
  }
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
  const page = Math.max(1, Math.round(Number(req.query.page) || 1));
  const limit = Math.min(100, Math.max(5, Math.round(Number(req.query.limit) || 30)));
  const filter = {
    assignedDriver: req.user._id,
    orderStatus: { $in: ['delivered', 'delivery_failed'] },
  };
  const from = req.query.from ? new Date(req.query.from) : null;
  const to = req.query.to ? new Date(req.query.to) : null;
  if ((from && !Number.isNaN(from.getTime())) || (to && !Number.isNaN(to.getTime()))) {
    filter.updatedAt = {};
    if (from && !Number.isNaN(from.getTime())) filter.updatedAt.$gte = from;
    if (to && !Number.isNaN(to.getTime())) filter.updatedAt.$lte = to;
  }

  // One extra row tells us whether another page exists without a count query.
  const orders = await Order.find(filter)
    .populate('user', 'name')
    .sort({ updatedAt: -1, _id: -1 })
    .skip((page - 1) * limit)
    .limit(limit + 1);

  res.json({
    success: true,
    data: orders.slice(0, limit).map(formatDriverHistoryOrder),
    meta: { page, limit, hasMore: orders.length > limit },
  });
});

export const getDriverStatsSummary = asyncHandler(async (req, res) => {
  const days = Math.min(90, Math.max(1, Math.round(Number(req.query.days) || 1)));
  const data = await getDriverStats(req.user._id, { days });
  res.json({ success: true, data: { ...data, days } });
});

export const getDriverDeliveryById = asyncHandler(async (req, res) => {
  const order = await loadOwnedOrderOr404(req);
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
      cashTrackingEnabled: driverSettings.cashTrackingEnabled !== false,
      allowReject: driverSettings.allowReject !== false,
      acceptTimeoutMin: Number(driverSettings.acceptTimeoutMin) || 0,
      driverAvailable: req.user.driverAvailable !== false,
      cashBalance: roundMoney(req.user.driverCashBalance),
      gpsDeliveryEnabled: await getGpsDeliveryEnabled(),
      activeDeliveries: await Order.countDocuments({ assignedDriver: req.user._id, orderStatus: 'out_for_delivery' }),
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

/** Driver confirms they will take the delivery (stops the accept timeout). */
export const acceptDriverDelivery = asyncHandler(async (req, res) => {
  const order = await loadOwnedOrderOr404(req);
  if (TERMINAL_STATUSES.includes(order.orderStatus)) {
    throw new AppError('This delivery is already closed', 400);
  }
  await ensureDeliveryRun(order);

  const accepted = await Order.findOneAndUpdate(
    { _id: order._id, assignedDriver: req.user._id, 'delivery.stage': 'assigned' },
    { $set: { 'delivery.stage': 'accepted', 'delivery.acceptedAt': new Date() } },
    { new: true },
  );
  if (accepted) {
    await logAudit({
      req,
      action: 'driver_accept_delivery',
      entityType: 'order',
      entityId: order._id,
      entityLabel: order.orderNumber,
    });
  }
  // Not matched = already accepted or further along: idempotent.
  await respondWithOrder(res, order._id, req.user._id);
});

/** Driver declines before pickup; the order goes back to the pool (or to the next driver). */
export const rejectDriverDelivery = asyncHandler(async (req, res) => {
  const settings = await getDriverSettings();
  if (settings.allowReject === false) {
    throw new AppError('Declining deliveries is disabled by the store', 403);
  }
  const order = await loadOwnedOrderOr404(req);
  await ensureDeliveryRun(order);

  const result = await releaseAssignment(order._id, req.user._id, { reason: 'reject', req });
  if (!result) {
    throw new AppError('This delivery can no longer be declined — it was already picked up', 409);
  }
  res.json({ success: true, data: { released: true, orderId: order._id } });
});

/**
 * Driver collects the order at the store. Records the picking checklist and, when the
 * order was still being prepared, dispatches it (out for delivery) — the store does not
 * need to change the status by hand.
 */
export const pickupDriverDelivery = asyncHandler(async (req, res) => {
  const order = await loadOwnedOrderOr404(req);
  if (!PICKUP_ORDER_STATUSES.includes(order.orderStatus)) {
    throw new AppError('This order is not ready for pickup yet', 400, 'NOT_READY');
  }
  await ensureDeliveryRun(order);

  const itemCount = order.items?.length || 0;
  const rawPicked = Array.isArray(req.body.pickedItems) ? req.body.pickedItems : null;
  const pickedItems = rawPicked
    ? [...new Set(rawPicked.map(Number).filter((i) => Number.isInteger(i) && i >= 0 && i < itemCount))]
    : null;
  const missingItems = pickedItems
    ? [...Array(itemCount).keys()].filter((i) => !pickedItems.includes(i))
    : null;

  const now = new Date();
  const claimed = await Order.findOneAndUpdate(
    {
      _id: order._id,
      assignedDriver: req.user._id,
      'delivery.stage': { $in: PRE_PICKUP_STAGES },
      orderStatus: { $in: PICKUP_ORDER_STATUSES },
    },
    {
      $set: {
        'delivery.stage': 'picked_up',
        'delivery.pickedUpAt': now,
        ...(pickedItems ? { 'delivery.pickedItems': pickedItems, 'delivery.missingItems': missingItems } : {}),
      },
    },
    { new: true },
  );

  if (!claimed) {
    // Retried tap after a successful pickup → just return the current state.
    await respondWithOrder(res, order._id, req.user._id);
    return;
  }

  const previousStatus = claimed.orderStatus;
  if (previousStatus !== 'out_for_delivery') {
    claimed.orderStatus = 'out_for_delivery';
    pushStatusHistory(claimed, 'out_for_delivery', { changedBy: req.user._id, note: 'Picked up by driver' });
  }
  await ensureOrderTracking(claimed);
  await claimed.save();

  await logAudit({
    req,
    action: 'driver_pickup',
    entityType: 'order',
    entityId: claimed._id,
    entityLabel: claimed.orderNumber,
    changes: {
      orderStatus: { from: previousStatus, to: claimed.orderStatus },
      ...(missingItems?.length ? { missingItems } : {}),
    },
  });

  if (missingItems?.length) {
    const namesIn = (lang) => missingItems
      .map((i) => (lang === 'ar'
        ? order.items[i]?.nameAr || order.items[i]?.nameEn
        : order.items[i]?.nameEn || order.items[i]?.nameAr))
      .filter(Boolean);
    alertStore({
      order: claimed,
      titleAr: 'أصناف ناقصة عند الاستلام',
      titleEn: 'Items missing at pickup',
      messageAr: `المندوب استلم طلب #${claimed.orderNumber} بدون: ${namesIn('ar').join('، ')}`,
      messageEn: `Driver picked up order #${claimed.orderNumber} without: ${namesIn('en').join(', ')}`,
    });
  }

  if (previousStatus !== 'out_for_delivery') {
    (async () => {
      await notifyOrderStatusChange(claimed._id, 'out_for_delivery', previousStatus).catch(() => {});
      const populated = await Order.findById(claimed._id).populate('user', 'name email phone');
      if (!populated?.user) return;
      await notifyOrderTimeline(populated, populated.user, 'out_for_delivery').catch(() => {});
      await notifyCustomerOrderStatus(populated, populated.user, 'out_for_delivery', previousStatus).catch(() => {});
      await notifyCustomerTrackingLive(populated, populated.user).catch(() => {});
    })().catch((err) => console.error('Pickup notify failed:', err.message));
  }

  await respondWithOrder(res, claimed._id, req.user._id);
});

/** Driver is at the customer's door. */
export const arriveDriverDelivery = asyncHandler(async (req, res) => {
  const order = await loadOwnedOrderOr404(req);
  if (order.orderStatus !== 'out_for_delivery') {
    throw new AppError('Only out-for-delivery orders can be marked as arrived', 400);
  }
  await ensureDeliveryRun(order);

  const arrived = await Order.findOneAndUpdate(
    {
      _id: order._id,
      assignedDriver: req.user._id,
      orderStatus: 'out_for_delivery',
      'delivery.stage': { $in: ['assigned', 'accepted', 'picked_up', 'en_route'] },
    },
    { $set: { 'delivery.stage': 'arrived', 'delivery.arrivedAt': new Date() } },
    { new: true },
  ).populate('user', 'name email phone');

  if (arrived) {
    await DeliveryTracking.updateOne({ orderId: arrived._id }, { $set: { status: 'arrived' } });
    await logAudit({
      req,
      action: 'driver_arrive',
      entityType: 'order',
      entityId: arrived._id,
      entityLabel: arrived.orderNumber,
    });
    if (arrived.user) {
      const settings = await getDriverSettings();
      notifyCustomerDriverArrived(arrived, arrived.user, {
        includePin: isDeliveryPinRequired(arrived, settings),
      }).catch((err) => console.error('Arrival notify failed:', err.message));
    }
  }
  await respondWithOrder(res, order._id, req.user._id);
});

/** Log a contact attempt (call / WhatsApp / knocking at the door). */
export const logDriverContactAttempt = asyncHandler(async (req, res) => {
  const type = String(req.body.type || '');
  if (!['call', 'whatsapp', 'door'].includes(type)) {
    throw new AppError('Invalid contact attempt type', 400);
  }
  const order = await loadOwnedOrderOr404(req);
  if (order.orderStatus !== 'out_for_delivery') {
    throw new AppError('Contact attempts are only logged while out for delivery', 400);
  }
  await ensureDeliveryRun(order);
  await Order.updateOne(
    { _id: order._id, assignedDriver: req.user._id },
    { $push: { 'delivery.attempts': { $each: [{ type, at: new Date() }], $slice: -30 } } },
  );
  await respondWithOrder(res, order._id, req.user._id);
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
    status: status || (order.delivery?.stage === 'arrived' ? 'arrived' : 'en_route'),
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

  // First movement after pickup: the run is now en route.
  if (!order.delivery?.stage || ['assigned', 'accepted', 'picked_up'].includes(order.delivery.stage)) {
    if (!order.delivery?.stage) await ensureDeliveryRun(order);
    await Order.updateOne(
      { _id: order._id, 'delivery.stage': { $in: ['assigned', 'accepted', 'picked_up'] } },
      { $set: { 'delivery.stage': 'en_route', 'delivery.enRouteAt': new Date() } },
    );
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

/**
 * One location stream per driver: the app sends its position for the whole shift and the
 * server applies it to every order the driver has out for delivery. Keeps tracking alive
 * when the driver is on another screen or carrying several orders.
 */
export const updateDriverShiftLocation = asyncHandler(async (req, res) => {
  if (!(await getGpsDeliveryEnabled())) {
    throw new AppError('Live GPS delivery is disabled in store settings', 403);
  }
  const lat = Number(req.body.lat);
  const lng = Number(req.body.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    throw new AppError('Valid latitude and longitude are required', 400);
  }
  const heading = req.body.heading != null && Number.isFinite(Number(req.body.heading)) ? Number(req.body.heading) : null;
  const speed = req.body.speed != null && Number.isFinite(Number(req.body.speed)) ? Number(req.body.speed) : null;
  const now = new Date();

  await User.updateOne({ _id: req.user._id }, { $set: { driverLastLocation: { lat, lng, at: now } } });

  const orders = await Order.find({ assignedDriver: req.user._id, orderStatus: 'out_for_delivery' });
  const updated = [];
  for (const order of orders) {
    const point = {
      lat, lng, heading, speed,
      status: order.delivery?.stage === 'arrived' ? 'arrived' : 'en_route',
    };
    let tracking = await updateDriverTrackingLocation(order._id, point);
    if (!tracking) {
      if (!order.trackingEnabled) {
        await Order.updateOne({ _id: order._id }, { $set: { trackingEnabled: true } });
        order.trackingEnabled = true;
      }
      await ensureOrderTracking(order);
      tracking = await updateDriverTrackingLocation(order._id, point);
    }
    if (!tracking) continue;
    if (!order.delivery?.stage) await ensureDeliveryRun(order);
    await Order.updateOne(
      { _id: order._id, 'delivery.stage': { $in: ['assigned', 'accepted', 'picked_up'] } },
      { $set: { 'delivery.stage': 'en_route', 'delivery.enRouteAt': now } },
    );
    updated.push({ orderId: order._id, tracking });
  }

  res.json({ success: true, data: { updatedAt: now, orders: updated.length } });

  for (const { orderId, tracking } of updated) {
    notifyCustomerAfterPing(orderId, tracking)
      .catch((err) => console.error('Driver location notify failed:', err.message));
  }
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

/**
 * Validate what the store requires at handover (delivery code, cash amount, proof
 * photo, geofence). Throws with a `code` the app can react to. Returns the extra
 * fields to store on the delivery run.
 */
async function checkCompletionRequirements(order, req, settings, gpsDeliveryEnabled) {
  const deliverySet = {};

  if (isDeliveryPinRequired(order, settings)) {
    const failures = order.delivery?.pinFailures || 0;
    if (failures >= MAX_PIN_FAILURES) {
      throw new AppError('Too many wrong delivery codes — contact the store to complete this order', 423, 'PIN_LOCKED');
    }
    const entered = String(req.body.deliveryPin || '').trim();
    if (!entered || entered !== order.deliveryPin) {
      const after = await Order.findOneAndUpdate(
        { _id: order._id },
        { $inc: { 'delivery.pinFailures': 1 } },
        { new: true },
      ).select('delivery.pinFailures orderNumber');
      if ((after?.delivery?.pinFailures || 0) >= MAX_PIN_FAILURES) {
        alertStore({
          order,
          titleAr: 'كود الاستلام مقفل',
          titleEn: 'Delivery code locked',
          messageAr: `تم إدخال كود خاطئ ${MAX_PIN_FAILURES} مرات لطلب #${order.orderNumber}. أكمل الطلب من لوحة التحكم بعد التحقق.`,
          messageEn: `${MAX_PIN_FAILURES} wrong delivery codes for order #${order.orderNumber}. Complete it from the admin panel after checking.`,
        });
      }
      throw new AppError('Wrong delivery code — ask the customer for the 4-digit code', 400, 'PIN_INVALID');
    }
  }

  if (isProofPhotoRequired(order, settings) && !req.file) {
    throw new AppError('A proof-of-delivery photo is required', 400, 'PHOTO_REQUIRED');
  }

  const due = codAmountDue(order);
  if (settings.cashTrackingEnabled !== false && due > 0) {
    const collected = roundMoney(req.body.cashCollected);
    if (req.body.cashCollected === undefined || req.body.cashCollected === '' || !(collected >= due)) {
      throw new AppError(`Enter the cash received — at least ${due} EGP is due`, 400, 'CASH_REQUIRED');
    }
    deliverySet.cashDue = due;
    deliverySet.cashCollected = collected;
    deliverySet.changeGiven = roundMoney(collected - due);
  }

  const fence = Number(settings.geofenceMeters) || 0;
  if (gpsDeliveryEnabled && fence > 0) {
    const tracking = await DeliveryTracking.findOne({ orderId: order._id }).select('lat lng').lean();
    const distance = distanceToDestination(order, tracking);
    if (distance == null || distance > fence) {
      const reason = String(req.body.offsiteReason || '').trim();
      if (reason.length < 3) {
        const where = distance == null ? 'Your location is unknown' : `You are ${distance} m from the address`;
        throw new AppError(`${where} — add a reason to complete away from the door`, 400, 'OUTSIDE_GEOFENCE');
      }
      deliverySet.offsite = { distanceMeters: distance, reason: reason.slice(0, 300) };
    }
  }

  return deliverySet;
}

export const completeDriverDelivery = asyncHandler(async (req, res) => {
  const order = await loadOwnedOrderOr404(req);

  const flags = await getDriverOrderFlags();
  if (order.orderStatus === 'delivered') {
    // Retry of a completion that already went through.
    res.json({ success: true, data: formatDriverOrder(order, flags) });
    return;
  }
  if (order.orderStatus !== 'out_for_delivery') {
    throw new AppError('Only out-for-delivery orders can be updated by the driver', 400);
  }

  await ensureDeliveryRun(order);
  const deliverySet = await checkCompletionRequirements(order, req, flags.settings, flags.gpsDeliveryEnabled);

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
      deliverySet,
    });
  } catch (err) {
    if (proofPhoto?.publicId) await deleteFromCloudinary(proofPhoto.publicId);
    throw err;
  }
  if (!result.changed && proofPhoto?.publicId) {
    await deleteFromCloudinary(proofPhoto.publicId);
  }

  if (result.changed) {
    if (deliverySet.cashDue > 0) {
      await recordCodCollection({ order: result.order, driverId: req.user._id, amount: deliverySet.cashDue });
    }
    if (deliverySet.offsite) {
      alertStore({
        order: result.order,
        titleAr: 'تسليم بعيد عن العنوان',
        titleEn: 'Delivered away from the address',
        messageAr: `طلب #${order.orderNumber} سُلّم على بعد ${deliverySet.offsite.distanceMeters ?? '؟'} م. السبب: ${deliverySet.offsite.reason}`,
        messageEn: `Order #${order.orderNumber} completed ${deliverySet.offsite.distanceMeters ?? '?'} m away. Reason: ${deliverySet.offsite.reason}`,
      });
    }
    await logAudit({
      req,
      action: 'driver_complete_delivery',
      entityType: 'order',
      entityId: order._id,
      entityLabel: order.orderNumber,
      changes: {
        orderStatus: { from: result.previousStatus, to: result.nextStatus },
        ...(deliverySet.cashCollected != null ? { cashCollected: deliverySet.cashCollected } : {}),
        ...(deliverySet.offsite ? { offsite: deliverySet.offsite } : {}),
      },
    });
  }

  res.json({ success: true, data: formatDriverOrder(result.order, flags) });
});

export const failDriverDelivery = asyncHandler(async (req, res) => {
  const order = await loadOwnedOrderOr404(req);

  const { deliveryFailureReasonKey, deliveryFailureReason } = req.body;
  const settings = await getDriverSettings();
  const minAttempts = Number(settings.failMinContactAttempts) || 0;
  if (
    order.orderStatus === 'out_for_delivery'
    && minAttempts > 0
    && CONTACT_FAILURE_REASONS.includes(deliveryFailureReasonKey)
    && contactAttemptCount(order) < minAttempts
  ) {
    throw new AppError(
      `Try to reach the customer first — at least ${minAttempts} call or WhatsApp attempts are required`,
      400,
      'ATTEMPTS_REQUIRED',
    );
  }

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

export const getDriverCash = asyncHandler(async (req, res) => {
  const data = await getDriverCashSummary(req.user._id, { limit: 50 });
  res.json({ success: true, data });
});

/** After a failed delivery, the driver confirms the items are back at the store. */
export const returnDriverDelivery = asyncHandler(async (req, res) => {
  const order = await loadOwnedOrderOr404(req);
  if (order.orderStatus !== 'delivery_failed') {
    throw new AppError('Only failed deliveries can be returned to the store', 400);
  }
  await ensureDeliveryRun(order);
  const returned = await Order.findOneAndUpdate(
    { _id: order._id, assignedDriver: req.user._id, orderStatus: 'delivery_failed', 'delivery.stage': 'failed' },
    { $set: { 'delivery.stage': 'returned', 'delivery.returnedAt': new Date() } },
    { new: true },
  );
  if (returned) {
    alertStore({
      order: returned,
      titleAr: 'طلب رجع للفرع',
      titleEn: 'Order returned to store',
      messageAr: `المندوب أرجع أصناف طلب #${returned.orderNumber} للفرع — أعد المحاولة أو ألغِ الطلب.`,
      messageEn: `The driver returned order #${returned.orderNumber} to the store — reattempt or cancel it.`,
    });
  }
  await respondWithOrder(res, order._id, req.user._id);
});
