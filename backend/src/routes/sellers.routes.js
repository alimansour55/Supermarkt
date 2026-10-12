import { Router } from 'express';
import { sellerApplyLimiter } from '../middleware/rateLimiter.js';
import { getMarketplaceConfig, applyAsSeller, getPublicSeller } from '../controllers/sellerPublic.controller.js';
import { listPublicSellerReviews } from '../controllers/sellerReview.controller.js';
import { listPublicSellerCategories } from '../controllers/sellerCategory.controller.js';

/** Public marketplace endpoints — seller registration and storefront seller cards. */
const router = Router();

router.get('/config', getMarketplaceConfig);
router.post('/apply', sellerApplyLimiter, applyAsSeller);
router.get('/:slug/reviews', listPublicSellerReviews);
router.get('/:slug/categories', listPublicSellerCategories);
router.get('/:slug', getPublicSeller);

export default router;
