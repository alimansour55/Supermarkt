import Order from '../models/Order.js';
import mongoose from 'mongoose';
import { asyncHandler } from '../middleware/errorHandler.js';
import {
  PAYMENT_LABELS,
  addDaysToStoreDateKey,
  fillRevenueByDay,
  getStoreDateKey,
  intervalDateFormat,
  parseRevenuePeriod,
  parseRevenueRangeQuery,
  pickRevenueInterval,
  pctChange,
  previousPeriodRange,
  revenueOrderMatch,
  startOfStoreDay,
  storeDateGroupField,
  STORE_TIMEZONE,
} from '../utils/revenueReport.js';

const itemCostPipeline = [
  {
    $lookup: {
      from: 'products',
      localField: 'items.product',
      foreignField: '_id',
      as: 'productDoc',
    },
  },
  { $unwind: { path: '$productDoc', preserveNullAndEmptyArrays: true } },
  {
    $addFields: {
      lineRevenue: { $multiply: ['$items.price', '$items.quantity'] },
      lineCost: {
        $multiply: [
          {
            $ifNull: [
              '$items.wholesalePrice',
              { $ifNull: ['$productDoc.wholesalePrice', 0] },
            ],
          },
          '$items.quantity',
        ],
      },
    },
  },
];

async function sumOrders(match) {
  const [agg] = await Order.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        revenue: { $sum: '$total' },
        orders: { $sum: 1 },
        subtotal: { $sum: '$subtotal' },
        deliveryFees: { $sum: '$deliveryFee' },
        discounts: { $sum: '$discount' },
        pointsDiscounts: { $sum: '$pointsDiscount' },
      },
    },
  ]);
  return agg || {
    revenue: 0,
    orders: 0,
    subtotal: 0,
    deliveryFees: 0,
    discounts: 0,
    pointsDiscounts: 0,
  };
}

async function sumProfit(match) {
  const [agg] = await Order.aggregate([
    { $match: match },
    { $unwind: '$items' },
    ...itemCostPipeline,
    {
      $group: {
        _id: null,
        itemRevenue: { $sum: '$lineRevenue' },
        itemCost: { $sum: '$lineCost' },
      },
    },
  ]);
  return agg || { itemRevenue: 0, itemCost: 0 };
}

export const getRevenueDashboard = asyncHandler(async (req, res) => {
  const periodInput = req.query.period || '30d';
  const { since, days, startKey, endKey, periodKey } = parseRevenuePeriod(periodInput);
  const periodMatch = revenueOrderMatch({ createdAt: { $gte: since } });

  const todayStart = startOfStoreDay(new Date());
  const yesterdayKey = addDaysToStoreDateKey(getStoreDateKey(new Date()), -1);
  const yesterdayStart = new Date(`${yesterdayKey}T00:00:00+02:00`);
  const yesterdayEnd = new Date(`${getStoreDateKey(new Date())}T00:00:00+02:00`);

  const { prevStart, prevEnd } = previousPeriodRange({ periodKey, startKey, endKey, days });
  const previousPeriodMatch = revenueOrderMatch({
    createdAt: { $gte: prevStart, $lt: prevEnd },
  });

  const [
    periodTotals,
    previousTotals,
    todayTotals,
    yesterdayTotals,
    allTimeTotals,
    profitTotals,
    revenueByDayRaw,
    revenueByPaymentRaw,
    revenueByStatusRaw,
    topCategoriesRaw,
    topProductsRaw,
    deliveredTotals,
    recentOrdersRaw,
  ] = await Promise.all([
    sumOrders(periodMatch),
    sumOrders(previousPeriodMatch),
    sumOrders(revenueOrderMatch({ createdAt: { $gte: todayStart } })),
    sumOrders(revenueOrderMatch({
      createdAt: { $gte: yesterdayStart, $lt: yesterdayEnd },
    })),
    sumOrders(revenueOrderMatch()),
    sumProfit(periodMatch),
    Order.aggregate([
      { $match: periodMatch },
      {
        $group: {
          _id: storeDateGroupField(),
          revenue: { $sum: '$total' },
          orders: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Order.aggregate([
      { $match: periodMatch },
      {
        $group: {
          _id: '$paymentMethod',
          revenue: { $sum: '$total' },
          orders: { $sum: 1 },
        },
      },
      { $sort: { revenue: -1 } },
    ]),
    Order.aggregate([
      { $match: periodMatch },
      {
        $group: {
          _id: '$orderStatus',
          revenue: { $sum: '$total' },
          orders: { $sum: 1 },
        },
      },
      { $sort: { revenue: -1 } },
    ]),
    Order.aggregate([
      { $match: periodMatch },
      { $unwind: '$items' },
      ...itemCostPipeline,
      {
        $lookup: {
          from: 'categories',
          localField: 'productDoc.category',
          foreignField: '_id',
          as: 'categoryDoc',
        },
      },
      { $unwind: { path: '$categoryDoc', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: '$categoryDoc._id',
          nameAr: { $first: '$categoryDoc.nameAr' },
          nameEn: { $first: '$categoryDoc.nameEn' },
          revenue: { $sum: '$lineRevenue' },
          unitsSold: { $sum: '$items.quantity' },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 8 },
    ]),
    Order.aggregate([
      { $match: periodMatch },
      { $unwind: '$items' },
      ...itemCostPipeline,
      {
        $group: {
          _id: '$items.product',
          nameAr: { $first: '$items.nameAr' },
          nameEn: { $first: '$items.nameEn' },
          revenue: { $sum: '$lineRevenue' },
          cost: { $sum: '$lineCost' },
          unitsSold: { $sum: '$items.quantity' },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 8 },
    ]),
    sumOrders(revenueOrderMatch({
      createdAt: { $gte: since },
      orderStatus: 'delivered',
    })),
    Order.find(periodMatch)
      .sort({ createdAt: -1 })
      .limit(6)
      .select('orderNumber total orderStatus paymentMethod createdAt')
      .lean(),
  ]);

  const grossProfit = profitTotals.itemRevenue - profitTotals.itemCost;
  const grossMarginPercent = profitTotals.itemRevenue > 0
    ? Math.round((grossProfit / profitTotals.itemRevenue) * 1000) / 10
    : 0;

  const periodRevenue = periodTotals.revenue || 0;
  const paymentTotal = revenueByPaymentRaw.reduce((sum, row) => sum + (row.revenue || 0), 0);
  const revenueByDay = fillRevenueByDay(
    revenueByDayRaw.map((row) => ({
      date: row._id,
      revenue: row.revenue,
      orders: row.orders,
    })),
    days,
  );
  const bestDay = revenueByDay.reduce(
    (best, row) => ((row.revenue || 0) > (best?.revenue || 0) ? row : best),
    null,
  );

  res.json({
    success: true,
    data: {
      period: periodInput,
      periodKey,
      range: { startKey, endKey, days },
      summary: {
        revenue: periodRevenue,
        orders: periodTotals.orders || 0,
        avgOrderValue: periodTotals.orders ? periodRevenue / periodTotals.orders : 0,
        subtotal: periodTotals.subtotal || 0,
        deliveryFees: periodTotals.deliveryFees || 0,
        discounts: periodTotals.discounts || 0,
        pointsDiscounts: periodTotals.pointsDiscounts || 0,
        itemRevenue: profitTotals.itemRevenue || 0,
        costOfGoods: profitTotals.itemCost || 0,
        grossProfit,
        grossMarginPercent,
        deliveredRevenue: deliveredTotals.revenue || 0,
        deliveredOrders: deliveredTotals.orders || 0,
        allTimeRevenue: allTimeTotals.revenue || 0,
        allTimeOrders: allTimeTotals.orders || 0,
        todayRevenue: todayTotals.revenue || 0,
        todayOrders: todayTotals.orders || 0,
        revenueChangePercent: pctChange(periodRevenue, previousTotals.revenue || 0),
        ordersChangePercent: pctChange(periodTotals.orders || 0, previousTotals.orders || 0),
        todayRevenueChangePercent: pctChange(todayTotals.revenue || 0, yesterdayTotals.revenue || 0),
        bestDayRevenue: bestDay?.revenue || 0,
        bestDayDate: bestDay?.date || null,
        bestDayOrders: bestDay?.orders || 0,
      },
      revenueByDay,
      revenueByPayment: revenueByPaymentRaw.map((row) => {
        const key = row._id || 'other';
        const labels = PAYMENT_LABELS[key] || { ar: key, en: key };
        const revenue = row.revenue || 0;
        return {
          method: key,
          labelAr: labels.ar,
          labelEn: labels.en,
          revenue,
          orders: row.orders || 0,
          sharePercent: paymentTotal > 0
            ? Math.round((revenue / paymentTotal) * 1000) / 10
            : 0,
        };
      }),
      revenueByStatus: revenueByStatusRaw.map((row) => ({
        status: row._id || 'unknown',
        revenue: row.revenue || 0,
        orders: row.orders || 0,
      })),
      topCategories: topCategoriesRaw.map((row) => ({
        categoryId: row._id,
        nameAr: row.nameAr || 'غير مصنف',
        nameEn: row.nameEn || 'Uncategorized',
        revenue: row.revenue || 0,
        unitsSold: row.unitsSold || 0,
      })),
      topProducts: topProductsRaw.map((row) => {
        const revenue = row.revenue || 0;
        const cost = row.cost || 0;
        return {
          productId: row._id,
          nameAr: row.nameAr,
          nameEn: row.nameEn,
          revenue,
          cost,
          profit: revenue - cost,
          unitsSold: row.unitsSold || 0,
        };
      }),
      recentOrders: recentOrdersRaw.map((order) => ({
        id: order._id,
        orderNumber: order.orderNumber,
        total: order.total,
        orderStatus: order.orderStatus,
        paymentMethod: order.paymentMethod,
        createdAt: order.createdAt,
      })),
    },
  });
});

function normalizeGroupBy(value) {
  const v = String(value || '').trim().toLowerCase();
  if (!v) return 'none';
  if (v === 'none') return 'none';
  if (v === 'payment' || v === 'paymentmethod') return 'paymentMethod';
  if (v === 'status' || v === 'orderstatus') return 'orderStatus';
  if (v === 'category' || v === 'categories') return 'category';
  if (v === 'product' || v === 'products') return 'product';
  if (v === 'deliveryzone' || v === 'zone' || v === 'zones') return 'deliveryZone';
  return 'none';
}

function clampInt(value, fallback, min, max) {
  const n = parseInt(value, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

function normalizeSortField(groupBy, value) {
  const v = String(value || 'revenue').trim().toLowerCase();
  const allowedBase = new Set(['revenue', 'orders']);
  const allowedProduct = new Set(['revenue', 'orders', 'unitsSold', 'profit']);
  const allowedCategory = new Set(['revenue', 'orders', 'unitsSold']);
  const allowed = groupBy === 'product'
    ? allowedProduct
    : groupBy === 'category'
      ? allowedCategory
      : allowedBase;
  return allowed.has(v) ? v : 'revenue';
}

function normalizeSortDir(value) {
  const v = String(value || 'desc').trim().toLowerCase();
  return v === 'asc' ? 1 : -1;
}

function normalizeSeriesGroupBy(value) {
  const v = String(value || '').trim().toLowerCase();
  if (!v || v === 'none') return 'none';
  if (v === 'category' || v === 'section' || v === 'sections') return 'category';
  if (v === 'product' || v === 'products') return 'product';
  return 'none';
}

export const getRevenueAnalytics = asyncHandler(async (req, res) => {
  const {
    period: periodInput = '30d',
    start,
    end,
    interval: intervalInput = 'auto',
    groupBy: groupByInput = 'none',
    q,
    page = '1',
    limit = '25',
    sort = 'revenue',
    dir = 'desc',
    seriesGroupBy: seriesGroupByInput = 'none',
    seriesLimit = '8',
    productId,
  } = req.query;

  const range = parseRevenueRangeQuery({ period: periodInput, start, end });
  const interval = pickRevenueInterval({ interval: intervalInput, days: range.days });
  const groupBy = normalizeGroupBy(groupByInput);
  const seriesGroupBy = normalizeSeriesGroupBy(seriesGroupByInput);
  const seriesTopN = clampInt(seriesLimit, 8, 1, 12);
  const pageNum = clampInt(page, 1, 1, 2000);
  const limitNum = clampInt(limit, 25, 5, 200);
  const skip = (pageNum - 1) * limitNum;
  const sortField = normalizeSortField(groupBy, sort);
  const sortDir = normalizeSortDir(dir);

  const focusProductId = typeof productId === 'string' && mongoose.Types.ObjectId.isValid(productId)
    ? new mongoose.Types.ObjectId(productId)
    : null;

  const match = revenueOrderMatch({
    createdAt: { $gte: range.since, $lt: range.until },
  });

  const { prevStart, prevEnd } = previousPeriodRange({
    periodKey: range.periodKey,
    startKey: range.startKey,
    endKey: range.endKey,
    days: range.days,
  });
  const previousMatch = revenueOrderMatch({ createdAt: { $gte: prevStart, $lt: prevEnd } });

  const bucketFormat = intervalDateFormat(interval);
  const bucketExpr = interval === 'week'
    ? {
      $dateToString: {
        format: bucketFormat,
        date: {
          $dateTrunc: {
            date: '$createdAt',
            unit: 'week',
            timezone: STORE_TIMEZONE,
          },
        },
        timezone: STORE_TIMEZONE,
      },
    }
    : {
      $dateToString: {
        format: bucketFormat,
        date: '$createdAt',
        timezone: STORE_TIMEZONE,
      },
    };

  const [totals, previousTotals, profitTotals, seriesRaw] = await Promise.all([
    sumOrders(match),
    sumOrders(previousMatch),
    sumProfit(match),
    Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: bucketExpr,
          revenue: { $sum: '$total' },
          orders: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
  ]);

  const grossProfit = (profitTotals.itemRevenue || 0) - (profitTotals.itemCost || 0);
  const grossMarginPercent = profitTotals.itemRevenue > 0
    ? Math.round((grossProfit / profitTotals.itemRevenue) * 1000) / 10
    : 0;

  let series = seriesRaw.map((row) => ({
    bucket: row._id,
    revenue: row.revenue || 0,
    orders: row.orders || 0,
  }));

  // If daily, fill missing days for nicer charts.
  if (interval === 'day') {
    series = fillRevenueByDay(
      series.map((r) => ({ date: r.bucket, revenue: r.revenue, orders: r.orders })),
      range.days,
      range.startKey,
    ).map((r) => ({ bucket: r.date, revenue: r.revenue, orders: r.orders }));
  }

  // Breakdown (table + optional chart)
  let breakdown = { dimension: groupBy, rows: [], pageInfo: null };
  if (groupBy === 'paymentMethod') {
    const rows = await Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$paymentMethod',
          revenue: { $sum: '$total' },
          orders: { $sum: 1 },
        },
      },
      { $sort: { revenue: -1 } },
    ]);
    const totalRevenue = rows.reduce((s, r) => s + (r.revenue || 0), 0);
    breakdown.rows = rows.map((row) => {
      const key = row._id || 'other';
      const labels = PAYMENT_LABELS[key] || { ar: key, en: key };
      const revenue = row.revenue || 0;
      return {
        key,
        labelAr: labels.ar,
        labelEn: labels.en,
        revenue,
        orders: row.orders || 0,
        sharePercent: totalRevenue > 0 ? Math.round((revenue / totalRevenue) * 1000) / 10 : 0,
      };
    });
  } else if (groupBy === 'orderStatus') {
    const rows = await Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$orderStatus',
          revenue: { $sum: '$total' },
          orders: { $sum: 1 },
        },
      },
      { $sort: { revenue: -1 } },
    ]);
    const totalRevenue = rows.reduce((s, r) => s + (r.revenue || 0), 0);
    breakdown.rows = rows.map((row) => {
      const revenue = row.revenue || 0;
      return {
        key: row._id || 'unknown',
        labelAr: row._id || 'unknown',
        labelEn: row._id || 'unknown',
        revenue,
        orders: row.orders || 0,
        sharePercent: totalRevenue > 0 ? Math.round((revenue / totalRevenue) * 1000) / 10 : 0,
      };
    });
  } else if (groupBy === 'deliveryZone') {
    const rows = await Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$deliveryZone',
          nameAr: { $first: '$deliveryZoneNameAr' },
          nameEn: { $first: '$deliveryZoneNameEn' },
          revenue: { $sum: '$total' },
          orders: { $sum: 1 },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 200 },
    ]);
    const totalRevenue = rows.reduce((s, r) => s + (r.revenue || 0), 0);
    breakdown.rows = rows.map((row) => {
      const revenue = row.revenue || 0;
      return {
        key: String(row._id || 'unknown'),
        labelAr: row.nameAr || 'غير معروف',
        labelEn: row.nameEn || 'Unknown',
        revenue,
        orders: row.orders || 0,
        sharePercent: totalRevenue > 0 ? Math.round((revenue / totalRevenue) * 1000) / 10 : 0,
      };
    });
  } else if (groupBy === 'category') {
    const search = String(q || '').trim();
    const rowsAgg = await Order.aggregate([
      { $match: match },
      { $unwind: '$items' },
      ...itemCostPipeline,
      {
        $lookup: {
          from: 'categories',
          localField: 'productDoc.category',
          foreignField: '_id',
          as: 'categoryDoc',
        },
      },
      { $unwind: { path: '$categoryDoc', preserveNullAndEmptyArrays: true } },
      ...(search
        ? [{
          $match: {
            $or: [
              { 'categoryDoc.nameAr': { $regex: search, $options: 'i' } },
              { 'categoryDoc.nameEn': { $regex: search, $options: 'i' } },
            ],
          },
        }]
        : []),
      {
        $group: {
          _id: '$categoryDoc._id',
          nameAr: { $first: '$categoryDoc.nameAr' },
          nameEn: { $first: '$categoryDoc.nameEn' },
          revenue: { $sum: '$lineRevenue' },
          orders: { $addToSet: '$_id' },
          unitsSold: { $sum: '$items.quantity' },
        },
      },
      {
        $project: {
          nameAr: 1,
          nameEn: 1,
          revenue: 1,
          unitsSold: 1,
          orders: { $size: '$orders' },
        },
      },
      {
        $addFields: {
          profit: '$revenue', // placeholder for consistent sorting; not exposed
        },
      },
      { $sort: { [sortField]: sortDir } },
      {
        $facet: {
          rows: [{ $skip: skip }, { $limit: limitNum }],
          total: [{ $count: 'count' }],
        },
      },
    ]);

    const rows = rowsAgg?.[0]?.rows || [];
    const totalCount = rowsAgg?.[0]?.total?.[0]?.count || 0;
    const totalsAgg = await Order.aggregate([
      { $match: match },
      { $unwind: '$items' },
      ...itemCostPipeline,
      {
        $lookup: {
          from: 'categories',
          localField: 'productDoc.category',
          foreignField: '_id',
          as: 'categoryDoc',
        },
      },
      { $unwind: { path: '$categoryDoc', preserveNullAndEmptyArrays: true } },
      ...(search
        ? [{
          $match: {
            $or: [
              { 'categoryDoc.nameAr': { $regex: search, $options: 'i' } },
              { 'categoryDoc.nameEn': { $regex: search, $options: 'i' } },
            ],
          },
        }]
        : []),
      { $group: { _id: null, revenue: { $sum: '$lineRevenue' } } },
    ]);
    const totalRevenue = totalsAgg?.[0]?.revenue || 0;

    breakdown.rows = rows.map((row) => {
      const revenue = row.revenue || 0;
      return {
        key: String(row._id || 'uncategorized'),
        labelAr: row.nameAr || 'غير مصنف',
        labelEn: row.nameEn || 'Uncategorized',
        revenue,
        orders: row.orders || 0,
        unitsSold: row.unitsSold || 0,
        sharePercent: totalRevenue > 0 ? Math.round((revenue / totalRevenue) * 1000) / 10 : 0,
      };
    });
    breakdown.pageInfo = {
      page: pageNum,
      limit: limitNum,
      total: totalCount,
      pages: totalCount ? Math.ceil(totalCount / limitNum) : 0,
    };
  } else if (groupBy === 'product') {
    const search = String(q || '').trim();
    const rowsAgg = await Order.aggregate([
      { $match: match },
      { $unwind: '$items' },
      ...itemCostPipeline,
      ...(search
        ? [{
          $match: {
            $or: [
              { 'items.nameAr': { $regex: search, $options: 'i' } },
              { 'items.nameEn': { $regex: search, $options: 'i' } },
              { 'items.sku': { $regex: search, $options: 'i' } },
            ],
          },
        }]
        : []),
      {
        $group: {
          _id: '$items.product',
          nameAr: { $first: '$items.nameAr' },
          nameEn: { $first: '$items.nameEn' },
          revenue: { $sum: '$lineRevenue' },
          cost: { $sum: '$lineCost' },
          unitsSold: { $sum: '$items.quantity' },
          orders: { $addToSet: '$_id' },
        },
      },
      {
        $project: {
          nameAr: 1,
          nameEn: 1,
          revenue: 1,
          cost: 1,
          unitsSold: 1,
          orders: { $size: '$orders' },
          profit: { $subtract: ['$revenue', '$cost'] },
        },
      },
      { $sort: { [sortField]: sortDir } },
      {
        $facet: {
          rows: [{ $skip: skip }, { $limit: limitNum }],
          total: [{ $count: 'count' }],
        },
      },
    ]);

    const rows = rowsAgg?.[0]?.rows || [];
    const totalCount = rowsAgg?.[0]?.total?.[0]?.count || 0;
    const totalsAgg = await Order.aggregate([
      { $match: match },
      { $unwind: '$items' },
      ...itemCostPipeline,
      ...(search
        ? [{
          $match: {
            $or: [
              { 'items.nameAr': { $regex: search, $options: 'i' } },
              { 'items.nameEn': { $regex: search, $options: 'i' } },
              { 'items.sku': { $regex: search, $options: 'i' } },
            ],
          },
        }]
        : []),
      { $group: { _id: null, revenue: { $sum: '$lineRevenue' } } },
    ]);
    const totalRevenue = totalsAgg?.[0]?.revenue || 0;

    breakdown.rows = rows.map((row) => {
      const revenue = row.revenue || 0;
      const cost = row.cost || 0;
      return {
        key: String(row._id || 'unknown'),
        labelAr: row.nameAr || 'منتج',
        labelEn: row.nameEn || 'Product',
        revenue,
        cost,
        profit: revenue - cost,
        orders: row.orders || 0,
        unitsSold: row.unitsSold || 0,
        sharePercent: totalRevenue > 0 ? Math.round((revenue / totalRevenue) * 1000) / 10 : 0,
      };
    });
    breakdown.pageInfo = {
      page: pageNum,
      limit: limitNum,
      total: totalCount,
      pages: totalCount ? Math.ceil(totalCount / limitNum) : 0,
    };
  }

  const periodRevenue = totals.revenue || 0;

  let seriesByDimension = null;
  if (seriesGroupBy !== 'none' && ['category', 'product'].includes(seriesGroupBy)) {
    const dimExpr = seriesGroupBy === 'category' ? '$productDoc.category' : '$items.product';
    const dimLabelArExpr = seriesGroupBy === 'category' ? '$categoryDoc.nameAr' : '$items.nameAr';
    const dimLabelEnExpr = seriesGroupBy === 'category' ? '$categoryDoc.nameEn' : '$items.nameEn';

    const topDimPipeline = [
      { $match: match },
      { $unwind: '$items' },
      ...itemCostPipeline,
      ...(seriesGroupBy === 'category'
        ? [{
          $lookup: {
            from: 'categories',
            localField: 'productDoc.category',
            foreignField: '_id',
            as: 'categoryDoc',
          },
        }, { $unwind: { path: '$categoryDoc', preserveNullAndEmptyArrays: true } }]
        : []),
      {
        $group: {
          _id: dimExpr,
          labelAr: { $first: dimLabelArExpr },
          labelEn: { $first: dimLabelEnExpr },
          revenue: { $sum: '$lineRevenue' },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: seriesTopN },
    ];

    const topDims = await Order.aggregate(topDimPipeline);
    const topDimIds = topDims.map((d) => d._id).filter(Boolean);

    if (topDimIds.length) {
      const seriesRows = await Order.aggregate([
        { $match: match },
        { $unwind: '$items' },
        ...itemCostPipeline,
        ...(seriesGroupBy === 'category'
          ? [{
            $lookup: {
              from: 'categories',
              localField: 'productDoc.category',
              foreignField: '_id',
              as: 'categoryDoc',
            },
          }, { $unwind: { path: '$categoryDoc', preserveNullAndEmptyArrays: true } }]
          : []),
        { $match: { [seriesGroupBy === 'category' ? 'productDoc.category' : 'items.product']: { $in: topDimIds } } },
        {
          $group: {
            _id: {
              bucket: bucketExpr,
              dim: dimExpr,
            },
            revenue: { $sum: '$lineRevenue' },
            orders: { $addToSet: '$_id' },
          },
        },
        {
          $project: {
            bucket: '$_id.bucket',
            dim: '$_id.dim',
            revenue: 1,
            orders: { $size: '$orders' },
          },
        },
        { $sort: { bucket: 1 } },
      ]);

      const dimMeta = new Map(topDims.map((d) => [String(d._id), {
        key: String(d._id),
        labelAr: d.labelAr || (seriesGroupBy === 'category' ? 'غير مصنف' : 'منتج'),
        labelEn: d.labelEn || (seriesGroupBy === 'category' ? 'Uncategorized' : 'Product'),
      }]));

      const bucketSet = new Set(seriesRows.map((r) => r.bucket));
      const buckets = Array.from(bucketSet).sort();
      const seriesMap = new Map();
      topDimIds.forEach((id) => {
        const meta = dimMeta.get(String(id));
        if (!meta) return;
        seriesMap.set(String(id), {
          ...meta,
          points: buckets.map((b) => ({ bucket: b, revenue: 0, orders: 0 })),
        });
      });

      const bucketIndex = new Map(buckets.map((b, i) => [b, i]));
      seriesRows.forEach((row) => {
        const key = String(row.dim);
        const i = bucketIndex.get(row.bucket);
        const target = seriesMap.get(key);
        if (target && i != null) {
          target.points[i] = {
            bucket: row.bucket,
            revenue: row.revenue || 0,
            orders: row.orders || 0,
          };
        }
      });

      seriesByDimension = {
        dimension: seriesGroupBy,
        interval,
        buckets,
        series: Array.from(seriesMap.values()),
      };
    }
  }

  let productDetail = null;
  if (focusProductId) {
    const [productTotals, productSeriesRaw] = await Promise.all([
      Order.aggregate([
        { $match: match },
        { $unwind: '$items' },
        { $match: { 'items.product': focusProductId } },
        ...itemCostPipeline,
        {
          $group: {
            _id: null,
            revenue: { $sum: '$lineRevenue' },
            cost: { $sum: '$lineCost' },
            unitsSold: { $sum: '$items.quantity' },
            orders: { $addToSet: '$_id' },
          },
        },
        {
          $project: {
            revenue: 1,
            cost: 1,
            unitsSold: 1,
            orders: { $size: '$orders' },
          },
        },
      ]),
      Order.aggregate([
        { $match: match },
        { $unwind: '$items' },
        { $match: { 'items.product': focusProductId } },
        ...itemCostPipeline,
        {
          $group: {
            _id: bucketExpr,
            revenue: { $sum: '$lineRevenue' },
            cost: { $sum: '$lineCost' },
            unitsSold: { $sum: '$items.quantity' },
            orders: { $addToSet: '$_id' },
          },
        },
        {
          $project: {
            bucket: '$_id',
            revenue: 1,
            cost: 1,
            unitsSold: 1,
            orders: { $size: '$orders' },
          },
        },
        { $sort: { bucket: 1 } },
      ]),
    ]);

    const totalsRow = productTotals?.[0] || { revenue: 0, cost: 0, unitsSold: 0, orders: 0 };
    const profit = (totalsRow.revenue || 0) - (totalsRow.cost || 0);
    const marginPercent = totalsRow.revenue > 0 ? Math.round((profit / totalsRow.revenue) * 1000) / 10 : 0;

    productDetail = {
      productId: String(focusProductId),
      totals: {
        revenue: totalsRow.revenue || 0,
        cost: totalsRow.cost || 0,
        profit,
        marginPercent,
        unitsSold: totalsRow.unitsSold || 0,
        orders: totalsRow.orders || 0,
      },
      series: (productSeriesRaw || []).map((r) => ({
        bucket: r.bucket,
        revenue: r.revenue || 0,
        cost: r.cost || 0,
        profit: (r.revenue || 0) - (r.cost || 0),
        unitsSold: r.unitsSold || 0,
        orders: r.orders || 0,
      })),
    };
  }

  res.json({
    success: true,
    data: {
      mode: range.isCustom ? 'range' : 'period',
      period: String(periodInput),
      range: { startKey: range.startKey, endKey: range.endKey, days: range.days },
      interval,
      groupBy,
      query: {
        q: String(q || ''),
        page: pageNum,
        limit: limitNum,
        sort: sortField,
        dir: sortDir === 1 ? 'asc' : 'desc',
        seriesGroupBy,
        seriesLimit: seriesTopN,
        productId: focusProductId ? String(focusProductId) : '',
      },
      summary: {
        revenue: periodRevenue,
        orders: totals.orders || 0,
        avgOrderValue: totals.orders ? periodRevenue / totals.orders : 0,
        subtotal: totals.subtotal || 0,
        deliveryFees: totals.deliveryFees || 0,
        discounts: totals.discounts || 0,
        pointsDiscounts: totals.pointsDiscounts || 0,
        itemRevenue: profitTotals.itemRevenue || 0,
        costOfGoods: profitTotals.itemCost || 0,
        grossProfit,
        grossMarginPercent,
        revenueChangePercent: pctChange(periodRevenue, previousTotals.revenue || 0),
        ordersChangePercent: pctChange(totals.orders || 0, previousTotals.orders || 0),
      },
      series,
      breakdown,
      seriesByDimension,
      productDetail,
    },
  });
});
