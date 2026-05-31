import { asyncHandler } from '../middleware/errorHandler.js';
import { parsePagination, parseSort, paginationMeta } from '../utils/listQuery.js';
import AuditLog from '../models/AuditLog.js';

const AUDIT_SORT = ['createdAt', 'action', 'entityType'];

export const getAuditLogs = asyncHandler(async (req, res) => {
  const { entityType, action, actor, q } = req.query;
  const { page, limit, skip } = parsePagination(req.query);
  const filter = {};

  if (entityType) filter.entityType = entityType;
  if (action) filter.action = action;
  if (actor) filter.actor = actor;
  if (q) {
    filter.$or = [
      { entityLabel: { $regex: q, $options: 'i' } },
      { actorName: { $regex: q, $options: 'i' } },
    ];
  }

  const sort = parseSort(req.query, AUDIT_SORT, '-createdAt');

  const [logs, total] = await Promise.all([
    AuditLog.find(filter)
      .populate('actor', 'name email role')
      .sort(sort)
      .skip(skip)
      .limit(limit),
    AuditLog.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: logs,
    pagination: paginationMeta(page, limit, total),
  });
});
