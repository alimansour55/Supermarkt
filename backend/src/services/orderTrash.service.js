import Order from '../models/Order.js';
import { AppError } from '../utils/AppError.js';

/** Only orders that have reached a final state can be recycled — an active order
 * (pending / preparing / out for delivery) must be cancelled or completed first,
 * so it can never silently disappear from the operational views while still live. */
export const TRASHABLE_STATUSES = ['delivered', 'delivery_failed', 'cancelled', 'returned'];

export const SECOND_BIN_RETENTION_DAYS = 30;

export const MAX_BULK_SIZE = 200;

export async function trashOrderById(orderId, actorId) {
  const order = await Order.findById(orderId);
  if (!order) throw new AppError('Order not found', 404);

  if (order.trash?.stage && order.trash.stage !== 'none') {
    throw new AppError('Order is already in the recycle bin', 400);
  }
  if (!TRASHABLE_STATUSES.includes(order.orderStatus)) {
    throw new AppError(
      'Only delivered, cancelled, failed or returned orders can be moved to the recycle bin',
      400,
    );
  }

  order.trash = {
    stage: 'bin1',
    bin1At: new Date(),
    bin1By: actorId,
    bin2At: null,
    bin2By: null,
    purgeAt: null,
    restoredAt: null,
    restoredBy: null,
  };
  await order.save();
  return order;
}

export async function trashOrderSecondById(orderId, actorId) {
  const order = await Order.findById(orderId);
  if (!order) throw new AppError('Order not found', 404);

  if (order.trash?.stage !== 'bin1') {
    throw new AppError('Order must be in the first recycle bin', 400);
  }

  order.trash.stage = 'bin2';
  order.trash.bin2At = new Date();
  order.trash.bin2By = actorId;
  order.trash.purgeAt = new Date(Date.now() + SECOND_BIN_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  await order.save();
  return order;
}

/**
 * Restores one stage at a time, mirroring how an order was trashed:
 * bin2 -> bin1 (still recoverable, no longer counting down to purge),
 * bin1 -> none (fully active again). It never jumps straight from bin2 to active.
 */
export async function restoreOrderById(orderId, actorId) {
  const order = await Order.findById(orderId);
  if (!order) throw new AppError('Order not found', 404);

  const fromStage = order.trash?.stage;
  if (fromStage !== 'bin1' && fromStage !== 'bin2') {
    throw new AppError('Order is not in the recycle bin', 400);
  }

  if (fromStage === 'bin2') {
    order.trash.stage = 'bin1';
    order.trash.bin2At = null;
    order.trash.bin2By = null;
    order.trash.purgeAt = null;
    order.trash.restoredAt = new Date();
    order.trash.restoredBy = actorId;
  } else {
    order.trash = {
      stage: 'none',
      bin1At: null,
      bin1By: null,
      bin2At: null,
      bin2By: null,
      purgeAt: null,
      restoredAt: new Date(),
      restoredBy: actorId,
    };
  }
  await order.save();
  return { order, fromStage, toStage: order.trash.stage };
}

/** Only reachable from the second bin — the first bin's only way out is either
 * restore or advance to the second bin, so nothing can skip the review stage. */
export async function deleteOrderForeverById(orderId) {
  const order = await Order.findById(orderId);
  if (!order) throw new AppError('Order not found', 404);

  if (order.trash?.stage !== 'bin2') {
    throw new AppError('Move the order to the second recycle bin before deleting it permanently', 400);
  }

  const label = order.orderNumber;
  await Order.deleteOne({ _id: order._id });
  return label;
}

export function assertBulkIds(ids) {
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new AppError('No orders selected', 400);
  }
  if (ids.length > MAX_BULK_SIZE) {
    throw new AppError(`You can only act on up to ${MAX_BULK_SIZE} orders at once`, 400);
  }
}

export async function runBulk(ids, fn) {
  const results = await Promise.allSettled(ids.map((id) => fn(id)));
  const succeeded = [];
  const failed = [];
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      succeeded.push(ids[index]);
    } else {
      failed.push({ id: ids[index], message: result.reason?.message || 'Failed' });
    }
  });
  return { succeeded, failed };
}
