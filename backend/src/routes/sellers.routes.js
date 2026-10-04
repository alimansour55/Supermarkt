import { Router } from 'express';
import { sellerApplyLimiter } from '../middleware/rateLimiter.js';
import { getMarketplaceConfig, applyAsSeller, getPublicSeller } from '../controllers/sellerPublic.controller.js';

/** Public marketplace endpoints — seller registration and storefront seller cards. */
const router = Router();

router.get('/config', getMarketplaceConfig);
router.post('/apply', sellerApplyLimiter, applyAsSeller);
router.get('/:slug', getPublicSeller);

export default router;
