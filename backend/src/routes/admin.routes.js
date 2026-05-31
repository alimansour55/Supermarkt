import { Router } from 'express';
import { requirePermission } from '../middleware/auth.js';
import { getDashboardStats } from '../controllers/admin.controller.js';
import { getReports } from '../controllers/reports.controller.js';
import { getAuditLogs } from '../controllers/auditLog.controller.js';
import {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '../controllers/notification.controller.js';
import {
  getAdminUsers,
  bulkAdminUsers,
  getAdminUserById,
  updateAdminUser,
  deleteAdminUser,
} from '../controllers/user.controller.js';

const router = Router();

router.get('/dashboard/stats', ...requirePermission('dashboard:read'), getDashboardStats);
router.get('/reports', ...requirePermission('reports:read'), getReports);

router.get('/notifications', ...requirePermission('notifications:read'), getNotifications);
router.get('/notifications/unread-count', ...requirePermission('notifications:read'), getUnreadNotificationCount);
router.patch('/notifications/read-all', ...requirePermission('notifications:read'), markAllNotificationsAsRead);
router.patch('/notifications/:id/read', ...requirePermission('notifications:read'), markNotificationAsRead);

router.get('/audit-logs', ...requirePermission('audit:read'), getAuditLogs);

router.post('/users/bulk', ...requirePermission('users:write'), bulkAdminUsers);
router.get('/users', ...requirePermission('users:read'), getAdminUsers);
router.get('/users/:id', ...requirePermission('users:read'), getAdminUserById);
router.put('/users/:id', ...requirePermission('users:write'), updateAdminUser);
router.delete('/users/:id', ...requirePermission('users:write'), deleteAdminUser);

export default router;
