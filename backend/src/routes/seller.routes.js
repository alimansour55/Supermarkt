import { Router } from 'express';
import { sellerOnly, sellerCanEditCatalog, sellerOwnerOnly, sellerCan } from '../middleware/auth.js';
import { uploadSingle, uploadProductMediaMultiple, optionalUploadFields } from '../middleware/upload.js';
import {
  listMyPromotions,
  createMyPromotion,
  cancelMyPromotion,
  getMyStorefront,
  updateMyStorefront,
  uploadStorefrontMedia,
  getTrafficReport,
} from '../controllers/sellerGrowth.controller.js';
import { getMyFinance, getMyLedger } from '../controllers/sellerFinance.controller.js';
import { listMyReviews } from '../controllers/sellerReview.controller.js';
import {
  listTeam,
  addTeamMember,
  updateTeamMember,
  listMyInbound,
  createInbound,
  cancelMyInbound,
} from '../controllers/sellerOps.controller.js';
import {
  getSellerMe,
  updateSellerProfile,
  updateSellerBank,
  uploadSellerDocument,
  deleteSellerDocument,
  resubmitApplication,
  getSellerDashboard,
  listSellerProducts,
  getSellerProduct,
  uploadSellerProductMedia,
  createSellerProduct,
  updateSellerProduct,
  submitSellerProduct,
  pauseSellerProduct,
  unpauseSellerProduct,
  discardSellerProductChanges,
  deleteSellerProduct,
  updateSellerProductStock,
  importSellerProducts,
  duplicateSellerProduct,
  bulkSellerProductCategories,
  bulkUpdateSellerInventory,
  exportSellerShipments,
  bulkUpdateSellerShipments,
  listSellerShipments,
  getSellerShipment,
  updateSellerShipmentStatus,
} from '../controllers/sellerPortal.controller.js';
import {
  getSellerSummary,
  getSellerHome,
  getSalesReport,
  sellerQuickSearch,
} from '../controllers/sellerInsights.controller.js';
import {
  listMyCategories,
  createMyCategory,
  updateMyCategory,
  deleteMyCategory,
  reorderMyCategories,
} from '../controllers/sellerCategory.controller.js';
import { listSellerReturns, noteSellerReturn, getPayoutStatement } from '../controllers/sellerReturns.controller.js';
import {
  setVacation,
  exportSellerCatalog,
  listSellerQuestions,
  answerQuestion,
  setQuestionVisibility,
  listSellerProductReviews,
  replyToProductReview,
} from '../controllers/sellerCatalog.controller.js';
import {
  getMySecurity,
  changeMyPassword,
  setMyTwoFactor,
  signOutEverywhere,
  listMyActivity,
} from '../controllers/sellerAuth.controller.js';

/** Seller portal API — every route runs as the signed-in seller (req.seller). */
const router = Router();

router.use(...sellerOnly);

// Staff permissions by area — owners pass every check.
router.use(['/products', '/categories', '/inbound', '/questions', '/product-reviews', '/promotions'], sellerCan('products'));
router.use(['/shipments', '/returns'], sellerCan('orders'));
router.use('/reports', sellerCan('reports'));
router.use('/finance', sellerCan('finance'));

router.get('/me', getSellerMe);
router.put('/me', sellerCan('store'), optionalUploadFields([{ name: 'logo', maxCount: 1 }, { name: 'banner', maxCount: 1 }]), updateSellerProfile);
router.put('/me/bank', sellerOwnerOnly, updateSellerBank);
router.post('/me/documents', sellerCan('store'), uploadSingle('file'), uploadSellerDocument);
router.delete('/me/documents/:docId', sellerCan('store'), deleteSellerDocument);

router.put('/me/vacation', sellerCan('store'), setVacation);
router.get('/me/storefront', getMyStorefront);
router.put('/me/storefront', sellerCan('store'), updateMyStorefront);
router.post('/me/storefront/media', sellerCan('store'), uploadProductMediaMultiple('images', 5), uploadStorefrontMedia);
router.get('/me/security', getMySecurity);
router.put('/me/password', changeMyPassword);
router.put('/me/two-factor', setMyTwoFactor);
router.post('/me/sign-out-everywhere', signOutEverywhere);
router.get('/activity', sellerOwnerOnly, listMyActivity);
router.post('/me/resubmit', sellerOwnerOnly, resubmitApplication);

router.get('/dashboard', getSellerDashboard);
router.get('/summary', getSellerSummary);
router.get('/home', getSellerHome);
router.get('/reports/sales', getSalesReport);
router.get('/reports/traffic', getTrafficReport);
router.get('/promotions', listMyPromotions);
router.post('/promotions', sellerCanEditCatalog, createMyPromotion);
router.post('/promotions/:id/cancel', cancelMyPromotion);
router.get('/search', sellerQuickSearch);

router.get('/finance', getMyFinance);
router.get('/finance/ledger', getMyLedger);
router.get('/finance/payouts/:id/statement', getPayoutStatement);
router.get('/reviews', listMyReviews);

router.get('/team', sellerOwnerOnly, listTeam);
router.post('/team', sellerOwnerOnly, addTeamMember);
router.put('/team/:userId', sellerOwnerOnly, updateTeamMember);

router.get('/inbound', listMyInbound);
router.post('/inbound', sellerCanEditCatalog, createInbound);
router.post('/inbound/:id/cancel', cancelMyInbound);

router.get('/categories', listMyCategories);
router.post('/categories', sellerCanEditCatalog, createMyCategory);
router.put('/categories/reorder', sellerCanEditCatalog, reorderMyCategories);
router.put('/categories/:id', sellerCanEditCatalog, updateMyCategory);
router.delete('/categories/:id', sellerCanEditCatalog, deleteMyCategory);

router.get('/questions', listSellerQuestions);
router.post('/questions/:id/answer', sellerCanEditCatalog, answerQuestion);
router.post('/questions/:id/visibility', setQuestionVisibility);
router.get('/product-reviews', listSellerProductReviews);
router.post('/product-reviews/:productId/:reviewId/reply', replyToProductReview);

router.get('/products', listSellerProducts);
router.get('/products/export', exportSellerCatalog);
router.post('/products/media', sellerCanEditCatalog, uploadProductMediaMultiple('images', 10), uploadSellerProductMedia);
router.post('/products', sellerCanEditCatalog, createSellerProduct);
router.post('/products/import', sellerCanEditCatalog, importSellerProducts);
router.post('/products/bulk-categories', sellerCanEditCatalog, bulkSellerProductCategories);
router.put('/products/bulk-inventory', sellerCanEditCatalog, bulkUpdateSellerInventory);
router.get('/products/:id', getSellerProduct);
router.put('/products/:id', sellerCanEditCatalog, updateSellerProduct);
router.put('/products/:id/stock', sellerCanEditCatalog, updateSellerProductStock);
router.post('/products/:id/submit', sellerCanEditCatalog, submitSellerProduct);
router.post('/products/:id/duplicate', sellerCanEditCatalog, duplicateSellerProduct);
router.post('/products/:id/pause', pauseSellerProduct);
router.post('/products/:id/unpause', sellerCanEditCatalog, unpauseSellerProduct);
router.post('/products/:id/discard-changes', discardSellerProductChanges);
router.delete('/products/:id', deleteSellerProduct);

router.get('/returns', listSellerReturns);
router.post('/returns/:orderId/:returnId/note', noteSellerReturn);

router.get('/shipments', listSellerShipments);
router.get('/shipments/export', exportSellerShipments);
router.post('/shipments/bulk-status', bulkUpdateSellerShipments);
router.get('/shipments/:id', getSellerShipment);
// Suspended sellers still finish shipments already sold — the customer has paid.
router.post('/shipments/:id/status', updateSellerShipmentStatus);

export default router;
