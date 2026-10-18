import { Router } from 'express';
import { protect, requirePermission } from '../middleware/auth.js';
import { productEventLimiter } from '../middleware/rateLimiter.js';
import {
  cancelAdminCommission,
  getAdminAffiliateOverview,
  getAdminAffiliateSettings,
  getAffiliateProgram,
  getMyAffiliate,
  joinMyAffiliate,
  listAdminAffiliates,
  listAdminCommissions,
  releaseAdminCommission,
  trackAffiliateClick,
  updateAdminAffiliate,
  updateAdminAffiliateSettings,
  updateMyAffiliate,
} from '../controllers/affiliate.controller.js';

const router = Router();

// Public — someone opened a ?ref= link.
router.post('/click', productEventLimiter, trackAffiliateClick);
// Public — is the program on? (menus hide the link while it is off)
router.get('/program', getAffiliateProgram);

router.use(protect);

// Customer
router.get('/me', getMyAffiliate);
router.post('/me/join', joinMyAffiliate);
router.patch('/me', updateMyAffiliate);

// Admin
const canManage = requirePermission('promotions:write');
router.get('/admin/settings', ...canManage, getAdminAffiliateSettings);
router.put('/admin/settings', ...canManage, updateAdminAffiliateSettings);
router.get('/admin/overview', ...canManage, getAdminAffiliateOverview);
router.get('/admin/affiliates', ...canManage, listAdminAffiliates);
router.patch('/admin/affiliates/:id', ...canManage, updateAdminAffiliate);
router.get('/admin/commissions', ...canManage, listAdminCommissions);
router.post('/admin/commissions/:id/cancel', ...canManage, cancelAdminCommission);
router.post('/admin/commissions/:id/release', ...canManage, releaseAdminCommission);

export default router;
