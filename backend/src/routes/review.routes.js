import { Router } from 'express';
import { protect, requirePermission } from '../middleware/auth.js';
import {
  bulkAdminReviews,
  deleteAdminReview,
  deleteMyReview,
  exportReviewsCsv,
  getAdminReviewProductFilters,
  getAdminReviewStats,
  getAdminReviews,
  getReviewEligibility,
  requestReviewForOrder,
  updateAdminReviewStatus,
  upsertMyReview,
} from '../controllers/review.controller.js';

const router = Router();

router.get('/admin/stats', ...requirePermission('reviews:moderate'), getAdminReviewStats);
router.get('/admin/product-filters', ...requirePermission('reviews:moderate'), getAdminReviewProductFilters);
router.get('/admin/export', ...requirePermission('reviews:moderate'), exportReviewsCsv);
router.get('/admin', ...requirePermission('reviews:moderate'), getAdminReviews);
router.post('/admin/bulk', ...requirePermission('reviews:moderate'), bulkAdminReviews);
router.post('/admin/orders/:orderId/request', ...requirePermission('reviews:moderate'), requestReviewForOrder);
router.patch('/admin/:productId/:reviewId', ...requirePermission('reviews:moderate'), updateAdminReviewStatus);
router.delete('/admin/:productId/:reviewId', ...requirePermission('reviews:moderate'), deleteAdminReview);

router.use(protect);
router.get('/products/:productId/eligibility', getReviewEligibility);
router.put('/products/:productId', upsertMyReview);
router.delete('/products/:productId', deleteMyReview);

export default router;
