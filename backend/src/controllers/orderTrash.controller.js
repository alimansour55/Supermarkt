import Order from '../models/Order.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { formatOrder } from '../utils/formatters.js';
import { logAudit } from '../services/auditLog.service.js';
import { parsePagination, parseSort, paginationMeta } from '../utils/listQuery.js';
import { buildAdminOrderFilter, ADMIN_ORDER_SORT } from './order.controller.js';
import {
  trashOrderById,
  trashOrderSecondById,
  restoreOrderById,
  deleteOrderForeverById,
  assertBulkIds,
  runBulk,
} from '../services/orderTrash.service.js';

const TRASH_POPULATE = ['trash.bin1By', 'trash.bin2By', 'trash.restoredBy'];

export const getOrderTrash = asyncHandler(async (req, res) => {
  const stage = req.query.stage === 'bin2' ? 'bin2' : 'bin1';
  const { page, limit, skip } = parsePagination(req.query);
  const filter = { ...buildAdminOrderFilter(req.query), 'trash.stage': stage };
  const sort = parseSort(req.query, ADMIN_ORDER_SORT);

  let query = Order.find(filter).populate('user', 'name email phone');
  TRASH_POPULATE.forEach((path) => {
    query = query.populate(path, 'name email');
  });

  const [orders, total] = await Promise.all([
    query.sort(sort).skip(skip).limit(limit),
    Order.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: orders.map((order) => formatOrder(order)),
    pagination: paginationMeta(page, limit, total),
  });
});

export const trashOrder = asyncHandler(async (req, res) => {
  const order = await trashOrderById(req.params.id, req.user._id);

  await logAudit({
    req,
    action: 'trash',
    entityType: 'order',
    entityId: order._id,
    entityLabel: order.orderNumber,
    changes: { trashStage: { from: 'none', to: 'bin1' } },
  });

  res.json({ success: true, order: formatOrder(order) });
});

export const trashOrderSecond = asyncHandler(async (req, res) => {
  const order = await trashOrderSecondById(req.params.id, req.user._id);

  await logAudit({
    req,
    action: 'trash',
    entityType: 'order',
    entityId: order._id,
    entityLabel: order.orderNumber,
    changes: { trashStage: { from: 'bin1', to: 'bin2' }, purgeAt: order.trash.purgeAt },
  });

  res.json({ success: true, order: formatOrder(order) });
});

export const restoreOrder = asyncHandler(async (req, res) => {
  const { order, fromStage, toStage } = await restoreOrderById(req.params.id, req.user._id);

  await logAudit({
    req,
    action: 'restore',
    entityType: 'order',
    entityId: order._id,
    entityLabel: order.orderNumber,
    changes: { trashStage: { from: fromStage, to: toStage } },
  });

  res.json({ success: true, order: formatOrder(order) });
});

export const deleteOrderForever = asyncHandler(async (req, res) => {
  const orderNumber = await deleteOrderForeverById(req.params.id);

  await logAudit({
    req,
    action: 'delete',
    entityType: 'order',
    entityId: req.params.id,
    entityLabel: orderNumber,
    changes: { trashStage: { from: 'bin2', to: 'purged' } },
  });

  res.json({ success: true });
});

async function bulkHandler(req, res, { fn, describe }) {
  const ids = req.body.ids;
  assertBulkIds(ids);

  const { succeeded, failed } = await runBulk(ids, (id) => fn(id, req.user._id));

  if (succeeded.length) {
    await logAudit({
      req,
      action: 'bulk',
      entityType: 'order',
      entityLabel: `${succeeded.length} orders`,
      changes: { bulkAction: describe, orderIds: succeeded },
    });
  }

  res.json({ success: true, succeeded, failed });
}

export const bulkTrashOrders = asyncHandler((req, res) =>
  bulkHandler(req, res, { fn: trashOrderById, describe: 'trash' }));

export const bulkTrashOrdersSecond = asyncHandler((req, res) =>
  bulkHandler(req, res, { fn: trashOrderSecondById, describe: 'trash_second' }));

export const bulkRestoreOrders = asyncHandler((req, res) =>
  bulkHandler(req, res, { fn: (id, actorId) => restoreOrderById(id, actorId).then((r) => r.order), describe: 'restore' }));

export const bulkDeleteOrdersForever = asyncHandler((req, res) =>
  bulkHandler(req, res, { fn: (id) => deleteOrderForeverById(id), describe: 'permanent_delete' }));
