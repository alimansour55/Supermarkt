import { Router } from 'express';
import {
  sendOtp,
  verifyOtp,
  resendOtp,
  adminLogin,
  driverLogin,
  logout,
  getMe,
  updateMe,
  addMyAddress,
  updateMyAddress,
  deleteMyAddress,
} from '../controllers/auth.controller.js';
import { protect } from '../middleware/auth.js';
import { sendOtpValidation, verifyOtpValidation, adminLoginValidation, driverLoginValidation, sellerLoginValidation, updateProfileValidation, addAddressValidation, updateAddressValidation, validate } from '../middleware/validate.js';
import { loginLimiter, otpSendLimiter, otpVerifyLimiter, sellerRecoveryLimiter } from '../middleware/rateLimiter.js';
import {
  sellerSignIn,
  verifySellerSignInCode,
  resendSellerSignInCode,
  forgotSellerPassword,
  resetSellerPassword,
} from '../controllers/sellerAuth.controller.js';

const router = Router();

/** Phone + SMS MFA authentication */
router.post('/send-otp', otpSendLimiter, validate(sendOtpValidation), sendOtp);
router.post('/verify-otp', otpVerifyLimiter, validate(verifyOtpValidation), verifyOtp);
router.post('/resend-otp', otpSendLimiter, validate(sendOtpValidation), resendOtp);
router.post('/admin-login', loginLimiter, validate(adminLoginValidation), adminLogin);
router.post('/driver-login', loginLimiter, validate(driverLoginValidation), driverLogin);
router.post('/seller-login', loginLimiter, validate(sellerLoginValidation), sellerSignIn);
router.post('/seller-login/verify', sellerRecoveryLimiter, verifySellerSignInCode);
router.post('/seller-login/resend', sellerRecoveryLimiter, resendSellerSignInCode);
router.post('/seller/forgot-password', sellerRecoveryLimiter, forgotSellerPassword);
router.post('/seller/reset-password', sellerRecoveryLimiter, resetSellerPassword);

router.post('/logout', protect, logout);
router.get('/me', protect, getMe);
router.patch('/me', protect, validate(updateProfileValidation), updateMe);
router.post('/me/addresses', protect, validate(addAddressValidation), addMyAddress);
router.patch('/me/addresses/:id', protect, validate(updateAddressValidation), updateMyAddress);
router.delete('/me/addresses/:id', protect, deleteMyAddress);

export default router;
