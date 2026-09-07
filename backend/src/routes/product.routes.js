import { Router } from 'express';
import { adminOnly, requirePermission } from '../middleware/auth.js';
import { uploadProductMediaMultiple } from '../middleware/upload.js';
import {
  getProducts,
  getProductsByIds,
  getProductById,
  getProductsByCategory,
  getProductsByMainSub,
  getProductsByCategoryPath,
  getOffers,
  getProductFilters,
  getAdminProducts,
  getAdminStockSummary,
  bulkAdminProducts,
  exportAdminProducts,
  duplicateAdminProduct,
  getAdminProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  uploadProductImages,
  removeProductImage,
  reorderProductImages,
  importAdminProducts,
  getProductCategoryIntegrity,
  repairProductCategoryIntegrity,
  suggestProductSku,
  checkProductSku,
} from '../controllers/product.controller.js';

const router = Router();

router.get('/filters/meta', getProductFilters);
router.get('/offers', getOffers);
router.post('/by-ids', getProductsByIds);
router.get('/category-path/{*slugPath}', getProductsByCategoryPath);
router.get('/category/:mainSlug/:subSlug', getProductsByMainSub);
router.get('/category/:slug', getProductsByCategory);

router.post('/admin/upload-images', ...adminOnly, uploadProductMediaMultiple('images', 10), uploadProductImages);
router.post('/admin/sku/suggest', ...adminOnly, suggestProductSku);
router.get('/admin/sku/check', ...adminOnly, checkProductSku);
router.put('/admin/:id/images/reorder', ...adminOnly, reorderProductImages);
router.delete('/admin/:id/images', ...adminOnly, removeProductImage);
router.get('/admin/export', ...adminOnly, exportAdminProducts);
router.post('/admin/import', ...adminOnly, importAdminProducts);
router.get('/admin/category-integrity', ...adminOnly, getProductCategoryIntegrity);
router.post('/admin/category-integrity/repair', ...adminOnly, repairProductCategoryIntegrity);
router.post('/admin/bulk', ...adminOnly, bulkAdminProducts);
router.get('/admin/stock-summary', ...adminOnly, getAdminStockSummary);
router.get('/admin', ...adminOnly, getAdminProducts);
router.get('/admin/:id', ...adminOnly, getAdminProductById);
router.post('/admin/:id/duplicate', ...adminOnly, duplicateAdminProduct);
router.post('/admin', ...adminOnly, createProduct);
router.put('/admin/:id', ...adminOnly, updateProduct);
router.delete('/admin/:id', ...requirePermission('products:delete'), deleteProduct);

router.get('/:id', getProductById);
router.get('/', getProducts);

export default router;
