import { Router } from 'express';
import multer from 'multer';
import { requirePermission } from '../middleware/auth.js';
import {
  getOverview,
  createConnection,
  getConnection,
  updateConnection,
  deleteConnection,
  rotateApiKey,
  rotateWebhookSecret,
  testConnection,
  runConnection,
  previewUpload,
  importUpload,
  getLogs,
  getDeliveries,
  postRetryDelivery,
  deleteUnmatched,
  updateSettings,
  rebuildStock,
  getProductStockBreakdown,
  downloadAgentFile,
} from '../controllers/integrationAdmin.controller.js';

const router = Router();
const can = requirePermission('integrations:write');
const fileUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } }).single('file');

router.get('/', ...can, getOverview);
router.put('/settings', ...can, updateSettings);
router.post('/rebuild-stock', ...can, rebuildStock);
router.get('/agent/:file', ...can, downloadAgentFile);
router.get('/products/:productId/stock', ...requirePermission('products:read'), getProductStockBreakdown);

router.post('/connections', ...can, createConnection);
router.get('/connections/:id', ...can, getConnection);
router.patch('/connections/:id', ...can, updateConnection);
router.delete('/connections/:id', ...can, deleteConnection);
router.post('/connections/:id/api-key', ...can, rotateApiKey);
router.post('/connections/:id/webhook-secret', ...can, rotateWebhookSecret);
router.post('/connections/:id/test', ...can, testConnection);
router.post('/connections/:id/run', ...can, runConnection);
router.post('/connections/:id/file/preview', ...can, fileUpload, previewUpload);
router.post('/connections/:id/file/import', ...can, fileUpload, importUpload);
router.get('/connections/:id/logs', ...can, getLogs);
router.get('/connections/:id/deliveries', ...can, getDeliveries);
router.post('/deliveries/:deliveryId/retry', ...can, postRetryDelivery);
router.delete('/connections/:id/unmatched', ...can, deleteUnmatched);

export default router;
