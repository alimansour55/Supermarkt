import User from '../models/User.js';
import ChatAgentProfile, { defaultAgentSchedule } from '../models/ChatAgentProfile.js';
import SupportConversation from '../models/SupportConversation.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { AppError } from '../utils/AppError.js';
import { STAFF_ROLES } from '../constants/roles.js';
import { getLiveChatSettings } from '../services/storeSettings.service.js';
import { isAgentAvailableNow } from '../utils/chatAgents.js';
import { logAudit } from '../services/auditLog.service.js';

const isSuper = (user) => user?.role === 'super_admin';
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function normalizeSchedule(input) {
  const byDay = new Map((Array.isArray(input) ? input : []).map((e) => [Number(e?.day), e]));
  return defaultAgentSchedule().map(({ day, from, to }) => {
    const e = byDay.get(day) || {};
    return {
      day,
      enabled: e.enabled !== false && e.enabled !== 'false',
      from: TIME_RE.test(String(e.from || '')) ? e.from : from,
      to: TIME_RE.test(String(e.to || '')) ? e.to : to,
    };
  });
}

const EMPTY_STATS = { handled: 0, monthHandled: 0, rated: 0, avgRating: null, csatPercent: null };

async function loadStats(userIds) {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const rows = await SupportConversation.aggregate([
    { $match: { assignedTo: { $in: userIds } } },
    {
      $group: {
        _id: '$assignedTo',
        handled: { $sum: 1 },
        monthHandled: { $sum: { $cond: [{ $gte: ['$createdAt', monthStart] }, 1, 0] } },
        rated: { $sum: { $cond: [{ $gte: ['$rating.score', 1] }, 1, 0] } },
        sumScore: { $sum: { $ifNull: ['$rating.score', 0] } },
        satisfied: { $sum: { $cond: [{ $gte: ['$rating.score', 4] }, 1, 0] } },
      },
    },
  ]);
  return new Map(rows.map((r) => [String(r._id), {
    handled: r.handled,
    monthHandled: r.monthHandled,
    rated: r.rated,
    satisfied: r.satisfied,
    avgRating: r.rated ? Math.round((r.sumScore / r.rated) * 100) / 100 : null,
    csatPercent: r.rated ? Math.round((r.satisfied / r.rated) * 1000) / 10 : null,
  }]));
}

function formatAgent(user, profile, stats) {
  return {
    userId: user._id,
    name: user.name || user.email || '',
    email: user.email || '',
    role: user.role,
    enabled: profile?.enabled === true,
    displayName: profile?.displayName || '',
    scheduleEnabled: profile?.scheduleEnabled === true,
    schedule: profile?.schedule?.length ? profile.schedule : defaultAgentSchedule(),
    availableNow: isAgentAvailableNow(profile),
    hasWhatsapp: Boolean(profile?.whatsappNumber),
    stats: stats || EMPTY_STATS,
  };
}

async function loadScope(req) {
  const filter = isSuper(req.user) ? { role: { $in: STAFF_ROLES } } : { _id: req.user._id };
  const users = await User.find(filter).select('name email role isActive');
  const profiles = await ChatAgentProfile.find({ user: { $in: users.map((u) => u._id) } });
  const byUser = new Map(profiles.map((p) => [String(p.user), p]));
  const stats = await loadStats(users.map((u) => u._id));
  return users.map((u) => formatAgent(u, byUser.get(String(u._id)), stats.get(String(u._id))));
}

const targetsOf = (liveChat) => ({
  csatTargetPercent: liveChat.csatTargetPercent ?? 90,
  monthlyChatTarget: liveChat.monthlyChatTarget ?? 0,
});

/** Super admin: every staff member. Everyone else: only themselves. */
export const listAgents = asyncHandler(async (req, res) => {
  const [data, liveChat] = await Promise.all([loadScope(req), getLiveChatSettings()]);
  res.json({ success: true, data, targets: targetsOf(liveChat), canManage: isSuper(req.user) });
});

/** Super admin designates (or removes) a live-chat agent. */
export const setAgentEnabled = asyncHandler(async (req, res) => {
  if (!isSuper(req.user)) throw new AppError('Only a super admin can assign the live-chat role', 403);
  const target = await User.findById(req.params.userId);
  if (!target || !STAFF_ROLES.includes(target.role)) throw new AppError('Staff member not found', 404);

  const enabled = req.body?.enabled === true || req.body?.enabled === 'true';
  const profile = await ChatAgentProfile.findOneAndUpdate(
    { user: target._id },
    { $set: { enabled }, $setOnInsert: { user: target._id, schedule: defaultAgentSchedule() } },
    { new: true, upsert: true },
  );

  // Custom-permission accounts need the chat permission to open the inbox.
  if (enabled && Array.isArray(target.permissions) && target.permissions.length
    && !target.permissions.includes('support:chat')) {
    target.permissions = [...target.permissions, 'support:chat'];
    await target.save();
  }

  await logAudit({
    req,
    action: 'update',
    entityType: 'chat_agent',
    entityId: target._id,
    entityLabel: target.name || target.email,
    changes: { enabled },
  });
  res.json({ success: true, data: formatAgent(target, profile) });
});

export const getMyAgentProfile = asyncHandler(async (req, res) => {
  const profile = await ChatAgentProfile.findOne({ user: req.user._id });
  res.json({
    success: true,
    data: { ...formatAgent(req.user, profile), whatsappNumber: profile?.whatsappNumber || '' },
  });
});

/** Display name, private WhatsApp number and own working hours. */
export const updateMyAgentProfile = asyncHandler(async (req, res) => {
  const set = {};
  if (req.body?.displayName !== undefined) set.displayName = String(req.body.displayName || '').trim().slice(0, 60);
  if (req.body?.whatsappNumber !== undefined) {
    const digits = String(req.body.whatsappNumber || '').replace(/\D/g, '');
    if (digits && (digits.length < 8 || digits.length > 15)) {
      throw new AppError('Enter the WhatsApp number with country code', 400);
    }
    set.whatsappNumber = digits;
  }
  if (req.body?.scheduleEnabled !== undefined) {
    set.scheduleEnabled = req.body.scheduleEnabled === true || req.body.scheduleEnabled === 'true';
  }
  if (req.body?.schedule !== undefined) set.schedule = normalizeSchedule(req.body.schedule);

  const profile = await ChatAgentProfile.findOneAndUpdate(
    { user: req.user._id },
    { $set: set, $setOnInsert: { user: req.user._id } },
    { new: true, upsert: true },
  );
  res.json({
    success: true,
    data: { ...formatAgent(req.user, profile), whatsappNumber: profile.whatsappNumber || '' },
  });
});

export const getPerformance = asyncHandler(async (req, res) => {
  const [all, liveChat] = await Promise.all([loadScope(req), getLiveChatSettings()]);
  const agents = all.filter((a) => a.enabled || a.stats.handled > 0);

  const totals = agents.reduce((acc, a) => ({
    handled: acc.handled + a.stats.handled,
    rated: acc.rated + a.stats.rated,
    satisfied: acc.satisfied + (a.stats.satisfied || 0),
    sum: acc.sum + (a.stats.avgRating || 0) * a.stats.rated,
  }), { handled: 0, rated: 0, satisfied: 0, sum: 0 });

  res.json({
    success: true,
    data: {
      targets: targetsOf(liveChat),
      team: {
        handled: totals.handled,
        rated: totals.rated,
        avgRating: totals.rated ? Math.round((totals.sum / totals.rated) * 100) / 100 : null,
        csatPercent: totals.rated ? Math.round((totals.satisfied / totals.rated) * 1000) / 10 : null,
      },
      agents,
      scope: isSuper(req.user) ? 'team' : 'self',
    },
  });
});
