/**
 * Month-by-month seller performance (Cairo months), oldest first — pure, so it is tested
 * without a database. Uses the same definitions as the account-health score
 * (getSellerPerformance), on seller-shipped parcels: seller cancels over those parcels, late =
 * shipped (or still not shipped) later than handling days + 1. Parcels and sales count all.
 */
import { cairoMonthKey } from './sellerFees.js';

const DAY = 86400000;
const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);

/** The last `months` Cairo month keys ending with the current one. */
export function lastMonthKeys(months, now = new Date()) {
  const [y, m] = cairoMonthKey(now).split('-').map(Number);
  const keys = [];
  for (let i = months - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    keys.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  return keys;
}

export function sellerMonthlyTrend(shipments = [], { months = 6, handlingDays = 2, now = new Date() } = {}) {
  const keys = lastMonthKeys(months, now);
  const rows = new Map(keys.map((k) => [k, { month: k, parcels: 0, sellerParcels: 0, sales: 0, sellerCancelled: 0, measured: 0, late: 0 }]));
  const allowedMs = (handlingDays + 1) * DAY;
  for (const s of shipments) {
    const row = rows.get(cairoMonthKey(new Date(s.createdAt)));
    if (!row) continue;
    row.parcels += 1;
    const own = s.fulfilledBy === 'seller';
    if (own) row.sellerParcels += 1;
    if (s.status === 'cancelled') {
      if (own && s.cancelledByRole === 'seller') row.sellerCancelled += 1;
      continue;
    }
    row.sales += Number(s.subtotal) || 0;
    if (!own) continue;
    const shippedAt = s.shippedAt ? new Date(s.shippedAt) : null;
    const elapsed = (shippedAt || now) - new Date(s.createdAt);
    if (shippedAt || elapsed > allowedMs) {
      row.measured += 1;
      if (elapsed > allowedMs) row.late += 1;
    }
  }
  return keys.map((k) => {
    const r = rows.get(k);
    return {
      month: k,
      parcels: r.parcels,
      sales: Math.round(r.sales * 100) / 100,
      cancelRate: pct(r.sellerCancelled, r.sellerParcels),
      lateShipRate: pct(r.late, r.measured),
    };
  });
}
