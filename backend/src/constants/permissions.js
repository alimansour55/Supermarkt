import { ROLE_PERMISSIONS, STAFF_ROLES } from './roles.js';

/** All permission keys used across the admin panel. */
export const ALL_PERMISSIONS = [
  'dashboard:read',
  'orders:read',
  'orders:write',
  'orders:delete',
  'orders:reset',
  'support:chat',
  'products:read',
  'products:write',
  'products:delete',
  'categories:write',
  'brands:write',
  'coupons:write',
  'promotions:write',
  'banners:write',
  'homepage:write',
  'delivery:write',
  'settings:write',
  'content:write',
  'reviews:moderate',
  'reports:read',
  'audit:read',
  'notifications:read',
  'notifications:write',
  'users:read',
  'users:write',
  'sellers:read',
  'sellers:write',
];

export const PERMISSION_GROUPS = [
  {
    id: 'overview',
    labelEn: 'Overview',
    labelAr: 'الرئيسية',
    permissions: [
      { key: 'dashboard:read', labelEn: 'View dashboard', labelAr: 'عرض لوحة التحكم' },
    ],
  },
  {
    id: 'orders',
    labelEn: 'Orders & delivery',
    labelAr: 'الطلبات والتوصيل',
    permissions: [
      { key: 'orders:read', labelEn: 'View orders, invoices, chats & returns', labelAr: 'عرض الطلبات والفواتير والمحادثات والمرتجعات' },
      { key: 'orders:write', labelEn: 'Manage orders & fulfillment', labelAr: 'إدارة الطلبات والتنفيذ' },
      { key: 'orders:delete', labelEn: 'Recycle bin & permanent delete', labelAr: 'سلة المحذوفات والحذف النهائي' },
      { key: 'delivery:write', labelEn: 'Delivery zones & fulfillment', labelAr: 'التوصيل ومواقع الشحن' },
      { key: 'support:chat', labelEn: 'Live chat with customers', labelAr: 'الدردشة المباشرة مع العملاء' },
    ],
  },
  {
    id: 'catalog',
    labelEn: 'Store & catalog',
    labelAr: 'المتجر والمنتجات',
    permissions: [
      { key: 'products:read', labelEn: 'View products & stock alerts', labelAr: 'عرض المنتجات وتنبيهات المخزون' },
      { key: 'products:write', labelEn: 'Create & edit products', labelAr: 'إنشاء وتعديل المنتجات' },
      { key: 'products:delete', labelEn: 'Delete products', labelAr: 'حذف المنتجات' },
      { key: 'categories:write', labelEn: 'Categories', labelAr: 'الأقسام' },
      { key: 'brands:write', labelEn: 'Brands', labelAr: 'العلامات التجارية' },
      { key: 'reviews:moderate', labelEn: 'Review moderation', labelAr: 'إدارة التقييمات' },
      { key: 'coupons:write', labelEn: 'Coupons', labelAr: 'الكوبونات' },
      { key: 'promotions:write', labelEn: 'Offers & promotions', labelAr: 'العروض والتخفيضات' },
      { key: 'banners:write', labelEn: 'Banners & campaigns', labelAr: 'البانرات والحملات' },
    ],
  },
  {
    id: 'marketplace',
    labelEn: 'Marketplace sellers',
    labelAr: 'البائعون (السوق)',
    permissions: [
      { key: 'sellers:read', labelEn: 'View sellers & listing queue', labelAr: 'عرض البائعين وطابور المراجعة' },
      { key: 'sellers:write', labelEn: 'Approve sellers, listings & payouts', labelAr: 'اعتماد البائعين والمنتجات والمدفوعات' },
    ],
  },
  {
    id: 'customers',
    labelEn: 'Customers',
    labelAr: 'العملاء',
    permissions: [
      { key: 'users:read', labelEn: 'View customers', labelAr: 'عرض العملاء' },
      { key: 'users:write', labelEn: 'Manage customers & team', labelAr: 'إدارة العملاء والفريق' },
      { key: 'settings:write', labelEn: 'Loyalty & store settings', labelAr: 'الولاء وإعدادات المتجر' },
    ],
  },
  {
    id: 'content',
    labelEn: 'Content & storefront',
    labelAr: 'المحتوى وواجهة المتجر',
    permissions: [
      { key: 'homepage:write', labelEn: 'Homepage CMS', labelAr: 'إدارة الصفحة الرئيسية' },
      { key: 'content:write', labelEn: 'Content pages', labelAr: 'صفحات المحتوى' },
    ],
  },
  {
    id: 'analytics',
    labelEn: 'Reports & analytics',
    labelAr: 'التقارير والتحليلات',
    permissions: [
      { key: 'reports:read', labelEn: 'Revenue & reports', labelAr: 'الإيرادات والتقارير' },
      { key: 'audit:read', labelEn: 'Audit log', labelAr: 'سجل التدقيق' },
    ],
  },
  {
    id: 'system',
    labelEn: 'System',
    labelAr: 'النظام',
    permissions: [
      { key: 'notifications:read', labelEn: 'View notifications', labelAr: 'عرض الإشعارات' },
      { key: 'notifications:write', labelEn: 'Notification templates', labelAr: 'قوالب الإشعارات' },
    ],
  },
];

/** Role templates — permissions derived from ROLE_PERMISSIONS when stored permissions are empty. */
export const ROLE_PRESET_PERMISSIONS = {
  manager: ALL_PERMISSIONS.filter((key) => ROLE_PERMISSIONS[key]?.includes('manager')),
  admin: ALL_PERMISSIONS.filter((key) => ROLE_PERMISSIONS[key]?.includes('admin')),
};

export function permissionsForRole(role) {
  if (role === 'super_admin') return [...ALL_PERMISSIONS];
  return ALL_PERMISSIONS.filter((key) => ROLE_PERMISSIONS[key]?.includes(role));
}

export function resolveUserPermissions(user) {
  if (!user) return [];
  if (user.role === 'super_admin') return [...ALL_PERMISSIONS];
  if (Array.isArray(user.permissions) && user.permissions.length > 0) {
    return user.permissions.filter((key) => ALL_PERMISSIONS.includes(key));
  }
  return permissionsForRole(user.role);
}

export function hasUserPermission(user, permission) {
  if (!user || !STAFF_ROLES.includes(user.role)) return false;
  return resolveUserPermissions(user).includes(permission);
}

/** Permissions a super_admin can never delegate away, even via custom permission sets. */
const NON_DELEGABLE_PERMISSIONS = ['users:write', 'orders:reset'];

export function sanitizeAssignablePermissions(permissions) {
  if (!Array.isArray(permissions)) return [];
  return [...new Set(permissions.filter((key) => ALL_PERMISSIONS.includes(key) && !NON_DELEGABLE_PERMISSIONS.includes(key)))];
}
