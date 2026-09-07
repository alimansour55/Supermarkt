import DeliveryTracking from '../models/DeliveryTracking.js';
import Order from '../models/Order.js';
import { ORDER_STATUSES } from '../constants/orderStatuses.js';
import { sendOrderSms } from './orderNotification.service.js';
import {
  createUserNotification,
  wasRecentlyNotified,
} from './userNotification.service.js';

const LOCATION_NOTIFY_THROTTLE_MS = 2 * 60 * 1000;
const ETA_NEARBY_SECONDS = 20 * 60;

function statusLabel(status, lang = 'ar') {
  const row = ORDER_STATUSES.find((s) => s.value === status);
  return row ? (lang === 'ar' ? row.labelAr : row.labelEn) : status;
}

export function buildOrderTrackingUrl(orderId) {
  const base = (process.env.CLIENT_URL || '').replace(/\/$/, '');
  if (!base || !orderId) return '';
  return `${base}/orders/${orderId}?track=1`;
}

function resolveUserId(order, user) {
  return user?._id || order?.user?._id || order?.user || null;
}

function resolvePhone(order, user) {
  return order?.phone || user?.phone || null;
}

function buildNotificationLink(type, orderId, extra = {}) {
  const id = String(orderId);
  const trackingTypes = [
    'order_tracking_live',
    'order_driver_location',
    'order_eta_update',
    'order_driver_assigned',
  ];
  const openTrack = trackingTypes.includes(type)
    || (type === 'order_status' && extra.status === 'out_for_delivery');
  return openTrack ? `/orders/${id}?track=1` : `/orders/${id}`;
}

async function notifyInApp({
  userId,
  type,
  titleAr,
  titleEn,
  messageAr,
  messageEn,
  orderId,
  orderNumber,
  link,
  extra = {},
}) {
  if (!userId) return null;
  const id = String(orderId);
  return createUserNotification({
    userId,
    type,
    titleAr,
    titleEn,
    messageAr,
    messageEn,
    link: link || buildNotificationLink(type, id, extra),
    data: { orderId: id, orderNumber, ...extra },
  });
}

async function sendTrackingSms(phone, templateKey, order, lang, extras = {}) {
  if (!phone) return { skipped: true };
  return sendOrderSms(phone, templateKey, { ...order, ...extras }, lang);
}

export async function notifyCustomerOrderStatus(order, user, newStatus, previousStatus, lang = 'ar') {
  if (!newStatus || newStatus === previousStatus) return;

  const userId = resolveUserId(order, user);
  const orderNumber = order.orderNumber;
  const orderId = order._id;
  const trackUrl = buildOrderTrackingUrl(orderId);

  const titleAr = 'تحديث حالة الطلب';
  const titleEn = 'Order status update';
  const messageAr = `طلب #${orderNumber}: ${statusLabel(newStatus, 'ar')}`;
  const messageEn = `Order #${orderNumber}: ${statusLabel(newStatus, 'en')}`;

  await notifyInApp({
    userId,
    type: 'order_status',
    titleAr,
    titleEn,
    messageAr,
    messageEn,
    orderId,
    orderNumber,
    extra: { status: newStatus, previousStatus },
  });

  if (['out_for_delivery', 'delivered', 'delivery_failed', 'cancelled'].includes(newStatus)) {
    if (newStatus === 'out_for_delivery' && trackUrl) {
      await DeliveryTracking.findOneAndUpdate(
        { orderId },
        { $set: { trackingLinkSmsSent: true } },
        { upsert: false },
      );
    }
  }
}

export async function notifyCustomerDriverAssigned(order, user, driver, lang = 'ar') {
  const userId = resolveUserId(order, user);
  const phone = resolvePhone(order, user);
  const orderNumber = order.orderNumber;
  const orderId = order._id;
  const driverName = driver?.name || (lang === 'ar' ? 'مندوب التوصيل' : 'your driver');
  const trackUrl = buildOrderTrackingUrl(orderId);

  await notifyInApp({
    userId,
    type: 'order_driver_assigned',
    titleAr: 'مندوب في الطريق',
    titleEn: 'Driver assigned',
    messageAr: `تم تعيين ${driverName} لتوصيل طلب #${orderNumber}`,
    messageEn: `${driverName} is assigned to deliver order #${orderNumber}`,
    orderId,
    orderNumber,
    extra: { driverId: driver?._id, driverName },
  });

  if (order.orderStatus === 'out_for_delivery' && trackUrl) {
    await sendTrackingSms(phone, 'driver_assigned', order, lang, { trackUrl, driverName });
    await DeliveryTracking.findOneAndUpdate(
      { orderId },
      { $set: { trackingLinkSmsSent: true } },
      { upsert: false },
    );
  }
}

export async function notifyCustomerTrackingLive(order, user, lang = 'ar', { skipInApp = false } = {}) {
  const userId = resolveUserId(order, user);
  const phone = resolvePhone(order, user);
  const orderNumber = order.orderNumber;
  const orderId = order._id;
  const trackUrl = buildOrderTrackingUrl(orderId);

  const tracking = await DeliveryTracking.findOne({ orderId }).lean();
  if (tracking?.trackingLinkSmsSent && skipInApp) return;

  if (!skipInApp) {
    const recent = await wasRecentlyNotified(userId, orderId, 'order_tracking_live', 30 * 60 * 1000);
    if (!recent) {
      await notifyInApp({
        userId,
        type: 'order_tracking_live',
        titleAr: 'تتبع مباشر متاح',
        titleEn: 'Live tracking available',
        messageAr: `يمكنك الآن متابعة موقع المندوب لطلب #${orderNumber} على الخريطة`,
        messageEn: `You can now track your driver for order #${orderNumber} on the map`,
        orderId,
        orderNumber,
      });
    }
  }

  if (trackUrl && !tracking?.trackingLinkSmsSent) {
    await sendTrackingSms(phone, 'tracking_live', order, lang, { trackUrl });
    await DeliveryTracking.findOneAndUpdate(
      { orderId },
      { $set: { trackingLinkSmsSent: true } },
      { upsert: false },
    );
  }
}

export async function notifyCustomerDriverLocation(order, user, tracking, routeMeta = {}, lang = 'ar') {
  if (!tracking?.lat || !tracking?.lng) return;

  const userId = resolveUserId(order, user);
  const phone = resolvePhone(order, user);
  const orderNumber = order.orderNumber;
  const orderId = order._id;
  const etaText = routeMeta.etaText || '';
  const etaSeconds = routeMeta.etaSeconds || null;

  const recentLocation = await wasRecentlyNotified(
    userId,
    orderId,
    'order_driver_location',
    LOCATION_NOTIFY_THROTTLE_MS,
  );

  if (!recentLocation) {
    const messageAr = etaText
      ? `تم تحديث موقع المندوب لطلب #${orderNumber}. الوصول المتوقع: ${etaText}`
      : `تم تحديث موقع المندوب لطلب #${orderNumber}`;
    const messageEn = etaText
      ? `Driver location updated for order #${orderNumber}. ETA: ${etaText}`
      : `Driver location updated for order #${orderNumber}`;

    await notifyInApp({
      userId,
      type: 'order_driver_location',
      titleAr: 'تحديث موقع المندوب',
      titleEn: 'Driver location update',
      messageAr,
      messageEn,
      orderId,
      orderNumber,
      extra: { etaText, lat: tracking.lat, lng: tracking.lng },
    });
  }

  const dbTracking = await DeliveryTracking.findOne({ orderId }).lean();

  if (!dbTracking?.firstLocationSmsSent) {
    const trackUrl = buildOrderTrackingUrl(orderId);
    await sendTrackingSms(phone, 'driver_location', order, lang, { trackUrl, etaText });
    await DeliveryTracking.findOneAndUpdate(
      { orderId },
      { $set: { firstLocationSmsSent: true } },
      { upsert: false },
    );
  }

  if (
    etaSeconds
    && etaSeconds <= ETA_NEARBY_SECONDS
    && !dbTracking?.etaAlertSmsSent
  ) {
    await notifyInApp({
      userId,
      type: 'order_eta_update',
      titleAr: 'المندوب قريب',
      titleEn: 'Driver is nearby',
      messageAr: `مندوب طلب #${orderNumber} على وشك الوصول${etaText ? ` (${etaText})` : ''}`,
      messageEn: `Your driver for order #${orderNumber} is almost there${etaText ? ` (${etaText})` : ''}`,
      orderId,
      orderNumber,
      extra: { etaText, etaSeconds },
    });
    await sendTrackingSms(phone, 'driver_nearby', order, lang, { etaText });
    await DeliveryTracking.findOneAndUpdate(
      { orderId },
      { $set: { etaAlertSmsSent: true } },
      { upsert: false },
    );
  }
}

export async function loadOrderForCustomerNotify(orderId) {
  return Order.findById(orderId).populate('user', 'name email phone').populate('assignedDriver', 'name phone');
}

export async function notifyTrackingUpdateFromOrder(order, options = {}) {
  const { routeMeta, lang = 'ar', event = 'location' } = options;
  const user = order.user;
  if (!user) return;

  if (event === 'driver_assigned' && order.assignedDriver) {
    const driver = typeof order.assignedDriver === 'object'
      ? order.assignedDriver
      : null;
    await notifyCustomerDriverAssigned(order, user, driver, lang);
    return;
  }

  if (event === 'tracking_live') {
    await notifyCustomerTrackingLive(order, user, lang);
    return;
  }

  if (event === 'location') {
    const tracking = await DeliveryTracking.findOne({ orderId: order._id }).lean();
    if (tracking) {
      await notifyCustomerDriverLocation(order, user, tracking, routeMeta, lang);
    }
  }
}
