import { Router } from 'express';
import { requirePermission } from '../middleware/auth.js';
import { uploadSingle } from '../middleware/upload.js';
import {
  getCategories,
  getMainCategories,
  getCategoryTree,
  getCategoryBrowse,
  getCategorySlugPath,
  getSubcategoriesBySlug,
  getCategoryBySlug,
  getAdminCategories,
  bulkAdminCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  reassignCategoryProducts,
  reorderAdminCategories,
} from '../controllers/category.controller.js';

const router = Router();

router.get('/browse/{*slugPath}', getCategoryBrowse);
router.get('/path/:slug', getCategorySlugPath);
router.get('/main', getMainCategories);
router.get('/tree', getCategoryTree);
router.get('/', getCategories);
router.get('/admin', ...requirePermission('categories:write'), getAdminCategories);
router.post('/admin/bulk', ...requirePermission('categories:write'), bulkAdminCategories);
router.put('/admin/reorder', ...requirePermission('categories:write'), reorderAdminCategories);
router.post('/admin', ...requirePermission('categories:write'), uploadSingle('image'), createCategory);
router.put('/admin/:id', ...requirePermission('categories:write'), uploadSingle('image'), updateCategory);
router.post('/admin/:id/reassign-products', ...requirePermission('categories:write'), reassignCategoryProducts);
router.delete('/admin/:id', ...requirePermission('categories:write'), deleteCategory);
router.get('/:slug/subcategories', getSubcategoriesBySlug);
router.get('/:slug', getCategoryBySlug);

export default router;
