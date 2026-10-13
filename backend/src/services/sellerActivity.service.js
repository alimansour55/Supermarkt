import SellerActivity from '../models/SellerActivity.js';

const clientIp = (req) => String(req?.headers?.['x-forwarded-for'] || req?.ip || '').split(',')[0].trim();

/**
 * Record a Seller Center action. Never throws — logging must not break the action itself.
 * `sellerId` defaults to req.seller (portal routes); auth routes pass it explicitly.
 */
export async function logSellerActivity(req, { action, entityType = '', entityId = null, label = '', details = null, sellerId, actor }) {
  const seller = sellerId || req?.seller?._id;
  if (!seller) return;
  const user = actor || req?.user;
  try {
    await SellerActivity.create({
      seller,
      actor: user?._id || null,
      actorName: user?.name || '',
      action,
      entityType,
      entityId,
      label: String(label || '').slice(0, 200),
      details,
      ip: clientIp(req),
    });
  } catch (err) {
    console.error('Seller activity log failed:', err.message);
  }
}

/** { field: [before, after] } for the fields that changed — compact log details. */
export function diffFields(before, after, fields) {
  const out = {};
  for (const f of fields) {
    const a = before?.[f];
    const b = after?.[f];
    if (b !== undefined && JSON.stringify(a ?? null) !== JSON.stringify(b ?? null)) out[f] = [a ?? null, b ?? null];
  }
  return Object.keys(out).length ? out : null;
}

export { clientIp };
