import mongoose from 'mongoose';
import Seller from '../models/Seller.js';
import Shipment from '../models/Shipment.js';
import SellerReview from '../models/SellerReview.js';

const DAY = 86400000;
const round1 = (n) => Math.round((Number(n) || 0) * 10) / 10;
const pct = (part, whole) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0);

/** Recompute a seller's public rating from its visible reviews. */
export async function refreshSellerRating(sellerId) {
  const [row] = await SellerReview.aggregate([
    { $match: { seller: new mongoose.Types.ObjectId(String(sellerId)), status: 'visible' } },
    { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  await Seller.updateOne({ _id: sellerId }, { $set: { rating: round1(row?.avg || 0), ratingCount: row?.count || 0 } });
}

/**
 * Seller performance over the last `days` (seller-shipped shipments only — the store owns the
 * timing of everything else):
 * - cancelRate: shipments the seller cancelled
 * - lateShipRate: shipped (or still unshipped) later than the promised handling time
 * The marketplace uses these to warn or suspend sellers.
 */
export async function getSellerPerformance(sellerId, { days = 90, now = new Date() } = {}) {
  const seller = await Seller.findById(sellerId).select('handlingDays rating ratingCount').lean();
  const since = new Date(now.getTime() - days * DAY);
  const shipments = await Shipment.find({ seller: sellerId, fulfilledBy: 'seller', createdAt: { $gte: since } })
    .select('status createdAt shippedAt cancelledByRole')
    .lean();

  const allowedMs = ((seller?.handlingDays ?? 2) + 1) * DAY;
  let sellerCancelled = 0;
  let late = 0;
  let measured = 0;
  for (const s of shipments) {
    if (s.status === 'cancelled' && s.cancelledByRole === 'seller') sellerCancelled += 1;
    if (s.status === 'cancelled') continue;
    const shippedAt = s.shippedAt ? new Date(s.shippedAt) : null;
    const elapsed = (shippedAt || now) - new Date(s.createdAt);
    if (shippedAt || elapsed > allowedMs) {
      measured += 1;
      if (elapsed > allowedMs) late += 1;
    }
  }

  const cancelRate = pct(sellerCancelled, shipments.length);
  const lateShipRate = pct(late, measured);
  const health = cancelRate > 5 || lateShipRate > 10 || (seller?.ratingCount >= 5 && seller.rating < 3.5)
    ? 'at_risk'
    : cancelRate > 2.5 || lateShipRate > 4 ? 'fair' : 'good';

  return {
    days,
    shipments: shipments.length,
    sellerCancelled,
    cancelRate,
    lateShipments: late,
    lateShipRate,
    rating: seller?.rating || 0,
    ratingCount: seller?.ratingCount || 0,
    health,
  };
}
