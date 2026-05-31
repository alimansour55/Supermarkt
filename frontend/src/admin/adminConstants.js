import {
  LayoutDashboard,
  Package,
  FolderOpen,
  ShoppingCart,
  Users,
  Tag,
  Image,
  BarChart3,
  ScrollText,
} from 'lucide-react';

export const ORDER_STATUSES = [
  { value: 'pending', labelAr: 'قيد الانتظار', labelEn: 'Pending', color: 'bg-amber-100 text-amber-800' },
  { value: 'confirmed', labelAr: 'مؤكد', labelEn: 'Confirmed', color: 'bg-blue-100 text-blue-800' },
  { value: 'preparing', labelAr: 'جاري التجهيز', labelEn: 'Preparing', color: 'bg-indigo-100 text-indigo-800' },
  { value: 'out_for_delivery', labelAr: 'في الطريق', labelEn: 'Out for delivery', color: 'bg-purple-100 text-purple-800' },
  { value: 'delivered', labelAr: 'تم التسليم', labelEn: 'Delivered', color: 'bg-green-100 text-green-800' },
  { value: 'cancelled', labelAr: 'ملغي', labelEn: 'Cancelled', color: 'bg-red-100 text-red-800' },
];

export const getOrderStatus = (value) => ORDER_STATUSES.find((s) => s.value === value) || ORDER_STATUSES[0];

export const PAYMENT_STATUSES = [
  { value: 'pending', labelAr: 'قيد الدفع', labelEn: 'Pending', color: 'bg-amber-100 text-amber-800' },
  { value: 'paid', labelAr: 'مدفوع', labelEn: 'Paid', color: 'bg-green-100 text-green-800' },
  { value: 'failed', labelAr: 'فشل', labelEn: 'Failed', color: 'bg-red-100 text-red-800' },
  { value: 'refunded', labelAr: 'مسترد', labelEn: 'Refunded', color: 'bg-slate-100 text-slate-700' },
];

export const getPaymentStatus = (value) =>
  PAYMENT_STATUSES.find((s) => s.value === value) || PAYMENT_STATUSES[0];

/** Simplified fulfillment timeline shown in admin order panel */
export const ORDER_TIMELINE = [
  { step: 'placed', statuses: ['pending'], labelEn: 'Placed', labelAr: 'تم الطلب' },
  { step: 'confirmed', statuses: ['confirmed', 'preparing'], labelEn: 'Confirmed', labelAr: 'مؤكد' },
  { step: 'shipped', statuses: ['out_for_delivery'], labelEn: 'Shipped', labelAr: 'تم الشحن' },
  { step: 'delivered', statuses: ['delivered'], labelEn: 'Delivered', labelAr: 'تم التسليم' },
];

export const ORDER_QUICK_ACTIONS = [
  { status: 'confirmed', labelEn: 'Mark as Confirmed', labelAr: 'تعيين كمؤكد' },
  { status: 'out_for_delivery', labelEn: 'Mark as Shipped', labelAr: 'تعيين كشحن' },
  { status: 'delivered', labelEn: 'Mark as Delivered', labelAr: 'تعيين كمُسلّم' },
  { status: 'cancelled', labelEn: 'Mark as Cancelled', labelAr: 'تعيين كملغي' },
];

export function orderTimelineIndex(orderStatus) {
  if (orderStatus === 'cancelled') return -1;
  const idx = ORDER_TIMELINE.findIndex((step) => step.statuses.includes(orderStatus));
  return idx >= 0 ? idx : 0;
}

/** Suggested next status for the primary quick-action button */
export const ORDER_NEXT_STATUS = {
  pending: 'confirmed',
  confirmed: 'out_for_delivery',
  preparing: 'out_for_delivery',
  out_for_delivery: 'delivered',
};

export function getPrimaryOrderAction(currentStatus) {
  const next = ORDER_NEXT_STATUS[currentStatus];
  if (!next) return null;
  return ORDER_QUICK_ACTIONS.find((a) => a.status === next) || null;
}

export const ADMIN_PAGE_SIZE = 20;

/** Hex colors for Recharts (matches order status semantics) */
export const ORDER_STATUS_CHART_COLORS = {
  pending: '#f59e0b',
  confirmed: '#3b82f6',
  preparing: '#6366f1',
  out_for_delivery: '#a855f7',
  delivered: '#22c55e',
  cancelled: '#ef4444',
};

export const ADMIN_NAV = [
  { path: '/admin', labelAr: 'لوحة التحكم', labelEn: 'Dashboard', Icon: LayoutDashboard, permission: 'dashboard:read' },
  { path: '/admin/products', labelAr: 'المنتجات', labelEn: 'Products', Icon: Package, permission: 'products:read' },
  { path: '/admin/categories', labelAr: 'الأقسام', labelEn: 'Categories', Icon: FolderOpen, permission: 'categories:write' },
  {
    path: '/admin/orders',
    labelAr: 'الطلبات',
    labelEn: 'Orders',
    Icon: ShoppingCart,
    badgeKey: 'pendingOrders',
    permission: 'orders:read',
  },
  { path: '/admin/reports', labelAr: 'التقارير', labelEn: 'Reports', Icon: BarChart3, permission: 'reports:read' },
  { path: '/admin/users', labelAr: 'المستخدمين', labelEn: 'Users', Icon: Users, permission: 'users:read' },
  { path: '/admin/coupons', labelAr: 'كوبونات', labelEn: 'Coupons', Icon: Tag, permission: 'coupons:write' },
  { path: '/admin/banners', labelAr: 'البانرات', labelEn: 'Banners', Icon: Image, permission: 'banners:write' },
  { path: '/admin/audit-log', labelAr: 'سجل التدقيق', labelEn: 'Audit log', Icon: ScrollText, permission: 'audit:read' },
];
