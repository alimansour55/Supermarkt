import mongoose from 'mongoose';
import { asyncHandler } from '../middleware/errorHandler.js';
import Order from '../models/Order.js';
import { getLoyaltySettings, buildLoyaltySummary, pointsToCashValue } from '../services/loyalty.service.js';

/** Look up friendly order numbers, tolerant of malformed / missing ids. */
async function resolveOrderNumbers(entries) {
  const ids = [...new Set(
    entries
      .map((e) => e.order)
      .filter(Boolean)
      .map(String)
      .filter((id) => mongoose.Types.ObjectId.isValid(id)),
  )];
  const map = new Map();
  if (!ids.length) return map;
  try {
    const orders = await Order.find({ _id: { $in: ids } }).select('orderNumber').lean();
    orders.forEach((o) => map.set(String(o._id), o.orderNumber));
  } catch {
    /* order numbers are cosmetic — never fail the points response over them */
  }
  return map;
}

const EXPIRING_SOON_DAYS = 30;

/**
 * Shape a points-history entry for clients. Presentation (labels, currency
 * formatting, bilingual text) is the client's job — the API only sends
 * structured data:
 *   type       earn | redeem | refund | adjust | expire
 *   points     signed integer
 *   cashValue  |points| * EGP-per-point  (what those points are worth)
 *   orderId / orderNumber   linkable reference when the entry came from an order
 *   note       optional free text (admin adjustments carry a reason here)
 *   expiresAt  when an `earn` batch lapses
 */
const formatHistory = (entry, { egpPerPoint, orderNumbers }) => {
  const orderId = entry.order ? String(entry.order) : null;
  return {
    id: entry._id,
    type: entry.type,
    points: entry.points,
    cashValue: Math.round(Math.abs(entry.points || 0) * egpPerPoint * 100) / 100,
    orderId,
    orderNumber: orderId ? orderNumbers.get(orderId) || null : null,
    note: entry.note || '',
    expiresAt: entry.expiresAt || null,
    createdAt: entry.createdAt || null,
  };
};

export const getMyLoyalty = asyncHandler(async (req, res) => {
  const lang = req.query.lang === 'en' ? 'en' : 'ar';
  const rules = await getLoyaltySettings();
  const summary = buildLoyaltySummary(rules, lang);
  const egpPerPoint = Number(rules.redemptionEGPPerPoint || 0);
  const pointsBalance = req.user.pointsBalance || 0;

  const raw = [...(req.user.pointsHistory || [])]
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, 50);

  const orderNumbers = await resolveOrderNumbers(raw);
  const history = raw.map((e) => formatHistory(e, { egpPerPoint, orderNumbers }));

  // Nudge: points from `earn` batches that lapse within the next 30 days.
  const now = Date.now();
  const soonCutoff = now + EXPIRING_SOON_DAYS * 24 * 60 * 60 * 1000;
  let expiringPoints = 0;
  let nextExpiry = null;
  for (const e of req.user.pointsHistory || []) {
    if (e.type !== 'earn' || !e.expiresAt || (e.points || 0) <= 0) continue;
    const t = new Date(e.expiresAt).getTime();
    if (t <= now) continue;
    if (t <= soonCutoff) expiringPoints += e.points;
    if (nextExpiry == null || t < nextExpiry) nextExpiry = t;
  }

  res.json({
    success: true,
    pointsBalance,
    cashbackValue: pointsToCashValue(pointsBalance, rules),
    expiringPoints,
    expiringCashValue: Math.round(expiringPoints * egpPerPoint * 100) / 100,
    nextExpiry: nextExpiry ? new Date(nextExpiry).toISOString() : null,
    history,
    rules: {
      ...rules,
      ...summary,
    },
  });
});
