/**
 * Seller Center insights (/api/seller/*): menu badges, the home dashboard, business reports and
 * quick search. Every query is scoped by `req.seller._id`.
 */
import Product from '../models/Product.js';
import Shipment from '../models/Shipment.js';
import Order from '../models/Order.js';
import ProductQuestion from '../models/ProductQuestion.js';
import SellerCategory from '../models/SellerCategory.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { AppError } from '../utils/AppError.js';
import { toCsv, sendCsv } from '../utils/csvExport.js';
import { getSellerBalance } from '../services/sellerLedger.service.js';
import { getSellerPerformance } from '../services/sellerReputation.service.js';
import { getUserUnreadCount } from '../services/userNotification.service.js';
import { getMarketplaceSettings } from '../services/marketplace.service.js';
import { LISTING_STATUSES, sellerUserPermissions } from '../constants/marketplace.js';

const DAY = 86400000;
const TZ = 'Africa/Cairo';
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const pctChange = (now, before) => (before > 0 ? Math.round(((now - before) / before) * 1000) / 10 : null);

/** "Ordered" sales: every shipment that wasn't cancelled, dated when the customer ordered. */
const orderedMatch = (sellerId, from, to) => ({
  seller: sellerId,
  status: { $ne: 'cancelled' },
  createdAt: { $gte: from, $lt: to },
});

/** YYYY-MM-DD in Cairo time — the day buckets every chart uses. */
function dayKey(date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

function dayRange(from, to) {
  const days = [];
  const seen = new Set();
  for (let t = from.getTime(); t < to.getTime(); t += DAY / 2) {
    const k = dayKey(new Date(t));
    if (!seen.has(k)) { seen.add(k); days.push(k); }
  }
  return days;
}

async function periodTotals(sellerId, from, to) {
  const [row] = await Shipment.aggregate([
    { $match: orderedMatch(sellerId, from, to) },
    {
      $group: {
        _id: null,
        orders: { $sum: 1 },
        gross: { $sum: '$subtotal' },
        net: { $sum: '$sellerNet' },
        units: { $sum: { $sum: '$items.quantity' } },
      },
    },
  ]);
  return { orders: row?.orders || 0, gross: round2(row?.gross), net: round2(row?.net), units: row?.units || 0 };
}

async function dailySeries(sellerId, from, to) {
  const rows = await Shipment.aggregate([
    { $match: orderedMatch(sellerId, from, to) },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: TZ } },
        orders: { $sum: 1 },
        gross: { $sum: '$subtotal' },
        units: { $sum: { $sum: '$items.quantity' } },
      },
    },
  ]);
  const byDay = new Map(rows.map((r) => [r._id, r]));
  return dayRange(from, to).map((date) => {
    const r = byDay.get(date);
    return { date, orders: r?.orders || 0, gross: round2(r?.gross), units: r?.units || 0 };
  });
}

async function productSales(sellerId, from, to, limit = 0) {
  const pipeline = [
    { $match: orderedMatch(sellerId, from, to) },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.product',
        nameAr: { $first: '$items.nameAr' },
        nameEn: { $first: '$items.nameEn' },
        sku: { $first: '$items.sku' },
        image: { $first: '$items.image' },
        units: { $sum: '$items.quantity' },
        gross: { $sum: '$items.lineTotal' },
        commission: { $sum: '$items.commission' },
        orders: { $addToSet: '$_id' },
      },
    },
    { $sort: { gross: -1 } },
  ];
  if (limit) pipeline.push({ $limit: limit });
  const rows = await Shipment.aggregate(pipeline);
  return rows.map((r) => ({
    product: r._id,
    nameAr: r.nameAr,
    nameEn: r.nameEn,
    sku: r.sku || '',
    image: r.image || '',
    units: r.units,
    orders: r.orders.length,
    gross: round2(r.gross),
    commission: round2(r.commission),
  }));
}

function parseRange(query) {
  const now = new Date();
  const days = [7, 30, 90].includes(Number(query.days)) ? Number(query.days) : 30;
  let to = query.to ? new Date(`${query.to}T23:59:59.999+02:00`) : now;
  let from = query.from ? new Date(`${query.from}T00:00:00+02:00`) : new Date(now.getTime() - days * DAY);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) throw new AppError('Invalid date range', 400);
  if (to > now) to = now;
  if (from >= to) from = new Date(to.getTime() - DAY);
  if (to - from > 366 * DAY) throw new AppError('Choose a range of one year or less', 400);
  return { from, to, days: Math.max(1, Math.round((to - from) / DAY)) };
}

// ── Menu badges ──

export const getSellerSummary = asyncHandler(async (req, res) => {
  const sellerId = req.seller._id;
  const [shipments, listings, unread, outOfStock, pendingReturns, unansweredQuestions] = await Promise.all([
    Shipment.aggregate([
      { $match: { seller: sellerId, fulfilledBy: 'seller', status: { $in: ['pending', 'confirmed', 'packed'] } } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Product.aggregate([
      { $match: { seller: sellerId, listingStatus: { $in: ['rejected', 'draft'] } } },
      { $group: { _id: '$listingStatus', count: { $sum: 1 } } },
    ]),
    getUserUnreadCount(req.user._id),
    Product.countDocuments({ seller: sellerId, listingStatus: 'approved', variants: { $size: 0 }, stock: { $lte: 0 } }),
    // Orders with a pending return — exact per-item matching happens on the Returns page.
    Order.countDocuments({ sellerIds: sellerId, returns: { $elemMatch: { status: 'pending' } } }),
    ProductQuestion.countDocuments({ seller: sellerId, answeredAt: null, status: 'visible' }),
  ]);
  const ship = Object.fromEntries(shipments.map((r) => [r._id, r.count]));
  const list = Object.fromEntries(listings.map((r) => [r._id, r.count]));
  res.json({
    success: true,
    data: {
      toConfirm: ship.pending || 0,
      toShip: (ship.confirmed || 0) + (ship.packed || 0),
      rejected: list.rejected || 0,
      drafts: list.draft || 0,
      outOfStock,
      unreadNotifications: unread,
      pendingReturns,
      unansweredQuestions,
      onVacation: req.seller.vacation?.enabled === true,
    },
  });
});

// ── Home dashboard ──

export const getSellerHome = asyncHandler(async (req, res) => {
  const sellerId = req.seller._id;
  const { from, to, days } = parseRange(req.query);
  const prevFrom = new Date(from.getTime() - (to - from));

  const [current, previous, series, topProducts, balance, performance, byStatus, stock, sectionCount, settings] = await Promise.all([
    periodTotals(sellerId, from, to),
    periodTotals(sellerId, prevFrom, from),
    dailySeries(sellerId, from, to),
    productSales(sellerId, from, to, 5),
    getSellerBalance(sellerId),
    getSellerPerformance(sellerId),
    Product.aggregate([{ $match: { seller: sellerId } }, { $group: { _id: '$listingStatus', count: { $sum: 1 } } }]),
    Product.aggregate([
      { $match: { seller: sellerId, listingStatus: { $in: ['approved', 'paused'] }, variants: { $size: 0 } } },
      { $project: { available: { $subtract: [{ $ifNull: ['$stock', 0] }, { $ifNull: ['$reservedStock', 0] }] } } },
      {
        $group: {
          _id: null,
          outOfStock: { $sum: { $cond: [{ $lte: ['$available', 0] }, 1, 0] } },
          lowStock: { $sum: { $cond: [{ $and: [{ $gt: ['$available', 0] }, { $lte: ['$available', 5] }] }, 1, 0] } },
        },
      },
    ]),
    SellerCategory.countDocuments({ seller: sellerId }),
    getMarketplaceSettings(),
  ]);

  const listings = Object.fromEntries(LISTING_STATUSES.map((s) => [s, 0]));
  byStatus.forEach((row) => { if (row._id in listings) listings[row._id] = row.count; });
  const seller = req.seller;
  const hasBank = Boolean(seller.bank?.accountNumber || seller.bank?.iban || seller.bank?.walletPhone);

  res.json({
    success: true,
    data: {
      range: { from, to, days },
      sales: {
        ...current,
        avgOrder: current.orders ? round2(current.gross / current.orders) : 0,
        change: {
          gross: pctChange(current.gross, previous.gross),
          orders: pctChange(current.orders, previous.orders),
          units: pctChange(current.units, previous.units),
        },
        previous,
      },
      series,
      topProducts,
      // Money is for logins with the finance permission only.
      balance: sellerUserPermissions(req.user).includes('finance') ? balance : null,
      performance,
      listings,
      totalProducts: Object.values(listings).reduce((a, b) => a + b, 0),
      outOfStock: stock[0]?.outOfStock || 0,
      lowStock: stock[0]?.lowStock || 0,
      payoutHoldDays: settings.payoutHoldDays,
      checklist: [
        { id: 'profile', done: Boolean(seller.logoUrl && (seller.descriptionAr || seller.descriptionEn)), to: '/seller-center/store' },
        { id: 'documents', done: (seller.documents || []).length > 0, to: '/seller-center/store/documents' },
        { id: 'payout', done: hasBank, to: '/seller-center/store/payout' },
        { id: 'sections', done: sectionCount > 0, to: '/seller-center/categories' },
        { id: 'product', done: listings.approved + listings.pending_review > 0, to: '/seller-center/products/new' },
      ],
    },
  });
});

// ── Business reports ──

export const getSalesReport = asyncHandler(async (req, res) => {
  const sellerId = req.seller._id;
  const { from, to, days } = parseRange(req.query);
  const [totals, series, products, cancelled] = await Promise.all([
    periodTotals(sellerId, from, to),
    dailySeries(sellerId, from, to),
    productSales(sellerId, from, to),
    Shipment.countDocuments({ seller: sellerId, status: 'cancelled', createdAt: { $gte: from, $lt: to } }),
  ]);

  // Sales per store section — a product in two sections counts in both.
  const ids = products.map((p) => p.product).filter(Boolean);
  const [docs, sections] = await Promise.all([
    Product.find({ _id: { $in: ids }, seller: sellerId }).select('sellerCategories').lean(),
    SellerCategory.find({ seller: sellerId }).select('nameAr nameEn').lean(),
  ]);
  const sectionsOf = new Map(docs.map((d) => [String(d._id), (d.sellerCategories || []).map(String)]));
  const bySectionMap = new Map();
  for (const p of products) {
    const keys = sectionsOf.get(String(p.product)) || [];
    for (const key of keys.length ? keys : ['none']) {
      const agg = bySectionMap.get(key) || { units: 0, gross: 0 };
      agg.units += p.units;
      agg.gross += p.gross;
      bySectionMap.set(key, agg);
    }
  }
  const sectionName = new Map(sections.map((s) => [String(s._id), s]));
  const bySection = [...bySectionMap.entries()]
    .map(([key, v]) => ({
      section: key === 'none' ? null : key,
      nameAr: key === 'none' ? 'بدون قسم' : sectionName.get(key)?.nameAr || '—',
      nameEn: key === 'none' ? 'No section' : sectionName.get(key)?.nameEn || '—',
      units: v.units,
      gross: round2(v.gross),
    }))
    .sort((a, b) => b.gross - a.gross);

  if (req.query.format === 'csv') {
    const view = req.query.view === 'days' ? 'days' : 'products';
    const csv = view === 'days'
      ? toCsv(series, [
        { header: 'date', value: (r) => r.date },
        { header: 'orders', value: (r) => r.orders },
        { header: 'units', value: (r) => r.units },
        { header: 'sales', value: (r) => r.gross },
      ])
      : toCsv(products, [
        { header: 'sku', value: (r) => r.sku },
        { header: 'nameAr', value: (r) => r.nameAr },
        { header: 'nameEn', value: (r) => r.nameEn },
        { header: 'orders', value: (r) => r.orders },
        { header: 'units', value: (r) => r.units },
        { header: 'sales', value: (r) => r.gross },
        { header: 'commission', value: (r) => r.commission },
      ]);
    return sendCsv(res, `sales-${view}-${dayKey(from)}-to-${dayKey(to)}.csv`, csv);
  }

  res.json({
    success: true,
    data: {
      range: { from, to, days },
      totals: { ...totals, cancelled, avgOrder: totals.orders ? round2(totals.gross / totals.orders) : 0 },
      series,
      products,
      bySection,
    },
  });
});

// ── Quick search (top bar) ──

export const sellerQuickSearch = asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 80);
  if (q.length < 2) return res.json({ success: true, data: { products: [], orders: [] } });
  const rx = { $regex: escapeRegex(q), $options: 'i' };
  const [products, orders] = await Promise.all([
    Product.find({ seller: req.seller._id, $or: [{ nameAr: rx }, { nameEn: rx }, { sku: rx }, { barcode: rx }] })
      .select('nameAr nameEn sku images listingStatus price').sort({ updatedAt: -1 }).limit(6).lean(),
    Shipment.find({ seller: req.seller._id, $or: [{ shipmentNumber: rx }, { orderNumber: rx }] })
      .select('shipmentNumber orderNumber status subtotal createdAt').sort({ createdAt: -1 }).limit(6).lean(),
  ]);
  res.json({
    success: true,
    data: {
      products: products.map((p) => ({
        _id: p._id, nameAr: p.nameAr, nameEn: p.nameEn, sku: p.sku, image: p.images?.[0] || '', listingStatus: p.listingStatus, price: p.price,
      })),
      orders: orders.map((s) => ({
        _id: s._id, shipmentNumber: s.shipmentNumber, orderNumber: s.orderNumber, status: s.status, subtotal: s.subtotal, createdAt: s.createdAt,
      })),
    },
  });
});
