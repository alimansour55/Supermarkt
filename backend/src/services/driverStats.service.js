import mongoose from 'mongoose';
import Order from '../models/Order.js';
import User from '../models/User.js';
import AuditLog from '../models/AuditLog.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const round1 = (n) => (n == null ? null : Math.round(n * 10) / 10);

/** Start of the window: today (local midnight) for 1 day, otherwise the last N days. */
export function statsWindowStart(days = 1, now = new Date()) {
  const n = Math.min(90, Math.max(1, Math.round(Number(days) || 1)));
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return new Date(start.getTime() - (n - 1) * DAY_MS);
}

/**
 * Delivery outcomes per driver since `from`: delivered / failed counts, cash collected,
 * average minutes from assignment and from pickup to delivery, and flags (away from the
 * address, items missing at pickup). Returns a Map keyed by driver id.
 */
export async function aggregateDriverOutcomes({ from, driverIds = null }) {
  const match = {
    assignedDriver: driverIds
      ? { $in: driverIds.map((id) => new mongoose.Types.ObjectId(String(id))) }
      : { $ne: null },
    $or: [
      { orderStatus: 'delivered', deliveredAt: { $gte: from } },
      { orderStatus: 'delivery_failed', updatedAt: { $gte: from } },
    ],
  };

  const rows = await Order.aggregate([
    { $match: match },
    {
      $project: {
        driver: '$assignedDriver',
        delivered: { $cond: [{ $eq: ['$orderStatus', 'delivered'] }, 1, 0] },
        failed: { $cond: [{ $eq: ['$orderStatus', 'delivery_failed'] }, 1, 0] },
        cash: { $ifNull: ['$delivery.cashDue', 0] },
        offsite: { $cond: [{ $gt: ['$delivery.offsite', null] }, 1, 0] },
        missing: { $cond: [{ $gt: [{ $size: { $ifNull: ['$delivery.missingItems', []] } }, 0] }, 1, 0] },
        assignToDeliver: {
          $cond: [
            { $and: [{ $eq: ['$orderStatus', 'delivered'] }, { $gt: ['$assignedDriverAt', null] }] },
            { $divide: [{ $subtract: ['$deliveredAt', '$assignedDriverAt'] }, 60000] },
            null,
          ],
        },
        pickupToDeliver: {
          $cond: [
            { $and: [{ $eq: ['$orderStatus', 'delivered'] }, { $gt: ['$delivery.pickedUpAt', null] }] },
            { $divide: [{ $subtract: ['$deliveredAt', '$delivery.pickedUpAt'] }, 60000] },
            null,
          ],
        },
      },
    },
    {
      $group: {
        _id: '$driver',
        delivered: { $sum: '$delivered' },
        failed: { $sum: '$failed' },
        cashCollected: { $sum: '$cash' },
        offsite: { $sum: '$offsite' },
        missingAtPickup: { $sum: '$missing' },
        avgAssignToDeliverMin: { $avg: '$assignToDeliver' },
        avgPickupToDeliverMin: { $avg: '$pickupToDeliver' },
      },
    },
  ]);

  return new Map(rows.map((row) => {
    const total = row.delivered + row.failed;
    return [String(row._id), {
      delivered: row.delivered,
      failed: row.failed,
      successRate: total ? Math.round((row.delivered / total) * 100) : null,
      cashCollected: Math.round(row.cashCollected * 100) / 100,
      offsite: row.offsite,
      missingAtPickup: row.missingAtPickup,
      avgAssignToDeliverMin: round1(row.avgAssignToDeliverMin),
      avgPickupToDeliverMin: round1(row.avgPickupToDeliverMin),
    }];
  }));
}

const EMPTY = {
  delivered: 0,
  failed: 0,
  successRate: null,
  cashCollected: 0,
  offsite: 0,
  missingAtPickup: 0,
  avgAssignToDeliverMin: null,
  avgPickupToDeliverMin: null,
};

export async function getDriverStats(driverId, { days = 1 } = {}) {
  const from = statsWindowStart(days);
  const outcomes = await aggregateDriverOutcomes({ from, driverIds: [driverId] });
  return { from, ...EMPTY, ...(outcomes.get(String(driverId)) || {}) };
}

/** Every driver's outcomes plus declines, expired assignments, cash held and last GPS. */
export async function getDriverPerformance({ days = 7 } = {}) {
  const from = statsWindowStart(days);
  const [drivers, outcomes, declines] = await Promise.all([
    User.find({ role: 'driver' })
      .select('name phone username isActive driverAvailable driverCashBalance driverLastLocation')
      .sort({ name: 1 })
      .lean(),
    aggregateDriverOutcomes({ from }),
    AuditLog.aggregate([
      {
        $match: {
          action: { $in: ['driver_reject_delivery', 'driver_assignment_expired'] },
          createdAt: { $gte: from },
        },
      },
      { $group: { _id: { driver: '$changes.assignedDriver.from', action: '$action' }, count: { $sum: 1 } } },
    ]),
  ]);

  const declineCount = (driverId, action) => declines
    .find((row) => row._id.driver === String(driverId) && row._id.action === action)?.count || 0;

  return {
    from,
    drivers: drivers.map((d) => ({
      _id: d._id,
      name: d.name,
      phone: d.phone,
      username: d.username,
      isActive: d.isActive !== false,
      available: d.driverAvailable !== false,
      cashHeld: Math.round((d.driverCashBalance || 0) * 100) / 100,
      lastLocationAt: d.driverLastLocation?.at || null,
      ...EMPTY,
      ...(outcomes.get(String(d._id)) || {}),
      declined: declineCount(d._id, 'driver_reject_delivery'),
      expired: declineCount(d._id, 'driver_assignment_expired'),
    })),
  };
}
