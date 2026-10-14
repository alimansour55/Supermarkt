import User from '../models/User.js';
import Order from '../models/Order.js';
import WalletTransaction from '../models/WalletTransaction.js';
import PushDevice from '../models/PushDevice.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { parsePagination, parseSort, paginationMeta } from '../utils/listQuery.js';
import { STAFF_ROLES, canAssignRole } from '../constants/roles.js';
import { logAudit, pickChanges } from '../services/auditLog.service.js';
import { normalizePhone, formatPhoneDisplay } from '../utils/phone.js';
import { escapeRegex } from '../utils/escapeRegex.js';
import { SELLER_ROLES } from '../constants/marketplace.js';
import { toCsv, sendCsv } from '../utils/csvExport.js';
import AuditLog from '../models/AuditLog.js';

const ADMIN_USER_SORT = ['createdAt', 'name', 'email', 'lastLoginAt', 'pointsBalance', 'walletBalance'];

/** Sort keys computed from orders — sorting by them needs the per-user rollup before paging. */
const ORDER_STATS_SORT = ['orderCount', 'totalSpent', 'lastOrderAt'];

const JOINED_WITHIN_DAYS = { 7: 7, 30: 30, 90: 90 };

const DAY_MS = 24 * 60 * 60 * 1000;

/** Orders that never turned into money — left out of a customer's lifetime spend. */
const NON_SPEND_ORDER_STATUSES = ['cancelled', 'returned', 'delivery_failed'];

/** Roles the customers page may switch between; staff roles live on the Admin team page. */
const CUSTOMER_PAGE_ROLES = ['user', 'driver'];

/** Anonymized (deleted) customers stay in the database for order history but leave the admin list. */
const NOT_DELETED = { deletedAt: null };

/** Ready-made customer groups for the list's segment chips. */
export const USER_SEGMENTS = {
  /** Lifetime spend at or above this many EGP. */
  vip: { minSpend: 5000 },
  /** Signed up but never ordered. */
  no_orders: {},
  /** Ordered before, but nothing in this many days. */
  at_risk: { idleDays: 60 },
  wallet: {},
  review_blocked: {},
};

/** Never send secrets or bulky history to the list/export. */
const LIST_HIDDEN_FIELDS = {
  password: 0,
  phoneOtpHash: 0,
  phoneOtpExpires: 0,
  phoneOtpAttempts: 0,
  loginCodeHash: 0,
  loginCodeExpires: 0,
  loginCodeAttempts: 0,
  loginHistory: 0,
  emailVerificationToken: 0,
  emailVerificationExpires: 0,
  resetPasswordToken: 0,
  resetPasswordExpires: 0,
  sessionVersion: 0,
  pointsHistory: 0,
  favorites: 0,
  addresses: 0,
};

/**
 * Search conditions for the admin user list. Text is matched literally, and a
 * typed phone number (01…, +20…, or a partial run of digits) matches the
 * stored +20 form.
 */
export function buildUserSearchConditions(q) {
  const text = String(q || '').trim();
  if (!text) return null;

  const literal = { $regex: escapeRegex(text), $options: 'i' };
  const conditions = [{ name: literal }, { email: literal }, { phone: literal }];

  const fullPhone = normalizePhone(text);
  if (fullPhone) {
    conditions.push({ phone: fullPhone });
  } else if (/^[\d\s+()-]+$/.test(text)) {
    // Partial number: drop the local leading 0 / country code so "0100" finds "+20100…".
    const digits = text.replace(/\D/g, '').replace(/^20/, '').replace(/^0/, '');
    if (digits.length >= 3) conditions.push({ phone: { $regex: escapeRegex(digits) } });
  }
  return conditions;
}

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
    noOrders: extra.noOrders ?? 0,
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
    filter.createdAt = { $gte: new Date(Date.now() - days * DAY_MS) };
  }
}

/** Mongo filter on User fields shared by the list and the CSV export. */
export function buildUserListFilter(query) {
  const { role, q, accountType, segment } = query;
  const filter = { ...NOT_DELETED };

  if (role) filter.role = String(role);
  else applyAccountTypeFilter(filter, accountType);

  applyUserListFilters(filter, query);

  // Order-based segments are about shoppers, so they narrow to customers.
  if (['vip', 'no_orders', 'at_risk'].includes(segment) && !role && !accountType) filter.role = 'user';
  if (segment === 'wallet') filter.walletBalance = { $gt: 0 };
  if (segment === 'review_blocked') filter.reviewBlocked = true;

  const searchConditions = buildUserSearchConditions(q);
  if (searchConditions) filter.$or = searchConditions;
  return filter;
}

/** Conditions on the computed order stats for order-based segments, or null. */
export function buildSegmentStatsMatch(segment, now = Date.now()) {
  if (segment === 'vip') return { totalSpent: { $gte: USER_SEGMENTS.vip.minSpend } };
  if (segment === 'no_orders') return { orderCount: 0 };
  if (segment === 'at_risk') {
    return {
      orderCount: { $gt: 0 },
      lastOrderAt: { $lt: new Date(now - USER_SEGMENTS.at_risk.idleDays * DAY_MS) },
    };
  }
  return null;
}

/** Pipeline stages that attach orderCount / totalSpent / lastOrderAt / avgOrderValue to each user. */
function orderStatsStages() {
  return [
    {
      $lookup: {
        from: Order.collection.name,
        localField: '_id',
        foreignField: 'user',
        pipeline: [
          {
            $group: {
              _id: null,
              orders: { $sum: 1 },
              paidOrders: {
                $sum: { $cond: [{ $in: ['$orderStatus', NON_SPEND_ORDER_STATUSES] }, 0, 1] },
              },
              spent: {
                $sum: { $cond: [{ $in: ['$orderStatus', NON_SPEND_ORDER_STATUSES] }, 0, '$total'] },
              },
              lastOrderAt: { $max: '$createdAt' },
            },
          },
        ],
        as: 'orderStats',
      },
    },
    {
      $addFields: {
        orderCount: { $ifNull: [{ $first: '$orderStats.orders' }, 0] },
        totalSpent: { $round: [{ $ifNull: [{ $first: '$orderStats.spent' }, 0] }, 2] },
        lastOrderAt: { $ifNull: [{ $first: '$orderStats.lastOrderAt' }, null] },
        avgOrderValue: {
          $let: {
            vars: {
              paid: { $ifNull: [{ $first: '$orderStats.paidOrders' }, 0] },
              spent: { $ifNull: [{ $first: '$orderStats.spent' }, 0] },
            },
            in: { $cond: [{ $gt: ['$$paid', 0] }, { $round: [{ $divide: ['$$spent', '$$paid'] }, 2] }, 0] },
          },
        },
      },
    },
    { $project: { orderStats: 0 } },
  ];
}

function parseUserSort(query) {
  const order = query.order === 'asc' ? 1 : -1;
  if (ORDER_STATS_SORT.includes(query.sort)) return { [query.sort]: order, _id: order };
  return { ...parseSort(query, ADMIN_USER_SORT), _id: order };
}

/**
 * One page of users with order stats. When sorting by an order stat or using an
 * order-based segment, stats are computed before paging; otherwise only the
 * page's users get them.
 */
export async function queryAdminUsers(query, { skip = 0, limit = 20 } = {}) {
  const filter = buildUserListFilter(query);
  const sort = parseUserSort(query);
  const statsMatch = buildSegmentStatsMatch(query.segment);
  const statsFirst = Boolean(statsMatch) || ORDER_STATS_SORT.includes(query.sort);

  if (!statsFirst) {
    const [rows, total] = await Promise.all([
      User.aggregate([
        { $match: filter },
        { $sort: sort },
        { $skip: skip },
        { $limit: limit },
        { $project: LIST_HIDDEN_FIELDS },
        ...orderStatsStages(),
      ]),
      User.countDocuments(filter),
    ]);
    return { rows, total };
  }

  const [result] = await User.aggregate([
    { $match: filter },
    { $project: LIST_HIDDEN_FIELDS },
    ...orderStatsStages(),
    ...(statsMatch ? [{ $match: statsMatch }] : []),
    {
      $facet: {
        rows: [{ $sort: sort }, { $skip: skip }, { $limit: limit }],
        total: [{ $count: 'n' }],
      },
    },
  ]);
  return { rows: result.rows, total: result.total[0]?.n ?? 0 };
}

export const getAdminUsers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const { rows, total } = await queryAdminUsers(req.query, { skip, limit });

  res.json({
    success: true,
    data: rows,
    pagination: paginationMeta(page, limit, total),
  });
});

export const getAdminUsersSummary = asyncHandler(async (req, res) => {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [roleAgg, suspended, newThisMonth, verified, buyerIds] = await Promise.all([
    User.aggregate([{ $match: NOT_DELETED }, { $group: { _id: '$role', count: { $sum: 1 } } }]),
    User.countDocuments({ ...NOT_DELETED, isActive: false }),
    User.countDocuments({ ...NOT_DELETED, createdAt: { $gte: startOfMonth } }),
    User.countDocuments({ ...NOT_DELETED, isPhoneVerified: true }),
    Order.distinct('user'),
  ]);
  const noOrders = await User.countDocuments({ ...NOT_DELETED, role: 'user', _id: { $nin: buyerIds } });

  res.json({
    success: true,
    data: buildUserSummary(roleAgg, {
      suspended, newThisMonth, verified, noOrders,
    }),
  });
});

const EXPORT_MAX_ROWS = 5000;

/** Spreadsheet apps run cells starting with = + - @ as formulas — neutralize them. */
function csvSafe(value) {
  if (value == null) return '';
  const s = String(value);
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}

const isoDay = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');

export const exportAdminUsers = asyncHandler(async (req, res) => {
  const { rows } = await queryAdminUsers(req.query, { skip: 0, limit: EXPORT_MAX_ROWS });

  const csv = toCsv(rows, [
    { header: 'Name', value: (u) => csvSafe(u.name) },
    { header: 'Phone', value: (u) => csvSafe(formatPhoneDisplay(u.phone) || '') },
    { header: 'Email', value: (u) => csvSafe(u.email) },
    { header: 'Role', value: (u) => u.role },
    { header: 'Status', value: (u) => (u.isActive === false ? 'suspended' : 'active') },
    { header: 'Phone verified', value: (u) => (u.isPhoneVerified ? 'yes' : 'no') },
    { header: 'Orders', value: (u) => u.orderCount },
    { header: 'Total spent (EGP)', value: (u) => u.totalSpent },
    { header: 'Average order (EGP)', value: (u) => u.avgOrderValue },
    { header: 'Last order', value: (u) => isoDay(u.lastOrderAt) },
    { header: 'Loyalty points', value: (u) => u.pointsBalance || 0 },
    { header: 'Wallet (EGP)', value: (u) => u.walletBalance || 0 },
    { header: 'Last active', value: (u) => isoDay(u.lastLoginAt) },
    { header: 'Joined', value: (u) => isoDay(u.createdAt) },
  ]);

  await logAudit({
    req,
    action: 'export',
    entityType: 'user',
    entityLabel: `${rows.length} users`,
    changes: { filters: req.query },
  });

  sendCsv(res, `customers-${isoDay(new Date())}.csv`, csv);
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

const BULK_USER_ACTIONS = ['delete', 'suspend', 'activate', 'signout', 'verify_phone'];

/** Removing accounts is owner-only; every other change needs `users:write`. */
function assertCanDeleteUsers(actor) {
  if (actor.role !== 'super_admin') {
    throw new AppError('Only the store owner can delete customer accounts', 403);
  }
}

/** Suspending signs the account out everywhere: old tokens carry the previous session version. */
function suspensionUpdate(isActive) {
  return isActive ? { isActive: true } : { isActive: false, $inc: { sessionVersion: 1 } };
}

/**
 * Remove a customer/driver account. Accounts with no order or wallet history are
 * deleted outright; the rest are anonymized so orders, refunds and the wallet
 * ledger keep a valid owner. A positive wallet balance blocks removal — that
 * money is owed to the customer.
 * @returns {Promise<'deleted'|'anonymized'>}
 */
export async function removeCustomerAccount(user) {
  if (SELLER_ROLES.includes(user.role)) {
    throw new AppError('Seller logins are managed on the Sellers page', 400);
  }
  if ((user.walletBalance || 0) > 0) {
    throw new AppError(
      `${user.name} still has ${user.walletBalance} EGP in their wallet — refund or adjust it to 0 before deleting`,
      400,
    );
  }

  const [hasOrders, hasWalletHistory] = await Promise.all([
    Order.exists({ user: user._id }),
    WalletTransaction.exists({ user: user._id }),
  ]);

  if (!hasOrders && !hasWalletHistory) {
    await user.deleteOne();
    return 'deleted';
  }

  user.name = 'Deleted customer';
  user.phone = undefined;
  user.email = undefined;
  user.username = undefined;
  user.password = undefined;
  user.addresses = [];
  user.favorites = [];
  user.isPhoneVerified = false;
  user.isEmailVerified = false;
  user.mfaEnabled = false;
  user.isActive = false;
  user.sessionVersion = (user.sessionVersion || 0) + 1;
  user.deletedAt = new Date();
  await user.save();
  await PushDevice.deleteMany({ user: user._id });
  return 'anonymized';
}

export const bulkAdminUsers = asyncHandler(async (req, res) => {
  const { ids, action } = req.body;
  if (!Array.isArray(ids) || !ids.length) {
    throw new AppError('ids array is required', 400);
  }
  if (!BULK_USER_ACTIONS.includes(action)) throw new AppError('Invalid action', 400);

  const users = await User.find({ _id: { $in: ids }, ...NOT_DELETED });
  if (users.some((u) => STAFF_ROLES.includes(u.role))) {
    throw new AppError('Staff accounts cannot be changed in bulk', 400);
  }
  if (ids.some((id) => id.toString() === req.user._id.toString())) {
    throw new AppError('You cannot include your own account in a bulk action', 400);
  }
  if (action === 'delete') assertCanDeleteUsers(req.user);

  const result = { affected: 0, deleted: 0, anonymized: 0, skipped: [] };

  if (action === 'delete') {
    for (const user of users) {
      try {
        const outcome = await removeCustomerAccount(user);
        result[outcome] += 1;
        result.affected += 1;
      } catch (err) {
        if (!(err instanceof AppError)) throw err;
        result.skipped.push({ id: user._id, name: user.name, reason: err.message });
      }
    }
  } else if (action === 'signout') {
    ({ modifiedCount: result.affected } = await User.updateMany(
      { _id: { $in: users.map((u) => u._id) }, role: { $nin: STAFF_ROLES } },
      { $inc: { sessionVersion: 1 } },
    ));
  } else if (action === 'verify_phone') {
    ({ modifiedCount: result.affected } = await User.updateMany(
      {
        _id: { $in: users.map((u) => u._id) },
        role: { $nin: STAFF_ROLES },
        phone: { $type: 'string', $gt: '' },
        isPhoneVerified: { $ne: true },
      },
      { isPhoneVerified: true },
    ));
  } else {
    const activate = action === 'activate';
    // Only touch accounts whose status actually changes, so a repeat suspend doesn't sign users out again.
    const scope = {
      _id: { $in: users.map((u) => u._id) },
      role: { $nin: STAFF_ROLES },
      isActive: activate ? false : { $ne: false },
    };
    ({ modifiedCount: result.affected } = await User.updateMany(scope, suspensionUpdate(activate)));
  }

  await logAudit({
    req,
    action: 'bulk',
    entityType: 'user',
    entityLabel: `${ids.length} users`,
    changes: {
      action,
      ids,
      ...(action === 'delete' && {
        deleted: result.deleted,
        anonymized: result.anonymized,
        skipped: result.skipped.map((s) => s.id),
      }),
    },
  });

  res.json({ success: true, ...result });
});

const RECENT_ORDERS_LIMIT = 5;
const ACTIVITY_LIMIT = 15;

export const getAdminUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select('-password');
  if (!user) throw new AppError('User not found', 404);

  const [statsRows, recentOrders, activity] = await Promise.all([
    User.aggregate([{ $match: { _id: user._id } }, { $project: { _id: 1 } }, ...orderStatsStages()]),
    Order.find({ user: user._id })
      .sort({ createdAt: -1 })
      .limit(RECENT_ORDERS_LIMIT)
      .select('orderNumber total orderStatus paymentStatus createdAt')
      .lean(),
    AuditLog.find({ entityType: 'user', entityId: user._id })
      .sort({ createdAt: -1 })
      .limit(ACTIVITY_LIMIT)
      .select('action actorName actorRole changes createdAt')
      .lean(),
  ]);
  const { _id, ...stats } = statsRows[0] || {};

  res.json({
    success: true,
    data: {
      ...user.toObject(),
      orderCount: stats.orderCount ?? 0,
      totalSpent: stats.totalSpent ?? 0,
      avgOrderValue: stats.avgOrderValue ?? 0,
      lastOrderAt: stats.lastOrderAt ?? null,
      recentOrders,
      activity,
    },
  });
});

export const updateAdminUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user || user.deletedAt) throw new AppError('User not found', 404);

  const isSelf = user._id.toString() === req.user._id.toString();
  const before = {
    name: user.name,
    phone: user.phone,
    role: user.role,
    isActive: user.isActive,
    isPhoneVerified: user.isPhoneVerified,
    reviewBlocked: user.reviewBlocked,
    adminNote: user.adminNote,
  };
  const {
    name, phone, role, isEmailVerified, isActive, isPhoneVerified, reviewBlocked, adminNote,
  } = req.body;

  if (role !== undefined && role !== user.role) {
    if (!CUSTOMER_PAGE_ROLES.includes(user.role) || !CUSTOMER_PAGE_ROLES.includes(role)) {
      throw new AppError('Staff roles are managed on the Admin team page', 400);
    }
    if (!canAssignRole(req.user.role, role)) {
      throw new AppError('You cannot assign this role', 403);
    }
    if (isSelf) {
      throw new AppError('You cannot change your own role', 400);
    }
    user.role = role;
  }

  if (isActive !== undefined && Boolean(isActive) !== (user.isActive !== false)) {
    if (isSelf) throw new AppError('You cannot change your own account status', 400);
    if (!isActive && user.role === 'super_admin') {
      await assertNotLastSuperAdmin(user._id);
    }
    user.isActive = Boolean(isActive);
    if (!user.isActive) user.sessionVersion = (user.sessionVersion || 0) + 1;
  }

  if (name !== undefined) {
    const trimmed = String(name).trim();
    if (trimmed.length < 2 || trimmed.length > 100) {
      throw new AppError('Name must be 2–100 characters', 400);
    }
    user.name = trimmed;
  }

  if (phone !== undefined && phone !== user.phone) {
    const normalized = normalizePhone(String(phone));
    if (!normalized) throw new AppError('Invalid Egyptian mobile number (e.g. 01xxxxxxxxx)', 400);
    if (normalized !== user.phone) {
      const taken = await User.exists({ phone: normalized, _id: { $ne: user._id } });
      if (taken) throw new AppError('Another account already uses this phone number', 409);
      user.phone = normalized;
      // The new number hasn't been confirmed by SMS yet unless the admin says so explicitly.
      if (isPhoneVerified === undefined) user.isPhoneVerified = false;
    }
  }

  if (isEmailVerified !== undefined) user.isEmailVerified = Boolean(isEmailVerified);
  if (isPhoneVerified !== undefined) user.isPhoneVerified = Boolean(isPhoneVerified);
  if (reviewBlocked !== undefined) user.reviewBlocked = Boolean(reviewBlocked);
  if (adminNote !== undefined) {
    const note = String(adminNote ?? '').trim();
    if (note.length > 1000) throw new AppError('Note must be 1000 characters or fewer', 400);
    user.adminNote = note;
  }

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
      adminNote: user.adminNote,
    },
    ['name', 'phone', 'role', 'isActive', 'isPhoneVerified', 'reviewBlocked', 'adminNote'],
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
      adminNote: user.adminNote,
    },
  });
});

export const deleteAdminUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user || user.deletedAt) throw new AppError('User not found', 404);
  if (STAFF_ROLES.includes(user.role)) {
    throw new AppError('Cannot delete staff account', 400);
  }
  if (user._id.toString() === req.user._id.toString()) {
    throw new AppError('You cannot delete your own account', 400);
  }
  assertCanDeleteUsers(req.user);

  const label = user.name;
  const outcome = await removeCustomerAccount(user);

  await logAudit({
    req,
    action: 'delete',
    entityType: 'user',
    entityId: user._id,
    entityLabel: label,
    changes: { outcome },
  });

  res.json({
    success: true,
    outcome,
    message: outcome === 'anonymized'
      ? 'Personal details erased — order history kept'
      : 'User deleted',
  });
});
