import { asyncHandler } from '../middleware/errorHandler.js';
import {
  listPartnerPayouts,
  getPartnerPayoutSummary,
  generatePayoutsFromPeriod,
  createManualPartnerPayout,
  updatePartnerPayout,
  setPartnerPayoutStatus,
  deletePartnerPayout,
} from '../services/partnerPayout.service.js';

export const getPartnerPayoutsHandler = asyncHandler(async (req, res) => {
  const data = await listPartnerPayouts(req.query);
  res.json({ success: true, data: data.items, pagination: data.pagination });
});

export const getPartnerPayoutSummaryHandler = asyncHandler(async (_req, res) => {
  const data = await getPartnerPayoutSummary();
  res.json({ success: true, data });
});

export const generatePartnerPayoutsHandler = asyncHandler(async (req, res) => {
  const data = await generatePayoutsFromPeriod(req.body, req.user);
  res.json({ success: true, data });
});

export const createPartnerPayoutHandler = asyncHandler(async (req, res) => {
  const data = await createManualPartnerPayout(req.body, req.user);
  res.status(201).json({ success: true, data });
});

export const updatePartnerPayoutHandler = asyncHandler(async (req, res) => {
  const data = await updatePartnerPayout(req.params.id, req.body);
  res.json({ success: true, data });
});

export const setPartnerPayoutStatusHandler = asyncHandler(async (req, res) => {
  const data = await setPartnerPayoutStatus(req.params.id, req.body, req.user);
  res.json({ success: true, data });
});

export const deletePartnerPayoutHandler = asyncHandler(async (req, res) => {
  const data = await deletePartnerPayout(req.params.id);
  res.json({ success: true, data });
});
