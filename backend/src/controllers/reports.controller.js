import Order from '../models/Order.js';
import Coupon from '../models/Coupon.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import {
  fillRevenueByDay,
  parseRevenuePeriod,
  revenueOrderMatch,
  PAYMENT_LABELS,
  storeDateGroupField,
} from '../utils/revenueReport.js';

/** Attach unit wholesale cost from line snapshot or current product */
const itemCostFields = [
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
      unitCost: {
        $ifNull: [
          '$items.wholesalePrice',
          { $ifNull: ['$productDoc.wholesalePrice', 0] },
        ],
      },
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

export const getReports = asyncHandler(async (req, res) => {
  const { since, days } = parseRevenuePeriod(req.query.period || '30d');

  const orderMatch = revenueOrderMatch({ createdAt: { $gte: since } });

  const [
    revenueSummary,
    profitSummary,
    salesByCategoryRaw,
    topProductsRaw,
    coupons,
    ordersWithCoupons,
    revenueByDayRaw,
    revenueByPaymentRaw,
    totalAllTimeAgg,
  ] = await Promise.all([
    Order.aggregate([
      { $match: orderMatch },
      {
        $group: {
          _id: null,
          revenue: { $sum: '$total' },
          orders: { $sum: 1 },
          discountTotal: { $sum: '$discount' },
        },
      },
    ]),
    Order.aggregate([
      { $match: orderMatch },
      { $unwind: '$items' },
      ...itemCostFields,
      {
        $group: {
          _id: null,
          itemRevenue: { $sum: '$lineRevenue' },
          itemCost: { $sum: '$lineCost' },
        },
      },
    ]),
    Order.aggregate([
      { $match: orderMatch },
      { $unwind: '$items' },
      ...itemCostFields,
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
          categorySlug: { $first: '$categoryDoc.slug' },
          nameAr: { $first: '$categoryDoc.nameAr' },
          nameEn: { $first: '$categoryDoc.nameEn' },
          revenue: { $sum: '$lineRevenue' },
          cost: { $sum: '$lineCost' },
          unitsSold: { $sum: '$items.quantity' },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 12 },
    ]),
    Order.aggregate([
      { $match: orderMatch },
      { $unwind: '$items' },
      ...itemCostFields,
      {
        $group: {
          _id: '$items.product',
          nameAr: { $first: '$items.nameAr' },
          nameEn: { $first: '$items.nameEn' },
          unitsSold: { $sum: '$items.quantity' },
          revenue: { $sum: '$lineRevenue' },
          cost: { $sum: '$lineCost' },
        },
      },
      { $sort: { unitsSold: -1 } },
      { $limit: 10 },
    ]),
    Coupon.find().sort({ usedCount: -1 }).select('code usedCount usageLimit discountType discountValue labelAr labelEn isActive expiryDate'),
    Order.aggregate([
      {
        $match: {
          ...orderMatch,
          couponCode: { $exists: true, $nin: [null, ''] },
        },
      },
      {
        $group: {
          _id: '$couponCode',
          uses: { $sum: 1 },
          totalDiscount: { $sum: '$discount' },
        },
      },
      { $sort: { uses: -1 } },
    ]),
    Order.aggregate([
      { $match: orderMatch },
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
      { $match: orderMatch },
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
      { $match: revenueOrderMatch() },
      {
        $group: {
          _id: null,
          revenue: { $sum: '$total' },
          orders: { $sum: 1 },
        },
      },
    ]),
  ]);

  const summary = revenueSummary[0] || { revenue: 0, orders: 0, discountTotal: 0 };
  const profitRow = profitSummary[0] || { itemRevenue: 0, itemCost: 0 };
  const grossProfit = profitRow.itemRevenue - profitRow.itemCost;
  const grossMarginPercent = profitRow.itemRevenue > 0
    ? Math.round((grossProfit / profitRow.itemRevenue) * 1000) / 10
    : 0;

  const categoryIds = salesByCategoryRaw
    .filter((r) => r._id)
    .map((r) => r._id);

  if (categoryIds.length === 0 && salesByCategoryRaw.some((r) => !r._id)) {
    // Uncategorized bucket already in aggregation
  }

  const salesByCategory = salesByCategoryRaw.map((row) => {
    const profit = (row.revenue || 0) - (row.cost || 0);
    return {
      categoryId: row._id,
      slug: row.categorySlug || 'uncategorized',
      nameAr: row.nameAr || 'غير مصنف',
      nameEn: row.nameEn || 'Uncategorized',
      revenue: row.revenue,
      cost: row.cost || 0,
      profit,
      unitsSold: row.unitsSold,
    };
  });

  const topProducts = topProductsRaw.map((row) => {
    const profit = (row.revenue || 0) - (row.cost || 0);
    return {
      productId: row._id,
      nameAr: row.nameAr,
      nameEn: row.nameEn,
      unitsSold: row.unitsSold,
      revenue: row.revenue,
      cost: row.cost || 0,
      profit,
    };
  });

  const couponUsage = coupons.map((c) => {
    const orderStats = ordersWithCoupons.find(
      (o) => o._id?.toUpperCase() === c.code.toUpperCase(),
    );
    return {
      code: c.code,
      usedCount: c.usedCount,
      usageLimit: c.usageLimit,
      orderUsesInPeriod: orderStats?.uses || 0,
      totalDiscountInPeriod: orderStats?.totalDiscount || 0,
      discountType: c.discountType,
      discountValue: c.discountValue,
      labelAr: c.labelAr,
      labelEn: c.labelEn,
      isActive: c.isActive,
      expiryDate: c.expiryDate,
    };
  });

  const revenueByDay = fillRevenueByDay(
    revenueByDayRaw.map((row) => ({
      date: row._id,
      revenue: row.revenue,
      orders: row.orders,
    })),
    days,
  );

  const revenueByPayment = revenueByPaymentRaw.map((row) => {
    const key = row._id || 'other';
    const labels = PAYMENT_LABELS[key] || { ar: key, en: key };
    return {
      method: key,
      labelAr: labels.ar,
      labelEn: labels.en,
      revenue: row.revenue,
      orders: row.orders,
    };
  });

  const totalAllTime = totalAllTimeAgg[0] || { revenue: 0, orders: 0 };

  res.json({
    success: true,
    reports: {
      period: req.query.period || '30d',
      since,
      summary: {
        revenue: summary.revenue,
        orders: summary.orders,
        discountTotal: summary.discountTotal,
        avgOrderValue: summary.orders ? summary.revenue / summary.orders : 0,
        itemRevenue: profitRow.itemRevenue,
        costOfGoods: profitRow.itemCost,
        grossProfit,
        grossMarginPercent,
        totalAllTimeRevenue: totalAllTime.revenue,
        totalAllTimeOrders: totalAllTime.orders,
      },
      revenueByDay,
      revenueByPayment,
      salesByCategory,
      topProducts,
      couponUsage,
    },
  });
});
