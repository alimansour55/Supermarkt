import UserNotification from '../models/UserNotification.js';
import { sendPushToUser } from './push.service.js';

export async function createUserNotification({
  userId,
  type,
  titleAr,
  titleEn,
  messageAr,
  messageEn,
  link = '',
  data = {},
}) {
  if (!userId) return null;
  const notification = await UserNotification.create({
    user: userId,
    type,
    titleAr,
    titleEn,
    messageAr,
    messageEn,
    link,
    data,
  });
  // Every in-app notification also rings the customer's phone (no-op until Firebase is
  // configured). Not awaited: a slow push must never delay the request that triggered it.
  sendPushToUser(userId, {
    titleAr,
    titleEn,
    bodyAr: messageAr,
    bodyEn: messageEn,
    link,
    data: { type, notificationId: String(notification._id), ...(data?.orderId ? { orderId: String(data.orderId) } : {}) },
  });
  return notification;
}

export async function getUserNotifications(userId, { page = 1, limit = 20, unreadOnly = false } = {}) {
  const skip = (Math.max(1, page) - 1) * limit;
  const filter = { user: userId };
  if (unreadOnly) filter.readAt = null;

  const [items, total, unreadCount] = await Promise.all([
    UserNotification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    UserNotification.countDocuments(filter),
    UserNotification.countDocuments({ user: userId, readAt: null }),
  ]);

  return {
    items: items.map((n) => ({ ...n, isRead: Boolean(n.readAt) })),
    total,
    unreadCount,
  };
}

export async function getUserUnreadCount(userId) {
  return UserNotification.countDocuments({ user: userId, readAt: null });
}

export async function markUserNotificationRead(notificationId, userId) {
  const notification = await UserNotification.findOneAndUpdate(
    { _id: notificationId, user: userId },
    { readAt: new Date() },
    { new: true },
  );
  return notification;
}

export async function markAllUserNotificationsRead(userId) {
  const result = await UserNotification.updateMany(
    { user: userId, readAt: null },
    { readAt: new Date() },
  );
  return result.modifiedCount;
}

export async function wasRecentlyNotified(userId, orderId, type, withinMs) {
  if (!userId || !orderId) return false;
  const since = new Date(Date.now() - withinMs);
  const existing = await UserNotification.findOne({
    user: userId,
    type,
    'data.orderId': orderId,
    createdAt: { $gte: since },
  }).select('_id').lean();
  return Boolean(existing);
}
