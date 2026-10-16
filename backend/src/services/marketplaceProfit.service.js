/**
 * Marketplace profit — what the store earns from its sellers, read straight from the seller
 * ledger (money is recognised when a shipment is delivered, a fee is charged or a return is
 * approved), plus two numbers the ledger can't hold:
 *  - discount cost: coupons and points on seller items are paid by the marketplace;
 *  - pipeline: fees on shipments that are placed but not delivered yet.
 *
 *   fee income   = commission − commission given back + fixed + fulfillment + payment
 *                  + plan fees + penalties
 *   net profit   = fee income − manual credits to sellers − discount cost
 *   VAT on fees is tax collected for the government, shown apart, never counted as profit.
 */
import mongoose from 'mongoose';
import Seller from '../models/Seller.js';
import Shipment from '../models/Shipment.js';
import Category from '../models/Category.js';
import SellerLedgerEntry from '../models/SellerLedgerEntry.js';

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const DAY = 86400000;

/** Ledger type → report bucket. Fee buckets are stored negative (seller debits). */
const FEE_TYPES = ['commission', 'commission_reversal', 'fixed_fee', 'fulfillment_fee', 'payment_fee', 'subscription_fee', 'penalty'];

const sumIf = (types) => ({ $sum: { $cond: [{ $in: ['$type', types] }, '$amount', 0] } });

function ledgerGroup(id) {
  return {
    _id: id,
    sales: sumIf(['sale']),
    deliveryFees: sumIf(['delivery_fee']),
    returns: sumIf(['return']),
    commission: sumIf(['commission']),
    commissionBack: sumIf(['commission_reversal']),
    fixedFees: sumIf(['fixed_fee']),
    fulfillmentFees: sumIf(['fulfillment_fee']),
    paymentFees: sumIf(['payment_fee']),
    planFees: sumIf(['subscription_fee']),
    penalties: sumIf(['penalty']),
    vat: sumIf(['fee_vat']),
    adjustments: sumIf(['adjustment']),
    paidOut: sumIf(['payout']),
    orders: { $addToSet: '$order' },
  };
}

/** Turn a raw ledger group into positive, readable report numbers. */
function shape(r = {}, discountCost = 0) {
  const commission = round2(-(r.commission || 0) - (r.commissionBack || 0));
  const fixedFees = round2(-(r.fixedFees || 0));
  const fulfillmentFees = round2(-(r.fulfillmentFees || 0));
  const paymentFees = round2(-(r.paymentFees || 0));
  const planFees = round2(-(r.planFees || 0));
  const penalties = round2(-(r.penalties || 0));
  const feeIncome = round2(commission + fixedFees + fulfillmentFees + paymentFees + planFees + penalties);
  const sales = round2(r.sales || 0);
  const returns = round2(-(r.returns || 0));
  const netSales = round2(sales - returns);
  const adjustments = round2(r.adjustments || 0);
  const netProfit = round2(feeIncome - adjustments - discountCost);
  return {
    sales,
    returns,
    netSales,
    deliveryFees: round2(r.deliveryFees || 0),
    commission,
    fixedFees,
    fulfillmentFees,
    paymentFees,
    planFees,
    penalties,
    feeIncome,
    vat: round2(-(r.vat || 0)),
    adjustments,
    discountCost: round2(discountCost),
    netProfit,
    /** Take rate: fee income as a share of net sales. */
    takeRate: netSales > 0 ? round2((feeIncome / netSales) * 100) : 0,
    margin: netSales > 0 ? round2((netProfit / netSales) * 100) : 0,
    sellerEarnings: round2(netSales + (r.deliveryFees || 0) - feeIncome - (-(r.vat || 0)) + adjustments),
    paidOut: round2(-(r.paidOut || 0)),
    orders: Array.isArray(r.orders) ? r.orders.filter(Boolean).length : 0,
  };
}

/** Coupons and points on delivered seller shipments, split by each shipment's share of the order. */
async function discountCostBySeller(match) {
  const rows = await Shipment.aggregate([
    { $match: match },
    { $lookup: { from: 'orders', localField: 'order', foreignField: '_id', as: 'o', pipeline: [{ $project: { subtotal: 1, discount: 1, pointsDiscount: 1 } }] } },
    { $unwind: '$o' },
    {
      $project: {
        seller: 1,
        cost: {
          $cond: [
            { $gt: ['$o.subtotal', 0] },
            { $multiply: [{ $add: [{ $ifNull: ['$o.discount', 0] }, { $ifNull: ['$o.pointsDiscount', 0] }] }, { $divide: ['$subtotal', '$o.subtotal'] }] },
            0,
          ],
        },
      },
    },
    { $group: { _id: '$seller', cost: { $sum: '$cost' } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), Math.min(r.cost, Number.MAX_SAFE_INTEGER)]));
}

export function parseRange({ from, to } = {}, now = new Date()) {
  const end = to ? new Date(to) : now;
  const start = from ? new Date(from) : new Date(end.getTime() - 30 * DAY);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return parseRange({}, now);
  // A bare date "to" means the whole of that day.
  if (to && /^\d{4}-\d{2}-\d{2}$/.test(String(to))) end.setTime(end.getTime() + DAY - 1);
  return { start, end };
}

/**
 * The profit report: totals, one row per seller, a trend and the categories that earn most.
 * `sellerId` narrows everything to one seller (the seller panel's money tab).
 */
export async function getProfitReport({ from, to, sellerId } = {}) {
  const { start, end } = parseRange({ from, to });
  const sellerMatch = sellerId ? { seller: new mongoose.Types.ObjectId(String(sellerId)) } : {};
  const ledgerMatch = { ...sellerMatch, createdAt: { $gte: start, $lte: end } };
  const deliveredMatch = { ...sellerMatch, status: { $in: ['delivered', 'returned'] }, deliveredAt: { $gte: start, $lte: end } };
  const spanDays = (end - start) / DAY;
  const unit = spanDays > 120 ? 'month' : spanDays > 31 ? 'week' : 'day';

  const [bySellerRaw, totalRaw, trendRaw, discounts, pipelineRaw, categoriesRaw] = await Promise.all([
    SellerLedgerEntry.aggregate([{ $match: ledgerMatch }, { $group: ledgerGroup('$seller') }]),
    SellerLedgerEntry.aggregate([{ $match: ledgerMatch }, { $group: ledgerGroup(null) }]),
    SellerLedgerEntry.aggregate([
      { $match: { ...ledgerMatch, type: { $in: [...FEE_TYPES, 'sale', 'return'] } } },
      {
        $group: {
          _id: { $dateTrunc: { date: '$createdAt', unit, timezone: 'Africa/Cairo', ...(unit === 'week' ? { startOfWeek: 'saturday' } : {}) } },
          fees: { $sum: { $cond: [{ $in: ['$type', FEE_TYPES] }, { $multiply: ['$amount', -1] }, 0] } },
          sales: { $sum: { $cond: [{ $in: ['$type', ['sale', 'return']] }, '$amount', 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    discountCostBySeller(deliveredMatch),
    Shipment.aggregate([
      { $match: { ...sellerMatch, status: { $in: ['pending', 'confirmed', 'packed', 'shipped'] } } },
      {
        $group: {
          _id: null,
          shipments: { $sum: 1 },
          sales: { $sum: '$subtotal' },
          fees: { $sum: { $add: ['$commissionTotal', { $ifNull: ['$fixedFees', 0] }, '$fulfillmentFee', { $ifNull: ['$paymentFee', 0] }] } },
        },
      },
    ]),
    Shipment.aggregate([
      { $match: deliveredMatch },
      { $unwind: '$items' },
      { $lookup: { from: 'products', localField: 'items.product', foreignField: '_id', as: 'p', pipeline: [{ $project: { mainCategory: 1 } }] } },
      {
        $group: {
          _id: { $ifNull: [{ $first: '$p.mainCategory' }, null] },
          sales: { $sum: '$items.lineTotal' },
          commission: { $sum: '$items.commission' },
          fixedFees: { $sum: { $ifNull: ['$items.fixedFee', 0] } },
          units: { $sum: '$items.quantity' },
        },
      },
      { $sort: { commission: -1 } },
      { $limit: 12 },
    ]),
  ]);

  const sellerIds = bySellerRaw.map((r) => r._id);
  const [sellers, categories] = await Promise.all([
    Seller.find({ _id: { $in: sellerIds } }).select('nameAr nameEn slug status feePlan commissionRate logo').lean(),
    Category.find({ _id: { $in: categoriesRaw.map((c) => c._id).filter(Boolean) } }).select('nameAr nameEn').lean(),
  ]);
  const sellerById = new Map(sellers.map((s) => [String(s._id), s]));
  const catById = new Map(categories.map((c) => [String(c._id), c]));

  const rows = bySellerRaw.map((r) => {
    const s = sellerById.get(String(r._id)) || {};
    return {
      seller: { _id: r._id, nameAr: s.nameAr || '', nameEn: s.nameEn || '', slug: s.slug || '', status: s.status || '', feePlan: s.feePlan || '', commissionRate: s.commissionRate ?? null, logo: s.logo || '' },
      ...shape(r, discounts.get(String(r._id)) || 0),
    };
  }).sort((a, b) => b.netProfit - a.netProfit);

  const totalDiscount = [...discounts.values()].reduce((s, v) => s + v, 0);
  const p = pipelineRaw[0] || {};
  return {
    range: { from: start, to: end, unit },
    totals: { ...shape(totalRaw[0], totalDiscount), sellers: rows.length },
    sellers: rows,
    trend: trendRaw.map((t) => ({ date: t._id, fees: round2(t.fees), sales: round2(t.sales) })),
    categories: categoriesRaw.map((c) => {
      const cat = c._id ? catById.get(String(c._id)) : null;
      return {
        _id: c._id,
        nameAr: cat?.nameAr || 'بدون قسم',
        nameEn: cat?.nameEn || 'No category',
        sales: round2(c.sales),
        commission: round2(c.commission),
        fixedFees: round2(c.fixedFees),
        units: c.units,
        rate: c.sales > 0 ? round2((c.commission / c.sales) * 100) : 0,
      };
    }),
    pipeline: { shipments: p.shipments || 0, sales: round2(p.sales), fees: round2(p.fees) },
  };
}
