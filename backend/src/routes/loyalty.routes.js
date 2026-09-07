import { Router } from 'express';
import { protect, requirePermission } from '../middleware/auth.js';
import { getMyLoyalty } from '../controllers/loyalty.controller.js';
import {
  adjustAdminUserPoints,
  getAdminLoyaltyOverview,
  getAdminLoyaltyRules,
  getAdminUserLoyalty,
  searchAdminLoyaltyUsers,
  updateAdminLoyaltyRules,
} from '../controllers/loyaltyAdmin.controller.js';

const router = Router();

router.use(protect);
router.get('/me', getMyLoyalty);

router.get('/admin/rules', ...requirePermission('settings:write'), getAdminLoyaltyRules);
router.put('/admin/rules', ...requirePermission('settings:write'), updateAdminLoyaltyRules);
router.get('/admin/overview', ...requirePermission('settings:write'), getAdminLoyaltyOverview);
router.get('/admin/users', ...requirePermission('settings:write'), searchAdminLoyaltyUsers);
router.get('/admin/users/:userId', ...requirePermission('settings:write'), getAdminUserLoyalty);
router.post('/admin/users/:userId/adjust', ...requirePermission('settings:write'), adjustAdminUserPoints);

export default router;
