import User from '../models/User.js';
import Order from '../models/Order.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { parsePagination, parseSort, paginationMeta } from '../utils/listQuery.js';
import { STAFF_ROLES, canAssignRole } from '../constants/roles.js';
import { logAudit, pickChanges } from '../services/auditLog.service.js';
import { normalizePhone, formatPhoneDisplay } from '../utils/phone.js';

const ADMIN_USER_SORT = ['createdAt', 'name', 'email'];

function buildUserSummary(roleAgg) {
  const byRole = Object.fromEntries(roleAgg.map((row) => [row._id, row.count]));
  return {
    total: roleAgg.reduce((sum, row) => sum + row.count, 0),
    customers: byRole.user ?? 0,
    staff: STAFF_ROLES.reduce((sum, role) => sum + (byRole[role] ?? 0), 0),
    drivers: byRole.driver ?? 0,
  };
}

function applyAccountTypeFilter(filter, accountType) {
  if (accountType === 'customer') filter.role = 'user';
  else if (accountType === 'staff') filter.role = { $in: STAFF_ROLES };
  else if (accountType === 'driver') filter.role = 'driver';
}

export const getAdminUsers = asyncHandler(async (req, res) => {
  const { role, q, accountType } = req.query;
  const { page, limit, skip } = parsePagination(req.query);
  const filter = {};

  if (role) filter.role = role;
  else applyAccountTypeFilter(filter, accountType);

  if (q) {
    filter.$or = [
      { name: { $regex: q, $options: 'i' } },
      { email: { $regex: q, $options: 'i' } },
      { phone: { $regex: q, $options: 'i' } },
    ];
  }

  const sort = parseSort(req.query, ADMIN_USER_SORT);

  const [users, total, roleAgg] = await Promise.all([
    User.find(filter).select('-password').sort(sort).skip(skip).limit(limit),
    User.countDocuments(filter),
    User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
  ]);

  res.json({
    success: true,
    data: users,
    pagination: paginationMeta(page, limit, total),
    summary: buildUserSummary(roleAgg),
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

export const bulkAdminUsers = asyncHandler(async (req, res) => {
  const { ids, action } = req.body;
  if (!Array.isArray(ids) || !ids.length) {
    throw new AppError('ids array is required', 400);
  }
  if (action !== 'delete') throw new AppError('Invalid action', 400);

  const users = await User.find({ _id: { $in: ids } });
  if (users.some((u) => STAFF_ROLES.includes(u.role))) {
    throw new AppError('Cannot delete staff accounts', 400);
  }

  await User.deleteMany({ _id: { $in: ids }, role: { $nin: STAFF_ROLES } });

  await logAudit({
    req,
    action: 'bulk',
    entityType: 'user',
    entityLabel: `${ids.length} users`,
    changes: { action: 'delete', ids },
  });

  res.json({ success: true, affected: ids.length });
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

  const before = { name: user.name, phone: user.phone, role: user.role };
  const { name, phone, role, isEmailVerified } = req.body;

  if (role !== undefined && role !== user.role) {
    if (!canAssignRole(req.user.role, role)) {
      throw new AppError('You cannot assign this role', 403);
    }
    if (user._id.toString() === req.user._id.toString() && role !== req.user.role) {
      throw new AppError('You cannot change your own role', 400);
    }
    user.role = role;
  }

  if (name !== undefined) user.name = name;
  if (phone !== undefined) user.phone = phone;
  if (isEmailVerified !== undefined) user.isEmailVerified = isEmailVerified;

  await user.save();

  const changes = pickChanges(before, { name: user.name, phone: user.phone, role: user.role }, ['name', 'phone', 'role']);
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
      isEmailVerified: user.isEmailVerified,
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
