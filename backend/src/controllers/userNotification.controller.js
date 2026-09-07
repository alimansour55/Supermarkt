import { asyncHandler } from '../middleware/errorHandler.js';
import { AppError } from '../utils/AppError.js';
import { parsePagination, paginationMeta } from '../utils/listQuery.js';
import {
  getUserNotifications,
  getUserUnreadCount,
  markUserNotificationRead,
  markAllUserNotificationsRead,
} from '../services/userNotification.service.js';

export const getMyNotifications = asyncHandler(async (req, res) => {
  const { page, limit } = parsePagination(req.query);
  const unreadOnly = req.query.unread === 'true';

  const { items, total, unreadCount } = await getUserNotifications(req.user._id, {
    page,
    limit,
    unreadOnly,
  });

  res.json({
    success: true,
    data: items,
    unreadCount,
    pagination: paginationMeta(page, limit, total),
  });
});

export const getMyUnreadNotificationCount = asyncHandler(async (req, res) => {
  const unreadCount = await getUserUnreadCount(req.user._id);
  res.json({ success: true, unreadCount });
});

export const markMyNotificationRead = asyncHandler(async (req, res) => {
  const notification = await markUserNotificationRead(req.params.id, req.user._id);
  if (!notification) throw new AppError('Notification not found', 404);
  res.json({ success: true });
});

export const markAllMyNotificationsRead = asyncHandler(async (req, res) => {
  const affected = await markAllUserNotificationsRead(req.user._id);
  res.json({ success: true, affected });
});
