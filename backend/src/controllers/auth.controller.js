import User from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { generateToken } from '../utils/generateToken.js';
import { normalizePhone, formatPhoneDisplay } from '../utils/phone.js';
import { sendSmsOtp } from '../utils/sms.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { isStaffRole } from '../constants/roles.js';
import { resolveUserPermissions } from '../constants/permissions.js';
import { pickGeoFields } from '../utils/addressGeo.js';
import { enrichAndValidateAddress } from '../services/addressEnrichment.service.js';
import crypto from 'crypto';

const OTP_RESEND_SECONDS = 60;
const DEMO_SHOPPER_PHONE = normalizePhone('01098765432');
const DEMO_ADMIN_OTP_PHONE = normalizePhone('01012345678');

const getConfiguredAdminPassword = () => {
  const fromEnv = process.env.ADMIN_PASSWORD?.trim();
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV !== 'production') return 'admin123';
  return null;
};

const isDevDemoPhone = (phone) => {
  if (process.env.NODE_ENV === 'production') return false;
  return phone === DEMO_SHOPPER_PHONE || phone === DEMO_ADMIN_OTP_PHONE;
};

const defaultDemoNameForPhone = (phone) => {
  if (phone === DEMO_SHOPPER_PHONE) return 'Demo Shopper';
  if (phone === DEMO_ADMIN_OTP_PHONE) return 'Demo Admin';
  return 'Demo User';
};

const safePasswordMatch = (input, expected) => {
  const inputBuf = Buffer.from(String(input));
  const expectedBuf = Buffer.from(String(expected));
  if (inputBuf.length !== expectedBuf.length) {
    crypto.timingSafeEqual(inputBuf, inputBuf);
    return false;
  }
  return crypto.timingSafeEqual(inputBuf, expectedBuf);
};

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
  username: user.username || null,
  email: user.email || null,
  phone: user.phone,
  phoneDisplay: user.phone ? formatPhoneDisplay(user.phone) : null,
  role: user.role,
  permissions: user.permissions || [],
  effectivePermissions: resolveUserPermissions(user),
  isPhoneVerified: user.isPhoneVerified,
  isVerified: user.isPhoneVerified,
  mfaEnabled: user.mfaEnabled,
  pointsBalance: user.pointsBalance || 0,
  walletBalance: user.walletBalance || 0,
  ...(user.role === 'driver' ? { driverAvailable: user.driverAvailable !== false } : {}),
});

const formatUserWithDetails = (user) => ({
  ...formatUserResponse(user),
  addresses: user.addresses || [],
  pointsHistory: user.pointsHistory || [],
});

function setDefaultAddress(user, addressId) {
  user.addresses.forEach((address) => {
    address.isDefault = String(address._id) === String(addressId);
  });
}

function applyAddressPayload(address, payload) {
  const fields = ['label', 'street', 'building', 'floor', 'city', 'governorate', 'area', 'postalCode'];
  fields.forEach((field) => {
    if (payload[field] !== undefined) {
      address[field] = String(payload[field] || '').trim();
    }
  });
  Object.assign(address, pickGeoFields(payload));
  if (payload.isDefault !== undefined) {
    address.isDefault = Boolean(payload.isDefault);
  }
}

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
    const trimmedName = name?.trim();
    const effectiveName = trimmedName || (isDevDemoPhone(phone) ? defaultDemoNameForPhone(phone) : '');
    if (!effectiveName) {
      throw new AppError('Name is required to create a new account', 400);
    }
    user = new User({
      name: effectiveName,
      phone,
      isPhoneVerified: false,
      mfaEnabled: true,
      role: 'user',
    });
    isNewUser = true;
  } else if (name?.trim() && user.name !== name.trim()) {
    user.name = name.trim();
  }

  if (!isNewUser && user.isActive === false) {
    throw new AppError('This account has been suspended. Please contact support.', 403);
  }

  if (user.lastOtpSentAt && !isDevDemoPhone(phone)) {
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
  await sendSmsOtp(phone, code, lang);

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

  if (user.isActive === false) {
    throw new AppError('This account has been suspended. Please contact support.', 403);
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

  if (user.isActive === false) {
    throw new AppError('This account has been suspended. Please contact support.', 403);
  }

  if (user.lastOtpSentAt && !isDevDemoPhone(phone)) {
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
  await sendSmsOtp(phone, code, lang);

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

/**
 * Admin panel — sign in with username + password, or legacy shared ADMIN_PASSWORD.
 */
export const adminLogin = asyncHandler(async (req, res) => {
  const { username, password } = req.body;
  if (!password || typeof password !== 'string') {
    throw new AppError('Password is required', 400);
  }

  const trimmedPassword = password.trim();
  const normalizedUsername = username ? String(username).trim().toLowerCase() : '';

  if (normalizedUsername) {
    const staffUser = await User.findOne({
      username: normalizedUsername,
      role: { $in: ['manager', 'admin', 'super_admin'] },
    }).select('+password');

    if (!staffUser || staffUser.isActive === false) {
      throw new AppError('Invalid username or password', 401);
    }
    if (!staffUser.password) {
      throw new AppError('This account does not have a password set', 401);
    }
    const match = await staffUser.comparePassword(trimmedPassword);
    if (!match) {
      throw new AppError('Invalid username or password', 401);
    }

    staffUser.lastLoginAt = new Date();
    await staffUser.save({ validateBeforeSave: false });
    return sendAuthResponse(staffUser, res);
  }

  const configuredPassword = getConfiguredAdminPassword();
  if (!configuredPassword) {
    throw new AppError('Admin password login is not configured on the server', 503);
  }

  if (!safePasswordMatch(trimmedPassword, configuredPassword)) {
    throw new AppError('Invalid admin password', 401);
  }

  const adminUser = await User.findOne({ role: 'super_admin' })
    || await User.findOne({ role: 'admin' })
    || await User.findOne({ role: 'manager' });

  if (!adminUser || !isStaffRole(adminUser.role)) {
    throw new AppError('No admin account found. Run npm run seed from the project root.', 503);
  }

  adminUser.lastLoginAt = new Date();
  await adminUser.save({ validateBeforeSave: false });
  sendAuthResponse(adminUser, res);
});

/**
 * Delivery driver portal — sign in with username + password.
 */
export const driverLogin = asyncHandler(async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    throw new AppError('Username and password are required', 400);
  }

  const normalizedUsername = String(username).trim().toLowerCase();
  const driverUser = await User.findOne({
    username: normalizedUsername,
    role: 'driver',
  }).select('+password');

  if (!driverUser || driverUser.isActive === false) {
    throw new AppError('Invalid username or password', 401);
  }
  if (!driverUser.password) {
    throw new AppError('This account does not have a password set', 401);
  }

  const match = await driverUser.comparePassword(String(password).trim());
  if (!match) {
    throw new AppError('Invalid username or password', 401);
  }

  driverUser.lastLoginAt = new Date();
  await driverUser.save({ validateBeforeSave: false });
  sendAuthResponse(driverUser, res);
});

export const logout = asyncHandler(async (_req, res) => {
  res.status(200).json({ success: true, message: 'Logged out successfully' });
});

export const getMe = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    user: formatUserWithDetails(req.user),
  });
});

export const updateMe = asyncHandler(async (req, res) => {
  const { name, email } = req.body;

  if (name !== undefined) {
    const trimmed = String(name).trim();
    if (trimmed.length < 2 || trimmed.length > 100) {
      throw new AppError('Name must be 2–100 characters', 400);
    }
    req.user.name = trimmed;
  }

  if (email !== undefined) {
    const trimmed = String(email).trim().toLowerCase();
    if (trimmed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      throw new AppError('Invalid email address', 400);
    }
    req.user.email = trimmed;
  }

  await req.user.save();

  res.status(200).json({
    success: true,
    user: formatUserWithDetails(req.user),
  });
});

export const addMyAddress = asyncHandler(async (req, res) => {
  const lang = req.body.lang === 'ar' ? 'ar' : 'en';
  const enriched = await enrichAndValidateAddress(req.body, {
    deliveryZoneId: req.body.deliveryZoneId,
    lang,
  });

  const makeDefault = Boolean(enriched.isDefault) || req.user.addresses.length === 0;
  if (makeDefault) {
    req.user.addresses.forEach((address) => {
      address.isDefault = false;
    });
  }

  req.user.addresses.push({
    label: String(enriched.label || 'Home').trim() || 'Home',
    street: enriched.street,
    building: enriched.building,
    floor: enriched.floor,
    city: enriched.city,
    governorate: enriched.governorate,
    area: enriched.area,
    postalCode: enriched.postalCode,
    isDefault: makeDefault,
    lat: enriched.lat,
    lng: enriched.lng,
    formattedAddress: enriched.formattedAddress,
    placeId: enriched.placeId,
  });

  await req.user.save();

  res.status(201).json({
    success: true,
    user: formatUserWithDetails(req.user),
  });
});

export const updateMyAddress = asyncHandler(async (req, res) => {
  const address = req.user.addresses.id(req.params.id);
  if (!address) throw new AppError('Address not found', 404);

  const onlyDefaultToggle = Object.keys(req.body).every((key) => ['isDefault', 'lang'].includes(key));

  if (!onlyDefaultToggle) {
    const lang = req.body.lang === 'ar' ? 'ar' : 'en';
    const merged = {
      label: req.body.label ?? address.label,
      street: req.body.street ?? address.street,
      building: req.body.building ?? address.building,
      floor: req.body.floor ?? address.floor,
      city: req.body.city ?? address.city,
      governorate: req.body.governorate ?? address.governorate,
      area: req.body.area ?? address.area,
      postalCode: req.body.postalCode ?? address.postalCode,
      isDefault: req.body.isDefault,
      ...pickGeoFields({
        lat: req.body.lat ?? address.lat,
        lng: req.body.lng ?? address.lng,
        formattedAddress: req.body.formattedAddress ?? address.formattedAddress,
        placeId: req.body.placeId ?? address.placeId,
      }),
    };

    const enriched = await enrichAndValidateAddress(merged, {
      deliveryZoneId: req.body.deliveryZoneId,
      lang,
    });

    applyAddressPayload(address, enriched);
    Object.assign(address, pickGeoFields(enriched));
  } else if (req.body.isDefault !== undefined) {
    address.isDefault = Boolean(req.body.isDefault);
  }

  if (req.body.isDefault === true) {
    setDefaultAddress(req.user, address._id);
  } else if (req.body.isDefault === false && address.isDefault) {
    address.isDefault = false;
    if (!req.user.addresses.some((item) => item.isDefault) && req.user.addresses.length > 0) {
      req.user.addresses[0].isDefault = true;
    }
  }

  await req.user.save();

  res.status(200).json({
    success: true,
    user: formatUserWithDetails(req.user),
  });
});

export const deleteMyAddress = asyncHandler(async (req, res) => {
  const address = req.user.addresses.id(req.params.id);
  if (!address) throw new AppError('Address not found', 404);

  const wasDefault = address.isDefault;
  req.user.addresses.pull(req.params.id);

  if (wasDefault && req.user.addresses.length > 0) {
    req.user.addresses[0].isDefault = true;
  }

  await req.user.save();

  res.status(200).json({
    success: true,
    user: formatUserWithDetails(req.user),
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
