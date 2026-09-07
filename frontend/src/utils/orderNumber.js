import { normalizeOrderStatus } from './orderStatus';

/** Full order number — same value in admin, customer app, emails, and invoices. */
export function formatOrderNumber(orderNumber) {
  if (orderNumber == null || orderNumber === '') return '—';
  return String(orderNumber).trim();
}

/** @deprecated Use formatOrderNumber — kept for existing imports. */
export const formatOrderNumberShort = formatOrderNumber;

/** @deprecated Use formatOrderNumber — kept for existing imports. */
export const formatOrderNumberReference = formatOrderNumber;

const ACTIVE_STATUSES = new Set(['pending', 'confirmed', 'preparing', 'out_for_delivery']);
const COMPLETED_STATUSES = new Set(['delivered']);
const ISSUE_STATUSES = new Set(['delivery_failed', 'cancelled', 'returned']);

export function isOrderActive(status) {
  return ACTIVE_STATUSES.has(normalizeOrderStatus(status));
}

export function isOrderCompleted(status) {
  return COMPLETED_STATUSES.has(normalizeOrderStatus(status));
}

export function isOrderIssue(status) {
  return ISSUE_STATUSES.has(normalizeOrderStatus(status));
}

export const ORDER_LIST_FILTERS = [
  { id: 'all', labelAr: 'الكل', labelEn: 'All' },
  { id: 'active', labelAr: 'جارية', labelEn: 'Active' },
  { id: 'completed', labelAr: 'مكتملة', labelEn: 'Completed' },
  { id: 'issues', labelAr: 'تحتاج متابعة', labelEn: 'Needs attention' },
];

export function filterOrdersByTab(orders, tab) {
  if (tab === 'all') return orders;
  if (tab === 'active') {
    return orders.filter((o) => isOrderActive(o.orderStatus || o.status));
  }
  if (tab === 'completed') {
    return orders.filter((o) => isOrderCompleted(o.orderStatus || o.status));
  }
  if (tab === 'issues') {
    return orders.filter((o) => isOrderIssue(o.orderStatus || o.status));
  }
  return orders;
}
