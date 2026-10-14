import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { logAudit } from '../services/auditLog.service.js';
import User from '../models/User.js';
import {
  getDriverCashSummary,
  listDriverCashBalances,
  recordCashAdjustment,
  recordCashHandover,
  roundMoney,
} from '../services/driverCash.service.js';

async function loadDriverOr404(id) {
  const driver = await User.findOne({ _id: id, role: 'driver' }).select('name');
  if (!driver) throw new AppError('Driver not found', 404);
  return driver;
}

export const getDriverCashBalances = asyncHandler(async (_req, res) => {
  const data = await listDriverCashBalances();
  const totalHeld = roundMoney(data.reduce((sum, d) => sum + d.balance, 0));
  res.json({ success: true, data, meta: { totalHeld } });
});

export const getDriverCashLedger = asyncHandler(async (req, res) => {
  const driver = await loadDriverOr404(req.params.driverId);
  const data = await getDriverCashSummary(driver._id, { limit: 100 });
  res.json({ success: true, data: { driver: { _id: driver._id, name: driver.name }, ...data } });
});

/** The store received cash from a driver. */
export const recordDriverCashHandover = asyncHandler(async (req, res) => {
  const driver = await loadDriverOr404(req.params.driverId);
  const amount = roundMoney(req.body.amount);
  if (!(amount > 0)) throw new AppError('Enter the amount received', 400);
  const note = String(req.body.note || '').trim().slice(0, 500);

  const entry = await recordCashHandover({ driverId: driver._id, amount, note, createdBy: req.user._id });
  if (!entry) {
    throw new AppError('Amount is more than the cash this driver holds', 400, 'EXCEEDS_BALANCE');
  }
  await logAudit({
    req,
    action: 'cash_handover',
    entityType: 'user',
    entityId: driver._id,
    entityLabel: driver.name,
    changes: { amount, balanceAfter: entry.balanceAfter, note },
  });
  res.json({ success: true, data: await getDriverCashSummary(driver._id, { limit: 100 }) });
});

/** Correct a driver's cash balance (shortage, counting error) — a note is mandatory. */
export const adjustDriverCash = asyncHandler(async (req, res) => {
  const driver = await loadDriverOr404(req.params.driverId);
  const amount = roundMoney(req.body.amount);
  if (!amount) throw new AppError('Enter a non-zero amount', 400);
  const note = String(req.body.note || '').trim().slice(0, 500);
  if (note.length < 3) throw new AppError('A note explaining the correction is required', 400);

  const entry = await recordCashAdjustment({ driverId: driver._id, amount, note, createdBy: req.user._id });
  if (!entry) throw new AppError('Driver not found', 404);
  await logAudit({
    req,
    action: 'cash_adjust',
    entityType: 'user',
    entityId: driver._id,
    entityLabel: driver.name,
    changes: { amount, balanceAfter: entry.balanceAfter, note },
  });
  res.json({ success: true, data: await getDriverCashSummary(driver._id, { limit: 100 }) });
});
