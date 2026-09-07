import { Router } from 'express';
import { protect, adminOnly, requirePermission } from '../middleware/auth.js';
import {
  bulkPromotions,
  bulkCatalogOffers,
  createPromotion,
  deletePromotion,
  getAdminPromotion,
  getPromotionStats,
  importCatalogOffers,
  listAdminPromotions,
  listCatalogOffers,
  listHomepageCampaignCandidates,
  listPromotionProducts,
  patchCatalogOffer,
  togglePromotion,
  updatePromotion,
} from '../controllers/promotion.controller.js';

const router = Router();

router.use(protect, adminOnly);

router.get('/admin/homepage-candidates', requirePermission('promotions:write'), listHomepageCampaignCandidates);
router.get('/admin/stats', requirePermission('promotions:write'), getPromotionStats);
router.get('/admin/catalog-offers', requirePermission('promotions:write'), listCatalogOffers);
router.post('/admin/catalog-offers/bulk', requirePermission('promotions:write'), bulkCatalogOffers);
router.post('/admin/catalog-offers/import', requirePermission('promotions:write'), importCatalogOffers);
router.patch('/admin/catalog-offers/:productId', requirePermission('promotions:write'), patchCatalogOffer);
router.get('/admin', requirePermission('promotions:write'), listAdminPromotions);
router.get('/admin/:id', requirePermission('promotions:write'), getAdminPromotion);
router.get('/admin/:id/products', requirePermission('promotions:write'), listPromotionProducts);
router.post('/admin', requirePermission('promotions:write'), createPromotion);
router.put('/admin/:id', requirePermission('promotions:write'), updatePromotion);
router.patch('/admin/:id/toggle', requirePermission('promotions:write'), togglePromotion);
router.post('/admin/bulk', requirePermission('promotions:write'), bulkPromotions);
router.delete('/admin/:id', requirePermission('promotions:write'), deletePromotion);

export default router;
