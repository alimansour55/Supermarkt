import { Router } from 'express';
import { requirePermission } from '../middleware/auth.js';
import { uploadFields } from '../middleware/upload.js';
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
router.post('/admin', ...requirePermission('banners:write'), uploadFields([
  { name: 'image', maxCount: 1 },
  { name: 'desktopImage', maxCount: 1 },
  { name: 'mobileImage', maxCount: 1 },
]), createBanner);
router.put('/admin/:id', ...requirePermission('banners:write'), uploadFields([
  { name: 'image', maxCount: 1 },
  { name: 'desktopImage', maxCount: 1 },
  { name: 'mobileImage', maxCount: 1 },
]), updateBanner);
router.delete('/admin/:id', ...requirePermission('banners:write'), deleteBanner);

export default router;
