import { Router } from 'express';
import { protect, requirePermission } from '../middleware/auth.js';
import {
  getAdminPushStats,
  registerMyDevice,
  sendAdminBroadcast,
  unregisterMyDevice,
} from '../controllers/push.controller.js';

const router = Router();

router.post('/devices', protect, registerMyDevice);
router.delete('/devices', protect, unregisterMyDevice);
router.get('/admin/stats', ...requirePermission('notifications:read'), getAdminPushStats);
router.post('/admin/broadcast', ...requirePermission('notifications:write'), sendAdminBroadcast);

export default router;
