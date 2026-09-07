import { Router } from 'express';
import { requirePermission } from '../middleware/auth.js';
import {
  createHomepageSection,
  deleteHomepageSection,
  getAdminHomepageSections,
  getHomepageCampaignCandidates,
  getPublicHomepageSections,
  updateHomepageSection,
  reorderHomepageSections,
  uploadHeroSlideImage,
} from '../controllers/homepageSection.controller.js';
import { uploadSingle } from '../middleware/upload.js';

const router = Router();

router.get('/', getPublicHomepageSections);
router.get('/admin/campaign-candidates', ...requirePermission('homepage:write'), getHomepageCampaignCandidates);
router.get('/admin', ...requirePermission('homepage:write'), getAdminHomepageSections);
router.post('/admin', ...requirePermission('homepage:write'), createHomepageSection);
router.post('/admin/upload-hero-image', ...requirePermission('homepage:write'), uploadSingle('image'), uploadHeroSlideImage);
router.put('/admin/reorder', ...requirePermission('homepage:write'), reorderHomepageSections);
router.put('/admin/:id', ...requirePermission('homepage:write'), updateHomepageSection);
router.delete('/admin/:id', ...requirePermission('homepage:write'), deleteHomepageSection);

export default router;
