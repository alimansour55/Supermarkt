import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import RevokedToken from '../models/RevokedToken.js';
import { AppError } from '../utils/AppError.js';
import { STAFF_ROLES } from '../constants/roles.js';
import { hasUserPermission } from '../constants/permissions.js';

const extractToken = (req) => {
  if (req.headers.authorization?.startsWith('Bearer ')) {
    return req.headers.authorization.split(' ')[1];
  }
  return req.cookies?.token || null;
};

/**
 * Verify a session token and load its user.
 * Rejects tokens that were revoked (logout), invalidated (token version bump)
 * or that belong to a suspended account.
 */
export const resolveSessionUser = async (token) => {
  const decoded = jwt.verify(token, process.env.JWT_SECRET);

  const [user, revoked] = await Promise.all([
    User.findById(decoded.id),
    decoded.jti ? RevokedToken.exists({ jti: decoded.jti }) : null,
  ]);

  if (!user) {
    throw new AppError('User not found', 401);
  }
  if (revoked || (decoded.tv || 0) !== (user.tokenVersion || 0)) {
    throw new AppError('Session expired — please sign in again', 401);
  }
  if (user.isActive === false) {
    throw new AppError('This account has been suspended. Please contact support.', 401);
  }

  user.$locals.session = { jti: decoded.jti, exp: decoded.exp };
  return user;
};

export const protect = async (req, res, next) => {
  try {
    const token = extractToken(req);

    if (!token) {
      throw new AppError('Not authorized — no token provided', 401);
    }

    req.user = await resolveSessionUser(token);
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return next(new AppError('Not authorized — invalid token', 401));
    }
    next(error);
  }
};

/**
 * Optional auth: a missing/expired/invalid/revoked token must never block a public
 * route — just continue as an anonymous visitor.
 */
export const optionalProtect = async (req, res, next) => {
  try {
    const token = extractToken(req);
    if (token) req.user = await resolveSessionUser(token);
  } catch (error) {
    if (!(error instanceof AppError) && error.name !== 'JsonWebTokenError' && error.name !== 'TokenExpiredError') {
      return next(error);
    }
  }
  next();
};

export const restrictTo = (...roles) => (req, res, next) => {
  const allowed = roles.flat();
  if (!allowed.includes(req.user?.role)) {
    return next(new AppError('You do not have permission to perform this action', 403));
  }
  next();
};

/** Any staff role (manager, admin, super_admin) */
export const staffOnly = [protect, restrictTo(...STAFF_ROLES)];

/** Delivery drivers sharing live location */
export const driverOnly = [protect, restrictTo('driver')];

/** Backward-compatible alias — all admin panel routes accept staff roles */
export const adminOnly = staffOnly;

/** Fine-grained permission check for staff routes */
export const requirePermission = (permission) => [
  protect,
  (req, res, next) => {
    if (!hasUserPermission(req.user, permission)) {
      return next(new AppError('You do not have permission to perform this action', 403));
    }
    next();
  },
];
