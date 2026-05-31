import Order from '../models/Order.js';
import Product from '../models/Product.js';
import User from '../models/User.js';
import { formatOrder } from '../utils/formatters.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { ORDER_STATUSES } from '../constants/orderStatuses.js';

const NON_CANCELLED = { orderStatus: { $ne: 'cancelled' } };

function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function pctChange(current, previous) {
  if (!previous) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

function fillSalesByDay(rows, days = 30) {
  const map = new Map(rows.map((r) => [r.date, r]));
  const result = [];
  const cursor = startOfDay();
  cursor.setDate(cursor.getDate() - (days - 1));

  for (let i = 0; i < days; i += 1) {
    const key = cursor.toISOString().slice(0, 10);
    const row = map.get(key);
    result.push({
      date: key,
      revenue: row?.revenue || 0,
      orders: row?.orders || 0,
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return result;
}

async function sumRevenueAndCount(match) {
  const [agg] = await Order.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        revenue: { $sum: '$total' },
        orders: { $sum: 1 },
      },
    },
  ]);
  return { revenue: agg?.revenue || 0, orders: agg?.orders || 0 };
}

export const getDashboardStats = asyncHandler(async (_req, res) => {
  const now = new Date();
  const todayStart = startOfDay(now);
  const yesterdayStart = startOfDay(new Date(now.getTime() - 86400000));
  const yesterdayEnd = endOfDay(new Date(now.getTime() - 86400000));
  const sevenDaysAgo = startOfDay(new Date(now.getTime() - 6 * 86400000));
  const prevSevenStart = startOfDay(new Date(now.getTime() - 13 * 86400000));
  const prevSevenEnd = endOfDay(new Date(now.getTime() - 7 * 86400000));
  const thirtyDaysAgo = startOfDay(new Date(now.getTime() - 29 * 86400000));

  const [
    totalOrders,
    totalProducts,
    totalUsers,
    salesAgg,
    lowStockProducts,
    latestOrders,
    pendingOrdersCount,
    salesByDayRaw,
    ordersByStatusRaw,
    todayStats,
    yesterdayStats,
    current7d,
    previous7d,
    newUsers7d,
    newUsersPrev7d,
  ] = await Promise.all([
    Order.countDocuments(NON_CANCELLED),
    Product.countDocuments(),
    User.countDocuments({ role: 'user' }),
    Order.aggregate([
      { $match: NON_CANCELLED },
      { $group: { _id: null, totalSales: { $sum: '$total' } } },
    ]),
    Product.find({ stock: { $lte: 10 }, isActive: true })
      .sort({ stock: 1 })
      .limit(10)
      .select('nameAr nameEn stock price slug emoji'),
    Order.find()
      .sort({ createdAt: -1 })
      .limit(8)
      .populate('user', 'name email'),
    Order.countDocuments({ orderStatus: 'pending' }),
    Order.aggregate([
      {
        $match: {
          createdAt: { $gte: thirtyDaysAgo },
          ...NON_CANCELLED,
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          revenue: { $sum: '$total' },
          orders: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Order.aggregate([{ $group: { _id: '$orderStatus', count: { $sum: 1 } } }]),
    sumRevenueAndCount({ createdAt: { $gte: todayStart }, ...NON_CANCELLED }),
    sumRevenueAndCount({
      createdAt: { $gte: yesterdayStart, $lte: yesterdayEnd },
      ...NON_CANCELLED,
    }),
    sumRevenueAndCount({ createdAt: { $gte: sevenDaysAgo }, ...NON_CANCELLED }),
    sumRevenueAndCount({
      createdAt: { $gte: prevSevenStart, $lte: prevSevenEnd },
      ...NON_CANCELLED,
    }),
    User.countDocuments({ role: 'user', createdAt: { $gte: sevenDaysAgo } }),
    User.countDocuments({
      role: 'user',
      createdAt: { $gte: prevSevenStart, $lte: prevSevenEnd },
    }),
  ]);

  const salesByDay = fillSalesByDay(
    salesByDayRaw.map((r) => ({
      date: r._id,
      revenue: r.revenue,
      orders: r.orders,
    })),
  );

  const statusMap = Object.fromEntries(
    ordersByStatusRaw.map((r) => [r._id, r.count]),
  );
  const ordersByStatus = ORDER_STATUSES.map((s) => ({
    status: s.value,
    count: statusMap[s.value] || 0,
  }));

  const avg7d = current7d.orders ? current7d.revenue / current7d.orders : 0;
  const avgPrev7d = previous7d.orders ? previous7d.revenue / previous7d.orders : 0;

  res.json({
    success: true,
    stats: {
      totalSales: salesAgg[0]?.totalSales || 0,
      totalOrders,
      totalProducts,
      totalUsers,
      pendingOrdersCount,
      todayOrders: todayStats.orders,
      todayRevenue: todayStats.revenue,
      todayOrdersChange: pctChange(todayStats.orders, yesterdayStats.orders),
      todayRevenueChange: pctChange(todayStats.revenue, yesterdayStats.revenue),
      revenue7d: current7d.revenue,
      revenue7dChange: pctChange(current7d.revenue, previous7d.revenue),
      orders7d: current7d.orders,
      orders7dChange: pctChange(current7d.orders, previous7d.orders),
      avgOrder7d: Math.round(avg7d * 100) / 100,
      avgOrder7dChange: pctChange(avg7d, avgPrev7d),
      newUsers7d,
      newUsers7dChange: pctChange(newUsers7d, newUsersPrev7d),
      salesByDay,
      ordersByStatus,
      lowStockProducts,
      latestOrders: latestOrders.map(formatOrder),
    },
  });
});
