import User from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { generateToken } from '../utils/generateToken.js';
import { normalizePhone, formatPhoneDisplay } from '../utils/phone.js';
import { sendSmsOtp } from '../utils/sms.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const OTP_RESEND_SECONDS = 60;

const devOtpFields = (code) => {
  const isDev = process.env.NODE_ENV !== 'production';
  if (!isDev && process.env.SMS_DEV_EXPOSE_OTP !== 'true') return {};
  return {
    devHint: 'Development mode — your verification code is below',
    devOtp: code,
  };
};

const formatUserResponse = (user) => ({
  id: user._id,
  name: user.name,
  phone: user.phone,
  phoneDisplay: formatPhoneDisplay(user.phone),
  role: user.role,
  isPhoneVerified: user.isPhoneVerified,
  isVerified: user.isPhoneVerified,
  mfaEnabled: user.mfaEnabled,
});

const sendAuthResponse = (user, res, statusCode = 200) => {
  const token = generateToken(user._id);

  res.status(statusCode).json({
    success: true,
    token,
    user: formatUserResponse(user),
  });
};

const findUserWithOtp = async (phone) =>
  User.findOne({ phone }).select('+phoneOtpHash +phoneOtpExpires +phoneOtpAttempts +lastOtpSentAt');

/**
 * Step 1 — Request SMS OTP (register with name, or login with phone only).
 * MFA: every sign-in requires a fresh SMS code.
 */
export const sendOtp = asyncHandler(async (req, res) => {
  const { phone: rawPhone, name } = req.body;
  const phone = normalizePhone(rawPhone);

  if (!phone) {
    throw new AppError('Invalid Egyptian mobile number (e.g. 01xxxxxxxxx)', 400);
  }

  let user = await findUserWithOtp(phone);
  let isNewUser = false;

  if (!user) {
    if (!name?.trim()) {
      throw new AppError('Name is required to create a new account', 400);
    }
    user = new User({
      name: name.trim(),
      phone,
      isPhoneVerified: false,
      mfaEnabled: true,
      role: 'user',
    });
    isNewUser = true;
  } else if (name?.trim() && user.name !== name.trim()) {
    user.name = name.trim();
  }

  if (user.lastOtpSentAt) {
    const elapsed = (Date.now() - user.lastOtpSentAt.getTime()) / 1000;
    if (elapsed < OTP_RESEND_SECONDS) {
      throw new AppError(
        `Please wait ${Math.ceil(OTP_RESEND_SECONDS - elapsed)} seconds before requesting a new code`,
        429,
      );
    }
  }

  const code = user.createPhoneOtp();
  await user.save({ validateBeforeSave: false });

  const lang = req.body.lang === 'en' ? 'en' : 'ar';
  const smsResult = await sendSmsOtp(phone, code, lang);

  res.json({
    success: true,
    message: isNewUser
      ? 'Verification code sent. Enter it to complete registration.'
      : 'Verification code sent to your phone.',
    phone,
    phoneDisplay: formatPhoneDisplay(phone),
    isNewUser,
    mfaRequired: true,
    expiresInMinutes: 10,
    ...devOtpFields(code),
  });
});

/**
 * Step 2 — Verify SMS OTP and issue JWT (completes login/register + MFA).
 */
export const verifyOtp = asyncHandler(async (req, res) => {
  const { phone: rawPhone, code } = req.body;
  const phone = normalizePhone(rawPhone);

  if (!phone) {
    throw new AppError('Invalid phone number', 400);
  }

  if (!code || !/^\d{6}$/.test(String(code).trim())) {
    throw new AppError('A valid 6-digit verification code is required', 400);
  }

  const user = await findUserWithOtp(phone);
  if (!user) {
    throw new AppError('No account found for this phone number', 404);
  }

  const result = user.verifyPhoneOtp(code);

  if (!result.ok) {
    await user.save({ validateBeforeSave: false });

    if (result.reason === 'expired') {
      throw new AppError('Verification code expired. Request a new one.', 400);
    }
    if (result.reason === 'locked') {
      throw new AppError('Too many failed attempts. Request a new code.', 429);
    }
    throw new AppError('Invalid verification code', 401);
  }

  await user.save();
  sendAuthResponse(user, res);
});

export const resendOtp = asyncHandler(async (req, res) => {
  const { phone: rawPhone } = req.body;
  const phone = normalizePhone(rawPhone);

  if (!phone) {
    throw new AppError('Invalid Egyptian mobile number', 400);
  }

  const user = await findUserWithOtp(phone);
  if (!user) {
    throw new AppError('No account found. Enter your name to create an account.', 404);
  }

  if (user.lastOtpSentAt) {
    const elapsed = (Date.now() - user.lastOtpSentAt.getTime()) / 1000;
    if (elapsed < OTP_RESEND_SECONDS) {
      throw new AppError(
        `Please wait ${Math.ceil(OTP_RESEND_SECONDS - elapsed)} seconds before requesting a new code`,
        429,
      );
    }
  }

  const code = user.createPhoneOtp();
  await user.save({ validateBeforeSave: false });

  const lang = req.body.lang === 'en' ? 'en' : 'ar';
  const smsResult = await sendSmsOtp(phone, code, lang);

  res.json({
    success: true,
    message: 'New verification code sent.',
    phone,
    phoneDisplay: formatPhoneDisplay(phone),
    mfaRequired: true,
    expiresInMinutes: 10,
    ...devOtpFields(code),
  });
});

export const logout = asyncHandler(async (_req, res) => {
  res.status(200).json({ success: true, message: 'Logged out successfully' });
});

export const getMe = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    user: {
      ...formatUserResponse(req.user),
      addresses: req.user.addresses,
    },
  });
});

export const updateMe = asyncHandler(async (req, res) => {
  const { name } = req.body;

  if (name !== undefined) {
    const trimmed = String(name).trim();
    if (trimmed.length < 2 || trimmed.length > 100) {
      throw new AppError('Name must be 2–100 characters', 400);
    }
    req.user.name = trimmed;
  }

  await req.user.save();

  res.status(200).json({
    success: true,
    user: {
      ...formatUserResponse(req.user),
      addresses: req.user.addresses,
    },
  });
});

// Legacy stubs — redirect clients to phone OTP flow
export const register = asyncHandler(async (_req, res) => {
  res.status(410).json({
    success: false,
    message: 'Email registration is disabled. Use phone number + SMS verification.',
  });
});

export const login = asyncHandler(async (_req, res) => {
  res.status(410).json({
    success: false,
    message: 'Password login is disabled. Use phone number + SMS verification.',
  });
});

export const verifyEmail = asyncHandler(async (_req, res) => {
  res.status(410).json({ success: false, message: 'Email verification is no longer used.' });
});

export const resendVerification = verifyEmail;
export const forgotPassword = verifyEmail;
export const resetPassword = verifyEmail;
