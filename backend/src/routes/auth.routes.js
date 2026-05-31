import { Router } from 'express';
import {
  sendOtp,
  verifyOtp,
  resendOtp,
  logout,
  getMe,
  updateMe,
} from '../controllers/auth.controller.js';
import { protect } from '../middleware/auth.js';
import { sendOtpValidation, verifyOtpValidation, updateProfileValidation, validate } from '../middleware/validate.js';
import { otpSendLimiter, otpVerifyLimiter } from '../middleware/rateLimiter.js';

const router = Router();

/** Phone + SMS MFA authentication */
router.post('/send-otp', otpSendLimiter, validate(sendOtpValidation), sendOtp);
router.post('/verify-otp', otpVerifyLimiter, validate(verifyOtpValidation), verifyOtp);
router.post('/resend-otp', otpSendLimiter, validate(sendOtpValidation), resendOtp);

router.post('/logout', protect, logout);
router.get('/me', protect, getMe);
router.patch('/me', protect, validate(updateProfileValidation), updateMe);

export default router;
