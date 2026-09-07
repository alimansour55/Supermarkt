import { Router } from 'express';
import { requirePermission } from '../middleware/auth.js';
import {
  getAdminNotificationTemplate,
  listAdminNotificationTemplates,
  seedAdminNotificationTemplates,
  updateAdminNotificationTemplate,
} from '../controllers/notificationTemplate.controller.js';

const router = Router();

router.get('/admin', ...requirePermission('notifications:write'), listAdminNotificationTemplates);
router.post('/admin/seed', ...requirePermission('notifications:write'), seedAdminNotificationTemplates);
router.get('/admin/:key', ...requirePermission('notifications:write'), getAdminNotificationTemplate);
router.put('/admin/:key', ...requirePermission('notifications:write'), updateAdminNotificationTemplate);

export default router;
