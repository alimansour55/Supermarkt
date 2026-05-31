import { Router } from 'express';
import { requirePermission } from '../middleware/auth.js';
import { uploadSingle } from '../middleware/upload.js';
import {
  getPublicBanners,
  getAdminBanners,
  createBanner,
  updateBanner,
  deleteBanner,
} from '../controllers/banner.controller.js';

const router = Router();

router.get('/', getPublicBanners);
router.get('/admin', ...requirePermission('banners:write'), getAdminBanners);
router.post('/admin', ...requirePermission('banners:write'), uploadSingle('image'), createBanner);
router.put('/admin/:id', ...requirePermission('banners:write'), uploadSingle('image'), updateBanner);
router.delete('/admin/:id', ...requirePermission('banners:write'), deleteBanner);

export default router;
