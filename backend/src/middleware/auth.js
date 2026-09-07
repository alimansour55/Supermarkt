import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { STAFF_ROLES } from '../constants/roles.js';
import { hasUserPermission } from '../constants/permissions.js';

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
    if (!user) throw new AppError('User not found', 401);
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return next(new AppError('Not authorized — invalid token', 401));
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
