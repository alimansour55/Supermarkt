import Order from '../models/Order.js';
import User from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { logAudit } from '../services/auditLog.service.js';
import { createNotification } from '../services/notification.service.js';
import { notifyDriver } from '../services/deliveryDispatch.service.js';
import { createUserNotification } from '../services/userNotification.service.js';
import { pushReturnFulfillmentHistory, updateReturnFulfillment } from '../services/orderReturn.service.js';
import { resolveReturnFulfillment } from '../constants/returnFlow.js';
import { CLOUDINARY_FOLDERS, deleteFromCloudinary, uploadFileToCloudinary } from '../utils/cloudinaryUpload.js';

const CONDITIONS = ['unopened', 'opened', 'damaged'];
/** Return pickups a driver still has to do. */
const OPEN_STEPS = ['confirmed', 'pickup_en_route'];

function isOpenPickup(ret) {
  return ret.returnMethod === 'home_pickup'
    && ret.status === 'approved'
    && OPEN_STEPS.includes(resolveReturnFulfillment(ret));
}

export function formatPickupTask(order, ret) {
  const user = order.user && typeof order.user === 'object' ? order.user : null;
  return {
    orderId: order._id,
    returnId: ret._id,
    orderNumber: order.orderNumber,
    customerName: user?.name || null,
    phone: ret.contactPhone || order.phone,
    alternatePhone: order.alternatePhone || '',
    shippingAddress: order.shippingAddress,
    item: {
      nameAr: ret.nameAr,
      nameEn: ret.nameEn,
      image: ret.image,
      quantity: ret.quantity,
    },
    reasonAr: ret.reasonAr,
    reasonEn: ret.reasonEn,
    customerNote: ret.customerNote,
    customerCondition: ret.itemCondition,
    pickupDate: ret.pickupDate,
    pickupSlotLabelAr: ret.pickupSlotLabelAr,
    pickupSlotLabelEn: ret.pickupSlotLabelEn,
    pickupSlotFrom: ret.pickupSlotFrom,
    pickupSlotTo: ret.pickupSlotTo,
    fulfillmentStatus: resolveReturnFulfillment(ret),
    pickupOutcome: ret.pickupOutcome || '',
    pickupCondition: ret.pickupCondition || '',
    pickupNote: ret.pickupNote || '',
    pickupAssignedAt: ret.pickupAssignedAt,
  };
}

async function loadDriverPickup(req) {
  const order = await Order.findOne({ _id: req.params.orderId, 'returns.pickupDriver': req.user._id })
    .populate('user', 'name');
  const ret = order?.returns.id(req.params.returnId);
  if (!order || !ret || String(ret.pickupDriver) !== String(req.user._id)) {
    throw new AppError('Pickup not found', 404);
  }
  return { order, ret };
}

/** Admin: give an approved home-pickup return to a driver (or take it back with driverId null). */
export const assignReturnPickupDriver = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  const ret = order?.returns.id(req.params.returnId);
  if (!order || !ret) throw new AppError('Return request not found', 404);
  if (ret.returnMethod !== 'home_pickup') throw new AppError('This return is a store drop-off, not a home pickup', 400);
  if (ret.status !== 'approved') throw new AppError('Approve the return before assigning a driver', 400);
  if (resolveReturnFulfillment(ret) === 'completed') throw new AppError('This return is already completed', 400);

  const previous = ret.pickupDriver ? String(ret.pickupDriver) : null;
  let next = null;
  if (req.body.driverId) {
    const driver = await User.findById(req.body.driverId).select('role name');
    if (!driver || driver.role !== 'driver') throw new AppError('Invalid delivery staff member', 400);
    next = String(driver._id);
  }

  ret.pickupDriver = next;
  ret.pickupAssignedAt = next ? new Date() : null;
  ret.pickupOutcome = '';
  await order.save();

  if (previous && previous !== next) notifyDriver(previous, order, 'unassigned');
  if (next && previous !== next) notifyDriver(next, order, 'pickup', { returnId: ret._id });

  await logAudit({
    req,
    action: 'return_pickup_assign',
    entityType: 'order',
    entityId: order._id,
    entityLabel: order.orderNumber,
    changes: { returnId: ret._id, pickupDriver: { from: previous, to: next } },
  });

  res.json({ success: true, data: { returnId: ret._id, pickupDriver: next } });
});

/** Driver: open return pickups. */
export const getDriverPickups = asyncHandler(async (req, res) => {
  const orders = await Order.find({
    returns: {
      $elemMatch: { pickupDriver: req.user._id, returnMethod: 'home_pickup', status: 'approved' },
    },
  })
    .populate('user', 'name')
    .sort({ updatedAt: -1 })
    .limit(50);

  const tasks = [];
  for (const order of orders) {
    for (const ret of order.returns) {
      if (String(ret.pickupDriver) === String(req.user._id) && isOpenPickup(ret)) {
        tasks.push(formatPickupTask(order, ret));
      }
    }
  }
  tasks.sort((a, b) => new Date(a.pickupDate || 0) - new Date(b.pickupDate || 0));
  res.json({ success: true, data: tasks });
});

export const getDriverPickup = asyncHandler(async (req, res) => {
  const { order, ret } = await loadDriverPickup(req);
  res.json({ success: true, data: formatPickupTask(order, ret) });
});

/** Driver: on the way to collect — the customer's return tracker shows "Agent on the way". */
export const startDriverPickup = asyncHandler(async (req, res) => {
  const { order, ret } = await loadDriverPickup(req);
  if (!isOpenPickup(ret)) throw new AppError('This pickup is already closed', 400);
  if (resolveReturnFulfillment(ret) !== 'pickup_en_route') {
    updateReturnFulfillment(order, ret, 'pickup_en_route', { changedBy: req.user._id });
    await order.save();
    createUserNotification({
      userId: order.user?._id || order.user,
      type: 'order_status',
      titleAr: 'المندوب في الطريق لاستلام المرتجع',
      titleEn: 'Driver on the way for your return',
      messageAr: `المندوب في طريقه لاستلام مرتجع طلب #${order.orderNumber}.`,
      messageEn: `A driver is on the way to collect the return for order #${order.orderNumber}.`,
      link: `/orders/${order._id}`,
      data: { orderId: order._id, orderNumber: order.orderNumber, returnId: ret._id },
    }).catch(() => {});
  }
  res.json({ success: true, data: formatPickupTask(order, ret) });
});

/** Driver: item collected (completes the return) or not collected (back to the store's queue). */
export const finishDriverPickup = asyncHandler(async (req, res) => {
  const { order, ret } = await loadDriverPickup(req);
  if (!isOpenPickup(ret)) {
    // Retried tap after the first one went through.
    res.json({ success: true, data: formatPickupTask(order, ret) });
    return;
  }

  const outcome = String(req.body.outcome || '');
  const note = String(req.body.note || '').trim().slice(0, 500);
  if (!['collected', 'not_collected'].includes(outcome)) throw new AppError('Invalid pickup outcome', 400);

  if (outcome === 'collected') {
    const condition = String(req.body.condition || '');
    if (!CONDITIONS.includes(condition)) throw new AppError('Record the item condition', 400);

    let photo = null;
    if (req.file) {
      const uploaded = await uploadFileToCloudinary(req.file, CLOUDINARY_FOLDERS.deliveryProofs);
      photo = { url: uploaded.url, publicId: uploaded.publicId };
    }
    try {
      ret.pickupOutcome = 'collected';
      ret.pickupOutcomeAt = new Date();
      ret.pickupCondition = condition;
      ret.pickupNote = note;
      if (photo) ret.pickupPhoto = photo;
      updateReturnFulfillment(order, ret, 'completed', { changedBy: req.user._id });
      await order.save();
    } catch (err) {
      if (photo?.publicId) await deleteFromCloudinary(photo.publicId);
      throw err;
    }

    if (condition !== ret.itemCondition) {
      createNotification({
        type: 'delivery_alert',
        titleAr: 'حالة المرتجع مختلفة',
        titleEn: 'Return condition differs',
        messageAr: `مرتجع طلب #${order.orderNumber}: العميل قال «${ret.itemCondition}» والمندوب سجّل «${condition}».`,
        messageEn: `Return on order #${order.orderNumber}: customer said "${ret.itemCondition}", driver recorded "${condition}".`,
        link: `/admin/orders?order=${order._id}`,
        data: { orderId: order._id, orderNumber: order.orderNumber },
      }).catch(() => {});
    }
  } else {
    if (note.length < 3) throw new AppError('Add a short note on why the item was not collected', 400);
    ret.pickupOutcome = 'not_collected';
    ret.pickupOutcomeAt = new Date();
    ret.pickupNote = note;
    // Back to "confirmed" so the store can reschedule; history keeps what happened.
    ret.fulfillmentStatus = 'confirmed';
    pushReturnFulfillmentHistory(ret, 'confirmed', { changedBy: req.user._id, note: `Not collected: ${note}` });
    ret.pickupDriver = null;
    await order.save();

    createNotification({
      type: 'delivery_alert',
      titleAr: 'لم يُستلم المرتجع',
      titleEn: 'Return not collected',
      messageAr: `لم يستلم المندوب مرتجع طلب #${order.orderNumber}: ${note}`,
      messageEn: `The driver could not collect the return for order #${order.orderNumber}: ${note}`,
      link: `/admin/orders?order=${order._id}`,
      data: { orderId: order._id, orderNumber: order.orderNumber },
    }).catch(() => {});
  }

  await logAudit({
    req,
    action: 'return_pickup',
    entityType: 'order',
    entityId: order._id,
    entityLabel: order.orderNumber,
    changes: { returnId: ret._id, outcome, condition: ret.pickupCondition || null, note },
  });

  res.json({ success: true, data: formatPickupTask(order, ret) });
});
