import { Router } from 'express';
import { requirePermission } from '../middleware/auth.js';
import {
  validateDiscountCode,
  listCoupons,
  createCoupon,
  getAdminCoupons,
  bulkAdminCoupons,
  updateCoupon,
  deleteCoupon,
} from '../controllers/coupon.controller.js';

const router = Router();

router.post('/validate', validateDiscountCode);
router.post('/admin', ...requirePermission('coupons:write'), createCoupon);
router.post('/admin/bulk', ...requirePermission('coupons:write'), bulkAdminCoupons);
router.get('/admin', ...requirePermission('coupons:write'), getAdminCoupons);
router.put('/admin/:id', ...requirePermission('coupons:write'), updateCoupon);
router.delete('/admin/:id', ...requirePermission('coupons:write'), deleteCoupon);
router.get('/', listCoupons);

export default router;
