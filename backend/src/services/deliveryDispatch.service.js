import Order from '../models/Order.js';
import User from '../models/User.js';
import FulfillmentLocation from '../models/FulfillmentLocation.js';
import { haversineMeters } from './googleMaps.service.js';
import { logAudit } from './auditLog.service.js';
import { createNotification } from './notification.service.js';
import { createUserNotification } from './userNotification.service.js';
import { getDriverSettings } from './storeSettings.service.js';
import { clearOrderTracking, ensureOrderTracking } from './deliveryTracking.service.js';
import { newDeliveryRun, PRE_PICKUP_STAGES } from './deliveryRun.service.js';

/**
 * Active delivery count per driver — orders currently out for delivery.
 * Returns a plain map: { [driverId]: count }.
 */
export async function getActiveDeliveryCounts() {
  const rows = await Order.aggregate([
    { $match: { orderStatus: 'out_for_delivery', assignedDriver: { $ne: null } } },
    { $group: { _id: '$assignedDriver', count: { $sum: 1 } } },
  ]);
  return Object.fromEntries(rows.map((row) => [String(row._id), row.count]));
}

/** A driver's last GPS fix older than this is ignored for distance ranking. */
const LOCATION_FRESH_MS = 15 * 60 * 1000;

/** Where the driver collects the order: its fulfillment branch, when it has one with coordinates. */
async function pickupPointFor(order) {
  const ref = order?.fulfillmentLocationId;
  if (!ref) return null;
  const location = ref.lat != null ? ref : await FulfillmentLocation.findById(ref).select('lat lng').lean();
  return location?.lat != null && location?.lng != null ? { lat: location.lat, lng: location.lng } : null;
}

/**
 * Choose the best driver for an automatic assignment, or null when none qualifies.
 * Ranking: fewest active deliveries first; then, when the order's pickup branch and the
 * driver's recent GPS are known, the closest driver; then whoever has been idle longest.
 * Drivers with no recent location rank after located ones at the same load.
 */
export async function pickAutoAssignDriver(driverSettings, { excludeId, order } = {}) {
  const settings = driverSettings || (await getDriverSettings());

  const query = { role: 'driver', isActive: { $ne: false } };
  if (settings.availabilityEnabled) {
    query.driverAvailable = { $ne: false };
  }
  if (excludeId) {
    query._id = { $ne: excludeId };
  }

  const drivers = await User.find(query)
    .select('name phone username driverAvailableAt lastLoginAt driverLastLocation')
    .lean();
  if (!drivers.length) return null;

  const [counts, pickup] = await Promise.all([getActiveDeliveryCounts(), pickupPointFor(order)]);
  const cap = Number(settings.autoAssignMaxActive) || 0;
  const now = Date.now();

  const ranked = drivers
    .map((driver) => {
      const loc = driver.driverLastLocation;
      const fresh = loc?.at && now - new Date(loc.at).getTime() <= LOCATION_FRESH_MS;
      return {
        driver,
        active: counts[String(driver._id)] || 0,
        distance: pickup && fresh ? haversineMeters(loc.lat, loc.lng, pickup.lat, pickup.lng) : Infinity,
        idleSince: new Date(driver.driverAvailableAt || driver.lastLoginAt || 0).getTime(),
      };
    })
    .filter((entry) => cap <= 0 || entry.active < cap)
    .sort((a, b) => a.active - b.active
      || (a.distance === b.distance ? 0 : a.distance < b.distance ? -1 : 1)
      || a.idleSince - b.idleSince);

  return ranked.length ? ranked[0].driver : null;
}

/**
 * Attach a driver automatically when an order ships with no driver assigned.
 * Mutates `order` (sets assignedDriver / assignedDriverAt) but does NOT save —
 * the caller persists. Returns the chosen driver doc, or null.
 */
export async function autoAssignDriverToOrder(order, { req } = {}) {
  if (!order || order.assignedDriver) return null;

  const settings = await getDriverSettings();
  if (!settings.autoAssignEnabled) return null;

  const driver = await pickAutoAssignDriver(settings, { order });

  if (!driver) {
    await createNotification({
      type: 'driver_unassigned',
      titleAr: 'لا يوجد مندوب متاح',
      titleEn: 'No driver available',
      messageAr: `طلب #${order.orderNumber} في الطريق بدون مندوب — لم يوجد مندوب متاح للتعيين التلقائي.`,
      messageEn: `Order #${order.orderNumber} is out for delivery with no driver — no driver was available for auto-assignment.`,
      link: `/admin/orders?order=${order._id}`,
      data: { orderId: order._id, orderNumber: order.orderNumber },
    }).catch((err) => console.error('Auto-assign alert failed:', err.message));
    return null;
  }

  order.assignedDriver = driver._id;
  order.assignedDriverAt = new Date();
  order.delivery = newDeliveryRun(order.assignedDriverAt);

  await logAudit({
    req,
    action: 'auto_assign_driver',
    entityType: 'order',
    entityId: order._id,
    entityLabel: order.orderNumber,
    changes: { assignedDriver: { from: null, to: String(driver._id) }, driverName: driver.name },
  });

  return driver;
}

const DRIVER_NOTICE_COPY = {
  assigned: {
    titleAr: 'طلب جديد لك',
    titleEn: 'New delivery assigned',
    messageAr: (n) => `تم تعيينك لطلب #${n} — جهّز نفسك للاستلام من الفرع.`,
    messageEn: (n) => `You've been assigned order #${n} — get ready to pick it up.`,
  },
  dispatched: {
    titleAr: 'طلب جاهز للتوصيل',
    titleEn: 'Delivery ready to go',
    messageAr: (n) => `طلب #${n} في الطريق الآن — ابدأ التوصيل وشارك موقعك.`,
    messageEn: (n) => `Order #${n} is out for delivery — start the trip and share your location.`,
  },
  pickup: {
    titleAr: 'استلام مرتجع',
    titleEn: 'Return pickup',
    messageAr: (n) => `مطلوب استلام مرتجع من عميل طلب #${n}.`,
    messageEn: (n) => `Collect a return from the customer of order #${n}.`,
  },
  unassigned: {
    titleAr: 'تم سحب طلب منك',
    titleEn: 'Delivery removed',
    messageAr: (n) => `لم يعد طلب #${n} معيّناً لك.`,
    messageEn: (n) => `Order #${n} is no longer assigned to you.`,
  },
};

/**
 * In-app notice to a driver about one of their orders. `kind` is
 * `assigned` | `dispatched` | `unassigned`. Never throws — a failed notice must not
 * fail the order update that triggered it.
 */
export async function notifyDriver(driverId, order, kind, { returnId = null } = {}) {
  const copy = DRIVER_NOTICE_COPY[kind];
  if (!driverId || !copy || !order) return;
  const isActive = kind !== 'unassigned';
  await createUserNotification({
    userId: driverId,
    type: isActive ? 'driver_assignment' : 'driver_unassigned',
    titleAr: copy.titleAr,
    titleEn: copy.titleEn,
    messageAr: copy.messageAr(order.orderNumber),
    messageEn: copy.messageEn(order.orderNumber),
    link: kind === 'pickup' && returnId
      ? `/driver/pickups/${order._id}/${returnId}`
      : isActive ? `/driver/deliveries/${order._id}` : '/driver',
    data: { orderId: order._id, orderNumber: order.orderNumber, kind, ...(returnId ? { returnId } : {}) },
  }).catch((err) => console.error('Driver notice failed:', err.message));
}

/**
 * Take an order back from a driver who declined it (or let it expire) before pickup,
 * and offer it to the next best driver when auto-assign is on. Atomic: only succeeds
 * while that driver still holds the order in a pre-pickup stage.
 * Returns { order, nextDriver } or null when the order had moved on.
 */
export async function releaseAssignment(orderId, driverId, { reason, req } = {}) {
  const released = await Order.findOneAndUpdate(
    { _id: orderId, assignedDriver: driverId, 'delivery.stage': { $in: PRE_PICKUP_STAGES } },
    { $set: { assignedDriver: null, assignedDriverAt: null, delivery: null } },
    { new: true },
  );
  if (!released) return null;

  await clearOrderTracking(released._id);
  await logAudit({
    req,
    action: reason === 'timeout' ? 'driver_assignment_expired' : 'driver_reject_delivery',
    entityType: 'order',
    entityId: released._id,
    entityLabel: released.orderNumber,
    changes: { assignedDriver: { from: String(driverId), to: null } },
  });
  if (reason === 'timeout') notifyDriver(driverId, released, 'unassigned');

  const settings = await getDriverSettings();
  let nextDriver = null;
  if (settings.autoAssignEnabled) {
    nextDriver = await pickAutoAssignDriver(settings, { excludeId: driverId, order: released });
    if (nextDriver) {
      const now = new Date();
      const claimed = await Order.findOneAndUpdate(
        { _id: released._id, assignedDriver: null },
        { $set: { assignedDriver: nextDriver._id, assignedDriverAt: now, delivery: newDeliveryRun(now) } },
        { new: true },
      );
      if (claimed) {
        if (claimed.orderStatus === 'out_for_delivery') await ensureOrderTracking(claimed);
        await claimed.save();
        notifyDriver(nextDriver._id, claimed, claimed.orderStatus === 'out_for_delivery' ? 'dispatched' : 'assigned');
        return { order: claimed, nextDriver };
      }
      nextDriver = null;
    }
  }

  const why = reason === 'timeout'
    ? { ar: 'لم يقبل المندوب الطلب في الوقت المحدد', en: 'the driver did not accept in time' }
    : { ar: 'رفض المندوب الطلب', en: 'the driver declined it' };
  await createNotification({
    type: 'driver_unassigned',
    titleAr: 'طلب يحتاج مندوباً',
    titleEn: 'Order needs a driver',
    messageAr: `طلب #${released.orderNumber} بدون مندوب — ${why.ar}.`,
    messageEn: `Order #${released.orderNumber} has no driver — ${why.en}.`,
    link: `/admin/orders?order=${released._id}`,
    data: { orderId: released._id, orderNumber: released.orderNumber },
  }).catch((err) => console.error('Release alert failed:', err.message));

  return { order: released, nextDriver: null };
}

/** Release assignments nobody accepted within `acceptTimeoutMin`. Returns how many moved. */
export async function releaseExpiredAssignments(now = Date.now()) {
  const settings = await getDriverSettings();
  const minutes = Number(settings.acceptTimeoutMin) || 0;
  if (minutes <= 0) return 0;

  const cutoff = new Date(now - minutes * 60 * 1000);
  const expired = await Order.find({
    assignedDriver: { $ne: null },
    'delivery.stage': 'assigned',
    'delivery.assignedAt': { $lte: cutoff },
    orderStatus: { $in: ['pending', 'confirmed', 'preparing', 'out_for_delivery'] },
  }).select('_id assignedDriver').limit(50).lean();

  let moved = 0;
  for (const row of expired) {
    const result = await releaseAssignment(row._id, row.assignedDriver, { reason: 'timeout' })
      .catch((err) => { console.error('Assignment release failed:', err.message); return null; });
    if (result) moved += 1;
  }
  return moved;
}

let expiryTimer = null;
export function startAssignmentExpiryJob(intervalMs = 60 * 1000) {
  if (expiryTimer) return;
  expiryTimer = setInterval(() => {
    releaseExpiredAssignments().catch((err) => console.error('Assignment expiry job failed:', err.message));
  }, intervalMs);
  expiryTimer.unref?.();
}
