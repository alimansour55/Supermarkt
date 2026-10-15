import { Router } from 'express';
import { requirePermission } from '../middleware/auth.js';
import { listSellerReviewsAdmin, setSellerReviewStatusAdmin } from '../controllers/sellerReview.controller.js';
import { listInboundAdmin, receiveInboundAdmin } from '../controllers/sellerOps.controller.js';
import { listPromotionsAdmin, reviewPromotionAdmin } from '../controllers/sellerGrowth.controller.js';
import {
  getSellerBalancesAdmin,
  getSellerLedgerAdmin,
  addSellerAdjustmentAdmin,
  generatePayoutAdmin,
  listPayoutsAdmin,
  markPayoutPaidAdmin,
  cancelPayoutAdmin,
  exportPendingPayoutsAdmin,
} from '../controllers/sellerFinance.controller.js';
import {
  getMarketplaceAdminSettings,
  updateMarketplaceAdminSettings,
  listSellers,
  getSellerAdmin,
  createSellerAdmin,
  sendSellerAccessAdmin,
  updateSellerAdmin,
  changeSellerStatusAdmin,
  reviewSellerDocument,
  listListingQueue,
  approveListing,
  rejectListing,
  listShipmentsAdmin,
  updateShipmentStatusAdmin,
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
router.post('/sellers/:id/access', ...write, sendSellerAccessAdmin);

router.get('/listings', ...read, listListingQueue);
router.post('/listings/:id/approve', ...write, approveListing);
router.get('/promotions', ...read, listPromotionsAdmin);
router.post('/promotions/:id/review', ...write, reviewPromotionAdmin);
router.post('/listings/:id/reject', ...write, rejectListing);

router.get('/shipments', ...requirePermission('orders:read'), listShipmentsAdmin);
router.post('/shipments/:id/status', ...requirePermission('orders:write'), updateShipmentStatusAdmin);

router.get('/inbound', ...requirePermission('products:read'), listInboundAdmin);
router.post('/inbound/:id/receive', ...requirePermission('products:write'), receiveInboundAdmin);

router.get('/seller-reviews', ...read, listSellerReviewsAdmin);
router.put('/seller-reviews/:id', ...write, setSellerReviewStatusAdmin);

// Seller money — reading balances needs reports access; moving money needs sellers:write.
router.get('/finance/balances', ...requirePermission('reports:read'), getSellerBalancesAdmin);
router.get('/sellers/:id/ledger', ...requirePermission('reports:read'), getSellerLedgerAdmin);
router.post('/sellers/:id/adjustments', ...write, addSellerAdjustmentAdmin);
router.post('/sellers/:id/payouts', ...write, generatePayoutAdmin);
router.get('/payouts', ...requirePermission('reports:read'), listPayoutsAdmin);
router.get('/payouts/export', ...write, exportPendingPayoutsAdmin);
router.post('/payouts/:id/paid', ...write, markPayoutPaidAdmin);
router.post('/payouts/:id/cancel', ...write, cancelPayoutAdmin);

export default router;
