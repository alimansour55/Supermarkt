import User from '../models/User.js';
import Order from '../models/Order.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { parsePagination, parseSort, paginationMeta } from '../utils/listQuery.js';
import { STAFF_ROLES, canAssignRole } from '../constants/roles.js';
import { logAudit, pickChanges } from '../services/auditLog.service.js';
import { normalizePhone, formatPhoneDisplay } from '../utils/phone.js';

const ADMIN_USER_SORT = ['createdAt', 'name', 'email', 'lastLoginAt', 'pointsBalance', 'walletBalance'];

const JOINED_WITHIN_DAYS = { 7: 7, 30: 30, 90: 90 };

function buildUserSummary(roleAgg, extra = {}) {
  const byRole = Object.fromEntries(roleAgg.map((row) => [row._id, row.count]));
  return {
    total: roleAgg.reduce((sum, row) => sum + row.count, 0),
    customers: byRole.user ?? 0,
    staff: STAFF_ROLES.reduce((sum, role) => sum + (byRole[role] ?? 0), 0),
    drivers: byRole.driver ?? 0,
    suspended: extra.suspended ?? 0,
    newThisMonth: extra.newThisMonth ?? 0,
    verified: extra.verified ?? 0,
  };
}

async function assertNotLastSuperAdmin(excludeId) {
  const others = await User.countDocuments({
    _id: { $ne: excludeId },
    role: 'super_admin',
    isActive: { $ne: false },
  });
  if (others === 0) {
    throw new AppError('This is the last active super admin — assign another one first', 400);
  }
}

function applyAccountTypeFilter(filter, accountType) {
  if (accountType === 'customer') filter.role = 'user';
  else if (accountType === 'staff') filter.role = { $in: STAFF_ROLES };
  else if (accountType === 'driver') filter.role = 'driver';
}

function applyUserListFilters(filter, query) {
  const { status, verified, joinedWithin } = query;

  if (status === 'active') filter.isActive = { $ne: false };
  else if (status === 'suspended') filter.isActive = false;

  if (verified === 'yes') filter.isPhoneVerified = true;
  else if (verified === 'no') filter.isPhoneVerified = { $ne: true };

  const days = JOINED_WITHIN_DAYS[joinedWithin];
  if (days) {
    filter.createdAt = { $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) };
  }
}

/** Merge per-user order count + lifetime spend onto the current page of users. */
async function attachOrderRollup(users) {
  const ids = users.map((u) => u._id);
  if (!ids.length) return users;

  const rollup = await Order.aggregate([
    { $match: { user: { $in: ids } } },
    { $group: { _id: '$user', orders: { $sum: 1 }, spent: { $sum: '$total' } } },
  ]);
  const byUser = new Map(rollup.map((row) => [String(row._id), row]));

  return users.map((user) => {
    const stats = byUser.get(String(user._id));
    return {
      ...user.toObject(),
      orderCount: stats?.orders ?? 0,
      totalSpent: Math.round((stats?.spent ?? 0) * 100) / 100,
    };
  });
}

export const getAdminUsers = asyncHandler(async (req, res) => {
  const { role, q, accountType } = req.query;
  const { page, limit, skip } = parsePagination(req.query);
  const filter = {};

  if (role) filter.role = role;
  else applyAccountTypeFilter(filter, accountType);

  applyUserListFilters(filter, req.query);

  if (q) {
    filter.$or = [
      { name: { $regex: q, $options: 'i' } },
      { email: { $regex: q, $options: 'i' } },
      { phone: { $regex: q, $options: 'i' } },
    ];
  }

  const sort = parseSort(req.query, ADMIN_USER_SORT);
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [users, total, roleAgg, suspended, newThisMonth, verified] = await Promise.all([
    User.find(filter).select('-password').sort(sort).skip(skip).limit(limit),
    User.countDocuments(filter),
    User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
    User.countDocuments({ isActive: false }),
    User.countDocuments({ createdAt: { $gte: startOfMonth } }),
    User.countDocuments({ isPhoneVerified: true }),
  ]);

  res.json({
    success: true,
    data: await attachOrderRollup(users),
    pagination: paginationMeta(page, limit, total),
    summary: buildUserSummary(roleAgg, { suspended, newThisMonth, verified }),
  });
});

export const createAdminUser = asyncHandler(async (req, res) => {
  const name = req.body.name?.trim();
  const phone = normalizePhone(req.body.phone);
  const role = req.body.role === 'driver' ? 'driver' : 'user';

  if (!name) throw new AppError('Name is required', 400);
  if (!phone) throw new AppError('Invalid Egyptian mobile number (e.g. 01xxxxxxxxx)', 400);

  const existing = await User.findOne({ phone });
  if (existing) {
    throw new AppError('A user with this phone number already exists', 409);
  }

  const user = await User.create({
    name,
    phone,
    role,
    isPhoneVerified: true,
    mfaEnabled: role === 'user',
    isActive: true,
    createdBy: req.user._id,
  });

  await logAudit({
    req,
    action: 'create',
    entityType: 'user',
    entityId: user._id,
    entityLabel: user.name,
    changes: { name: user.name, phone: user.phone, role: user.role, isPhoneVerified: true },
  });

  res.status(201).json({
    success: true,
    data: {
      id: user._id,
      name: user.name,
      phone: user.phone,
      phoneDisplay: formatPhoneDisplay(user.phone),
      role: user.role,
      isPhoneVerified: user.isPhoneVerified,
      createdAt: user.createdAt,
    },
  });
});

const BULK_USER_ACTIONS = ['delete', 'suspend', 'activate'];

export const bulkAdminUsers = asyncHandler(async (req, res) => {
  const { ids, action } = req.body;
  if (!Array.isArray(ids) || !ids.length) {
    throw new AppError('ids array is required', 400);
  }
  if (!BULK_USER_ACTIONS.includes(action)) throw new AppError('Invalid action', 400);

  const users = await User.find({ _id: { $in: ids } });
  if (users.some((u) => STAFF_ROLES.includes(u.role))) {
    throw new AppError('Staff accounts cannot be changed in bulk', 400);
  }
  if (ids.some((id) => id.toString() === req.user._id.toString())) {
    throw new AppError('You cannot include your own account in a bulk action', 400);
  }

  const scope = { _id: { $in: ids }, role: { $nin: STAFF_ROLES } };
  let affected = 0;

  if (action === 'delete') {
    ({ deletedCount: affected } = await User.deleteMany(scope));
  } else {
    ({ modifiedCount: affected } = await User.updateMany(scope, {
      isActive: action === 'activate',
    }));
  }

  await logAudit({
    req,
    action: 'bulk',
    entityType: 'user',
    entityLabel: `${ids.length} users`,
    changes: { action, ids },
  });

  res.json({ success: true, affected });
});

export const getAdminUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select('-password');
  if (!user) throw new AppError('User not found', 404);

  const orderCount = await Order.countDocuments({ user: user._id });

  res.json({
    success: true,
    data: {
      ...user.toObject(),
      orderCount,
    },
  });
});

export const updateAdminUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new AppError('User not found', 404);

  const isSelf = user._id.toString() === req.user._id.toString();
  const before = {
    name: user.name,
    phone: user.phone,
    role: user.role,
    isActive: user.isActive,
    isPhoneVerified: user.isPhoneVerified,
    reviewBlocked: user.reviewBlocked,
  };
  const {
    name, phone, role, isEmailVerified, isActive, isPhoneVerified, reviewBlocked,
  } = req.body;

  if (role !== undefined && role !== user.role) {
    if (!canAssignRole(req.user.role, role)) {
      throw new AppError('You cannot assign this role', 403);
    }
    if (isSelf && role !== req.user.role) {
      throw new AppError('You cannot change your own role', 400);
    }
    if (user.role === 'super_admin' && !STAFF_ROLES.includes(role)) {
      await assertNotLastSuperAdmin(user._id);
    }
    user.role = role;
  }

  if (isActive !== undefined && isActive !== user.isActive) {
    if (isSelf) throw new AppError('You cannot change your own account status', 400);
    if (!isActive && user.role === 'super_admin') {
      await assertNotLastSuperAdmin(user._id);
    }
    user.isActive = Boolean(isActive);
  }

  if (name !== undefined) user.name = name;
  if (phone !== undefined) user.phone = phone;
  if (isEmailVerified !== undefined) user.isEmailVerified = isEmailVerified;
  if (isPhoneVerified !== undefined) user.isPhoneVerified = Boolean(isPhoneVerified);
  if (reviewBlocked !== undefined) user.reviewBlocked = Boolean(reviewBlocked);

  await user.save();

  const changes = pickChanges(
    before,
    {
      name: user.name,
      phone: user.phone,
      role: user.role,
      isActive: user.isActive,
      isPhoneVerified: user.isPhoneVerified,
      reviewBlocked: user.reviewBlocked,
    },
    ['name', 'phone', 'role', 'isActive', 'isPhoneVerified', 'reviewBlocked'],
  );
  if (changes) {
    await logAudit({
      req,
      action: 'update',
      entityType: 'user',
      entityId: user._id,
      entityLabel: user.name,
      changes,
    });
  }

  res.json({
    success: true,
    data: {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      isActive: user.isActive,
      isPhoneVerified: user.isPhoneVerified,
      isEmailVerified: user.isEmailVerified,
      reviewBlocked: user.reviewBlocked,
    },
  });
});

export const deleteAdminUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new AppError('User not found', 404);
  if (STAFF_ROLES.includes(user.role)) {
    throw new AppError('Cannot delete staff account', 400);
  }

  const label = user.name;
  await user.deleteOne();

  await logAudit({
    req,
    action: 'delete',
    entityType: 'user',
    entityId: user._id,
    entityLabel: label,
  });

  res.json({ success: true, message: 'User deleted' });
});
