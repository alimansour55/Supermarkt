import { asyncHandler } from '../middleware/errorHandler.js';
import { AppError } from '../utils/AppError.js';
import { logAudit } from '../services/auditLog.service.js';
import {
  getCartRecoverySettings,
  updateCartRecoverySettings,
  getCartRecoveryStats,
  listCartRecoveries,
  runCartRecovery,
} from '../services/cartRecovery.service.js';

export const getCartRecoverySettingsHandler = asyncHandler(async (_req, res) => {
  res.json({ success: true, data: await getCartRecoverySettings() });
});

export const updateCartRecoverySettingsHandler = asyncHandler(async (req, res) => {
  if (!req.body || typeof req.body !== 'object') throw new AppError('Settings payload is required', 400);
  if (req.body.steps !== undefined && (!Array.isArray(req.body.steps) || req.body.steps.length === 0)) {
    throw new AppError('At least one reminder step is required', 400);
  }
  const before = await getCartRecoverySettings();
  const data = await updateCartRecoverySettings(req.body);
  await logAudit({
    req,
    action: 'update',
    entityType: 'store_settings',
    entityLabel: 'Cart recovery',
    changes: { before, after: data },
  });
  res.json({ success: true, data });
});

export const getCartRecoveryStatsHandler = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await getCartRecoveryStats({ days: req.query.days }) });
});

export const listCartRecoveriesHandler = asyncHandler(async (req, res) => {
  const { data, pagination } = await listCartRecoveries(req.query);
  res.json({ success: true, data, pagination });
});

/** "Run now": process due reminders immediately (even while disabled, for a supervised test). */
export const runCartRecoveryHandler = asyncHandler(async (req, res) => {
  const summary = await runCartRecovery(new Date(), { force: req.body?.force === true });
  res.json({ success: true, data: summary });
});
