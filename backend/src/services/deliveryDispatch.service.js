import Order from '../models/Order.js';
import User from '../models/User.js';
import { logAudit } from './auditLog.service.js';
import { createNotification } from './notification.service.js';
import { createUserNotification } from './userNotification.service.js';
import { getDriverSettings } from './storeSettings.service.js';

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

/**
 * Choose the best driver for an automatic assignment, or null when none qualifies.
 * Least-busy first, ties broken by the driver who has been idle longest.
 */
export async function pickAutoAssignDriver(driverSettings, { excludeId } = {}) {
  const settings = driverSettings || (await getDriverSettings());

  const query = { role: 'driver', isActive: { $ne: false } };
  if (settings.availabilityEnabled) {
    query.driverAvailable = { $ne: false };
  }
  if (excludeId) {
    query._id = { $ne: excludeId };
  }

  const drivers = await User.find(query)
    .select('name phone username driverAvailableAt lastLoginAt')
    .lean();
  if (!drivers.length) return null;

  const counts = await getActiveDeliveryCounts();
  const cap = Number(settings.autoAssignMaxActive) || 0;

  const ranked = drivers
    .map((driver) => ({
      driver,
      active: counts[String(driver._id)] || 0,
      idleSince: new Date(driver.driverAvailableAt || driver.lastLoginAt || 0).getTime(),
    }))
    .filter((entry) => cap <= 0 || entry.active < cap)
    .sort((a, b) => a.active - b.active || a.idleSince - b.idleSince);

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

  const driver = await pickAutoAssignDriver(settings);

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
export async function notifyDriver(driverId, order, kind) {
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
    link: isActive ? `/driver/deliveries/${order._id}` : '/driver',
    data: { orderId: order._id, orderNumber: order.orderNumber, kind },
  }).catch((err) => console.error('Driver notice failed:', err.message));
}
