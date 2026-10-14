import User from '../models/User.js';
import RevokedToken from '../models/RevokedToken.js';
import { AppError } from '../utils/AppError.js';
import { generateToken, generateMfaToken, verifyMfaToken } from '../utils/generateToken.js';
import { setSessionCookie, clearSessionCookie, wantsTokenInBody } from '../utils/sessionCookie.js';
import { normalizePhone, formatPhoneDisplay } from '../utils/phone.js';
import { sendSmsOtp } from '../utils/sms.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { isStaffRole, STAFF_ROLES } from '../constants/roles.js';
import { resolveUserPermissions } from '../constants/permissions.js';
import { pickGeoFields } from '../utils/addressGeo.js';
import { enrichAndValidateAddress } from '../services/addressEnrichment.service.js';

const OTP_RESEND_SECONDS = 60;
const DEMO_SHOPPER_PHONE = normalizePhone('01098765432');
const DEMO_ADMIN_OTP_PHONE = normalizePhone('01012345678');

const isDevDemoPhone = (phone) => {
  if (process.env.NODE_ENV === 'production') return false;
  return phone === DEMO_SHOPPER_PHONE || phone === DEMO_ADMIN_OTP_PHONE;
};

const defaultDemoNameForPhone = (phone) => {
  if (phone === DEMO_SHOPPER_PHONE) return 'Demo Shopper';
  if (phone === DEMO_ADMIN_OTP_PHONE) return 'Demo Admin';
  return 'Demo User';
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

const sendAuthResponse = (user, req, res, statusCode = 200) => {
  const token = generateToken(user);
  setSessionCookie(res, token);

  res.status(statusCode).json({
    success: true,
    ...(wantsTokenInBody(req) ? { token } : {}),
    user: formatUserResponse(user),
  });
};

/** 01012345678 → 010•••••678 */
const maskPhone = (phone) => {
  const local = String(formatPhoneDisplay(phone) || phone).replace(/\s+/g, '');
  return local.length > 6 ? `${local.slice(0, 3)}${'•'.repeat(local.length - 6)}${local.slice(-3)}` : local;
};

const OTP_SELECT = '+phoneOtpHash +phoneOtpExpires +phoneOtpAttempts +lastOtpSentAt +otpSendCount +otpSendWindowStart';

const findUserWithOtp = async (phone) =>
  User.findOne({ phone }).select(OTP_SELECT);

/** Enforce resend cooldown + daily per-phone quota, then generate, store and SMS a fresh code. */
const issuePhoneOtp = async (user, phone, lang) => {
  if (!isDevDemoPhone(phone)) {
    if (user.lastOtpSentAt) {
      const elapsed = (Date.now() - user.lastOtpSentAt.getTime()) / 1000;
      if (elapsed < OTP_RESEND_SECONDS) {
        throw new AppError(
          `Please wait ${Math.ceil(OTP_RESEND_SECONDS - elapsed)} seconds before requesting a new code`,
          429,
        );
      }
    }
    if (!user.consumeOtpQuota()) {
      throw new AppError('Too many verification codes requested for this number today. Please try again tomorrow.', 429);
    }
  }

  const code = user.createPhoneOtp();
  await user.save({ validateBeforeSave: false });
  await sendSmsOtp(phone, code, lang === 'en' ? 'en' : 'ar');
  return code;
};

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
      // Abandoned sign-ups are removed automatically after a day.
      pendingSignupExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    isNewUser = true;
  } else if (!user.isPhoneVerified && name?.trim()) {
    // Only a registration that was never completed may change its name here —
    // otherwise anyone knowing a customer's phone could rename their account.
    user.name = name.trim();
  }

  if (!isNewUser && user.isActive === false) {
    throw new AppError('This account has been suspended. Please contact support.', 403);
  }

  const code = await issuePhoneOtp(user, phone, req.body.lang);

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
    // Same response as a wrong code — don't reveal which numbers are registered.
    throw new AppError('Invalid verification code', 401);
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
  sendAuthResponse(user, req, res);
});

export const resendOtp = asyncHandler(async (req, res) => {
  const { phone: rawPhone } = req.body;
  const phone = normalizePhone(rawPhone);

  if (!phone) {
    throw new AppError('Invalid Egyptian mobile number', 400);
  }

  const user = await findUserWithOtp(phone);
  if (!user) {
    throw new AppError('Please start again and request a new verification code.', 400);
  }

  if (user.isActive === false) {
    throw new AppError('This account has been suspended. Please contact support.', 403);
  }

  const code = await issuePhoneOtp(user, phone, req.body.lang);

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

const staffMfaRequired = () => process.env.ADMIN_MFA_REQUIRED === 'true';

/**
 * Admin panel — step 1: username + password.
 * Staff with a phone on file then get an SMS code (step 2, verifyAdminMfa) before a session is issued.
 */
export const adminLogin = asyncHandler(async (req, res) => {
  const { username, password } = req.body;
  if (!password || typeof password !== 'string') {
    throw new AppError('Password is required', 400);
  }

  const normalizedUsername = username ? String(username).trim().toLowerCase() : '';
  if (!normalizedUsername) {
    throw new AppError('Username is required', 400);
  }

  const staffUser = await User.findOne({
    username: normalizedUsername,
    role: { $in: STAFF_ROLES },
  }).select(`+password ${OTP_SELECT}`);

  if (!staffUser || staffUser.isActive === false) {
    throw new AppError('Invalid username or password', 401);
  }
  if (!staffUser.password) {
    throw new AppError('This account does not have a password set', 401);
  }
  const match = await staffUser.comparePassword(password.trim());
  if (!match) {
    throw new AppError('Invalid username or password', 401);
  }

  if (staffUser.phone) {
    const code = await issuePhoneOtp(staffUser, staffUser.phone, req.body.lang);
    return res.json({
      success: true,
      mfaRequired: true,
      mfaToken: generateMfaToken(staffUser),
      phoneDisplay: maskPhone(staffUser.phone),
      expiresInMinutes: 10,
      ...devOtpFields(code),
    });
  }

  if (staffMfaRequired()) {
    throw new AppError('Two-step verification is required. Ask a super admin to add a phone number to your account.', 403);
  }

  staffUser.lastLoginAt = new Date();
  await staffUser.save({ validateBeforeSave: false });
  sendAuthResponse(staffUser, req, res);
});

const loadMfaStaffUser = async (mfaToken) => {
  let decoded;
  try {
    decoded = verifyMfaToken(String(mfaToken || ''));
  } catch {
    throw new AppError('Sign-in expired. Please enter your password again.', 401);
  }
  const user = await User.findById(decoded.id).select(OTP_SELECT);
  if (
    !user
    || user.isActive === false
    || !isStaffRole(user.role)
    || (decoded.tv || 0) !== (user.tokenVersion || 0)
  ) {
    throw new AppError('Sign-in expired. Please enter your password again.', 401);
  }
  return user;
};

/** Admin panel — step 2: SMS code sent after the password step. */
export const verifyAdminMfa = asyncHandler(async (req, res) => {
  const { mfaToken, code } = req.body;
  if (!code || !/^\d{6}$/.test(String(code).trim())) {
    throw new AppError('A valid 6-digit verification code is required', 400);
  }

  const user = await loadMfaStaffUser(mfaToken);
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

  user.lastLoginAt = new Date();
  await user.save({ validateBeforeSave: false });
  sendAuthResponse(user, req, res);
});

/** Admin panel — resend the step-2 SMS code. */
export const resendAdminMfa = asyncHandler(async (req, res) => {
  const user = await loadMfaStaffUser(req.body.mfaToken);
  const code = await issuePhoneOtp(user, user.phone, req.body.lang);
  res.json({
    success: true,
    mfaRequired: true,
    phoneDisplay: maskPhone(user.phone),
    expiresInMinutes: 10,
    ...devOtpFields(code),
  });
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
  sendAuthResponse(driverUser, req, res);
});

export const logout = asyncHandler(async (req, res) => {
  const session = req.user.$locals.session;
  if (session?.jti && session.exp) {
    await RevokedToken.updateOne(
      { jti: session.jti },
      { $setOnInsert: { user: req.user._id, expiresAt: new Date(session.exp * 1000) } },
      { upsert: true },
    );
  }
  clearSessionCookie(res);
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
