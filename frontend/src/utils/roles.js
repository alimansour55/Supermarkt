/** Role helpers shared by the storefront and the admin panel (kept tiny on purpose). */
export const STAFF_ROLES = ['manager', 'admin', 'super_admin'];

export function isStaffRole(role) {
  return STAFF_ROLES.includes(role);
}
