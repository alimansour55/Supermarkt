import { Router } from 'express';
import { requirePermission } from '../middleware/auth.js';
import { optionalUploadFields } from '../middleware/upload.js';
import {
  addSellerLoginAdmin,
  updateSellerLoginAdmin,
  setSellerLoginPasswordAdmin,
  signOutSellerLoginAdmin,
  removeSellerLoginAdmin,
  transferSellerOwnerAdmin,
} from '../controllers/sellerAdminAccess.controller.js';
import {
  getSellerDealAdmin,
  getSellerHistoryAdmin,
  scheduleSellerDealAdmin,
  cancelSellerDealAdmin,
  bulkSellerDealAdmin,
} from '../controllers/sellerDeal.controller.js';
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
  getProfitReportAdmin,
  exportProfitReportAdmin,
  previewFeesAdmin,
  chargePenaltyAdmin,
} from '../controllers/sellerProfit.controller.js';
import {
  getMarketplaceAdminSettings,
  updateMarketplaceAdminSettings,
  listSellers,
  getSellerAdmin,
  createSellerAdmin,
  sendSellerAccessAdmin,
  updateSellerAdmin,
  updateSellerMediaAdmin,
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
router.post('/sellers/bulk-deal', ...requirePermission('settings:write'), bulkSellerDealAdmin);
router.get('/sellers/:id', ...read, getSellerAdmin);
router.put('/sellers/:id', ...write, updateSellerAdmin);
router.post('/sellers/:id/status', ...write, changeSellerStatusAdmin);
router.put('/sellers/:id/documents/:docId', ...write, reviewSellerDocument);
router.post('/sellers/:id/access', ...write, sendSellerAccessAdmin);
router.post('/sellers/:id/media', ...write, optionalUploadFields([{ name: 'logo', maxCount: 1 }, { name: 'banner', maxCount: 1 }]), updateSellerMediaAdmin);
// Logins (support: temporary password, sign out, unlock, 2-step reset, team, owner)
router.post('/sellers/:id/users', ...write, addSellerLoginAdmin);
router.put('/sellers/:id/users/:userId', ...write, updateSellerLoginAdmin);
router.post('/sellers/:id/users/:userId/password', ...write, setSellerLoginPasswordAdmin);
router.post('/sellers/:id/users/:userId/sign-out', ...write, signOutSellerLoginAdmin);
router.delete('/sellers/:id/users/:userId', ...write, removeSellerLoginAdmin);
router.post('/sellers/:id/owner', ...write, transferSellerOwnerAdmin);
// Deal (commission & fees): summary, history, scheduled changes
router.get('/sellers/:id/deal', ...read, getSellerDealAdmin);
router.get('/sellers/:id/history', ...read, getSellerHistoryAdmin);
router.post('/sellers/:id/deal-schedule', ...write, scheduleSellerDealAdmin);
router.delete('/sellers/:id/deal-schedule/:changeId', ...write, cancelSellerDealAdmin);

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
router.post('/sellers/:id/penalties', ...write, chargePenaltyAdmin);

// Profit from sellers and the fee calculator.
router.get('/profit', ...requirePermission('reports:read'), getProfitReportAdmin);
router.get('/profit/export', ...requirePermission('reports:read'), exportProfitReportAdmin);
router.post('/fees/preview', ...read, previewFeesAdmin);

export default router;
