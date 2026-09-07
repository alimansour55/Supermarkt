import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { Router } from 'express';
import { protect, requirePermission } from '../middleware/auth.js';
import {
  createAdminDeliveryZone,
  deleteAdminDeliveryZone,
  geocodeDeliveryAddress,
  getAdminDeliveryZones,
  getPublicDeliveryZones,
  suggestDeliveryPlaces,
  resolveDeliveryPlace,
  updateAdminDeliveryZone,
  validateDeliveryAddress,
  validateDeliveryZone,
} from '../controllers/deliveryZone.controller.js';

const router = Router();

const placesSuggestLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?._id?.toString() || ipKeyGenerator(req.ip),
  message: { success: false, message: 'Too many address searches. Please wait a moment.' },
});

router.get('/', getPublicDeliveryZones);
router.get('/validate', validateDeliveryZone);
router.post('/geocode', geocodeDeliveryAddress);
router.post('/places-suggest', placesSuggestLimiter, suggestDeliveryPlaces);
router.post('/resolve-place', placesSuggestLimiter, resolveDeliveryPlace);
router.post('/validate-address', protect, validateDeliveryAddress);
router.get('/admin', ...requirePermission('delivery:write'), getAdminDeliveryZones);
router.post('/admin', ...requirePermission('delivery:write'), createAdminDeliveryZone);
router.put('/admin/:id', ...requirePermission('delivery:write'), updateAdminDeliveryZone);
router.delete('/admin/:id', ...requirePermission('delivery:write'), deleteAdminDeliveryZone);

export default router;
