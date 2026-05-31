/** Mirrors backend/src/constants/roles.js */
export const STAFF_ROLES = ['manager', 'admin', 'super_admin'];

export const ROLE_LABELS = {
  user: { en: 'Customer', ar: 'عميل' },
  manager: { en: 'Manager', ar: 'مدير' },
  admin: { en: 'Admin', ar: 'مسؤول' },
  super_admin: { en: 'Super Admin', ar: 'مسؤول أعلى' },
};

export const ROLE_PERMISSIONS = {
  'dashboard:read': STAFF_ROLES,
  'orders:read': STAFF_ROLES,
  'orders:write': STAFF_ROLES,
  'products:read': STAFF_ROLES,
  'products:write': STAFF_ROLES,
  'products:delete': ['admin', 'super_admin'],
  'categories:write': ['admin', 'super_admin'],
  'coupons:write': ['admin', 'super_admin'],
  'banners:write': ['admin', 'super_admin'],
  'reports:read': ['admin', 'super_admin'],
  'audit:read': ['admin', 'super_admin'],
  'notifications:read': STAFF_ROLES,
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

export function roleLabel(role, isAr) {
  const labels = ROLE_LABELS[role];
  if (!labels) return role;
  return isAr ? labels.ar : labels.en;
}

export const ASSIGNABLE_ROLES = ['user', 'manager', 'admin', 'super_admin'];
