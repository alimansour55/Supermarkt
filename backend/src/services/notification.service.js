import Notification from '../models/Notification.js';

export async function createNotification(payload) {
  return Notification.create(payload);
}

export async function notifyNewOrder(order) {
  return createNotification({
    type: 'new_order',
    titleAr: 'طلب جديد',
    titleEn: 'New order',
    messageAr: `طلب #${order.orderNumber} — ${order.total} ج.م`,
    messageEn: `Order #${order.orderNumber} — ${order.total} EGP`,
    link: '/admin/orders',
    data: {
      orderId: order._id,
      orderNumber: order.orderNumber,
      total: order.total,
    },
  });
}

export async function notifyOrderCustomerMessage(order, preview) {
  const snippet = (preview || '').trim().slice(0, 120);
  const customerName = order.user?.name || order.phone || '';

  return createNotification({
    type: 'order_customer_message',
    titleAr: 'رسالة من عميل على طلب',
    titleEn: 'Customer message on order',
    messageAr: `طلب #${order.orderNumber}${customerName ? ` — ${customerName}` : ''}${snippet ? `: ${snippet}` : ''}`,
    messageEn: `Order #${order.orderNumber}${customerName ? ` — ${customerName}` : ''}${snippet ? `: ${snippet}` : ''}`,
    link: `/admin/order-chats?order=${order._id}`,
    data: {
      orderId: order._id,
      orderNumber: order.orderNumber,
    },
  });
}

export async function notifySupportConversationMessage(conversation, preview) {
  const snippet = (preview || '').trim().slice(0, 120);
  const customerName = conversation.user?.name || conversation.user?.phone || '';

  return createNotification({
    type: 'support_chat_message',
    titleAr: 'رسالة دردشة جديدة',
    titleEn: 'New live chat message',
    messageAr: `${customerName || 'عميل'}${snippet ? `: ${snippet}` : ''}`,
    messageEn: `${customerName || 'Customer'}${snippet ? `: ${snippet}` : ''}`,
    link: `/admin/live-chat?conversation=${conversation._id}`,
    data: {
      conversationId: conversation._id,
    },
  });
}

export async function notifyLowStock(product, threshold) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const existing = await Notification.findOne({
    type: 'low_stock',
    'data.productId': product._id,
    createdAt: { $gte: since },
  });
  if (existing) return existing;

  const nameAr = product.nameAr || product.name;
  const nameEn = product.nameEn || nameAr;

  return createNotification({
    type: 'low_stock',
    titleAr: 'مخزون منخفض',
    titleEn: 'Low stock alert',
    messageAr: `${nameAr} — ${product.stock} متبقي (حد التنبيه: ${threshold})`,
    messageEn: `${nameEn} — ${product.stock} left (threshold: ${threshold})`,
    link: `/admin/products/${product._id}/edit`,
    data: {
      productId: product._id,
      slug: product.slug,
      stock: product.stock,
      threshold,
    },
  });
}

export async function getUnreadCount(userId) {
  return Notification.countDocuments({
    'readBy.user': { $ne: userId },
  });
}

export async function markNotificationRead(notificationId, userId) {
  const notification = await Notification.findById(notificationId);
  if (!notification) return null;

  const already = notification.readBy.some(
    (r) => r.user.toString() === userId.toString(),
  );
  if (!already) {
    notification.readBy.push({ user: userId, readAt: new Date() });
    await notification.save();
  }
  return notification;
}

export async function markAllNotificationsRead(userId) {
  const unread = await Notification.find({ 'readBy.user': { $ne: userId } });
  await Promise.all(
    unread.map((n) => markNotificationRead(n._id, userId)),
  );
  return unread.length;
}
