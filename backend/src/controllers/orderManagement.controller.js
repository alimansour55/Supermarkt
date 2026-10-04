import Order from '../models/Order.js';
import Product from '../models/Product.js';
import User from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { formatOrder } from '../utils/formatters.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { logAudit } from '../services/auditLog.service.js';
import { resolveProductLine } from '../utils/productCatalog.js';
import {
  restoreOrderInventory,
  reverseOrderLoyalty,
  reverseCouponUsage,
  assertCustomerCanCancel,
  assertAdminCanCancel,
  pushStatusHistory,
  visibleMessages,
} from '../services/orderManagement.service.js';
import { reverseOrderWallet } from '../services/wallet.service.js';
import { processOnlineRefund } from '../services/payments/payment.service.js';
import { isOnlinePaymentMethod } from '../constants/paymentMethods.js';
import Shipment from '../models/Shipment.js';
import { assertShipmentsCancellable, shipmentsForOrder } from '../services/marketplaceOrder.service.js';
import { getActiveDeliveryCounts } from '../services/deliveryDispatch.service.js';
import { notifyOrderCustomerMessage } from '../services/notification.service.js';
import {
  countUnreadCustomerMessages,
  markOrderMessagesReadByAdmin,
} from '../utils/orderMessages.js';
import {
  ensureOrderDeliveredAt,
  getOrderDeliveredAt,
  getReturnDeadline,
  getReturnableQuantity,
  hasRejectedReturnForItem,
  isWithinReturnWindow,
} from '../services/orderReturn.service.js';
import {
  getCustomerEditBlockReason,
  isCustomerEditableOrder,
  updateCustomerOrderItems,
} from '../services/orderEdit.service.js';
import { generateOrderInvoicePdf } from '../services/invoicePdf.service.js';
import StoreSettings from '../models/StoreSettings.js';
import { requiresPaymentProof } from '../constants/paymentMethods.js';
import { CLOUDINARY_FOLDERS, uploadFileToCloudinary } from '../utils/cloudinaryUpload.js';
import { notifyOrderTimeline } from '../services/orderNotification.service.js';
import {
  formatFulfillmentLocation,
  resolveFulfillmentLocationForZone,
} from '../services/fulfillmentLocation.service.js';
import {
  notifyOrderStatusChange,
  sendOrderStatusUpdateEmail,
} from '../utils/sendEmail.js';
import { canShowOrderTracking, ensureOrderTracking } from '../services/deliveryTracking.service.js';
import { getGpsDeliveryEnabled } from '../services/storeSettings.service.js';
import {
  notifyCustomerDriverAssigned,
  notifyCustomerOrderStatus,
  notifyCustomerTrackingLive,
} from '../services/orderTrackingNotify.service.js';

async function loadOrderForAdmin(id) {
  const order = await Order.findById(id)
    .populate('user', 'name email phone')
    .populate('assignedDriver', 'name phone')
    .populate('fulfillmentLocationId');
  if (!order) throw new AppError('Order not found', 404);
  return order;
}

async function loadOrderForCustomer(id, userId) {
  const order = await Order.findOne({ _id: id, user: userId })
    .populate('assignedDriver', 'name phone')
    .populate('fulfillmentLocationId');
  if (!order) throw new AppError('Order not found', 404);
  return order;
}

async function formatOrderResponse(order, { isStaff = false, gpsDeliveryEnabled } = {}) {
  const gpsEnabled = gpsDeliveryEnabled ?? await getGpsDeliveryEnabled();
  ensureOrderDeliveredAt(order);
  const formatted = formatOrder(order);
  formatted.messages = visibleMessages(order, isStaff);
  formatted.returns = order.returns || [];
  const deliveredAt = getOrderDeliveredAt(order);
  formatted.deliveredAt = deliveredAt;
  formatted.returnWindowOpen = isWithinReturnWindow(order, { bypass: isStaff });
  formatted.returnDeadline = getReturnDeadline(deliveredAt);
  formatted.returnableQuantities = (order.items || []).map((_, index) =>
    getReturnableQuantity(order, index, { isStaff }),
  );
  formatted.returnBlockedByRejection = (order.items || []).map((_, index) =>
    !isStaff && hasRejectedReturnForItem(order, index),
  );
  if (isStaff) {
    formatted.unreadCustomerMessages = countUnreadCustomerMessages(order);
  }
  if (order.sellerIds?.length) {
    formatted.shipments = await shipmentsForOrder(order._id, { isStaff });
  }
  if (order.assignedDriver) {
    formatted.assignedDriver = {
      _id: order.assignedDriver._id,
      name: order.assignedDriver.name,
      phone: order.assignedDriver.phone,
    };
  }
  if (order.fulfillmentLocationId) {
    formatted.fulfillmentLocation = formatFulfillmentLocation(order.fulfillmentLocationId);
  }
  formatted.canEdit = isCustomerEditableOrder(order);
  formatted.canEditReason = getCustomerEditBlockReason(order, 'ar');
  formatted.canEditReasonEn = getCustomerEditBlockReason(order, 'en');
  formatted.trackingEnabled = order.trackingEnabled === true;
  formatted.canTrack = canShowOrderTracking(order, { gpsDeliveryEnabled: gpsEnabled });
  return formatted;
}

async function cancelOrderInternal(order, { reason, actor, isAdmin }) {
  if (isAdmin) assertAdminCanCancel(order);
  else {
    assertCustomerCanCancel(order);
    await assertShipmentsCancellable(order);
  }

  const previousStatus = order.orderStatus;

  // Lines of shipments a seller already cancelled were restocked and refunded then.
  const settledIdx = new Set();
  if (order.sellerIds?.length) {
    const cancelled = await Shipment.find({ order: order._id, status: 'cancelled' }).select('items.itemIndex').lean();
    cancelled.forEach((s) => s.items.forEach((it) => settledIdx.add(it.itemIndex)));
  }
  await restoreOrderInventory(order.items.filter((_, i) => !settledIdx.has(i)));
  await reverseOrderLoyalty(order);
  await reverseOrderWallet(order);
  await reverseCouponUsage(order);

  if (order.paymentStatus === 'paid' && isOnlinePaymentMethod(order.paymentMethod)) {
    // A cancelled seller shipment may already have been refunded through the gateway.
    const outstanding = Math.max(0, Math.round((order.total - (order.refundAmount || 0)) * 100) / 100);
    const refund = outstanding > 0
      ? await processOnlineRefund(order, outstanding, reason || 'Order cancelled')
      : { refundId: null };
    if (refund.refundId) order.paymentRefundId = refund.refundId;
    order.paymentStatus = 'refunded';
    order.refundAmount = order.total;
    order.refundedAt = new Date();
    order.refundReason = reason || 'Order cancelled';
  }

  order.orderStatus = 'cancelled';
  order.cancellationReason = reason || '';
  order.cancelledAt = new Date();
  order.cancelledBy = actor?._id || null;
  pushStatusHistory(order, 'cancelled', { note: reason, changedBy: actor?._id });

  await order.save();

  const user = order.user?._id ? order.user : await User.findById(order.user);
  await notifyOrderTimeline(order, user, 'cancelled');
  await notifyCustomerOrderStatus(order, user, 'cancelled', previousStatus)
    .catch((err) => console.error('Order tracking notify failed:', err.message));
  await notifyOrderStatusChange(order._id, 'cancelled', previousStatus);

  return order;
}

export const cancelMyOrder = asyncHandler(async (req, res) => {
  const order = await loadOrderForCustomer(req.params.id, req.user._id);
  const { reason } = req.body;

  await cancelOrderInternal(order, { reason, actor: req.user, isAdmin: false });

  await logAudit({
    req,
    action: 'cancel',
    entityType: 'order',
    entityId: order._id,
    entityLabel: order.orderNumber,
  });

  res.json({ success: true, order: await formatOrderResponse(order) });
});

export const cancelAdminOrder = asyncHandler(async (req, res) => {
  const order = await loadOrderForAdmin(req.params.id);
  const { reason } = req.body;

  const prev = order.orderStatus;
  await cancelOrderInternal(order, { reason, actor: req.user, isAdmin: true });

  await logAudit({
    req,
    action: 'cancel',
    entityType: 'order',
    entityId: order._id,
    entityLabel: order.orderNumber,
    changes: { orderStatus: { from: prev, to: 'cancelled' } },
  });

  res.json({ success: true, order: await formatOrderResponse(order, { isStaff: true }) });
});

export const refundAdminOrder = asyncHandler(async (req, res) => {
  const order = await loadOrderForAdmin(req.params.id);
  const { amount, reason } = req.body;

  if (order.paymentStatus !== 'paid') {
    throw new AppError('Only paid orders can be refunded', 400);
  }

  const refundAmount = amount != null ? Number(amount) : order.total;
  if (refundAmount <= 0 || refundAmount > order.total) {
    throw new AppError('Invalid refund amount', 400);
  }

  const refund = await processOnlineRefund(order, refundAmount, reason || 'Admin refund');
  if (refund.refundId) order.paymentRefundId = refund.refundId;

  order.paymentStatus = 'refunded';
  order.refundAmount = refundAmount;
  order.refundReason = reason || 'Admin refund';
  order.refundedAt = new Date();

  if (refundAmount >= order.total) {
    await reverseOrderLoyalty(order);
    await reverseOrderWallet(order);
  }

  await order.save();

  const user = order.user;
  await notifyOrderTimeline(order, user, 'refunded');
  await sendOrderStatusUpdateEmail(order, user, 'refunded');

  await logAudit({
    req,
    action: 'refund',
    entityType: 'order',
    entityId: order._id,
    entityLabel: order.orderNumber,
    changes: { refundAmount, paymentStatus: 'refunded', gatewayRefund: refund.status },
  });

  res.json({
    success: true,
    // 'manual_required' → the gateway can't refund this method (Fawry cash, valU): pay the customer back yourself.
    refund: { status: refund.status, refundId: refund.refundId },
    order: await formatOrderResponse(order, { isStaff: true }),
  });
});

export const suggestSubstitution = asyncHandler(async (req, res) => {
  const order = await loadOrderForAdmin(req.params.id);
  const { itemIndex, replacementProductId, replacementVariantId, reason } = req.body;

  if (['cancelled', 'delivered', 'delivery_failed'].includes(order.orderStatus)) {
    throw new AppError('Cannot suggest substitutions for this order', 400);
  }

  const idx = Number(itemIndex);
  const item = order.items[idx];
  if (!item) throw new AppError('Invalid item index', 400);
  if (item.seller) throw new AppError('Marketplace seller items cannot be substituted', 400);

  const product = await Product.findById(replacementProductId);
  if (!product?.isActive) throw new AppError('Replacement product not found', 404);

  const line = resolveProductLine(product, replacementVariantId);
  if (!line) throw new AppError('Invalid replacement variant', 400);

  const priceDiff = (line.price - item.price) * item.quantity;

  order.substitutions.push({
    itemIndex: idx,
    reason: reason || '',
    original: {
      product: item.product,
      nameAr: item.nameAr,
      nameEn: item.nameEn,
      price: item.price,
      quantity: item.quantity,
    },
    replacement: {
      product: product._id,
      variantId: line.variantId || null,
      nameAr: line.nameAr || product.nameAr,
      nameEn: line.nameEn || product.nameEn,
      price: line.price,
      quantity: item.quantity,
      image: line.image || product.images?.[0]?.url,
    },
    status: 'pending',
    priceDifference: priceDiff,
    suggestedBy: req.user._id,
  });

  await order.save();

  const user = order.user;
  await notifyOrderTimeline(order, user, 'substitution');
  await sendOrderStatusUpdateEmail(order, user, 'substitution_pending');

  res.json({ success: true, order: await formatOrderResponse(order, { isStaff: true }) });
});

export const respondToSubstitution = asyncHandler(async (req, res) => {
  const order = await loadOrderForCustomer(req.params.id, req.user._id);
  const { action } = req.body;
  const sub = order.substitutions.id(req.params.subId);

  if (!sub || sub.status !== 'pending') {
    throw new AppError('Substitution not found or already responded', 404);
  }

  if (!['accept', 'reject'].includes(action)) {
    throw new AppError('action must be accept or reject', 400);
  }

  sub.status = action === 'accept' ? 'accepted' : 'rejected';
  sub.respondedAt = new Date();

  if (action === 'accept') {
    const item = order.items[sub.itemIndex];
    if (item) {
      item.product = sub.replacement.product;
      item.variantId = sub.replacement.variantId;
      item.nameAr = sub.replacement.nameAr;
      item.nameEn = sub.replacement.nameEn;
      item.price = sub.replacement.price;
      item.image = sub.replacement.image;
      item.substituted = true;
      item.substitutionId = sub._id;
    }
    order.subtotal = Math.max(0, order.subtotal + sub.priceDifference);
    order.total = Math.max(0, order.total + sub.priceDifference);
  }

  await order.save();
  res.json({ success: true, order: await formatOrderResponse(order) });
});

export const assignDriver = asyncHandler(async (req, res) => {
  const order = await loadOrderForAdmin(req.params.id);
  const { driverId } = req.body;

  if (!order.fulfillmentLocationId) {
    const fulfillmentLocation = await resolveFulfillmentLocationForZone(order.deliveryZone);
    if (fulfillmentLocation) {
      order.fulfillmentLocationId = fulfillmentLocation._id;
    }
  }

  if (!driverId) {
    order.assignedDriver = null;
    order.assignedDriverAt = null;
  } else {
    const driver = await User.findById(driverId);
    if (!driver || driver.role !== 'driver') {
      throw new AppError('Invalid delivery staff member', 400);
    }
    order.assignedDriver = driver._id;
    order.assignedDriverAt = new Date();

    const shippableStatuses = ['pending', 'confirmed', 'preparing'];
    if (shippableStatuses.includes(order.orderStatus)) {
      order.orderStatus = 'out_for_delivery';
    }
  }

  if (order.assignedDriver && order.orderStatus === 'out_for_delivery') {
    await ensureOrderTracking(order);
  }

  await order.save();
  await order.populate('assignedDriver', 'name phone');
  await order.populate('fulfillmentLocationId');

  await logAudit({
    req,
    action: 'assign_driver',
    entityType: 'order',
    entityId: order._id,
    entityLabel: order.orderNumber,
    changes: { assignedDriver: driverId || null },
  });

  if (driverId && order.assignedDriver) {
    const populated = await Order.findById(order._id)
      .populate('user', 'name email phone')
      .populate('assignedDriver', 'name phone');
    notifyCustomerDriverAssigned(populated, populated.user, populated.assignedDriver)
      .catch((err) => console.error('Driver assign notify failed:', err.message));
    if (order.orderStatus === 'out_for_delivery') {
      notifyCustomerTrackingLive(populated, populated.user)
        .catch((err) => console.error('Tracking live notify failed:', err.message));
    }
  }

  res.json({ success: true, order: await formatOrderResponse(order, { isStaff: true }) });
});

export const getDeliveryStaff = asyncHandler(async (_req, res) => {
  const drivers = await User.find({ role: 'driver', isActive: { $ne: false } })
    .select('name phone email username lastLoginAt isActive driverAvailable')
    .sort({ name: 1 });

  const countByDriver = await getActiveDeliveryCounts();

  res.json({
    success: true,
    data: drivers.map((d) => ({
      _id: d._id,
      name: d.name,
      phone: d.phone || null,
      email: d.email || null,
      username: d.username || null,
      lastLoginAt: d.lastLoginAt || null,
      available: d.driverAvailable !== false,
      activeDeliveries: countByDriver[String(d._id)] || 0,
    })),
  });
});

function formatChatMessages(messages) {
  return (messages || []).map((m) => ({
    _id: m._id,
    author: m.author,
    authorName: m.authorName,
    authorRole: m.authorRole,
    body: m.body,
    isInternal: Boolean(m.isInternal),
    createdAt: m.createdAt,
  }));
}

export const getOrderMessages = asyncHandler(async (req, res) => {
  const isAdmin = req.originalUrl.includes('/admin/');
  const order = isAdmin
    ? await loadOrderForAdmin(req.params.id)
    : await loadOrderForCustomer(req.params.id, req.user._id);

  if (isAdmin && countUnreadCustomerMessages(order) > 0) {
    await markOrderMessagesReadByAdmin(order);
  }

  res.json({
    success: true,
    messages: formatChatMessages(visibleMessages(order, isAdmin)),
  });
});

export const addCustomerMessage = asyncHandler(async (req, res) => {
  const order = await loadOrderForCustomer(req.params.id, req.user._id);
  const { body } = req.body;

  if (!body?.trim()) throw new AppError('Message body is required', 400);

  order.messages.push({
    author: req.user._id,
    authorName: req.user.name,
    authorRole: 'customer',
    body: body.trim(),
    isInternal: false,
  });

  await order.save();

  const populated = await Order.findById(order._id).populate('user', 'name email phone');
  try {
    await notifyOrderCustomerMessage(populated, body.trim());
  } catch {
    /* notification failure must not block the message */
  }

  res.json({ success: true, order: await formatOrderResponse(order) });
});

export const addAdminMessage = asyncHandler(async (req, res) => {
  const order = await loadOrderForAdmin(req.params.id);
  const { body, isInternal = false } = req.body;

  if (!body?.trim()) throw new AppError('Message body is required', 400);

  order.messages.push({
    author: req.user._id,
    authorName: req.user.name,
    authorRole: 'staff',
    body: body.trim(),
    isInternal: Boolean(isInternal),
  });

  if (!isInternal) {
    order.adminMessagesReadAt = new Date();
  }

  await order.save();

  if (!isInternal) {
    const user = order.user;
    await sendOrderStatusUpdateEmail(order, user, 'message');
  }

  res.json({ success: true, order: await formatOrderResponse(order, { isStaff: true }) });
});

export const downloadOrderInvoice = asyncHandler(async (req, res) => {
  const isAdmin = req.originalUrl.includes('/admin/');
  let order;
  let user;

  if (isAdmin) {
    order = await loadOrderForAdmin(req.params.id);
    user = order.user;
  } else {
    order = await loadOrderForCustomer(req.params.id, req.user._id);
    user = req.user;
  }

  const lang = req.query.lang === 'en' ? 'en' : 'ar';
  const storeSettings = await StoreSettings.findOne({ key: 'main' }).lean();
  const pdf = await generateOrderInvoicePdf(order, user, { lang, storeSettings });

  const safeName = String(order.orderNumber || 'order').replace(/[^\w.-]+/g, '_');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Length', pdf.length);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="invoice-${safeName}.pdf"; filename*=UTF-8''invoice-${encodeURIComponent(order.orderNumber || 'order')}.pdf`,
  );
  res.end(pdf);
});

export const updateMyOrderItems = asyncHandler(async (req, res) => {
  const order = await loadOrderForCustomer(req.params.id, req.user._id);
  const lang = req.body.lang === 'en' ? 'en' : 'ar';

  const updated = await updateCustomerOrderItems(order, req.body.items, {
    user: req.user,
    lang,
  });

  await logAudit({
    req,
    action: 'update',
    entityType: 'order',
    entityId: updated._id,
    entityLabel: updated.orderNumber,
    changes: { items: 'customer_edit' },
  });

  res.json({ success: true, order: await formatOrderResponse(updated) });
});

export const uploadOrderPaymentProof = asyncHandler(async (req, res) => {
  const order = await loadOrderForCustomer(req.params.id, req.user._id);
  const lang = req.body?.lang === 'en' ? 'en' : 'ar';

  if (!requiresPaymentProof(order.paymentMethod)) {
    throw new AppError(lang === 'ar' ? 'هذا الطلب لا يتطلب إيصال تحويل' : 'This order does not require a transfer receipt', 400);
  }

  if (order.paymentStatus === 'paid') {
    throw new AppError(lang === 'ar' ? 'تم تأكيد الدفع بالفعل' : 'Payment is already confirmed', 400);
  }

  if (!req.file?.buffer?.length) {
    throw new AppError(lang === 'ar' ? 'ارفع صورة تأكيد التحويل' : 'Upload a transfer confirmation screenshot', 400);
  }

  const uploaded = await uploadFileToCloudinary(req.file, CLOUDINARY_FOLDERS.paymentProofs);
  order.paymentProofUrl = uploaded.url;
  order.paymentProofPublicId = uploaded.publicId;
  order.paymentProofUploadedAt = new Date();

  const manualPaymentAccount = String(req.body?.manualPaymentAccount || '').trim();
  if (manualPaymentAccount) {
    order.manualPaymentAccount = manualPaymentAccount;
  }

  await order.save();

  res.json({ success: true, order: await formatOrderResponse(order) });
});

export { formatOrderResponse };
