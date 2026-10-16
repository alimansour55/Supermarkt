import { Router } from 'express';
import express from 'express';
import multer from 'multer';
import { integrationAuth, integrationLimiter, requireScope } from '../middleware/integrationAuth.js';
import {
  ping,
  getLocations,
  putStock,
  postStockAdjustments,
  putPrices,
  postFile,
  getProducts,
  getOrders,
  getOrder,
  postAcknowledge,
  postAgentHeartbeat,
  getAgentDownload,
} from '../controllers/integrationApi.controller.js';

/** Open API v1 — for outside systems, authenticated by connection API key. Docs: backend/docs/integrations-api.md */
const router = Router();

const fileUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } }).single('file');
const rawFile = express.raw({ type: ['text/csv', 'text/plain', 'application/octet-stream', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'], limit: '20mb' });

router.use(integrationLimiter, integrationAuth);

router.get('/ping', ping);
router.get('/locations', requireScope('locations:read', 'stock:write'), getLocations);

router.put('/stock', requireScope('stock:write'), putStock);
router.post('/stock/adjustments', requireScope('stock:write'), postStockAdjustments);
router.put('/prices', requireScope('prices:write'), putPrices);
router.post('/files', requireScope('stock:write', 'prices:write'), rawFile, fileUpload, postFile);

router.get('/products', requireScope('products:read'), getProducts);

router.get('/orders', requireScope('orders:read'), getOrders);
router.get('/orders/:ref', requireScope('orders:read'), getOrder);
router.post('/orders/:ref/acknowledge', requireScope('orders:write'), postAcknowledge);

router.post('/agent/heartbeat', postAgentHeartbeat);
router.get('/agent/download', getAgentDownload);

export default router;
