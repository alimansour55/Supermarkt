import { Router } from 'express';
import { sellerOnly, sellerCanEditCatalog, sellerOwnerOnly } from '../middleware/auth.js';
import { uploadSingle, uploadProductMediaMultiple, optionalUploadFields } from '../middleware/upload.js';
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
  listSellerShipments,
  getSellerShipment,
  updateSellerShipmentStatus,
} from '../controllers/sellerPortal.controller.js';
import {
  listMyCategories,
  createMyCategory,
  updateMyCategory,
  deleteMyCategory,
  reorderMyCategories,
} from '../controllers/sellerCategory.controller.js';

/** Seller portal API — every route runs as the signed-in seller (req.seller). */
const router = Router();

router.use(...sellerOnly);

router.get('/me', getSellerMe);
router.put('/me', optionalUploadFields([{ name: 'logo', maxCount: 1 }, { name: 'banner', maxCount: 1 }]), updateSellerProfile);
router.put('/me/bank', sellerOwnerOnly, updateSellerBank);
router.post('/me/documents', uploadSingle('file'), uploadSellerDocument);
router.delete('/me/documents/:docId', deleteSellerDocument);
router.post('/me/resubmit', sellerOwnerOnly, resubmitApplication);

router.get('/dashboard', getSellerDashboard);

router.get('/finance', getMyFinance);
router.get('/finance/ledger', getMyLedger);
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

router.get('/products', listSellerProducts);
router.post('/products/media', sellerCanEditCatalog, uploadProductMediaMultiple('images', 10), uploadSellerProductMedia);
router.post('/products', sellerCanEditCatalog, createSellerProduct);
router.post('/products/import', sellerCanEditCatalog, importSellerProducts);
router.post('/products/bulk-categories', sellerCanEditCatalog, bulkSellerProductCategories);
router.get('/products/:id', getSellerProduct);
router.put('/products/:id', sellerCanEditCatalog, updateSellerProduct);
router.put('/products/:id/stock', sellerCanEditCatalog, updateSellerProductStock);
router.post('/products/:id/submit', sellerCanEditCatalog, submitSellerProduct);
router.post('/products/:id/duplicate', sellerCanEditCatalog, duplicateSellerProduct);
router.post('/products/:id/pause', pauseSellerProduct);
router.post('/products/:id/unpause', sellerCanEditCatalog, unpauseSellerProduct);
router.post('/products/:id/discard-changes', discardSellerProductChanges);
router.delete('/products/:id', deleteSellerProduct);

router.get('/shipments', listSellerShipments);
router.get('/shipments/:id', getSellerShipment);
// Suspended sellers still finish shipments already sold — the customer has paid.
router.post('/shipments/:id/status', updateSellerShipmentStatus);

export default router;
