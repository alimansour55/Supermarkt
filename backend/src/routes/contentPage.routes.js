import { Router } from 'express';
import { requirePermission } from '../middleware/auth.js';
import {
  getPublicContentPages,
  getPublicContentPage,
  getAdminContentPages,
  getAdminContentPage,
  updateAdminContentPage,
} from '../controllers/contentPage.controller.js';

const router = Router();

router.get('/admin', ...requirePermission('content:write'), getAdminContentPages);
router.get('/admin/:slug', ...requirePermission('content:write'), getAdminContentPage);
router.put('/admin/:slug', ...requirePermission('content:write'), updateAdminContentPage);

router.get('/', getPublicContentPages);
router.get('/:slug', getPublicContentPage);

export default router;
