import User from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { parsePagination, parseSort, paginationMeta } from '../utils/listQuery.js';
import { STAFF_ROLES, canAssignRole } from '../constants/roles.js';
import { logAudit, pickChanges } from '../services/auditLog.service.js';

const ADMIN_USER_SORT = ['createdAt', 'name', 'email'];

export const getAdminUsers = asyncHandler(async (req, res) => {
  const { role, q } = req.query;
  const { page, limit, skip } = parsePagination(req.query);
  const filter = {};

  if (role) filter.role = role;
  if (q) {
    filter.$or = [
      { name: { $regex: q, $options: 'i' } },
      { email: { $regex: q, $options: 'i' } },
      { phone: { $regex: q, $options: 'i' } },
    ];
  }

  const sort = parseSort(req.query, ADMIN_USER_SORT);

  const [users, total] = await Promise.all([
    User.find(filter).select('-password').sort(sort).skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: users,
    pagination: paginationMeta(page, limit, total),
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
  res.json({ success: true, data: user });
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
