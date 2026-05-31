import { asyncHandler } from '../middleware/errorHandler.js';
import { AppError } from '../utils/AppError.js';
import { parsePagination, paginationMeta } from '../utils/listQuery.js';
import Notification from '../models/Notification.js';
import {
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
} from '../services/notification.service.js';

export const getNotifications = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const userId = req.user._id;

  const filter = {};
  if (req.query.unread === 'true') {
    filter['readBy.user'] = { $ne: userId };
  }

  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Notification.countDocuments(filter),
    getUnreadCount(userId),
  ]);

  res.json({
    success: true,
    data: notifications.map((n) => ({
      ...n.toObject(),
      isRead: n.readBy.some((r) => r.user.toString() === userId.toString()),
    })),
    unreadCount,
    pagination: paginationMeta(page, limit, total),
  });
});

export const getUnreadNotificationCount = asyncHandler(async (req, res) => {
  const unreadCount = await getUnreadCount(req.user._id);
  res.json({ success: true, unreadCount });
});

export const markNotificationAsRead = asyncHandler(async (req, res) => {
  const notification = await markNotificationRead(req.params.id, req.user._id);
  if (!notification) throw new AppError('Notification not found', 404);
  res.json({ success: true });
});

export const markAllNotificationsAsRead = asyncHandler(async (req, res) => {
  const affected = await markAllNotificationsRead(req.user._id);
  res.json({ success: true, affected });
});
