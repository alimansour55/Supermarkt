import { Router } from 'express';
import { requirePermission, staffOnly } from '../middleware/auth.js';
import { validate, createAdminUserValidation } from '../middleware/validate.js';
import { getAdminReturns } from '../controllers/orderReturn.controller.js';
import { getDashboardStats } from '../controllers/admin.controller.js';
import { getReports } from '../controllers/reports.controller.js';
import { getRevenueAnalytics, getRevenueDashboard } from '../controllers/revenue.controller.js';
import {
  getPartnerRevenueDistributionReport,
  getPartnerRevenueSettingsHandler,
  updatePartnerRevenueSettingsHandler,
  searchPartnerRevenueProductsHandler,
  searchPartnerRevenueCustomersHandler,
} from '../controllers/partnerRevenue.controller.js';
import {
  getPartnerPayoutsHandler,
  getPartnerPayoutSummaryHandler,
  generatePartnerPayoutsHandler,
  createPartnerPayoutHandler,
  updatePartnerPayoutHandler,
  setPartnerPayoutStatusHandler,
  deletePartnerPayoutHandler,
} from '../controllers/partnerPayout.controller.js';
import { getAuditLogs } from '../controllers/auditLog.controller.js';
import {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '../controllers/notification.controller.js';
import {
  getAdminUsers,
  createAdminUser,
  bulkAdminUsers,
  getAdminUserById,
  updateAdminUser,
  deleteAdminUser,
} from '../controllers/user.controller.js';
import {
  getStaffAccounts,
  getStaffAccountById,
  createStaffAccount,
  updateStaffAccount,
  deleteStaffAccount,
  getStaffPermissionMeta,
} from '../controllers/staff.controller.js';

const router = Router();

/** Product returns inbox — dedicated path avoids /orders/admin/:id catching "returns" */
router.get('/order-returns', ...staffOnly, getAdminReturns);

router.get('/dashboard/stats', ...requirePermission('dashboard:read'), getDashboardStats);
router.get('/revenue', ...requirePermission('reports:read'), getRevenueDashboard);
router.get('/revenue/analytics', ...requirePermission('reports:read'), getRevenueAnalytics);
router.get('/reports', ...requirePermission('reports:read'), getReports);
router.get('/partner-revenue/distribution', ...requirePermission('reports:read'), getPartnerRevenueDistributionReport);
router.get('/partner-revenue/settings', ...requirePermission('reports:read'), getPartnerRevenueSettingsHandler);
router.get('/partner-revenue/search-products', ...requirePermission('reports:read'), searchPartnerRevenueProductsHandler);
router.get('/partner-revenue/search-customers', ...requirePermission('reports:read'), searchPartnerRevenueCustomersHandler);
router.put('/partner-revenue/settings', ...requirePermission('settings:write'), updatePartnerRevenueSettingsHandler);
router.get('/partner-revenue/payouts', ...requirePermission('reports:read'), getPartnerPayoutsHandler);
router.get('/partner-revenue/payouts/summary', ...requirePermission('reports:read'), getPartnerPayoutSummaryHandler);
router.post('/partner-revenue/payouts/generate', ...requirePermission('settings:write'), generatePartnerPayoutsHandler);
router.post('/partner-revenue/payouts', ...requirePermission('settings:write'), createPartnerPayoutHandler);
router.patch('/partner-revenue/payouts/:id', ...requirePermission('settings:write'), updatePartnerPayoutHandler);
router.patch('/partner-revenue/payouts/:id/status', ...requirePermission('settings:write'), setPartnerPayoutStatusHandler);
router.delete('/partner-revenue/payouts/:id', ...requirePermission('settings:write'), deletePartnerPayoutHandler);

router.get('/notifications', ...requirePermission('notifications:read'), getNotifications);
router.get('/notifications/unread-count', ...requirePermission('notifications:read'), getUnreadNotificationCount);
router.patch('/notifications/read-all', ...requirePermission('notifications:read'), markAllNotificationsAsRead);
router.patch('/notifications/:id/read', ...requirePermission('notifications:read'), markNotificationAsRead);

router.get('/audit-logs', ...requirePermission('audit:read'), getAuditLogs);

router.post('/users/bulk', ...requirePermission('users:write'), bulkAdminUsers);
router.post('/users', ...requirePermission('users:write'), validate(createAdminUserValidation), createAdminUser);
router.get('/users', ...requirePermission('users:read'), getAdminUsers);
router.get('/users/:id', ...requirePermission('users:read'), getAdminUserById);
router.put('/users/:id', ...requirePermission('users:write'), updateAdminUser);
router.delete('/users/:id', ...requirePermission('users:write'), deleteAdminUser);

router.get('/staff/permissions', ...requirePermission('users:read'), getStaffPermissionMeta);
router.get('/staff', ...requirePermission('users:read'), getStaffAccounts);
router.post('/staff', ...requirePermission('users:write'), createStaffAccount);
router.get('/staff/:id', ...requirePermission('users:read'), getStaffAccountById);
router.put('/staff/:id', ...requirePermission('users:write'), updateStaffAccount);
router.delete('/staff/:id', ...requirePermission('users:write'), deleteStaffAccount);

export default router;
