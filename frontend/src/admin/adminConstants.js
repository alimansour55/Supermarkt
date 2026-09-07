import {
  ORDER_STATUSES,
  ORDER_STATUS_CHART_COLORS,
  getOrderStatusEntry,
} from '../constants/orderFlow';

export { ORDER_STATUSES, ORDER_STATUS_CHART_COLORS };
export const getOrderStatus = getOrderStatusEntry;

export const PAYMENT_STATUSES = [
  { value: 'pending', labelAr: 'قيد الدفع', labelEn: 'Pending', color: 'bg-amber-100 text-amber-800' },
  { value: 'paid', labelAr: 'مدفوع', labelEn: 'Paid', color: 'bg-green-100 text-green-800' },
  { value: 'failed', labelAr: 'فشل', labelEn: 'Failed', color: 'bg-red-100 text-red-800' },
  { value: 'refunded', labelAr: 'مسترد', labelEn: 'Refunded', color: 'bg-slate-100 text-slate-700' },
];

export const getPaymentStatus = (value) =>
  PAYMENT_STATUSES.find((s) => s.value === value) || PAYMENT_STATUSES[0];

export const ADMIN_PAGE_SIZE = 20;

export { ADMIN_NAV, ADMIN_NAV_GROUPS } from './adminNavGroups';
