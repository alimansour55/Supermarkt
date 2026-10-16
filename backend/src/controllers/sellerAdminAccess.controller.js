/**
 * Staff support for seller logins (/api/admin/marketplace/sellers/:id/users…): set a temporary
 * password, sign out everywhere, turn a login off/on, unlock it, reset 2-step verification,
 * change its email, add / remove team members and hand the store to another owner.
 *
 * Every change is written to the staff audit log AND the seller's own activity log, and the
 * affected login gets an email — sellers always learn when staff touched their account.
 */
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import Seller from '../models/Seller.js';
import User from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { logAudit } from '../services/auditLog.service.js';
import { logSellerActivity } from '../services/sellerActivity.service.js';
import { sellerUsers } from '../services/marketplace.service.js';
import { DEFAULT_STAFF_PERMISSIONS, SELLER_PERMISSIONS } from '../constants/marketplace.js';
import { sellerStaffChangeTemplate } from '../emails/templates/sellerTemplates.js';
import { assertStrongPassword, sendSellerAccessEmail, sendQuietly } from './sellerAuth.controller.js';
import { MAX_STAFF, readPermissions } from './sellerOps.controller.js';

const isId = (v) => mongoose.Types.ObjectId.isValid(v);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const bump = (user) => { user.sessionVersion = (user.sessionVersion || 0) + 1; };

async function loadSeller(id) {
  if (!isId(id)) throw new AppError('Seller not found', 404);
  const seller = await Seller.findById(id);
  if (!seller) throw new AppError('Seller not found', 404);
  return seller;
}

async function loadLogin(seller, userId, select = '') {
  if (!isId(userId)) throw new AppError('Login not found for this seller', 404);
  const user = await User.findOne({ _id: userId, seller: seller._id }).select(select);
  if (!user) throw new AppError('Login not found for this seller', 404);
  return user;
}

/** Audit + seller activity in one go, then the fresh team list for the panel. */
async function record(req, seller, user, action, details = {}) {
  await logAudit({
    req,
    action: 'update',
    entityType: 'seller',
    entityId: seller._id,
    entityLabel: seller.nameEn,
    changes: { [`login.${action}`]: { from: null, to: { user: user.email, ...details } } },
  });
  await logSellerActivity(req, {
    sellerId: seller._id,
    action: `staff.${action}`,
    entityType: 'user',
    entityId: user._id,
    label: user.name,
    details: Object.keys(details).length ? details : null,
  });
}

const teamResponse = async (res, seller, extra = {}) => res.json({
  success: true,
  data: await sellerUsers(seller._id, { forStaff: true }),
  ...extra,
});

// ── Add a login ──

export const addSellerLoginAdmin = asyncHandler(async (req, res) => {
  const seller = await loadSeller(req.params.id);
  const name = String(req.body?.name || '').trim().slice(0, 100);
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '').trim();
  if (name.length < 2) throw new AppError('Name is required', 400);
  if (!EMAIL_RE.test(email)) throw new AppError('A valid email is required', 400);
  if (password) assertStrongPassword(password);
  if (await User.countDocuments({ seller: seller._id }) >= MAX_STAFF + 1) {
    throw new AppError(`Up to ${MAX_STAFF} staff logins per store`, 400);
  }
  if (await User.exists({ email })) throw new AppError('This email is already registered', 409);

  // A store without an owner (e.g. its owner was removed) gets one back first.
  const hasOwner = Boolean(seller.owner) && await User.exists({ _id: seller.owner, seller: seller._id });
  const role = hasOwner ? 'seller_staff' : 'seller_owner';
  const member = await User.create({
    name,
    email,
    // No password = an emailed invite; a placeholder nobody knows keeps the account unusable until then.
    password: password || `${crypto.randomUUID()}A1`,
    mustChangePassword: Boolean(password),
    role,
    seller: seller._id,
    createdBy: req.user._id,
    sellerPermissions: role === 'seller_staff' ? readPermissions(req.body?.permissions, DEFAULT_STAFF_PERMISSIONS) : undefined,
  });
  if (role === 'seller_owner') {
    seller.owner = member._id;
    await seller.save();
  }
  const access = await sendSellerAccessEmail(member, { seller, withPasswordLink: !password });
  await record(req, seller, member, 'login_added', { role, invited: !password });
  res.status(201);
  return teamResponse(res, seller, { access: { ...access, invited: !password }, userId: member._id });
});

// ── Change a login ──

/**
 * { name?, email?, isActive?, permissions?, unlock?: true, twoFactorEnabled?: false }
 * Staff can only turn 2-step verification OFF (a seller who lost access); turning it on is the
 * seller's own choice from their Security page.
 */
export const updateSellerLoginAdmin = asyncHandler(async (req, res) => {
  const seller = await loadSeller(req.params.id);
  const user = await loadLogin(seller, req.params.userId);
  const b = req.body || {};
  const done = [];

  if (b.name !== undefined) {
    const name = String(b.name).trim().slice(0, 100);
    if (name.length < 2) throw new AppError('Name is required', 400);
    if (name !== user.name) { user.name = name; done.push('name'); }
  }
  let oldEmail = '';
  if (b.email !== undefined) {
    const email = String(b.email).trim().toLowerCase();
    if (!EMAIL_RE.test(email)) throw new AppError('A valid email is required', 400);
    if (email !== user.email) {
      if (await User.exists({ email, _id: { $ne: user._id } })) throw new AppError('This email is already registered', 409);
      oldEmail = user.email;
      user.email = email;
      done.push('email');
    }
  }
  if (b.isActive !== undefined) {
    const active = b.isActive === true || b.isActive === 'true';
    if (active !== (user.isActive !== false)) {
      user.isActive = active;
      if (!active) bump(user); // turning a login off signs it out everywhere at once
      done.push(active ? 'turned_on' : 'turned_off');
    }
  }
  if (b.permissions !== undefined) {
    if (user.role === 'seller_owner') throw new AppError('The owner always has full access', 400);
    user.sellerPermissions = readPermissions(b.permissions, user.sellerPermissions);
    done.push('permissions');
  }
  if (b.unlock === true) {
    user.failedLoginCount = 0;
    user.lockedUntil = null;
    done.push('unlocked');
  }
  if (b.twoFactorEnabled === false && user.twoFactorEnabled) {
    user.twoFactorEnabled = false;
    done.push('two_factor_off');
  } else if (b.twoFactorEnabled === true && !user.twoFactorEnabled) {
    throw new AppError('Only the seller can turn on 2-step verification', 400);
  }

  if (!done.length) return teamResponse(res, seller);
  await user.save({ validateBeforeSave: true });

  if (oldEmail) {
    // Tell both addresses: the old one in case this was not expected.
    sendQuietly(sellerStaffChangeTemplate(user, { change: 'email', seller }), oldEmail);
    sendQuietly(sellerStaffChangeTemplate(user, { change: 'email', seller }), user.email);
  }
  if (done.includes('two_factor_off')) sendQuietly(sellerStaffChangeTemplate(user, { change: 'two_factor_off', seller }), user.email);
  await record(req, seller, user, 'login_updated', {
    changed: done,
    ...(oldEmail ? { email: [oldEmail, user.email] } : {}),
    ...(done.includes('permissions') ? { permissions: user.sellerPermissions } : {}),
  });
  return teamResponse(res, seller);
});

// ── Temporary password ──

/**
 * Staff type a temporary password (for sellers without reliable email). The seller must choose
 * their own at next sign-in, every device is signed out, and the login is unlocked.
 */
export const setSellerLoginPasswordAdmin = asyncHandler(async (req, res) => {
  const seller = await loadSeller(req.params.id);
  const user = await loadLogin(seller, req.params.userId);
  const password = String(req.body?.password || '');
  assertStrongPassword(password);
  if (user.isActive === false) throw new AppError('This login is turned off — turn it on first', 400);
  user.password = password;
  user.mustChangePassword = req.body?.mustChange !== false;
  user.failedLoginCount = 0;
  user.lockedUntil = null;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  bump(user);
  await user.save();
  sendQuietly(sellerStaffChangeTemplate(user, { change: 'password', seller }), user.email);
  await record(req, seller, user, 'password_set', { mustChange: user.mustChangePassword });
  return teamResponse(res, seller);
});

// ── Sign out everywhere ──

export const signOutSellerLoginAdmin = asyncHandler(async (req, res) => {
  const seller = await loadSeller(req.params.id);
  const user = await loadLogin(seller, req.params.userId);
  await User.updateOne({ _id: user._id }, { $inc: { sessionVersion: 1 } });
  sendQuietly(sellerStaffChangeTemplate(user, { change: 'signed_out', seller }), user.email);
  await record(req, seller, user, 'signed_out');
  return teamResponse(res, seller);
});

// ── Remove a staff login ──

export const removeSellerLoginAdmin = asyncHandler(async (req, res) => {
  const seller = await loadSeller(req.params.id);
  const user = await loadLogin(seller, req.params.userId);
  if (user.role === 'seller_owner') throw new AppError('Make someone else the owner before removing this login', 400);
  await User.deleteOne({ _id: user._id });
  await record(req, seller, user, 'login_removed');
  return teamResponse(res, seller);
});

// ── Hand the store to another login ──

/** The new owner gets full access; the old owner stays on as staff with every permission. */
export const transferSellerOwnerAdmin = asyncHandler(async (req, res) => {
  const seller = await loadSeller(req.params.id);
  const next = await loadLogin(seller, req.body?.userId);
  if (next.role === 'seller_owner') throw new AppError('This login is already the owner', 400);
  if (next.isActive === false) throw new AppError('Turn this login on before making it the owner', 400);

  const current = seller.owner ? await User.findOne({ _id: seller.owner, seller: seller._id }) : null;
  if (current) {
    current.role = 'seller_staff';
    current.sellerPermissions = [...SELLER_PERMISSIONS];
    await current.save();
  }
  next.role = 'seller_owner';
  next.sellerPermissions = undefined;
  await next.save();
  seller.owner = next._id;
  await seller.save();

  sendQuietly(sellerStaffChangeTemplate(next, { change: 'owner', seller }), next.email);
  await record(req, seller, next, 'owner_changed', { from: current?.email || null, to: next.email });
  return teamResponse(res, seller);
});

