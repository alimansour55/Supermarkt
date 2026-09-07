import { Router } from 'express';
import { requirePermission } from '../middleware/auth.js';
import { optionalUploadFields } from '../middleware/upload.js';
import {
  getAdminStoreSettings,
  getPublicStoreSettings,
  updateAdminStoreSettings,
  previewInvoicePdf,
} from '../controllers/storeSettings.controller.js';

const router = Router();

router.get('/', getPublicStoreSettings);
router.get('/admin', ...requirePermission('settings:write'), getAdminStoreSettings);
router.get('/admin/invoice-preview', ...requirePermission('settings:write'), previewInvoicePdf);
router.put(
  '/admin',
  ...requirePermission('settings:write'),
  optionalUploadFields([
    { name: 'logo', maxCount: 1 },
    { name: 'favicon', maxCount: 1 },
  ]),
  updateAdminStoreSettings,
);

export default router;
