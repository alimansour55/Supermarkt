import Order from '../models/Order.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { formatOrderResponse } from './orderManagement.controller.js';
import { parsePagination, paginationMeta } from '../utils/listQuery.js';
import { logAudit } from '../services/auditLog.service.js';
import { resolveReturnFulfillment } from '../constants/returnFlow.js';
import { validateReturnRejectNote } from '../constants/returnRejectReasons.js';
import {
  applyApprovedReturn,
  approveReturnRequest,
  reopenReturnRequest,
  assertCustomerCanRequestReturn,
  buildReturnPayload,
  getOrderDeliveredAt,
  getReturnDeadline,
  isWithinReturnWindow,
  persistOrderDeliveredAtIfNeeded,
  updateReturnFulfillment,
} from '../services/orderReturn.service.js';

async function loadOrderForCustomer(id, userId) {
  const order = await Order.findOne({ _id: id, user: userId });
  if (!order) throw new AppError('Order not found', 404);
  return order;
}

async function loadOrderForAdmin(id) {
  const order = await Order.findById(id).populate('user', 'name email phone');
  if (!order) throw new AppError('Order not found', 404);
  return order;
}

function formatReturnRow(order, ret) {
  const deliveredAt = getOrderDeliveredAt(order);
  const returnDeadline = getReturnDeadline(deliveredAt);
  const retObj = ret.toObject?.() ?? ret;
  const row = {
    ...retObj,
    _id: retObj._id || ret._id,
    orderId: order._id,
    orderNumber: order.orderNumber,
    orderStatus: order.orderStatus,
    customerName: order.user?.name || order.phone,
    customerEmail: order.user?.email || '',
    customerPhone: order.phone,
    orderTotal: order.total,
    paymentMethod: order.paymentMethod,
    deliveredAt,
    returnDeadline,
    withinReturnWindow: isWithinReturnWindow(order),
  };
  return {
    ...row,
    _id: String(row._id),
    orderId: String(row.orderId),
    product: row.product ? String(row.product) : null,
    requestedBy: row.requestedBy ? String(row.requestedBy) : null,
    reviewedBy: row.reviewedBy ? String(row.reviewedBy) : null,
    status: row.status || 'pending',
    fulfillmentStatus: resolveReturnFulfillment(ret),
  };
}

function buildReturnStats(rows) {
  const stats = { pending: 0, approved: 0, rejected: 0, all: rows.length };
  rows.forEach((row) => {
    if (stats[row.status] != null) stats[row.status] += 1;
  });
  return stats;
}

export const requestCustomerReturn = asyncHandler(async (req, res) => {
  const order = await loadOrderForCustomer(req.params.id, req.user._id);
  await persistOrderDeliveredAtIfNeeded(order);
  assertCustomerCanRequestReturn(order);

  const payload = buildReturnPayload(order, req.body, {
    actor: req.user,
    role: 'customer',
    autoApprove: false,
  });

  order.returns.push(payload);
  await order.save();

  res.json({ success: true, order: await formatOrderResponse(order) });
});

export const requestAdminReturn = asyncHandler(async (req, res) => {
  const order = await loadOrderForAdmin(req.params.id);
  if (order.orderStatus !== 'delivered') {
    throw new AppError('Returns can only be recorded for delivered orders', 400);
  }
  const { autoApprove = true } = req.body;

  const payload = buildReturnPayload(order, req.body, {
    actor: req.user,
    role: 'staff',
    autoApprove: Boolean(autoApprove),
  });

  order.returns.push(payload);
  const created = order.returns[order.returns.length - 1];

  if (created.status === 'approved') {
    await applyApprovedReturn(order, created);
  }

  await order.save();

  await logAudit({
    req,
    action: 'return_request',
    entityType: 'order',
    entityId: order._id,
    entityLabel: order.orderNumber,
    changes: { returnId: created._id, status: created.status },
  });

  res.json({ success: true, order: await formatOrderResponse(order, { isStaff: true }) });
});

export const updateAdminReturnFulfillment = asyncHandler(async (req, res) => {
  const order = await loadOrderForAdmin(req.params.id);
  const ret = order.returns.id(req.params.returnId);

  if (!ret) throw new AppError('Return request not found', 404);

  const fulfillmentStatus = String(req.body?.fulfillmentStatus || '').trim();
  if (!fulfillmentStatus) {
    throw new AppError('fulfillmentStatus is required', 400);
  }

  updateReturnFulfillment(order, ret, fulfillmentStatus, { changedBy: req.user._id });
  await order.save();

  await logAudit({
    req,
    action: 'return_fulfillment',
    entityType: 'order',
    entityId: order._id,
    entityLabel: order.orderNumber,
    changes: { returnId: ret._id, fulfillmentStatus, orderStatus: order.orderStatus },
  });

  res.json({ success: true, order: await formatOrderResponse(order, { isStaff: true }) });
});

export const patchAdminReturn = asyncHandler(async (req, res) => {
  const order = await loadOrderForAdmin(req.params.id);
  const ret = order.returns.id(req.params.returnId);

  if (!ret) throw new AppError('Return request not found', 404);

  const { action, adminNote } = req.body;

  if (!action) {
    throw new AppError('action is required (approve, reject, or reopen)', 400);
  }

  let auditAction;

  if (ret.status === 'pending') {
    if (!['approve', 'reject'].includes(action)) {
      throw new AppError('action must be approve or reject', 400);
    }
    if (action === 'reject') {
      const rejectNote = validateReturnRejectNote(adminNote);
      if (!rejectNote.ok) {
        throw new AppError(rejectNote.message, 400);
      }
      ret.status = 'rejected';
      ret.reviewedBy = req.user._id;
      ret.reviewedAt = new Date();
      ret.adminNote = rejectNote.adminNote;
      auditAction = 'return_reject';
    } else {
      approveReturnRequest(ret, { changedBy: req.user._id, adminNote });
      await applyApprovedReturn(order, ret);
      auditAction = 'return_approve';
    }
  } else if (ret.status === 'rejected') {
    if (!['approve', 'reject', 'reopen'].includes(action)) {
      throw new AppError('For rejected returns use approve, reject (update reason), or reopen', 400);
    }
    if (action === 'reject') {
      const rejectNote = validateReturnRejectNote(adminNote);
      if (!rejectNote.ok) {
        throw new AppError(rejectNote.message, 400);
      }
      ret.adminNote = rejectNote.adminNote;
      ret.reviewedBy = req.user._id;
      ret.reviewedAt = new Date();
      auditAction = 'return_reject_revise';
    } else if (action === 'approve') {
      approveReturnRequest(ret, { changedBy: req.user._id, adminNote });
      await applyApprovedReturn(order, ret);
      auditAction = 'return_overturn_approve';
    } else {
      reopenReturnRequest(ret);
      auditAction = 'return_reopen';
    }
  } else {
    throw new AppError('Only pending or rejected returns can be changed this way', 400);
  }

  await order.save();

  await logAudit({
    req,
    action: auditAction,
    entityType: 'order',
    entityId: order._id,
    entityLabel: order.orderNumber,
    changes: {
      returnId: ret._id,
      status: ret.status,
      fulfillmentStatus: ret.fulfillmentStatus,
      refundAmount: ret.refundAmount,
      orderStatus: order.orderStatus,
    },
  });

  res.json({ success: true, order: await formatOrderResponse(order, { isStaff: true }) });
});

/** @deprecated use patchAdminReturn */
export const reviewAdminReturn = patchAdminReturn;

export const getAdminReturns = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const statusFilter = (req.query.status || '').trim();
  const q = (req.query.q || '').trim().toLowerCase();
  const sortOrder = req.query.order === 'asc' ? 1 : -1;

  const orders = await Order.find({
    returns: { $exists: true, $not: { $size: 0 } },
  })
    .populate('user', 'name email phone')
    .sort({ updatedAt: -1 })
    .limit(800);

  const allRows = [];
  orders.forEach((order) => {
    (order.returns || []).forEach((ret) => {
      try {
        allRows.push(formatReturnRow(order, ret));
      } catch (err) {
        console.error('formatReturnRow failed:', order.orderNumber, err.message);
      }
    });
  });

  let rows = allRows;
  if (statusFilter) {
    rows = rows.filter((row) => row.status === statusFilter);
  }
  if (q) {
    rows = rows.filter((row) => {
      const hay = [
        row.orderNumber,
        row.customerName,
        row.customerPhone,
        row.nameAr,
        row.nameEn,
        row.sku,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }

  rows.sort((a, b) => sortOrder * (new Date(b.requestedAt || b.createdAt) - new Date(a.requestedAt || a.createdAt)));

  const stats = buildReturnStats(allRows);

  const total = rows.length;
  const data = rows.slice(skip, skip + limit);

  res.json({
    success: true,
    data,
    stats,
    pagination: paginationMeta(page, limit, total),
  });
});

export async function countPendingOrderReturns() {
  const orders = await Order.find({ 'returns.status': 'pending' }).select('returns').limit(2000);
  let count = 0;
  orders.forEach((o) => {
    count += (o.returns || []).filter((r) => r.status === 'pending').length;
  });
  return count;
}
