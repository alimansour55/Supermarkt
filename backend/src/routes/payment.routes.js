import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import {
  createCheckoutSession,
  createPaymentIntent,
  confirmPayment,
  verifyCheckoutSession,
  startPayment,
  getPaymentStatus,
  paymobWebhook,
  paymobReturn,
  fawryWebhook,
} from '../controllers/payment.controller.js';

const router = Router();

// Paymob + Fawry (Egypt)
router.post('/start', protect, startPayment);
router.get('/status/:orderId', protect, getPaymentStatus);
router.post('/paymob/webhook', paymobWebhook);
router.get('/paymob/return/:channel/:lang', paymobReturn);
router.get('/paymob/return/:channel', paymobReturn);
router.post('/fawry/webhook', fawryWebhook);

// Legacy Stripe

router.post('/create-checkout-session', protect, createCheckoutSession);
router.get('/verify-session', protect, verifyCheckoutSession);
router.post('/verify-session', protect, verifyCheckoutSession);
router.post('/create-intent', protect, createPaymentIntent);
router.post('/confirm', protect, confirmPayment);

export default router;
