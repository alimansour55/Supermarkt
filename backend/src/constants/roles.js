/** Staff roles that can access the admin panel. */
export const STAFF_ROLES = ['manager', 'admin', 'super_admin'];

export const ROLE_LABELS = {
  user: { en: 'Customer', ar: 'عميل' },
  manager: { en: 'Manager', ar: 'مدير' },
  admin: { en: 'Admin', ar: 'مسؤول' },
  super_admin: { en: 'Super Admin', ar: 'مسؤول أعلى' },
  driver: { en: 'Delivery driver', ar: 'مندوب توصيل' },
};

/** Permission -> roles allowed. */
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

export function isStaffRole(role) {
  return STAFF_ROLES.includes(role);
}

export function hasPermission(role, permission) {
  const allowed = ROLE_PERMISSIONS[permission];
  if (!allowed) return false;
  return allowed.includes(role);
}

/** Roles the current user may assign. */
export function assignableRoles(actorRole) {
  if (actorRole === 'super_admin') {
    return ['user', 'manager', 'admin', 'super_admin', 'driver'];
  }
  return [];
}

export function canAssignRole(actorRole, targetRole) {
  return assignableRoles(actorRole).includes(targetRole);
}

export function canManageUser(actorRole, targetUser) {
  if (actorRole !== 'super_admin') return false;
  if (targetUser._id?.toString() === targetUser._actorId) return false;
  return true;
}
