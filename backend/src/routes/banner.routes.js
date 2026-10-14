import { Router } from 'express';
import { optionalProtect, requirePermission } from '../middleware/auth.js';
import { uploadFields } from '../middleware/upload.js';
import {
  getPublicBanners,
  getAdminBanners,
  createBanner,
  updateBanner,
  setBannerStatus,
  reorderBanners,
  duplicateBanner,
  deleteBanner,
} from '../controllers/banner.controller.js';

const router = Router();

const bannerImages = uploadFields([
  { name: 'image', maxCount: 1 },
  { name: 'desktopImage', maxCount: 1 },
  { name: 'mobileImage', maxCount: 1 },
]);

router.get('/', optionalProtect, getPublicBanners);
router.get('/admin', ...requirePermission('banners:write'), getAdminBanners);
router.post('/admin', ...requirePermission('banners:write'), bannerImages, createBanner);
router.put('/admin/reorder', ...requirePermission('banners:write'), reorderBanners);
router.put('/admin/:id', ...requirePermission('banners:write'), bannerImages, updateBanner);
router.patch('/admin/:id/status', ...requirePermission('banners:write'), setBannerStatus);
router.post('/admin/:id/duplicate', ...requirePermission('banners:write'), duplicateBanner);
router.delete('/admin/:id', ...requirePermission('banners:write'), deleteBanner);

export default router;
