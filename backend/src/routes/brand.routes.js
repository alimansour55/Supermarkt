import { Router } from 'express';
import { requirePermission } from '../middleware/auth.js';
import { uploadSingle } from '../middleware/upload.js';
import {
  getPublicBrands,
  getAdminBrands,
  getAdminBrandStats,
  createBrand,
  updateBrand,
  deleteBrand,
  bulkAdminBrands,
  syncBrandsFromProducts,
  repairProductBrandLinks,
} from '../controllers/brand.controller.js';

const router = Router();

router.get('/', getPublicBrands);
router.get('/admin/stats', ...requirePermission('brands:write'), getAdminBrandStats);
router.get('/admin', ...requirePermission('brands:write'), getAdminBrands);
router.post('/admin/sync-from-products', ...requirePermission('brands:write'), syncBrandsFromProducts);
router.post('/admin/repair-product-links', ...requirePermission('brands:write'), repairProductBrandLinks);
router.post('/admin/bulk', ...requirePermission('brands:write'), bulkAdminBrands);
router.post('/admin', ...requirePermission('brands:write'), uploadSingle('logo'), createBrand);
router.put('/admin/:id', ...requirePermission('brands:write'), uploadSingle('logo'), updateBrand);
router.delete('/admin/:id', ...requirePermission('brands:write'), deleteBrand);

export default router;
