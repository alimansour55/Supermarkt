import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { STAFF_ROLES } from '../constants/roles.js';
import { hasUserPermission } from '../constants/permissions.js';
import { SELLER_ROLES } from '../constants/marketplace.js';
import Seller from '../models/Seller.js';

export const protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies?.token) {
      token = req.cookies.token;
    }

    if (!token) {
      throw new AppError('Not authorized — no token provided', 401);
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      throw new AppError('User not found', 401);
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return next(new AppError('Not authorized — invalid token', 401));
    }
    next(error);
  }
};

export const optionalProtect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies?.token) {
      token = req.cookies.token;
    }

    if (!token) return next();

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    // Optional auth: a missing/expired/invalid token must never block a public
    // route — just continue as an anonymous visitor.
    if (user) req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return next();
    }
    next(error);
  }
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

/**
 * Marketplace seller portal. Loads the caller's Seller into `req.seller`; every seller
 * controller must scope its queries by `req.seller._id` — never by an id from the request.
 */
const loadSeller = async (req, res, next) => {
  try {
    if (!req.user.seller || req.user.isActive === false) {
      throw new AppError('Seller account is not available', 403);
    }
    const seller = await Seller.findById(req.user.seller);
    if (!seller) throw new AppError('Seller account is not available', 403);
    req.seller = seller;
    next();
  } catch (error) {
    next(error);
  }
};

export const sellerOnly = [protect, restrictTo(...SELLER_ROLES), loadSeller];

/** Seller writes that change the catalog — blocked once suspended or rejected. */
export const sellerCanEditCatalog = (req, res, next) => {
  if (['suspended', 'rejected'].includes(req.seller?.status)) {
    return next(new AppError('Your seller account cannot make changes right now', 403));
  }
  next();
};

/** Only the seller owner (not seller staff) — bank details, team. */
export const sellerOwnerOnly = (req, res, next) => {
  if (req.user?.role !== 'seller_owner') {
    return next(new AppError('Only the store owner can do this', 403));
  }
  next();
};

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

export const requireVerified = (req, res, next) => {
  if (!req.user.isEmailVerified) {
    return next(new AppError('Please verify your email before continuing', 403));
  }
  next();
};
