import { Router } from 'express';
import { requirePermission } from '../middleware/auth.js';
import { uploadSingle } from '../middleware/upload.js';
import {
  getCategories,
  getCategoryBySlug,
  getAdminCategories,
  bulkAdminCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../controllers/category.controller.js';

const router = Router();

router.get('/', getCategories);
router.get('/admin', ...requirePermission('categories:write'), getAdminCategories);
router.post('/admin/bulk', ...requirePermission('categories:write'), bulkAdminCategories);
router.post('/admin', ...requirePermission('categories:write'), uploadSingle('image'), createCategory);
router.put('/admin/:id', ...requirePermission('categories:write'), uploadSingle('image'), updateCategory);
router.delete('/admin/:id', ...requirePermission('categories:write'), deleteCategory);
router.get('/:slug', getCategoryBySlug);

export default router;
