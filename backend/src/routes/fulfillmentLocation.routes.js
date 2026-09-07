import { Router } from 'express';
import { requirePermission } from '../middleware/auth.js';
import {
  createAdminFulfillmentLocation,
  deleteAdminFulfillmentLocation,
  geocodeAdminFulfillmentLocation,
  getAdminFulfillmentLocations,
  updateAdminFulfillmentLocation,
} from '../controllers/fulfillmentLocation.controller.js';

const router = Router();

router.get('/admin', ...requirePermission('delivery:write'), getAdminFulfillmentLocations);
router.post('/admin/geocode', ...requirePermission('delivery:write'), geocodeAdminFulfillmentLocation);
router.post('/admin', ...requirePermission('delivery:write'), createAdminFulfillmentLocation);
router.put('/admin/:id', ...requirePermission('delivery:write'), updateAdminFulfillmentLocation);
router.delete('/admin/:id', ...requirePermission('delivery:write'), deleteAdminFulfillmentLocation);

export default router;
