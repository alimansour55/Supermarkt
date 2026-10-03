import { STAFF_ROLES } from '../constants/roles.js';

/**
 * Business-internal fields that must never reach customers or the public storefront
 * (cost prices, stock audit trail, Cloudinary asset ids). Staff still receive them.
 */
const PRIVATE_FIELDS = new Set([
  'wholesalePrice', 'stockHistory', 'cloudinaryPublicIds',
  // Payment-gateway internals (order.payment) — support staff only.
  'references', 'intentionId', 'gatewayOrderId',
]);

function stripPrivate(value) {
  if (value == null || typeof value !== 'object') return value;
  // Mongoose documents, ObjectIds, Dates… serialize the same way JSON.stringify would.
  if (typeof value.toJSON === 'function') {
    const json = value.toJSON();
    if (json === value || json == null || typeof json !== 'object') return json;
    return stripPrivate(json);
  }
  if (Buffer.isBuffer(value)) return value;
  if (Array.isArray(value)) return value.map(stripPrivate);

  const out = {};
  for (const [key, child] of Object.entries(value)) {
    if (!PRIVATE_FIELDS.has(key)) out[key] = stripPrivate(child);
  }
  return out;
}

/**
 * Wraps res.json so non-staff responses are filtered at send time — by then
 * route-level auth middleware has populated req.user.
 */
export function hidePrivateFields(req, res, next) {
  const json = res.json.bind(res);
  res.json = (body) => {
    if (STAFF_ROLES.includes(req.user?.role)) return json(body);
    return json(stripPrivate(body));
  };
  next();
}
