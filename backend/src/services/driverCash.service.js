import DriverCashLedger from '../models/DriverCashLedger.js';
import User from '../models/User.js';

export const roundMoney = (value) => Math.round(Number(value || 0) * 100) / 100;

/** Cash the driver must collect at the door: unpaid COD orders only (total is already net of wallet). */
export function codAmountDue(order) {
  if (!order || order.paymentMethod !== 'cod' || order.paymentStatus === 'paid') return 0;
  return roundMoney(order.total);
}

async function moveBalance(driverId, delta, { requireCover = false } = {}) {
  const filter = { _id: driverId, role: 'driver' };
  if (requireCover && delta < 0) filter.driverCashBalance = { $gte: Math.abs(delta) };
  const user = await User.findOneAndUpdate(filter, { $inc: { driverCashBalance: delta } }, { new: true })
    .select('driverCashBalance');
  return user ? roundMoney(user.driverCashBalance) : null;
}

/**
 * Record the COD cash a driver took at the door. Idempotent per order: the ledger's
 * unique (order, collect) index makes a second call a no-op, so a retried completion
 * can never count the same cash twice. Returns the ledger entry, or null.
 */
export async function recordCodCollection({ order, driverId, amount }) {
  const value = roundMoney(amount);
  if (!order?._id || !driverId || value <= 0) return null;

  let entry;
  try {
    entry = await DriverCashLedger.create({
      driver: driverId,
      type: 'collect',
      amount: value,
      balanceAfter: 0,
      order: order._id,
      note: `#${order.orderNumber}`,
    });
  } catch (err) {
    if (err?.code === 11000) return null;
    throw err;
  }

  const balanceAfter = await moveBalance(driverId, value);
  entry.balanceAfter = balanceAfter ?? 0;
  await entry.save();
  return entry;
}

/** Cash a driver hands over to the store. Fails (null) if it exceeds what they hold. */
export async function recordCashHandover({ driverId, amount, note = '', createdBy = null }) {
  const value = roundMoney(amount);
  if (!(value > 0)) return null;
  const balanceAfter = await moveBalance(driverId, -value, { requireCover: true });
  if (balanceAfter == null) return null;
  return DriverCashLedger.create({
    driver: driverId, type: 'handover', amount: -value, balanceAfter, note, createdBy,
  });
}

/** Signed correction with a mandatory note (shortage, counting error...). */
export async function recordCashAdjustment({ driverId, amount, note, createdBy = null }) {
  const value = roundMoney(amount);
  if (!value) return null;
  const balanceAfter = await moveBalance(driverId, value);
  if (balanceAfter == null) return null;
  return DriverCashLedger.create({
    driver: driverId, type: 'adjust', amount: value, balanceAfter, note, createdBy,
  });
}

export async function getDriverCashSummary(driverId, { limit = 30 } = {}) {
  const [user, entries] = await Promise.all([
    User.findById(driverId).select('name driverCashBalance').lean(),
    DriverCashLedger.find({ driver: driverId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('order', 'orderNumber')
      .populate('createdBy', 'name')
      .lean(),
  ]);
  return {
    balance: roundMoney(user?.driverCashBalance),
    entries: entries.map((e) => ({
      _id: e._id,
      type: e.type,
      amount: e.amount,
      balanceAfter: e.balanceAfter,
      orderId: e.order?._id || null,
      orderNumber: e.order?.orderNumber || null,
      note: e.note,
      createdBy: e.createdBy?.name || null,
      createdAt: e.createdAt,
    })),
  };
}

/** Every driver with their cash in hand and when they last handed cash over. */
export async function listDriverCashBalances() {
  const drivers = await User.find({ role: 'driver' })
    .select('name phone username driverCashBalance isActive')
    .sort({ driverCashBalance: -1, name: 1 })
    .lean();
  const lastHandovers = await DriverCashLedger.aggregate([
    { $match: { type: 'handover' } },
    { $sort: { createdAt: -1 } },
    { $group: { _id: '$driver', at: { $first: '$createdAt' } } },
  ]);
  const lastById = new Map(lastHandovers.map((row) => [String(row._id), row.at]));
  return drivers.map((d) => ({
    _id: d._id,
    name: d.name,
    phone: d.phone,
    username: d.username,
    isActive: d.isActive !== false,
    balance: roundMoney(d.driverCashBalance),
    lastHandoverAt: lastById.get(String(d._id)) || null,
  }));
}
