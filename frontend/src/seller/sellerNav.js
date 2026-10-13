import {
  BarChart3, Bell, Boxes, History, Lock, ClipboardList, FileText, Gauge, HelpCircle, LayoutDashboard, Landmark, Package, PackagePlus,
  Settings, Star, Store, Tags, Truck, Upload, Users, Wallet, Warehouse,
} from 'lucide-react';

/**
 * Seller Center menu, grouped like Amazon Seller Central. An item is active when the path
 * matches and — if the link carries a query — every one of its params matches too.
 * `badge` names a key of /seller/summary; `storeOnly` / `ownerOnly` hide items the seller
 * can't use.
 */
export const SELLER_NAV = [
  { id: 'home', to: '/seller-center', end: true, ar: 'الرئيسية', en: 'Home', Icon: LayoutDashboard },
  {
    id: 'catalog',
    ar: 'الكتالوج',
    en: 'Catalog',
    Icon: Package,
    children: [
      { to: '/seller-center/products', ar: 'كل المنتجات', en: 'All products', Icon: Boxes, badge: 'rejected', badgeTone: 'red', perm: 'products' },
      { to: '/seller-center/products/new', ar: 'إضافة منتج', en: 'Add a product', Icon: PackagePlus, perm: 'products' },
      { to: '/seller-center/inventory', ar: 'إدارة المخزون والأسعار', en: 'Manage inventory', Icon: Warehouse, badge: 'outOfStock', badgeTone: 'amber', perm: 'products' },
      { to: '/seller-center/categories', ar: 'أقسام متجري', en: 'My store sections', Icon: Tags, perm: 'products' },
      { to: '/seller-center/products?import=1', ar: 'استيراد بالجملة (CSV)', en: 'Bulk import (CSV)', Icon: Upload, perm: 'products' },
    ],
  },
  {
    id: 'orders',
    ar: 'الطلبات',
    en: 'Orders',
    Icon: ClipboardList,
    children: [
      { to: '/seller-center/orders', ar: 'كل الطلبات', en: 'Manage orders', Icon: ClipboardList, exactQuery: true, perm: 'orders' },
      { to: '/seller-center/orders?status=pending', ar: 'بانتظار التأكيد', en: 'To confirm', Icon: Bell, badge: 'toConfirm', badgeTone: 'red', perm: 'orders' },
      { to: '/seller-center/orders?status=confirmed', ar: 'جاهزة للشحن', en: 'To ship', Icon: Truck, badge: 'toShip', badgeTone: 'indigo', perm: 'orders' },
      { to: '/seller-center/inbound', ar: 'شحنات لمخزننا', en: 'Send stock to us', Icon: Warehouse, storeOnly: true, perm: 'products' },
    ],
  },
  {
    id: 'payments',
    ar: 'المدفوعات',
    en: 'Payments',
    Icon: Wallet,
    children: [
      { to: '/seller-center/finance', ar: 'الرصيد والتحويلات', en: 'Balance & payouts', Icon: Wallet, perm: 'finance' },
      { to: '/seller-center/store/payout', ar: 'بيانات استلام الأرباح', en: 'Payout details', Icon: Landmark, ownerOnly: true },
    ],
  },
  { id: 'reports', to: '/seller-center/reports', ar: 'تقارير المبيعات', en: 'Business reports', Icon: BarChart3, perm: 'reports' },
  {
    id: 'performance',
    ar: 'الأداء',
    en: 'Performance',
    Icon: Gauge,
    children: [
      { to: '/seller-center/performance', ar: 'صحة الحساب', en: 'Account health', Icon: Gauge },
      { to: '/seller-center/reviews', ar: 'تقييمات العملاء', en: 'Customer feedback', Icon: Star },
    ],
  },
  {
    id: 'store',
    ar: 'إعدادات المتجر',
    en: 'Store settings',
    Icon: Settings,
    children: [
      { to: '/seller-center/store', end: true, ar: 'بيانات وواجهة المتجر', en: 'Store profile', Icon: Store, perm: 'store' },
      { to: '/seller-center/store/documents', ar: 'المستندات', en: 'Documents', Icon: FileText, perm: 'store' },
      { to: '/seller-center/store/team', ar: 'فريق العمل', en: 'Team & logins', Icon: Users, ownerOnly: true },
      { to: '/seller-center/store/security', ar: 'الأمان وتسجيل الدخول', en: 'Login & security', Icon: Lock },
      { to: '/seller-center/activity', ar: 'سجل النشاط', en: 'Activity log', Icon: History, ownerOnly: true },
    ],
  },
  { id: 'notifications', to: '/seller-center/notifications', ar: 'الإشعارات', en: 'Notifications', Icon: Bell, badge: 'unreadNotifications', badgeTone: 'red' },
  { id: 'help', to: '/seller-center/help', ar: 'مركز المساعدة', en: 'Help center', Icon: HelpCircle },
];

const ALL_PATHS = new Set(SELLER_NAV.flatMap((g) => [g, ...(g.children || [])]).filter((i) => i.to).map((i) => i.to.split('?')[0]));

export function navItemActive(item, location) {
  const [path, query] = item.to.split('?');
  const here = location.pathname.replace(/\/+$/, '') || '/';
  const current = new URLSearchParams(location.search);
  if (query) {
    if (here !== path) return false;
    const wanted = new URLSearchParams(query);
    // "To ship" covers both confirmed and packed orders.
    return [...wanted.entries()].every(([k, v]) => current.get(k) === v || (v === 'confirmed' && current.get(k) === 'packed'));
  }
  // Sub-pages (e.g. a product's editor) light up their parent link, unless they have a link of their own.
  const matches = here === path || (!item.end && here.startsWith(`${path}/`) && !ALL_PATHS.has(here));
  if (!matches) return false;
  if (item.exactQuery) return !current.get('status');
  return !current.get('import');
}

export function visibleNav({ isOwner, storeFulfillment, permissions = [] }) {
  const keep = (i) => (!i.ownerOnly || isOwner) && (!i.storeOnly || storeFulfillment) && (!i.perm || permissions.includes(i.perm));
  return SELLER_NAV.filter(keep)
    .map((g) => (g.children ? { ...g, children: g.children.filter(keep) } : g))
    .filter((g) => !g.children || g.children.length > 0);
}
