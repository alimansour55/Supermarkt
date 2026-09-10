import { Router } from 'express';
import { requirePermission } from '../middleware/auth.js';
import {
  validate,
  createCouponValidation,
  updateCouponValidation,
  validateDiscountCodeValidation,
} from '../middleware/validate.js';
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

router.post('/validate', validate(validateDiscountCodeValidation), validateDiscountCode);
router.post('/admin', ...requirePermission('coupons:write'), validate(createCouponValidation), createCoupon);
router.post('/admin/bulk', ...requirePermission('coupons:write'), bulkAdminCoupons);
router.get('/admin', ...requirePermission('coupons:write'), getAdminCoupons);
router.put('/admin/:id', ...requirePermission('coupons:write'), validate(updateCouponValidation), updateCoupon);
router.delete('/admin/:id', ...requirePermission('coupons:write'), deleteCoupon);
router.get('/', listCoupons);

export default router;
