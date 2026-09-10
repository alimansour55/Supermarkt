import User from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { parsePagination, parseSort, paginationMeta } from '../utils/listQuery.js';
import {
  ALL_PERMISSIONS,
  ROLE_PRESET_PERMISSIONS,
  resolveUserPermissions,
  sanitizeAssignablePermissions,
} from '../constants/permissions.js';
import { TEAM_ROLES } from '../constants/roles.js';
import { logAudit, pickChanges } from '../services/auditLog.service.js';
import { normalizePhone } from '../utils/phone.js';
import { generatePassword } from '../utils/generatePassword.js';

const STAFF_SORT = ['createdAt', 'name', 'username', 'lastLoginAt', 'role'];
const STAFF_SELECT = '-password -phoneOtpHash -phoneOtpExpires -phoneOtpAttempts -lastOtpSentAt -emailVerificationToken -emailVerificationExpires -resetPasswordToken -resetPasswordExpires';

// Roles that can be assigned to a team account (same set as TEAM_ROLES today, kept as an alias for intent).
const TEAM_ASSIGNABLE_ROLES = TEAM_ROLES;

function normalizeUsername(value) {
  return String(value || '').trim().toLowerCase();
}

function teamMemberFilter(extra = {}) {
  return {
    role: { $in: TEAM_ROLES },
    username: { $exists: true, $nin: [null, ''] },
    ...extra,
  };
}

async function countSuperAdmins(excludeId = null, { activeOnly = false } = {}) {
  const filter = teamMemberFilter({ role: 'super_admin' });
  if (activeOnly) filter.isActive = { $ne: false };
  if (excludeId) filter._id = { $ne: excludeId };
  return User.countDocuments(filter);
}

function assertActorIsSuperAdmin(actor) {
  if (actor.role !== 'super_admin') {
    throw new AppError('You do not have permission to manage team accounts', 403);
  }
}

function assertNotSelf(actor, target, action) {
  if (actor._id.toString() === target._id.toString()) {
    const messages = {
      delete: 'You cannot delete your own account',
      deactivate: 'You cannot deactivate your own account',
      demote: 'You cannot change your own role — ask another super admin',
    };
    throw new AppError(messages[action] || 'You cannot perform this action on your own account', 400);
  }
}

async function assertSuperAdminRemains(target, { excludeId, activeOnly = false } = {}) {
  if (target.role !== 'super_admin') return;
  const remaining = await countSuperAdmins(excludeId ?? target._id, { activeOnly });
  if (remaining < 1) {
    const message = activeOnly
      ? 'At least one active super admin must remain'
      : 'At least one super admin account must remain';
    throw new AppError(message, 400);
  }
}

async function findTeamMember(id) {
  return User.findOne(teamMemberFilter({ _id: id }));
}

function formatStaffAccount(user, actorId) {
  const obj = user.toObject ? user.toObject() : user;
  const id = String(obj._id);
  const isSelf = Boolean(actorId && id === String(actorId));
  const createdBy = obj.createdBy && typeof obj.createdBy === 'object'
    ? { id: obj.createdBy._id, name: obj.createdBy.name, username: obj.createdBy.username }
    : obj.createdBy || null;

  const isDriver = obj.role === 'driver';

  return {
    id: obj._id,
    name: obj.name,
    username: obj.username,
    email: obj.email || null,
    phone: obj.phone || null,
    role: obj.role,
    permissions: obj.permissions || [],
    effectivePermissions: isDriver ? [] : resolveUserPermissions(obj),
    isActive: obj.isActive !== false,
    lastLoginAt: obj.lastLoginAt || null,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
    createdBy,
    isSelf,
    canDelete: !isSelf,
    canDeactivate: !isSelf,
    canEditRole: !isSelf,
    canResetPassword: !isSelf,
    canSignIn: obj.isActive !== false,
    isSuperAdmin: obj.role === 'super_admin',
    isDriver,
    portal: isDriver ? 'driver' : 'admin',
    loginPath: isDriver ? '/driver/login' : '/admin/login',
  };
}

function resolveStoredPermissions({ role, permissions, useCustomPermissions }) {
  if (role === 'super_admin') return [];
  if (!useCustomPermissions) return [];
  return sanitizeAssignablePermissions(permissions);
}

function buildTeamSummary(roleAgg, total, activeCount) {
  const byRole = Object.fromEntries(roleAgg.map((row) => [row._id, row.count]));
  return {
    total,
    active: activeCount,
    inactive: total - activeCount,
    superAdmins: byRole.super_admin ?? 0,
    admins: byRole.admin ?? 0,
    managers: byRole.manager ?? 0,
    drivers: byRole.driver ?? 0,
  };
}

export const getStaffAccounts = asyncHandler(async (req, res) => {
  const { q, active, role } = req.query;
  const { page, limit, skip } = parsePagination(req.query);
  const filter = teamMemberFilter();

  if (role && TEAM_ROLES.includes(role)) filter.role = role;
  if (active === 'true') filter.isActive = true;
  if (active === 'false') filter.isActive = false;

  if (q) {
    filter.$or = [
      { name: { $regex: q, $options: 'i' } },
      { username: { $regex: q, $options: 'i' } },
      { email: { $regex: q, $options: 'i' } },
    ];
  }

  const sort = parseSort(req.query, STAFF_SORT);

  const [users, total, roleAgg, globalTotal, globalActive] = await Promise.all([
    User.find(filter).select(STAFF_SELECT).populate('createdBy', 'name username').sort(sort).skip(skip).limit(limit),
    User.countDocuments(filter),
    User.aggregate([
      { $match: teamMemberFilter() },
      { $group: { _id: '$role', count: { $sum: 1 } } },
    ]),
    User.countDocuments(teamMemberFilter()),
    User.countDocuments(teamMemberFilter({ isActive: { $ne: false } })),
  ]);

  res.json({
    success: true,
    data: users.map((u) => formatStaffAccount(u, req.user._id)),
    pagination: paginationMeta(page, limit, total),
    summary: buildTeamSummary(roleAgg, globalTotal, globalActive),
    meta: {
      permissionGroups: ALL_PERMISSIONS,
      presets: Object.keys(ROLE_PRESET_PERMISSIONS),
      assignableRoles: TEAM_ASSIGNABLE_ROLES,
      superAdminCount: await countSuperAdmins(),
    },
  });
});

export const getStaffAccountById = asyncHandler(async (req, res) => {
  const user = await User.findOne(teamMemberFilter({ _id: req.params.id }))
    .select(STAFF_SELECT)
    .populate('createdBy', 'name username');

  if (!user) throw new AppError('Team account not found', 404);

  res.json({ success: true, data: formatStaffAccount(user, req.user._id) });
});

export const createStaffAccount = asyncHandler(async (req, res) => {
  assertActorIsSuperAdmin(req.user);

  const {
    name,
    username,
    password,
    email,
    phone: rawPhone,
    role = 'manager',
    permissions,
    useCustomPermissions = false,
    isActive = true,
  } = req.body;

  const normalizedUsername = normalizeUsername(username);
  if (!normalizedUsername) throw new AppError('Username is required', 400);
  if (!name?.trim()) throw new AppError('Name is required', 400);
  if (!password || String(password).length < 8) {
    throw new AppError('Password must be at least 8 characters', 400);
  }
  if (!TEAM_ASSIGNABLE_ROLES.includes(role)) {
    throw new AppError('Invalid role for team account', 400);
  }

  const existing = await User.findOne({ username: normalizedUsername });
  if (existing) throw new AppError('Username is already taken', 409);

  const phone = rawPhone ? normalizePhone(rawPhone) : null;
  if (rawPhone && !phone) throw new AppError('Invalid phone number', 400);
  if (role === 'driver' && !phone) {
    throw new AppError('Phone number is required for delivery drivers', 400);
  }
  if (phone) {
    const phoneTaken = await User.findOne({ phone });
    if (phoneTaken) throw new AppError('Phone number is already in use', 409);
  }

  const storedPermissions = role === 'driver'
    ? []
    : resolveStoredPermissions({ role, permissions, useCustomPermissions });

  const userDoc = {
    name: name.trim(),
    username: normalizedUsername,
    password,
    role,
    permissions: storedPermissions,
    isActive: Boolean(isActive),
    isPhoneVerified: Boolean(phone),
    mfaEnabled: role === 'driver' ? false : !phone,
    createdBy: req.user._id,
  };
  if (email?.trim()) userDoc.email = email.trim();
  if (phone) userDoc.phone = phone;

  const user = await User.create(userDoc);

  await logAudit({
    req,
    action: 'create',
    entityType: 'staff_account',
    entityId: user._id,
    entityLabel: user.username,
    changes: { role: user.role, permissions: storedPermissions },
  });

  res.status(201).json({
    success: true,
    data: formatStaffAccount(user, req.user._id),
    credentials: {
      username: user.username,
      portal: user.role === 'driver' ? 'driver' : 'admin',
      message: user.role === 'driver'
        ? 'Share these credentials securely with the driver. They sign in at /driver/login.'
        : 'Share these credentials securely with the team member.',
    },
  });
});

export const updateStaffAccount = asyncHandler(async (req, res) => {
  assertActorIsSuperAdmin(req.user);

  const user = await User.findOne(teamMemberFilter({ _id: req.params.id })).select('+password');
  if (!user) throw new AppError('Team account not found', 404);

  const isSelf = user._id.toString() === req.user._id.toString();

  const before = {
    name: user.name,
    role: user.role,
    permissions: [...(user.permissions || [])],
    isActive: user.isActive,
    email: user.email,
    phone: user.phone,
  };

  const {
    name,
    email,
    phone: rawPhone,
    role,
    permissions,
    useCustomPermissions,
    isActive,
    password,
  } = req.body;

  if (name !== undefined) user.name = String(name).trim();
  if (email !== undefined) user.email = email?.trim() || undefined;

  if (rawPhone !== undefined) {
    if (!rawPhone) {
      if (user.role === 'driver') {
        throw new AppError('Phone number is required for delivery drivers', 400);
      }
      user.phone = undefined;
    } else {
      const phone = normalizePhone(rawPhone);
      if (!phone) throw new AppError('Invalid phone number', 400);
      const phoneTaken = await User.findOne({ phone, _id: { $ne: user._id } });
      if (phoneTaken) throw new AppError('Phone number is already in use', 409);
      user.phone = phone;
      user.isPhoneVerified = true;
    }
  }

  if (role === 'driver' && user.role === 'driver' && !user.phone) {
    throw new AppError('Phone number is required for delivery drivers', 400);
  }

  if (role !== undefined && role !== user.role) {
    if (isSelf) assertNotSelf(req.user, user, 'demote');
    if (!TEAM_ASSIGNABLE_ROLES.includes(role)) {
      throw new AppError('Invalid role for team account', 400);
    }
    if (user.role === 'super_admin' && role !== 'super_admin') {
      await assertSuperAdminRemains(user);
    }
    user.role = role;
    if (role === 'super_admin' || role === 'driver') {
      user.permissions = [];
    }
  }

  if (useCustomPermissions !== undefined || permissions !== undefined) {
    if (isSelf) {
      throw new AppError('You cannot change your own permissions', 400);
    }
    if (user.role === 'super_admin' || user.role === 'driver') {
      user.permissions = [];
    } else {
      user.permissions = resolveStoredPermissions({
        role: user.role,
        permissions: permissions ?? user.permissions,
        useCustomPermissions: useCustomPermissions ?? (user.permissions?.length > 0),
      });
    }
  }

  if (isActive !== undefined && isActive !== user.isActive) {
    if (isSelf && isActive === false) assertNotSelf(req.user, user, 'deactivate');
    if (user.role === 'super_admin' && isActive === false) {
      await assertSuperAdminRemains(user, { activeOnly: true });
    }
    user.isActive = Boolean(isActive);
  }

  if (password) {
    if (String(password).length < 8) {
      throw new AppError('Password must be at least 8 characters', 400);
    }
    user.password = password;
  }

  await user.save();

  const changes = pickChanges(before, {
    name: user.name,
    role: user.role,
    permissions: user.permissions,
    isActive: user.isActive,
    email: user.email,
    phone: user.phone,
  }, ['name', 'role', 'permissions', 'isActive', 'email', 'phone']);

  if (changes) {
    await logAudit({
      req,
      action: 'update',
      entityType: 'staff_account',
      entityId: user._id,
      entityLabel: user.username,
      changes,
    });
  }

  res.json({ success: true, data: formatStaffAccount(user, req.user._id) });
});

export const resetStaffPassword = asyncHandler(async (req, res) => {
  assertActorIsSuperAdmin(req.user);

  const user = await User.findOne(teamMemberFilter({ _id: req.params.id })).select('+password');
  if (!user) throw new AppError('Team account not found', 404);

  const requested = typeof req.body?.password === 'string' ? req.body.password.trim() : '';
  const autoGenerated = !requested || requested.length < 8;
  const newPassword = autoGenerated ? generatePassword(14) : requested;

  user.password = newPassword;
  await user.save();

  await logAudit({
    req,
    action: 'update',
    entityType: 'staff_account',
    entityId: user._id,
    entityLabel: user.username,
    changes: { password: 'reset' },
  });

  const isDriver = user.role === 'driver';
  res.json({
    success: true,
    autoGenerated,
    credentials: {
      username: user.username,
      password: newPassword,
      portal: isDriver ? 'driver' : 'admin',
      loginPath: isDriver ? '/driver/login' : '/admin/login',
    },
  });
});

export const deleteStaffAccount = asyncHandler(async (req, res) => {
  assertActorIsSuperAdmin(req.user);

  const user = await findTeamMember(req.params.id);
  if (!user) throw new AppError('Team account not found', 404);

  assertNotSelf(req.user, user, 'delete');
  await assertSuperAdminRemains(user);

  const label = user.username;
  await user.deleteOne();

  await logAudit({
    req,
    action: 'delete',
    entityType: 'staff_account',
    entityId: user._id,
    entityLabel: label,
  });

  res.json({ success: true, message: 'Team account deleted' });
});

export const getStaffPermissionMeta = asyncHandler(async (_req, res) => {
  res.json({
    success: true,
    data: {
      allPermissions: ALL_PERMISSIONS,
      presets: ROLE_PRESET_PERMISSIONS,
      assignableRoles: TEAM_ASSIGNABLE_ROLES,
    },
  });
});
