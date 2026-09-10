export const STAFF_ROLES = ['manager', 'admin', 'super_admin'];

export const ROLE_LABELS = {
  user: { en: 'Customer', ar: 'عميل' },
  manager: { en: 'Operations', ar: 'تشغيل يومي' },
  admin: { en: 'Store admin', ar: 'إدارة المتجر' },
  super_admin: { en: 'Owner', ar: 'مالك النظام' },
  driver: { en: 'Delivery driver', ar: 'مندوب توصيل' },
};

/**
 * Every role managed from the Admin Team page, in the order the UI shows them
 * (owner first, like Microsoft admin center). `driver` is a field role — it has
 * NO admin panel access — so the UI presents it separately from the panel roles.
 */
export const TEAM_ROLES = ['super_admin', 'admin', 'manager', 'driver'];

/** Admin-panel roles only (a member picks exactly one of these, or Custom). */
export const TEAM_PANEL_ROLES = ['super_admin', 'admin', 'manager'];

export const TEAM_ROLE_META = {
  super_admin: { kind: 'panel', tone: 'amber' },
  admin: { kind: 'panel', tone: 'purple' },
  manager: { kind: 'panel', tone: 'blue' },
  driver: { kind: 'field', tone: 'teal' },
};

/** Plain-language guide for the team account role picker (not duplicates — 3 levels + custom). */
export const ROLE_GUIDE = {
  manager: {
    en: {
      summary: 'Handles the day-to-day order desk and product catalog.',
      bestFor: 'Order desk, stock & fulfillment staff',
      can: ['View the dashboard', 'Process orders, chats & returns', 'Add and edit products & stock', 'View notifications'],
      cannot: ['Delete products', 'Edit categories, brands, coupons or offers', 'Change store, delivery or loyalty settings', 'See revenue reports or the audit log', 'Manage team accounts'],
    },
    ar: {
      summary: 'يدير مكتب الطلبات اليومي وكتالوج المنتجات.',
      bestFor: 'موظف طلبات، مخزون، وتجهيز',
      can: ['عرض لوحة التحكم', 'معالجة الطلبات والمحادثات والمرتجعات', 'إضافة وتعديل المنتجات والمخزون', 'عرض الإشعارات'],
      cannot: ['حذف المنتجات', 'تعديل الأقسام أو العلامات أو الكوبونات أو العروض', 'تغيير إعدادات المتجر أو التوصيل أو الولاء', 'رؤية تقارير الإيرادات أو سجل التدقيق', 'إدارة حسابات الفريق'],
    },
  },
  admin: {
    en: {
      summary: 'Runs the whole store — catalog, offers, content, settings & reports.',
      bestFor: 'Store manager, marketing, catalog lead',
      can: ['Everything Operations can do', 'Categories, brands, coupons, offers & banners', 'Homepage & content pages', 'Delivery zones & store / loyalty settings', 'Revenue reports & audit log', 'Moderate reviews'],
      cannot: ['Create, edit or remove team logins', 'Assign roles or reset other members’ passwords'],
    },
    ar: {
      summary: 'يدير المتجر بالكامل — منتجات وعروض ومحتوى وإعدادات وتقارير.',
      bestFor: 'مدير متجر، تسويق، مسؤول كتالوج',
      can: ['كل ما يفعله دور التشغيل', 'الأقسام والعلامات والكوبونات والعروض والبانرات', 'الصفحة الرئيسية وصفحات المحتوى', 'مناطق التوصيل وإعدادات المتجر والولاء', 'تقارير الإيرادات وسجل التدقيق', 'إدارة التقييمات'],
      cannot: ['إنشاء أو تعديل أو حذف حسابات الفريق', 'تعيين الأدوار أو إعادة تعيين كلمات مرور الأعضاء'],
    },
  },
  super_admin: {
    en: {
      summary: 'Full access, including this Team page.',
      bestFor: 'Business owner or IT lead — keep 1–2 accounts only',
      can: ['Everything a Store admin can do', 'Create & delete team accounts', 'Assign roles & custom permissions', 'Reset any member’s password', 'Activate / deactivate members'],
      cannot: ['Delete or deactivate their own account (another owner must)'],
    },
    ar: {
      summary: 'صلاحيات كاملة، بما في ذلك صفحة الفريق هذه.',
      bestFor: 'صاحب المتجر أو مسؤول التقنية — احتفظ بحساب أو اثنين فقط',
      can: ['كل ما يفعله مسؤول المتجر', 'إنشاء وحذف حسابات الفريق', 'تعيين الأدوار والصلاحيات المخصصة', 'إعادة تعيين كلمة مرور أي عضو', 'تفعيل / تعطيل الأعضاء'],
      cannot: ['حذف أو تعطيل حسابه الشخصي (يقوم بذلك مالك آخر)'],
    },
  },
  driver: {
    en: {
      summary: 'Field role — no admin panel. Signs in to the driver app only.',
      bestFor: 'Courier / delivery staff on the road',
      can: ['Sign in at /driver/login', 'See only orders assigned to them', 'Share live GPS with customer & admin', 'Mark deliveries done or failed'],
      cannot: ['Open the admin panel', 'See other drivers’ orders, products, customers or settings'],
    },
    ar: {
      summary: 'دور ميداني — بدون لوحة تحكم. يدخل إلى تطبيق المندوب فقط.',
      bestFor: 'مندوب توصيل / سائق',
      can: ['الدخول من /driver/login', 'رؤية الطلبات المعيّنة له فقط', 'مشاركة الموقع المباشر مع العميل والإدارة', 'تحديد التوصيل كمكتمل أو فاشل'],
      cannot: ['فتح لوحة التحكم', 'رؤية طلبات المناديب الآخرين أو المنتجات أو العملاء أو الإعدادات'],
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
