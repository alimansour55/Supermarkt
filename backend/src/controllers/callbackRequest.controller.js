import CallbackRequest, { CALLBACK_REQUEST_STATUSES, CALLBACK_REQUEST_SOURCES } from '../models/CallbackRequest.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { AppError } from '../utils/AppError.js';
import { logAudit } from '../services/auditLog.service.js';

const PHONE_PATTERN = /^[\d+\s()-]{6,20}$/;

const formatCallbackRequest = (r) => ({
  id: r._id,
  name: r.name,
  phone: r.phone,
  note: r.note || '',
  source: r.source || 'contact_page',
  status: r.status,
  adminNote: r.adminNote || '',
  handledAt: r.handledAt || null,
  createdAt: r.createdAt,
  user: r.user?._id
    ? { _id: r.user._id, name: r.user.name, phone: r.user.phone }
    : (r.user || null),
  handledBy: r.handledBy?._id ? { _id: r.handledBy._id, name: r.handledBy.name } : null,
});

const populateRequest = (query) => query
  .populate('user', 'name phone')
  .populate('handledBy', 'name');

export const createCallbackRequest = asyncHandler(async (req, res) => {
  const name = String(req.body?.name || req.user?.name || '').trim().slice(0, 120);
  const phone = String(req.body?.phone || req.user?.phone || '').trim();
  const note = String(req.body?.note || '').trim().slice(0, 500);
  const source = CALLBACK_REQUEST_SOURCES.includes(req.body?.source) ? req.body.source : 'contact_page';

  if (!name) throw new AppError('Name is required', 400);
  if (!PHONE_PATTERN.test(phone)) throw new AppError('A valid phone number is required', 400);

  const created = await CallbackRequest.create({
    user: req.user?._id || null,
    name,
    phone,
    note,
    source,
  });

  res.status(201).json({ success: true, data: formatCallbackRequest(created) });
});

export const listAdminCallbackRequests = asyncHandler(async (req, res) => {
  const status = CALLBACK_REQUEST_STATUSES.includes(req.query.status) ? req.query.status : undefined;
  const page = Math.max(1, Math.trunc(Number(req.query.page) || 1));
  const limit = Math.min(50, Math.max(1, Math.trunc(Number(req.query.limit) || 20)));
  const filter = status ? { status } : {};

  const [items, total, counts] = await Promise.all([
    populateRequest(CallbackRequest.find(filter))
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    CallbackRequest.countDocuments(filter),
    CallbackRequest.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
  ]);

  const stats = Object.fromEntries(CALLBACK_REQUEST_STATUSES.map((s) => [s, 0]));
  counts.forEach((c) => { stats[c._id] = c.count; });

  res.json({
    success: true,
    data: items.map(formatCallbackRequest),
    stats,
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  });
});

export const updateAdminCallbackRequest = asyncHandler(async (req, res) => {
  const request = await CallbackRequest.findById(req.params.id);
  if (!request) throw new AppError('Callback request not found', 404);

  const status = String(req.body?.status || '').trim();
  if (!CALLBACK_REQUEST_STATUSES.includes(status)) {
    throw new AppError(`status must be one of ${CALLBACK_REQUEST_STATUSES.join(', ')}`, 400);
  }

  request.status = status;
  if (req.body?.adminNote !== undefined) {
    request.adminNote = String(req.body.adminNote || '').trim().slice(0, 500);
  }
  if (status === 'pending') {
    request.handledBy = null;
    request.handledAt = null;
  } else {
    request.handledBy = req.user._id;
    request.handledAt = new Date();
  }
  await request.save();

  await logAudit({
    req,
    action: 'update',
    entityType: 'callback_request',
    entityId: request._id,
    entityLabel: request.phone,
    changes: { status },
  });

  res.json({ success: true, data: formatCallbackRequest(await populateRequest(CallbackRequest.findById(request._id))) });
});

export async function countPendingCallbackRequests() {
  return CallbackRequest.countDocuments({ status: 'pending' });
}
