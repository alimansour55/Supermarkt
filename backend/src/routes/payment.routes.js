import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import {
  createCheckoutSession,
  createPaymentIntent,
  confirmPayment,
  verifyCheckoutSession,
} from '../controllers/payment.controller.js';

const router = Router();

router.post('/create-checkout-session', protect, createCheckoutSession);
router.get('/verify-session', protect, verifyCheckoutSession);
router.post('/verify-session', protect, verifyCheckoutSession);
router.post('/create-intent', protect, createPaymentIntent);
router.post('/confirm', protect, confirmPayment);

export default router;
