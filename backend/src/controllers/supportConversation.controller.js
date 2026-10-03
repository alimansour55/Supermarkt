import SupportConversation from '../models/SupportConversation.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { AppError } from '../utils/AppError.js';
import { logAudit } from '../services/auditLog.service.js';
import { notifySupportConversationMessage } from '../services/notification.service.js';
import { createUserNotification } from '../services/userNotification.service.js';
import { getLiveChatSettings } from '../services/storeSettings.service.js';
import { isLiveChatAvailableNow, getNextAvailableAt } from '../utils/liveChatAvailability.js';
import ChatAgentProfile from '../models/ChatAgentProfile.js';
import { getAgentAvailability, agentPublicName, pickAvailableAgent } from '../utils/chatAgents.js';
import User from '../models/User.js';
import { sendWhatsAppText, isWhatsAppConfigured } from '../services/whatsapp.service.js';

/** 'open' is a legacy alias of 'active', kept for any pre-existing dev rows. */
const ACTIVE_LIKE_STATUSES = ['active', 'open'];
const ADMIN_LIST_STATUSES = ['queued', 'active', 'pending', 'closed'];
const STAFF_SETTABLE_STATUSES = ['active', 'pending', 'closed'];

const populateAdmin = (query) => query
  .populate('user', 'name email phone')
  .populate('assignedTo', 'name email');

/** 'draft' (no conversation started yet) reports as null; legacy 'open' reports as 'active'. */
function toClientStatus(status) {
  if (status === 'draft') return null;
  if (status === 'open') return 'active';
  return status;
}

function countUnread(conversation) {
  if (!conversation.lastCustomerMessageAt) return 0;
  if (!conversation.staffReadAt) return conversation.messages.some((m) => m.authorRole === 'customer') ? 1 : 0;
  return new Date(conversation.lastCustomerMessageAt) > new Date(conversation.staffReadAt) ? 1 : 0;
}

function formatRating(conversation) {
  const score = conversation.rating?.score;
  if (!score) return null;
  return { score, comment: conversation.rating.comment || '', ratedAt: conversation.rating.ratedAt };
}

function formatListItem(conversation) {
  const messages = conversation.messages || [];
  const last = messages[messages.length - 1] || null;
  return {
    _id: conversation._id,
    status: toClientStatus(conversation.status),
    user: conversation.user
      ? { _id: conversation.user._id, name: conversation.user.name, email: conversation.user.email, phone: conversation.user.phone }
      : null,
    assignedTo: conversation.assignedTo
      ? { _id: conversation.assignedTo._id, name: conversation.assignedTo.name, email: conversation.assignedTo.email }
      : null,
    unreadCustomerMessages: countUnread(conversation),
    lastMessage: last ? { body: last.body, createdAt: last.createdAt, authorRole: last.authorRole } : null,
    lastMessageAt: conversation.lastMessageAt,
    closedAt: conversation.closedAt,
    closedBy: conversation.closedBy,
    rating: formatRating(conversation),
    createdAt: conversation.createdAt,
  };
}

async function countActiveConversations() {
  return SupportConversation.countDocuments({ status: { $in: ACTIVE_LIKE_STATUSES } });
}

async function computeQueuePosition(conversation) {
  if (conversation.status !== 'queued' || !conversation.queuedAt) return null;
  const ahead = await SupportConversation.countDocuments({
    status: 'queued',
    queuedAt: { $lt: conversation.queuedAt },
  });
  return ahead + 1;
}

/** Decide whether a conversation entering the pool right now gets a free agent slot or waits. */
async function decideEntryStatus(liveChat) {
  const capacity = liveChat?.maxConcurrentChats || 0;
  if (capacity > 0) {
    const activeCount = await countActiveConversations();
    if (activeCount >= capacity) return { status: 'queued', queuedAt: new Date() };
  }
  return { status: 'active', queuedAt: null };
}

/** Promote queued conversations into free agent slots. Call after anything that closes an active/pending chat, or after capacity increases. */
export async function promoteFromQueue() {
  const liveChat = await getLiveChatSettings();
  const capacity = liveChat?.maxConcurrentChats || 0;

  if (capacity === 0) {
    await SupportConversation.updateMany(
      { status: 'queued' },
      { $set: { status: 'active', queuedAt: null } },
    );
    return;
  }

  let activeCount = await countActiveConversations();
  // eslint-disable-next-line no-constant-condition
  while (activeCount < capacity) {
    const next = await SupportConversation.findOne({ status: 'queued' }).sort({ queuedAt: 1 });
    if (!next) break;
    next.status = 'active';
    next.queuedAt = null;
    await next.save();
    activeCount += 1;
  }
}


const RATING_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

/** Append a localisable system line ('ack' | 'joined') to the thread. */
function pushSystem(conversation, systemKey, authorName = '') {
  const body = {
    joined: `You are now chatting with ${authorName}`,
    auto_closed: 'This chat was closed because there was no reply.',
    ack: 'Thank you for contacting us — your message will be delivered to an agent.',
  }[systemKey] || '';
  conversation.messages.push({ authorRole: 'system', systemKey, authorName, body });
}

/** Public display name of a staff user (their chosen chat name, else account name). */
async function resolveAgentName(user) {
  const profile = await ChatAgentProfile.findOne({ user: user._id });
  return agentPublicName(profile, user);
}

/** Set the assignee and tell the customer who they are talking to — only when it changes. */
async function assignAgent(conversation, user) {
  if (conversation.assignedTo && String(conversation.assignedTo._id || conversation.assignedTo) === String(user._id)) return;
  const name = await resolveAgentName(user);
  conversation.assignedTo = user._id;
  conversation.assignedAgentName = name;
  pushSystem(conversation, 'joined', name);
}

/** Customers see live chat as offline when agents are designated but none is on shift. */
async function computeAvailability(liveChat) {
  const hoursOpen = isLiveChatAvailableNow(liveChat);
  if (!hoursOpen) return { available: false, nextAvailableAt: getNextAvailableAt(liveChat) };
  const gate = await getAgentAvailability();
  if (gate.designated > 0 && gate.available.length === 0) return { available: false, nextAvailableAt: null };
  return { available: true, nextAvailableAt: null };
}

/** When the customer's silence began: only meaningful if staff spoke last. */
function idleSinceOf(conversation) {
  const real = (conversation.messages || []).filter((m) => m.authorRole !== 'system');
  const last = real[real.length - 1];
  if (!last || last.authorRole !== 'staff') return null;
  const t = new Date(last.createdAt).getTime();
  const k = conversation.keepAliveAt ? new Date(conversation.keepAliveAt).getTime() : 0;
  return new Date(Math.max(t, k));
}

/** Close chats where staff spoke last and the customer stayed silent past the limit. */
export async function autoCloseIdleChats() {
  const liveChat = await getLiveChatSettings();
  const minutes = Number(liveChat?.autoCloseMinutes) || 0;
  if (minutes <= 0) return 0;
  const cutoff = Date.now() - minutes * 60 * 1000;
  const candidates = await SupportConversation.find({ status: { $in: ['active', 'open', 'pending'] } });
  let closed = 0;
  for (const conversation of candidates) {
    const since = idleSinceOf(conversation);
    if (!since || since.getTime() > cutoff) continue;
    pushSystem(conversation, 'auto_closed');
    conversation.status = 'closed';
    conversation.closedAt = new Date();
    conversation.closedBy = 'system';
    await conversation.save();
    closed += 1;
  }
  if (closed) await promoteFromQueue();
  return closed;
}

let autoCloseTimer = null;
export function startChatAutoCloseJob() {
  if (autoCloseTimer) return;
  autoCloseTimer = setInterval(() => { autoCloseIdleChats().catch(() => {}); }, 30000);
  autoCloseTimer.unref?.();
}

function customerPayload(conversation, extra = {}) {
  return {
    _id: conversation._id,
    status: toClientStatus(conversation.status),
    agentName: conversation.assignedAgentName || '',
    messages: conversation.messages,
    idleSince: idleSinceOf(conversation),
    serverNow: new Date(),
    ...extra,
  };
}

/* ------------------------------- customer ------------------------------- */

async function findOrCreateConversation(userId) {
  let conversation = await SupportConversation.findOne({
    user: userId,
    status: { $ne: 'closed' },
  }).sort({ createdAt: -1 });
  if (!conversation) {
    conversation = await SupportConversation.create({ user: userId, status: 'draft', messages: [] });
  }
  return conversation;
}

export const getMyConversation = asyncHandler(async (req, res) => {
  await autoCloseIdleChats().catch(() => {});
  const conversation = await findOrCreateConversation(req.user._id);
  const liveChat = await getLiveChatSettings();
  const { available, nextAvailableAt } = await computeAvailability(liveChat);
  const queuePosition = await computeQueuePosition(conversation);

  // A recently ended chat the customer has not rated yet (ended by them or by staff).
  const unrated = await SupportConversation.findOne({
    user: req.user._id,
    status: 'closed',
    'rating.score': null,
    closedAt: { $gte: new Date(Date.now() - RATING_WINDOW_MS) },
    'messages.authorRole': 'customer',
  }).sort({ closedAt: -1 }).select('_id closedBy assignedAgentName messages');

  res.json({
    success: true,
    data: customerPayload(conversation, {
      queuePosition,
      available,
      nextAvailableAt,
      idlePromptMinutes: Number(liveChat.idlePromptMinutes) || 0,
      autoCloseMinutes: Number(liveChat.autoCloseMinutes) || 0,
      ratingEnabled: liveChat.ratingEnabled !== false,
      pendingRating: unrated
        ? {
          conversationId: unrated._id,
          agentName: unrated.assignedAgentName || '',
          closedBy: unrated.closedBy,
          messages: unrated.messages,
        }
        : null,
    }),
  });
});

export const postMyMessage = asyncHandler(async (req, res) => {
  const body = String(req.body?.body || '').trim();
  if (!body) throw new AppError('Message body is required', 400);
  if (body.length > 2000) throw new AppError('Message is too long (max 2000 characters)', 400);

  const liveChat = await getLiveChatSettings();
  if (!liveChat.enabled) throw new AppError('Live chat is currently unavailable', 403);
  const availability = await computeAvailability(liveChat);
  if (!availability.available) throw new AppError('Live chat is not available right now', 403);

  const conversation = await findOrCreateConversation(req.user._id);
  const isFirstCustomerMessage = !conversation.messages.some((m) => m.authorRole === 'customer');

  if (conversation.status === 'draft') {
    const entry = await decideEntryStatus(liveChat);
    conversation.status = entry.status;
    conversation.queuedAt = entry.queuedAt;
  } else if (conversation.status === 'pending') {
    // Customer replied to a "waiting on you" chat — hand it back to the active queue.
    conversation.status = 'active';
  }

  const now = new Date();
  conversation.messages.push({
    author: req.user._id,
    authorName: req.user.name || '',
    authorRole: 'customer',
    body,
  });
  if (isFirstCustomerMessage) pushSystem(conversation, 'ack');
  conversation.lastMessageAt = now;
  conversation.lastCustomerMessageAt = now;
  await conversation.save();

  try {
    const populated = await conversation.populate('user', 'name phone');
    await notifySupportConversationMessage(populated, body);
  } catch { /* notification is best-effort */ }

  const queuePosition = await computeQueuePosition(conversation);
  res.json({
    success: true,
    data: customerPayload(conversation, {
      conversationId: conversation._id,
      queuePosition,
      available: true,
      nextAvailableAt: null,
    }),
  });
});

export const closeMyConversation = asyncHandler(async (req, res) => {
  const conversation = await SupportConversation.findOne({
    user: req.user._id,
    status: { $in: [...ACTIVE_LIKE_STATUSES, 'queued', 'pending'] },
  });
  if (!conversation) throw new AppError('No active conversation to close', 404);

  conversation.status = 'closed';
  conversation.closedAt = new Date();
  conversation.closedBy = 'customer';
  await conversation.save();
  await promoteFromQueue();

  res.json({
    success: true,
    data: {
      _id: conversation._id,
      status: 'closed',
      agentName: conversation.assignedAgentName || '',
      rated: false,
    },
  });
});

/** Customer's own ended conversations, newest first (with the rating they gave). */
export const getMyHistory = asyncHandler(async (req, res) => {
  const items = await SupportConversation.find({ user: req.user._id, status: 'closed', 'messages.authorRole': 'customer' })
    .sort({ closedAt: -1 })
    .limit(30);
  res.json({
    success: true,
    data: items.map((c) => ({
      _id: c._id,
      closedAt: c.closedAt,
      closedBy: c.closedBy,
      agentName: c.assignedAgentName || '',
      rating: c.rating?.score ? { score: c.rating.score, comment: c.rating.comment } : null,
      messages: c.messages,
    })),
  });
});

export const keepMyConversationAlive = asyncHandler(async (req, res) => {
  const conversation = await SupportConversation.findOne({
    user: req.user._id,
    status: { $in: [...ACTIVE_LIKE_STATUSES, 'pending'] },
  });
  if (!conversation) throw new AppError('No active conversation', 404);
  conversation.keepAliveAt = new Date();
  await conversation.save();
  res.json({ success: true, data: { idleSince: idleSinceOf(conversation) } });
});

export const rateMyConversation = asyncHandler(async (req, res) => {
  const liveChatSettings = await getLiveChatSettings();
  if (liveChatSettings.ratingEnabled === false) throw new AppError('Rating is turned off', 403);
  const score = Math.round(Number(req.body?.score));
  if (!Number.isFinite(score) || score < 1 || score > 5) throw new AppError('score must be between 1 and 5', 400);
  const conversation = await SupportConversation.findOne({
    _id: req.params.id,
    user: req.user._id,
    status: 'closed',
  });
  if (!conversation) throw new AppError('Conversation not found', 404);
  if (conversation.rating?.score) throw new AppError('This conversation was already rated', 400);

  conversation.rating = {
    score,
    comment: String(req.body?.comment || '').trim().slice(0, 500),
    ratedAt: new Date(),
  };
  await conversation.save();
  res.json({ success: true, data: { score } });
});

/* --------------------------------- admin --------------------------------- */

export const listAdminConversations = asyncHandler(async (req, res) => {
  const status = ADMIN_LIST_STATUSES.includes(req.query.status) ? req.query.status : 'active';
  const page = Math.max(1, Math.trunc(Number(req.query.page) || 1));
  const limit = Math.min(50, Math.max(1, Math.trunc(Number(req.query.limit) || 30)));
  const q = String(req.query.q || '').trim().toLowerCase();
  const dateFrom = req.query.dateFrom ? new Date(req.query.dateFrom) : null;
  const dateTo = req.query.dateTo ? new Date(`${req.query.dateTo}T23:59:59.999Z`) : null;

  const query = { status: status === 'active' ? { $in: ACTIVE_LIKE_STATUSES } : status };
  if ((dateFrom && !Number.isNaN(dateFrom.getTime())) || (dateTo && !Number.isNaN(dateTo.getTime()))) {
    query.lastMessageAt = {};
    if (dateFrom && !Number.isNaN(dateFrom.getTime())) query.lastMessageAt.$gte = dateFrom;
    if (dateTo && !Number.isNaN(dateTo.getTime())) query.lastMessageAt.$lte = dateTo;
  }

  const conversations = await populateAdmin(SupportConversation.find(query))
    .sort({ lastMessageAt: -1 })
    .limit(500);

  let items = conversations.map(formatListItem);
  if (q) {
    items = items.filter((item) => {
      const hay = [item.user?.name, item.user?.phone, item.user?.email].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }
  const total = items.length;
  const data = items.slice((page - 1) * limit, (page - 1) * limit + limit);

  res.json({
    success: true,
    data,
    pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
  });
});

export const getAdminConversationMessages = asyncHandler(async (req, res) => {
  const conversation = await populateAdmin(SupportConversation.findById(req.params.id));
  if (!conversation) throw new AppError('Conversation not found', 404);

  conversation.staffReadAt = new Date();
  await conversation.save();

  const queuePosition = await computeQueuePosition(conversation);

  res.json({
    success: true,
    data: {
      _id: conversation._id,
      status: toClientStatus(conversation.status),
      user: conversation.user,
      assignedTo: conversation.assignedTo,
      queuePosition,
      closedAt: conversation.closedAt,
      closedBy: conversation.closedBy,
      rating: formatRating(conversation),
      messages: conversation.messages,
    },
  });
});

export const postAdminMessage = asyncHandler(async (req, res) => {
  const body = String(req.body?.body || '').trim();
  if (!body) throw new AppError('Message body is required', 400);
  if (body.length > 2000) throw new AppError('Message is too long (max 2000 characters)', 400);

  const conversation = await SupportConversation.findById(req.params.id).populate('user', 'name');
  if (!conversation) throw new AppError('Conversation not found', 404);
  if (conversation.status === 'closed') {
    throw new AppError('This conversation is closed — reopen it before replying', 400);
  }

  if (conversation.status === 'queued') {
    // Staff engaging directly pulls it out of the queue immediately.
    conversation.status = 'active';
    conversation.queuedAt = null;
  }

  if (!conversation.assignedTo) await assignAgent(conversation, req.user);
  conversation.messages.push({
    author: req.user._id,
    authorName: conversation.assignedAgentName || await resolveAgentName(req.user),
    authorRole: 'staff',
    body,
  });
  conversation.lastMessageAt = new Date();
  conversation.staffReadAt = new Date();
  await conversation.save();

  if (conversation.channel === 'whatsapp' && conversation.waPhone && isWhatsAppConfigured()) {
    sendWhatsAppText(conversation.waPhone, body).catch(() => { /* best-effort */ });
  }

  try {
    await createUserNotification({
      userId: conversation.user?._id || conversation.user,
      type: 'support_chat_reply',
      titleAr: 'رد جديد من فريق الدعم',
      titleEn: 'New reply from support',
      messageAr: body.slice(0, 120),
      messageEn: body.slice(0, 120),
      link: '/',
    });
  } catch { /* best-effort */ }

  res.json({
    success: true,
    data: { _id: conversation._id, status: toClientStatus(conversation.status), messages: conversation.messages },
  });
});

export const patchAdminConversation = asyncHandler(async (req, res) => {
  const conversation = await populateAdmin(SupportConversation.findById(req.params.id));
  if (!conversation) throw new AppError('Conversation not found', 404);

  const { status, claim } = req.body || {};
  let freedSlot = false;

  if (status !== undefined) {
    if (!STAFF_SETTABLE_STATUSES.includes(status)) {
      throw new AppError(`status must be one of ${STAFF_SETTABLE_STATUSES.join(', ')}`, 400);
    }
    if (status === 'pending' && conversation.status !== 'active') {
      throw new AppError('Only an active conversation can be marked pending', 400);
    }
    if (status === 'closed' && conversation.status !== 'closed') freedSlot = true;

    conversation.status = status;
    if (status === 'closed') {
      conversation.closedAt = new Date();
      conversation.closedBy = 'staff';
    } else if (status === 'active') {
      conversation.closedAt = null;
      conversation.closedBy = null;
      conversation.queuedAt = null;
    }
  }

  if (claim) {
    await assignAgent(conversation, req.user);
    if (conversation.status === 'queued') {
      conversation.status = 'active';
      conversation.queuedAt = null;
    }
  }

  await conversation.save();
  if (freedSlot) await promoteFromQueue();

  await logAudit({
    req,
    action: 'update',
    entityType: 'support_conversation',
    entityId: conversation._id,
    entityLabel: conversation.user?.name || String(conversation.user),
    changes: { status: conversation.status, assignedTo: conversation.assignedTo },
  });

  res.json({ success: true, data: formatListItem(conversation) });
});

export const getConversationHistoryForUser = asyncHandler(async (req, res) => {
  const conversations = await SupportConversation.find({ user: req.params.userId, status: 'closed' })
    .sort({ closedAt: -1 })
    .limit(20)
    .populate('assignedTo', 'name email');

  const data = conversations.map((conversation) => {
    const messages = conversation.messages || [];
    const last = messages[messages.length - 1] || null;
    return {
      _id: conversation._id,
      closedAt: conversation.closedAt,
      closedBy: conversation.closedBy,
      assignedTo: conversation.assignedTo
        ? { _id: conversation.assignedTo._id, name: conversation.assignedTo.name }
        : null,
      messageCount: messages.length,
      rating: formatRating(conversation),
      lastMessage: last ? { body: last.body, authorRole: last.authorRole } : null,
    };
  });

  res.json({ success: true, data });
});

export async function countOpenUnreadConversations() {
  const conversations = await SupportConversation.find({
    status: { $in: ['active', 'queued', 'pending', 'open'] },
  }).select('lastCustomerMessageAt staffReadAt');
  return conversations.filter((c) => {
    if (!c.lastCustomerMessageAt) return false;
    if (!c.staffReadAt) return true;
    return new Date(c.lastCustomerMessageAt) > new Date(c.staffReadAt);
  }).length;
}

/**
 * Inbound WhatsApp text from a customer: joins/creates their conversation, routes it to an
 * available agent and pings that agent on their own (private) WhatsApp number.
 */
export async function receiveWhatsAppMessage({ phone, text }) {
  const digits = String(phone || '').replace(/\D/g, '');
  const tail = digits.slice(-10);
  const reply = (msg) => sendWhatsAppText(digits, msg).catch(() => {});
  const user = tail.length === 10
    ? await User.findOne({ phone: new RegExp(`${tail}$`), role: 'user' })
    : null;
  if (!user) {
    await reply('Please register in our app with this number first, then message us again. / سجّل في التطبيق بنفس الرقم ثم راسلنا.');
    return null;
  }

  const liveChat = await getLiveChatSettings();
  const availability = await computeAvailability(liveChat);
  if (!liveChat.enabled || !availability.available) {
    await reply(liveChat.offlineMessageEn || 'Our support team is not available right now.');
    return null;
  }

  const conversation = await findOrCreateConversation(user._id);
  const isFirst = !conversation.messages.some((m) => m.authorRole === 'customer');
  if (conversation.status === 'draft') {
    const entry = await decideEntryStatus(liveChat);
    conversation.status = entry.status;
    conversation.queuedAt = entry.queuedAt;
    conversation.channel = 'whatsapp';
  } else if (conversation.status === 'pending') {
    conversation.status = 'active';
  }
  conversation.waPhone = digits;

  const now = new Date();
  conversation.messages.push({
    author: user._id,
    authorName: user.name || '',
    authorRole: 'customer',
    body: String(text).slice(0, 2000),
  });
  if (isFirst) {
    pushSystem(conversation, 'ack');
    await reply('Thank you for contacting us — your message will be delivered to an agent. / شكراً لتواصلك، رسالتك هتتوصل لأحد الموظفين.');
  }
  conversation.lastMessageAt = now;
  conversation.lastCustomerMessageAt = now;

  let agentProfile = null;
  if (!conversation.assignedTo) {
    agentProfile = await pickAvailableAgent();
    if (agentProfile) {
      await assignAgent(conversation, agentProfile.user);
      await reply(`You are now chatting with ${conversation.assignedAgentName} / أنت الآن تتحدث مع ${conversation.assignedAgentName}`);
    }
  } else {
    agentProfile = await ChatAgentProfile.findOne({ user: conversation.assignedTo });
  }
  await conversation.save();

  try {
    await notifySupportConversationMessage(await conversation.populate('user', 'name phone'), text);
  } catch { /* best-effort */ }
  if (agentProfile?.whatsappNumber) {
    sendWhatsAppText(
      agentProfile.whatsappNumber,
      `New WhatsApp chat from ${user.name || 'a customer'}: ${String(text).slice(0, 200)}\nReply from Admin > Live chat.`,
    ).catch(() => {});
  }
  return conversation;
}
