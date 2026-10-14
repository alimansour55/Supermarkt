import { Router } from 'express';
import { requirePermission } from '../middleware/auth.js';
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
  getAdminProductsStats,
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

router.post('/admin/upload-images', ...requirePermission('products:write'), uploadProductMediaMultiple('images', 10), uploadProductImages);
router.post('/admin/sku/suggest', ...requirePermission('products:write'), suggestProductSku);
router.get('/admin/sku/check', ...requirePermission('products:read'), checkProductSku);
router.put('/admin/:id/images/reorder', ...requirePermission('products:write'), reorderProductImages);
router.delete('/admin/:id/images', ...requirePermission('products:write'), removeProductImage);
router.get('/admin/export', ...requirePermission('products:read'), exportAdminProducts);
router.post('/admin/import', ...requirePermission('products:write'), importAdminProducts);
router.get('/admin/category-integrity', ...requirePermission('products:read'), getProductCategoryIntegrity);
router.post('/admin/category-integrity/repair', ...requirePermission('products:write'), repairProductCategoryIntegrity);
router.post('/admin/bulk', ...requirePermission('products:write'), bulkAdminProducts);
router.get('/admin/stock-summary', ...requirePermission('products:read'), getAdminStockSummary);
router.get('/admin/stats-summary', ...requirePermission('products:read'), getAdminProductsStats);
router.get('/admin', ...requirePermission('products:read'), getAdminProducts);
router.get('/admin/:id', ...requirePermission('products:read'), getAdminProductById);
router.post('/admin/:id/duplicate', ...requirePermission('products:write'), duplicateAdminProduct);
router.post('/admin', ...requirePermission('products:write'), createProduct);
router.put('/admin/:id', ...requirePermission('products:write'), updateProduct);
router.delete('/admin/:id', ...requirePermission('products:delete'), deleteProduct);

router.get('/:id', getProductById);
router.get('/', getProducts);

export default router;
