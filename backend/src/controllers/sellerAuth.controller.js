/**
 * Seller Center account security: sign-in (with optional emailed 2-step code), new-sign-in
 * alerts, forgot / reset / change password, sign out of every device, and the team activity log.
 */
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import User from '../models/User.js';
import SellerActivity from '../models/SellerActivity.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { generateToken } from '../utils/generateToken.js';
import { parsePagination, paginationMeta } from '../utils/listQuery.js';
import { sendEmail } from '../utils/sendEmail.js';
import { clientUrl } from '../emails/helpers.js';
import { SELLER_ROLES, sellerUserPermissions } from '../constants/marketplace.js';
import { logSellerActivity, clientIp } from '../services/sellerActivity.service.js';
import {
  sellerPasswordResetTemplate,
  sellerLoginCodeTemplate,
  sellerNewSignInTemplate,
  sellerAccessTemplate,
} from '../emails/templates/sellerTemplates.js';

const CODE_TTL_MS = 10 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;
const MAX_CODE_ATTEMPTS = 5;
/** Wrong passwords in a row before sign-in locks, and for how long. */
export const MAX_PASSWORD_ATTEMPTS = 10;
export const LOCK_MS = 15 * 60 * 1000;
const sha256 = (v) => crypto.createHash('sha256').update(String(v)).digest('hex');
const secret = () => process.env.JWT_SECRET;

/** At least 8 characters with a letter and a digit. */
export function assertStrongPassword(password) {
  const p = String(password || '');
  if (p.length < 8 || !/[A-Za-z؀-ۿ]/.test(p) || !/\d/.test(p)) {
    throw new AppError('Use at least 8 characters with letters and numbers', 400);
  }
}

const maskEmail = (email) => String(email || '').replace(/^(.)(.*)(.@.*)$/, (_m, a, b, c) => `${a}${'•'.repeat(Math.min(6, b.length))}${c}`);

export function sendQuietly(message, to) {
  sendEmail({ to, ...message }).catch((err) => console.error('Seller email failed:', err.message));
}

function authPayload(user) {
  return {
    success: true,
    token: generateToken(user._id, { sv: user.sessionVersion }),
    user: { id: user._id, name: user.name, email: user.email, role: user.role, seller: user.seller, mustChangePassword: user.mustChangePassword === true },
  };
}

async function completeSignIn(user, req, res) {
  const entry = { at: new Date(), ip: clientIp(req), userAgent: String(req.headers['user-agent'] || '').slice(0, 300) };
  await User.updateOne(
    { _id: user._id },
    { $set: { lastLoginAt: entry.at, failedLoginCount: 0, lockedUntil: null }, $push: { loginHistory: { $each: [entry], $position: 0, $slice: 10 } } },
  );
  sendQuietly(sellerNewSignInTemplate(user, entry), user.email);
  await logSellerActivity(req, { sellerId: user.seller, actor: user, action: 'security.login', label: entry.ip });
  res.json(authPayload(user));
}

async function issueLoginCode(user) {
  const code = String(crypto.randomInt(100000, 1000000));
  await User.updateOne(
    { _id: user._id },
    { $set: { loginCodeHash: sha256(code), loginCodeExpires: new Date(Date.now() + CODE_TTL_MS), loginCodeAttempts: 0 } },
  );
  sendQuietly(sellerLoginCodeTemplate(user, code), user.email);
  return jwt.sign({ id: String(user._id), purpose: 'seller-2fa' }, secret(), { expiresIn: '10m' });
}

// ── Sign-in ──

export const sellerSignIn = asyncHandler(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (!email || !password) throw new AppError('Email and password are required', 400);

  const user = await User.findOne({ email, role: { $in: SELLER_ROLES } }).select('+password');
  if (user?.lockedUntil && user.lockedUntil > new Date()) {
    const minutes = Math.max(1, Math.ceil((user.lockedUntil - Date.now()) / 60000));
    throw new AppError(`Too many wrong passwords. Try again in ${minutes} minutes, or ask the store team to unlock your login.`, 429);
  }
  if (!user || user.isActive === false || !user.password || !(await user.comparePassword(password))) {
    if (user && user.isActive !== false) {
      const count = (user.failedLoginCount || 0) + 1;
      await User.updateOne(
        { _id: user._id },
        count >= MAX_PASSWORD_ATTEMPTS
          ? { $set: { failedLoginCount: 0, lockedUntil: new Date(Date.now() + LOCK_MS) } }
          : { $set: { failedLoginCount: count } },
      );
    }
    throw new AppError('Invalid email or password', 401);
  }

  if (user.twoFactorEnabled) {
    const challenge = await issueLoginCode(user);
    return res.json({ success: true, twoFactorRequired: true, challenge, sentTo: maskEmail(user.email) });
  }
  return completeSignIn(user, req, res);
});

function readChallenge(challenge) {
  try {
    const decoded = jwt.verify(String(challenge || ''), secret());
    if (decoded.purpose !== 'seller-2fa') throw new Error('wrong purpose');
    return decoded.id;
  } catch {
    throw new AppError('Your sign-in code expired — sign in again', 401);
  }
}

export const verifySellerSignInCode = asyncHandler(async (req, res) => {
  const userId = readChallenge(req.body.challenge);
  const code = String(req.body.code || '').replace(/\D/g, '');
  const user = await User.findOne({ _id: userId, role: { $in: SELLER_ROLES } })
    .select('+loginCodeHash +loginCodeExpires +loginCodeAttempts');
  if (!user || user.isActive === false || !user.loginCodeHash) throw new AppError('Sign in again to get a new code', 401);
  if (user.loginCodeAttempts >= MAX_CODE_ATTEMPTS) throw new AppError('Too many wrong codes — sign in again', 429);
  if (!user.loginCodeExpires || user.loginCodeExpires < new Date()) throw new AppError('The code expired — sign in again', 401);

  if (sha256(code) !== user.loginCodeHash) {
    await User.updateOne({ _id: user._id }, { $inc: { loginCodeAttempts: 1 } });
    throw new AppError('Wrong code', 400);
  }
  await User.updateOne({ _id: user._id }, { $unset: { loginCodeHash: 1, loginCodeExpires: 1 }, $set: { loginCodeAttempts: 0 } });
  return completeSignIn(user, req, res);
});

export const resendSellerSignInCode = asyncHandler(async (req, res) => {
  const userId = readChallenge(req.body.challenge);
  const user = await User.findOne({ _id: userId, role: { $in: SELLER_ROLES }, isActive: { $ne: false } }).select('+loginCodeExpires');
  if (!user) throw new AppError('Sign in again', 401);
  // At most one code every 30 seconds.
  const sentAt = user.loginCodeExpires ? user.loginCodeExpires.getTime() - CODE_TTL_MS : 0;
  if (Date.now() - sentAt < 30_000) throw new AppError('Wait a few seconds before asking for another code', 429);
  const challenge = await issueLoginCode(user);
  res.json({ success: true, challenge, sentTo: maskEmail(user.email) });
});

// ── Forgot / reset password ──

/** Store a fresh one-time password link for a seller user; returns the raw token. */
export async function issuePasswordToken(user, ttlMs) {
  const token = crypto.randomBytes(32).toString('hex');
  await User.updateOne(
    { _id: user._id },
    { $set: { resetPasswordToken: sha256(token), resetPasswordExpires: new Date(Date.now() + ttlMs) } },
  );
  return token;
}

export const SELLER_INVITE_TTL_HOURS = 72;

/**
 * Staff onboarding / support: email a seller user a "set your password" link (valid 72 hours)
 * together with the Seller Center sign-in address. Returns the links so staff can also share
 * them over WhatsApp when email is unreliable.
 */
export async function sendSellerAccessEmail(user, { seller, withPasswordLink = true } = {}) {
  const loginUrl = `${clientUrl()}/seller-center/login`;
  let setupUrl = '';
  let token = '';
  if (withPasswordLink) {
    token = await issuePasswordToken(user, SELLER_INVITE_TTL_HOURS * 60 * 60 * 1000);
    setupUrl = `${clientUrl()}/seller-center/reset-password/${token}`;
  }
  sendQuietly(sellerAccessTemplate(user, { seller, token, expiresHours: SELLER_INVITE_TTL_HOURS }), user.email);
  return {
    sentTo: user.email,
    loginUrl,
    setupUrl,
    expiresAt: withPasswordLink ? new Date(Date.now() + SELLER_INVITE_TTL_HOURS * 60 * 60 * 1000) : null,
  };
}

export const forgotSellerPassword = asyncHandler(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const user = email ? await User.findOne({ email, role: { $in: SELLER_ROLES }, isActive: { $ne: false } }) : null;
  if (user) {
    const token = await issuePasswordToken(user, RESET_TTL_MS);
    sendQuietly(sellerPasswordResetTemplate(user, token), user.email);
  }
  // Same answer either way — never reveal which emails have accounts.
  res.json({ success: true, message: 'If this email has a seller account, we sent a reset link.' });
});

export const resetSellerPassword = asyncHandler(async (req, res) => {
  const token = String(req.body.token || '');
  assertStrongPassword(req.body.password);
  const user = await User.findOne({
    resetPasswordToken: sha256(token),
    resetPasswordExpires: { $gt: new Date() },
    role: { $in: SELLER_ROLES },
  }).select('+resetPasswordToken +resetPasswordExpires');
  if (!token || !user) throw new AppError('This reset link is invalid or has expired', 400);

  user.password = String(req.body.password);
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  user.mustChangePassword = false;
  user.sessionVersion = (user.sessionVersion || 0) + 1;
  await user.save();
  await logSellerActivity(req, { sellerId: user.seller, actor: user, action: 'security.password_reset' });
  return completeSignIn(user, req, res);
});

// ── Signed-in security settings (/api/seller/me/security…) ──

export const getMySecurity = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+loginHistory').lean();
  res.json({
    success: true,
    data: {
      email: user.email,
      twoFactorEnabled: user.twoFactorEnabled === true,
      loginHistory: user.loginHistory || [],
      permissions: sellerUserPermissions(user),
    },
  });
});

async function verifyCurrentPassword(req) {
  const user = await User.findById(req.user._id).select('+password');
  if (!user || !(await user.comparePassword(String(req.body.currentPassword || '')))) {
    throw new AppError('Your current password is not correct', 400);
  }
  return user;
}

export const changeMyPassword = asyncHandler(async (req, res) => {
  const user = await verifyCurrentPassword(req);
  assertStrongPassword(req.body.newPassword);
  if (await user.comparePassword(String(req.body.newPassword))) throw new AppError('Choose a different password', 400);
  user.password = String(req.body.newPassword);
  user.mustChangePassword = false;
  user.sessionVersion = (user.sessionVersion || 0) + 1;
  await user.save();
  await logSellerActivity(req, { action: 'security.password_change' });
  // Other devices are signed out; this one gets a fresh token.
  res.json(authPayload(user));
});

export const setMyTwoFactor = asyncHandler(async (req, res) => {
  const user = await verifyCurrentPassword(req);
  user.twoFactorEnabled = req.body.enabled === true;
  await user.save({ validateBeforeSave: false });
  await logSellerActivity(req, { action: user.twoFactorEnabled ? 'security.2fa_on' : 'security.2fa_off' });
  res.json({ success: true, data: { twoFactorEnabled: user.twoFactorEnabled } });
});

export const signOutEverywhere = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(req.user._id, { $inc: { sessionVersion: 1 } }, { new: true });
  await logSellerActivity(req, { action: 'security.sign_out_all' });
  res.json(authPayload(user));
});

// ── Activity log (owner) ──

export const listMyActivity = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, 100);
  const filter = { seller: req.seller._id };
  const area = String(req.query.area || '');
  if (/^[a-z_]{2,20}$/.test(area)) filter.action = { $regex: `^${area}\\.` };
  if (mongoose.Types.ObjectId.isValid(req.query.actor)) filter.actor = req.query.actor;
  const [items, total] = await Promise.all([
    SellerActivity.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    SellerActivity.countDocuments(filter),
  ]);
  res.json({ success: true, data: items, pagination: paginationMeta(page, limit, total) });
});
