import Order from '../models/Order.js';
import Product from '../models/Product.js';
import User from '../models/User.js';
import { countPendingReviews } from '../utils/productRating.js';
import { countOrdersWithUnreadCustomerMessages } from '../utils/orderMessages.js';
import { countPendingOrderReturns } from './orderReturn.controller.js';
import { countPendingCallbackRequests } from './callbackRequest.controller.js';
import { countOpenUnreadConversations } from './supportConversation.controller.js';
import { formatOrder } from '../utils/formatters.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { ORDER_STATUSES } from '../constants/orderStatuses.js';
import {
  fillRevenueByDay,
  getStoreDateKey,
  parseRevenuePeriod,
  revenueOrderMatch,
  startOfStoreDay,
  storeDateGroupField,
  pctChange,
} from '../utils/revenueReport.js';
import { getAdminStockAlertThreshold } from '../utils/adminStockThreshold.js';

const REVENUE_MATCH = revenueOrderMatch();

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
  const adminStockThreshold = await getAdminStockAlertThreshold();
  const now = new Date();
  const todayStart = startOfStoreDay(now);
  const todayKey = getStoreDateKey(now);
  const yesterdayKey = getStoreDateKey(new Date(now.getTime() - 86400000));
  const yesterdayStart = new Date(`${yesterdayKey}T00:00:00+02:00`);
  const yesterdayEnd = new Date(`${todayKey}T00:00:00+02:00`);
  const sevenDaysAgo = startOfStoreDay(new Date(now.getTime() - 6 * 86400000));
  const prevSevenStart = startOfStoreDay(new Date(now.getTime() - 13 * 86400000));
  const prevSevenEnd = new Date(sevenDaysAgo.getTime() - 1);
  const thirtyDaysAgo = startOfStoreDay(new Date(now.getTime() - 29 * 86400000));

  const [
    totalOrders,
    totalProducts,
    totalUsers,
    salesAgg,
    lowStockProducts,
    outOfStockProducts,
    outOfStockCount,
    latestOrders,
    pendingOrdersCount,
    pendingReviewsCount,
    ordersUnreadMessagesCount,
    pendingReturnsCount,
    pendingCallbackRequestsCount,
    pendingLiveChatsCount,
    salesByDayRaw,
    ordersByStatusRaw,
    todayStats,
    yesterdayStats,
    current7d,
    previous7d,
    newUsers7d,
    newUsersPrev7d,
  ] = await Promise.all([
    Order.countDocuments(REVENUE_MATCH),
    Product.countDocuments(),
    User.countDocuments({ role: 'user' }),
    Order.aggregate([
      { $match: REVENUE_MATCH },
      { $group: { _id: null, totalSales: { $sum: '$total' } } },
    ]),
    Product.find({ stock: { $lte: adminStockThreshold, $gt: 0 }, isActive: true })
      .sort({ stock: 1 })
      .limit(10)
      .select('nameAr nameEn stock price slug emoji'),
    Product.find({ stock: 0, isActive: true })
      .sort({ updatedAt: -1 })
      .limit(10)
      .select('nameAr nameEn stock price slug emoji'),
    Product.countDocuments({ stock: 0, isActive: true }),
    Order.find()
      .sort({ createdAt: -1 })
      .limit(8)
      .populate('user', 'name email'),
    Order.countDocuments({ orderStatus: 'pending' }),
    countPendingReviews(Product),
    countOrdersWithUnreadCustomerMessages(),
    countPendingOrderReturns(),
    countPendingCallbackRequests(),
    countOpenUnreadConversations(),
    Order.aggregate([
      {
        $match: {
          createdAt: { $gte: thirtyDaysAgo },
          ...REVENUE_MATCH,
        },
      },
      {
        $group: {
          _id: storeDateGroupField(),
          revenue: { $sum: '$total' },
          orders: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Order.aggregate([{ $group: { _id: '$orderStatus', count: { $sum: 1 } } }]),
    sumRevenueAndCount({ createdAt: { $gte: todayStart }, ...REVENUE_MATCH }),
    sumRevenueAndCount({
      createdAt: { $gte: yesterdayStart, $lt: yesterdayEnd },
      ...REVENUE_MATCH,
    }),
    sumRevenueAndCount({ createdAt: { $gte: sevenDaysAgo }, ...REVENUE_MATCH }),
    sumRevenueAndCount({
      createdAt: { $gte: prevSevenStart, $lte: prevSevenEnd },
      ...REVENUE_MATCH,
    }),
    User.countDocuments({ role: 'user', createdAt: { $gte: sevenDaysAgo } }),
    User.countDocuments({
      role: 'user',
      createdAt: { $gte: prevSevenStart, $lte: prevSevenEnd },
    }),
  ]);

  const salesByDay = fillRevenueByDay(
    salesByDayRaw.map((r) => ({
      date: r._id,
      revenue: r.revenue,
      orders: r.orders,
    })),
    30,
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
      pendingReviewsCount,
      ordersUnreadMessagesCount,
      pendingReturnsCount,
      pendingCallbackRequestsCount,
      pendingLiveChatsCount,
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
      outOfStockProducts,
      outOfStockCount,
      latestOrders: latestOrders.map(formatOrder),
    },
  });
});

const DASHBOARD_SALES_TREND_PERIODS = new Set(['7d', '30d', '90d']);

export const getDashboardSalesTrend = asyncHandler(async (req, res) => {
  const period = DASHBOARD_SALES_TREND_PERIODS.has(req.query.period) ? req.query.period : '30d';
  const { since, days, startKey } = parseRevenuePeriod(period);

  const salesByDayRaw = await Order.aggregate([
    { $match: { createdAt: { $gte: since }, ...REVENUE_MATCH } },
    {
      $group: {
        _id: storeDateGroupField(),
        revenue: { $sum: '$total' },
        orders: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const salesByDay = fillRevenueByDay(
    salesByDayRaw.map((r) => ({ date: r._id, revenue: r.revenue, orders: r.orders })),
    days,
    startKey,
  );

  res.json({ success: true, data: { period, salesByDay } });
});
