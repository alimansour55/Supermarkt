import Order from '../models/Order.js';
import Cart from '../models/Cart.js';
import Coupon from '../models/Coupon.js';
import Product from '../models/Product.js';
import { AppError } from '../utils/AppError.js';
import { calculateCartTotals, validateCoupon } from '../utils/cartCalculations.js';
import { formatOrder } from '../utils/formatters.js';
import { notifyOrderCreated, notifyOrderStatusChange } from '../utils/sendEmail.js';
import { logAudit } from '../services/auditLog.service.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { parsePagination, parseSort, paginationMeta } from '../utils/listQuery.js';
import { toCsv, sendCsv } from '../utils/csvExport.js';

const ADMIN_ORDER_SORT = ['createdAt', 'total', 'orderNumber'];

function buildAdminOrderFilter(query) {
  const filter = {};
  if (query.orderStatus) filter.orderStatus = query.orderStatus;
  if (query.paymentStatus) filter.paymentStatus = query.paymentStatus;

  if (query.dateFrom || query.dateTo) {
    filter.createdAt = {};
    if (query.dateFrom) filter.createdAt.$gte = new Date(query.dateFrom);
    if (query.dateTo) {
      const end = new Date(query.dateTo);
      end.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = end;
    }
  }

  if (query.q) {
    const rx = { $regex: query.q, $options: 'i' };
    filter.$or = [
      { orderNumber: rx },
      { phone: rx },
      { couponCode: rx },
    ];
  }

  return filter;
}

const generateOrderNumber = () => {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `MP-${dateStr}-${random}`;
};

export const createOrder = asyncHandler(async (req, res) => {
  const {
    items,
    shippingAddress,
    phone,
    notes,
    paymentMethod = 'cod',
    deliveryMethod = 'scheduled',
    scheduledDate,
    discountCode,
    area,
  } = req.body;

  if (!items?.length) {
    throw new AppError('Cart is empty', 400);
  }

  if (!shippingAddress?.street) {
    throw new AppError('Delivery address is required', 400);
  }

  if (!phone) {
    throw new AppError('Phone number is required', 400);
  }

  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);

  if (discountCode) {
    const validation = await validateCoupon(discountCode, subtotal);
    if (!validation.valid) {
      throw new AppError(validation.message, 400);
    }
  }

  const totals = await calculateCartTotals({ items, deliveryMethod, discountCode });

  const productIds = items
    .map((item) => item.productId || item.product)
    .filter(Boolean);
  const products = productIds.length
    ? await Product.find({ _id: { $in: productIds } }).select('wholesalePrice')
    : [];
  const wholesaleById = Object.fromEntries(
    products.map((p) => [p._id.toString(), p.wholesalePrice ?? 0]),
  );

  const order = await Order.create({
    orderNumber: generateOrderNumber(),
    user: req.user._id,
    items: items.map((item) => {
      const pid = (item.productId || item.product)?.toString?.()
        || String(item.productId || item.product || '');
      return {
        product: item.productId || item.product,
        nameAr: item.name || item.nameAr,
        nameEn: item.nameEn,
        price: item.price,
        wholesalePrice: wholesaleById[pid] ?? 0,
        quantity: item.quantity,
        unit: item.unit,
        image: item.emoji || item.image,
      };
    }),
    shippingAddress: {
      label: shippingAddress.label,
      street: shippingAddress.street,
      building: shippingAddress.building,
      floor: shippingAddress.floor,
      city: shippingAddress.city || area,
      governorate: shippingAddress.governorate,
      area,
      postalCode: shippingAddress.postalCode,
    },
    phone,
    subtotal: totals.subtotal,
    deliveryFee: totals.deliveryFee,
    discount: totals.discountAmount,
    couponCode: totals.appliedCoupon?.code || discountCode || null,
    total: totals.total,
    paymentMethod,
    deliveryMethod,
    scheduledDate: scheduledDate ? new Date(scheduledDate) : undefined,
    notes,
    paymentStatus: 'pending',
    orderStatus: 'pending',
    statusHistory: [{ status: 'pending', changedAt: new Date() }],
  });

  if (totals.appliedCoupon?.code) {
    await Coupon.findOneAndUpdate(
      { code: totals.appliedCoupon.code },
      { $inc: { usedCount: 1 } },
    );
  }

  await Cart.findOneAndUpdate(
    { user: req.user._id },
    { items: [] },
    { upsert: true },
  );

  notifyOrderCreated(order, req.user);

  res.status(201).json({
    success: true,
    order: {
      id: order._id,
      orderNumber: order.orderNumber,
      total: order.total,
      paymentMethod: order.paymentMethod,
      deliveryMethod: order.deliveryMethod,
      status: order.orderStatus,
      orderStatus: order.orderStatus,
    },
  });
});

export const getMyOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });

  res.json({ success: true, orders: orders.map(formatOrder) });
});

export const getOrderById = asyncHandler(async (req, res) => {
  const order = await Order.findOne({ _id: req.params.id, user: req.user._id });

  if (!order) {
    throw new AppError('Order not found', 404);
  }

  res.json({ success: true, order: formatOrder(order) });
});

export const calculateTotals = asyncHandler(async (req, res) => {
  const { items, deliveryMethod, discountCode } = req.body;
  const totals = await calculateCartTotals({ items: items || [], deliveryMethod, discountCode });
  res.json({ success: true, ...totals });
});

export const getAdminOrders = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = buildAdminOrderFilter(req.query);
  const sort = parseSort(req.query, ADMIN_ORDER_SORT);

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .populate('user', 'name email phone')
      .sort(sort)
      .skip(skip)
      .limit(limit),
    Order.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: orders.map(formatOrder),
    pagination: paginationMeta(page, limit, total),
  });
});

export const exportAdminOrders = asyncHandler(async (req, res) => {
  const filter = buildAdminOrderFilter(req.query);
  const sort = parseSort(req.query, ADMIN_ORDER_SORT);

  const orders = await Order.find(filter)
    .populate('user', 'name email phone')
    .sort(sort)
    .limit(5000);

  const csv = toCsv(orders, [
    { header: 'Order #', value: (o) => o.orderNumber },
    { header: 'Date', value: (o) => o.createdAt?.toISOString?.() || o.createdAt },
    { header: 'Customer', value: (o) => o.user?.name || o.phone },
    { header: 'Email', value: (o) => o.user?.email || '' },
    { header: 'Phone', value: (o) => o.phone },
    { header: 'Total', value: (o) => o.total },
    { header: 'Order Status', value: (o) => o.orderStatus },
    { header: 'Payment Status', value: (o) => o.paymentStatus },
    { header: 'Payment Method', value: (o) => o.paymentMethod },
  ]);

  sendCsv(res, 'orders.csv', csv);
});

export const getAdminOrderById = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id).populate('user', 'name email phone');

  if (!order) {
    throw new AppError('Order not found', 404);
  }

  res.json({ success: true, order: formatOrder(order) });
});

export const updateOrderStatus = asyncHandler(async (req, res) => {
  const { orderStatus, paymentStatus, adminNotes } = req.body;
  const order = await Order.findById(req.params.id);

  if (!order) {
    throw new AppError('Order not found', 404);
  }

  const previousStatus = order.orderStatus;

  if (orderStatus && orderStatus !== order.orderStatus) {
    order.orderStatus = orderStatus;
    order.statusHistory = order.statusHistory || [];
    order.statusHistory.push({ status: orderStatus, changedAt: new Date() });
  }
  if (paymentStatus) order.paymentStatus = paymentStatus;
  if (adminNotes !== undefined) order.adminNotes = adminNotes;

  await order.save();

  if (orderStatus && orderStatus !== previousStatus) {
    notifyOrderStatusChange(order._id, orderStatus, previousStatus);
    await logAudit({
      req,
      action: 'status_change',
      entityType: 'order',
      entityId: order._id,
      entityLabel: order.orderNumber,
      changes: { orderStatus: { from: previousStatus, to: orderStatus } },
    });
  }

  const populated = await Order.findById(order._id).populate('user', 'name email phone');
  res.json({ success: true, order: formatOrder(populated) });
});
