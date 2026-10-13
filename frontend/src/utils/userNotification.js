const TRACKING_TYPES = new Set([
  'order_tracking_live',
  'order_driver_location',
  'order_eta_update',
  'order_driver_assigned',
]);

const TRACKING_STATUSES = new Set(['out_for_delivery']);

/** Normalize MongoDB ObjectId / string order id from notification payload */
export function resolveNotificationOrderId(notification) {
  const raw = notification?.data?.orderId;
  if (!raw) return null;
  if (typeof raw === 'string') return raw;
  if (typeof raw === 'object' && raw._id) return String(raw._id);
  return String(raw);
}

/** Resolve in-app route for a customer notification */
const DRIVER_TYPES = new Set(['driver_assignment', 'driver_unassigned']);

export function getUserNotificationHref(notification) {
  // Driver notices point into the driver app, never the customer order page.
  if (DRIVER_TYPES.has(notification?.type)) {
    const stored = notification?.link;
    return typeof stored === 'string' && stored.startsWith('/driver') ? stored : '/driver';
  }

  const orderId = resolveNotificationOrderId(notification);
  if (orderId) {
    const type = notification?.type;
    const status = notification?.data?.status;
    const openTracking = TRACKING_TYPES.has(type)
      || (type === 'order_status' && TRACKING_STATUSES.has(status));
    const path = `/orders/${orderId}`;
    return openTracking ? `${path}?track=1` : path;
  }

  const stored = notification?.link;
  if (typeof stored === 'string' && stored.startsWith('/')) {
    return stored;
  }
  return '/orders';
}

export function getUserNotificationActionLabel(notification, isAr) {
  const type = notification?.type;
  if (type === 'driver_assignment') return isAr ? 'فتح الطلب' : 'Open delivery';
  if (type === 'driver_unassigned') return isAr ? 'طلباتي' : 'My deliveries';
  const status = notification?.data?.status;
  if (TRACKING_TYPES.has(type) || (type === 'order_status' && status === 'out_for_delivery')) {
    return isAr ? 'تتبع التوصيل' : 'Track delivery';
  }
  return isAr ? 'عرض الطلب' : 'View order';
}

export function notificationShowsOrderNumber(notification) {
  return Boolean(notification?.data?.orderNumber);
}
