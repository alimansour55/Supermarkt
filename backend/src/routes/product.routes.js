import { Router } from 'express';
import { adminOnly, requirePermission } from '../middleware/auth.js';
import { uploadMultiple } from '../middleware/upload.js';
import {
  getProducts,
  getProductById,
  getProductsByCategory,
  getOffers,
  getProductFilters,
  getAdminProducts,
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
} from '../controllers/product.controller.js';

const router = Router();

router.get('/filters/meta', getProductFilters);
router.get('/offers', getOffers);
router.get('/category/:slug', getProductsByCategory);

router.post('/admin/upload-images', ...adminOnly, uploadMultiple('images', 10), uploadProductImages);
router.put('/admin/:id/images/reorder', ...adminOnly, reorderProductImages);
router.delete('/admin/:id/images', ...adminOnly, removeProductImage);
router.get('/admin/export', ...adminOnly, exportAdminProducts);
router.post('/admin/bulk', ...adminOnly, bulkAdminProducts);
router.get('/admin', ...adminOnly, getAdminProducts);
router.get('/admin/:id', ...adminOnly, getAdminProductById);
router.post('/admin/:id/duplicate', ...adminOnly, duplicateAdminProduct);
router.post('/admin', ...adminOnly, createProduct);
router.put('/admin/:id', ...adminOnly, updateProduct);
router.delete('/admin/:id', ...requirePermission('products:delete'), deleteProduct);

router.get('/:id', getProductById);
router.get('/', getProducts);

export default router;
