import { Router } from 'express';
import { requirePermission } from '../middleware/auth.js';
import {
  getMarketplaceAdminSettings,
  updateMarketplaceAdminSettings,
  listSellers,
  getSellerAdmin,
  createSellerAdmin,
  updateSellerAdmin,
  changeSellerStatusAdmin,
  reviewSellerDocument,
  listListingQueue,
  approveListing,
  rejectListing,
} from '../controllers/marketplaceAdmin.controller.js';

/** Staff marketplace management — mounted at /api/admin/marketplace. */
const router = Router();

const read = requirePermission('sellers:read');
const write = requirePermission('sellers:write');

router.get('/settings', ...read, getMarketplaceAdminSettings);
router.put('/settings', ...requirePermission('settings:write'), updateMarketplaceAdminSettings);

router.get('/sellers', ...read, listSellers);
router.post('/sellers', ...write, createSellerAdmin);
router.get('/sellers/:id', ...read, getSellerAdmin);
router.put('/sellers/:id', ...write, updateSellerAdmin);
router.post('/sellers/:id/status', ...write, changeSellerStatusAdmin);
router.put('/sellers/:id/documents/:docId', ...write, reviewSellerDocument);

router.get('/listings', ...read, listListingQueue);
router.post('/listings/:id/approve', ...write, approveListing);
router.post('/listings/:id/reject', ...write, rejectListing);

export default router;
