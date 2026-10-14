/**
 * Banner audience filtering on the storefront. Homepage data is publicly cached
 * (and server-rendered), so it carries banners for every audience and the
 * browser picks the ones meant for the current visitor.
 */
import { STAFF_ROLES } from './roles.js';

export function viewerAudienceForUser(user) {
  if (!user) return 'guests';
  if (STAFF_ROLES.includes(user.role)) return 'staff';
  return 'customers';
}

export function bannerVisibleTo(banner, viewer) {
  const audience = banner?.targetAudience || 'all';
  if (audience === 'all') return true;
  if (viewer === 'staff') return audience === 'customers' || audience === 'staff';
  return audience === viewer;
}

export function filterBannersForViewer(banners, viewer, limit = null) {
  const list = (Array.isArray(banners) ? banners : []).filter((b) => bannerVisibleTo(b, viewer));
  return limit ? list.slice(0, limit) : list;
}
