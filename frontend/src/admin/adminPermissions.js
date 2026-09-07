export const STAFF_ROLES = ['manager', 'admin', 'super_admin'];

export const ROLE_LABELS = {
  user: { en: 'Customer', ar: 'عميل' },
  manager: { en: 'Operations', ar: 'تشغيل يومي' },
  admin: { en: 'Store admin', ar: 'إدارة المتجر' },
  super_admin: { en: 'Owner', ar: 'مالك النظام' },
  driver: { en: 'Delivery driver', ar: 'مندوب توصيل' },
};

/** Plain-language guide for the team account role picker (not duplicates — 3 levels + custom). */
export const ROLE_GUIDE = {
  manager: {
    en: {
      summary: 'Handles orders and products. Cannot change store settings, coupons, or homepage.',
      bestFor: 'Order desk, stock & fulfillment staff',
    },
    ar: {
      summary: 'يتعامل مع الطلبات والمنتجات. لا يغيّر إعدادات المتجر أو الكوبونات أو الصفحة الرئيسية.',
      bestFor: 'موظف طلبات، مخزون، وتجهيز',
    },
  },
  admin: {
    en: {
      summary: 'Runs the whole store — catalog, offers, settings & reports. Cannot add/remove team logins.',
      bestFor: 'Store manager, marketing, catalog lead',
    },
    ar: {
      summary: 'يدير المتجر بالكامل — منتجات وعروض وإعدادات وتقارير. لا ينشئ أو يحذف حسابات الفريق.',
      bestFor: 'مدير متجر، تسويق، مسؤول كتالوج',
    },
  },
  super_admin: {
    en: {
      summary: 'Full access including Admin team — create accounts, assign roles, remove other admins.',
      bestFor: 'Business owner or IT lead (keep 1–2 accounts only)',
    },
    ar: {
      summary: 'صلاحيات كاملة بما فيها فريق الإدارة — إنشاء الحسابات وتعيين الأدوار وحذف المسؤولين الآخرين.',
      bestFor: 'صاحب المتجر أو مسؤول تقنية (احتفظ بحساب أو اثنين فقط)',
    },
  },
  driver: {
    en: {
      summary: 'Delivery driver only — sees assigned orders, shares live GPS, no admin panel access.',
      bestFor: 'Courier / delivery staff on the road',
    },
    ar: {
      summary: 'مندوب توصيل فقط — يرى الطلبات المعيّنة ويشارك الموقع المباشر، بدون دخول لوحة التحكم.',
      bestFor: 'مندوب توصيل / سائق',
    },
  },
  custom: {
    en: {
      summary: 'You choose each permission manually — for special cases only.',
      bestFor: 'e.g. “returns only” or “reports read-only”',
    },
    ar: {
      summary: 'تختار كل صلاحية يدوياً — للحالات الخاصة فقط.',
      bestFor: 'مثال: «مرتجعات فقط» أو «تقارير للعرض»',
    },
  },
};

export const ROLE_DESCRIPTIONS = {
  super_admin: {
    en: ROLE_GUIDE.super_admin.en.summary,
    ar: ROLE_GUIDE.super_admin.ar.summary,
  },
  admin: {
    en: ROLE_GUIDE.admin.en.summary,
    ar: ROLE_GUIDE.admin.ar.summary,
  },
  manager: {
    en: ROLE_GUIDE.manager.en.summary,
    ar: ROLE_GUIDE.manager.ar.summary,
  },
  driver: {
    en: ROLE_GUIDE.driver.en.summary,
    ar: ROLE_GUIDE.driver.ar.summary,
  },
};

export const ROLE_PERMISSIONS = {
  'dashboard:read': STAFF_ROLES,
  'orders:read': STAFF_ROLES,
  'orders:write': STAFF_ROLES,
  'products:read': STAFF_ROLES,
  'products:write': STAFF_ROLES,
  'products:delete': ['admin', 'super_admin'],
  'categories:write': ['admin', 'super_admin'],
  'brands:write': ['admin', 'super_admin'],
  'coupons:write': ['admin', 'super_admin'],
  'promotions:write': ['admin', 'super_admin'],
  'banners:write': ['admin', 'super_admin'],
  'homepage:write': ['admin', 'super_admin'],
  'delivery:write': ['admin', 'super_admin'],
  'settings:write': ['admin', 'super_admin'],
  'content:write': ['admin', 'super_admin'],
  'reviews:moderate': ['admin', 'super_admin'],
  'reports:read': ['admin', 'super_admin'],
  'audit:read': ['admin', 'super_admin'],
  'notifications:read': STAFF_ROLES,
  'notifications:write': ['admin', 'super_admin'],
  'users:read': ['super_admin'],
  'users:write': ['super_admin'],
};

export const ALL_PERMISSIONS = Object.keys(ROLE_PERMISSIONS);

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
      { key: 'orders:read', labelEn: 'View orders, chats & returns', labelAr: 'عرض الطلبات والمحادثات والمرتجعات' },
      { key: 'orders:write', labelEn: 'Manage orders & fulfillment', labelAr: 'إدارة الطلبات والتنفيذ' },
      { key: 'delivery:write', labelEn: 'Delivery zones & fulfillment', labelAr: 'التوصيل ومواقع الشحن' },
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
    id: 'customers',
    labelEn: 'Customers',
    labelAr: 'العملاء',
    permissions: [
      { key: 'users:read', labelEn: 'View customers', labelAr: 'عرض العملاء' },
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

export const ROLE_PRESET_PERMISSIONS = {
  manager: ALL_PERMISSIONS.filter((key) => ROLE_PERMISSIONS[key]?.includes('manager')),
  admin: ALL_PERMISSIONS.filter((key) => ROLE_PERMISSIONS[key]?.includes('admin')),
  super_admin: [...ALL_PERMISSIONS],
};

export const ROLE_BADGE_STYLES = {
  super_admin: 'bg-amber-100 text-amber-900 ring-1 ring-amber-200',
  admin: 'bg-purple-100 text-purple-800',
  manager: 'bg-blue-100 text-blue-800',
  driver: 'bg-teal-100 text-teal-800',
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
  if (Array.isArray(user.effectivePermissions) && user.effectivePermissions.length > 0) {
    return user.effectivePermissions;
  }
  return permissionsForRole(user.role);
}

export function isStaffRole(role) {
  return STAFF_ROLES.includes(role);
}

/** @param {string|{ role?: string, permissions?: string[], effectivePermissions?: string[] }} userOrRole */
export function hasPermission(userOrRole, permission) {
  if (userOrRole && typeof userOrRole === 'object') {
    return resolveUserPermissions(userOrRole).includes(permission);
  }
  const allowed = ROLE_PERMISSIONS[permission];
  if (!allowed) return false;
  return allowed.includes(userOrRole);
}

export function roleLabel(role, isAr) {
  const labels = ROLE_LABELS[role];
  if (!labels) return role;
  return isAr ? labels.ar : labels.en;
}

export const ASSIGNABLE_ROLES = ['user', 'manager', 'admin', 'super_admin', 'driver'];

export const STAFF_ACCOUNT_ROLES = ['manager', 'admin', 'super_admin', 'driver'];

export function countPermissions(permissions) {
  return permissions?.length || 0;
}
