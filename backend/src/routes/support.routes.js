import { Router } from 'express';
import { optionalProtect, requirePermission } from '../middleware/auth.js';
import { callbackRequestLimiter } from '../middleware/rateLimiter.js';
import {
  createCallbackRequest,
  listAdminCallbackRequests,
  updateAdminCallbackRequest,
} from '../controllers/callbackRequest.controller.js';

const router = Router();

// Customer — works for guests and signed-in users
router.post('/callback-requests', callbackRequestLimiter, optionalProtect, createCallbackRequest);

// Admin
const canView = requirePermission('orders:read');
const canManage = requirePermission('orders:write');
router.get('/admin/callback-requests', ...canView, listAdminCallbackRequests);
router.patch('/admin/callback-requests/:id', ...canManage, updateAdminCallbackRequest);

export default router;
