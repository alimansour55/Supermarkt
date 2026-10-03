import { asyncHandler } from '../middleware/errorHandler.js';
import { AppError } from '../utils/AppError.js';
import {
  computePartnerRevenueDistribution,
  getPartnerRevenueSettings,
  updatePartnerRevenueSettings,
  searchPartnerRevenueProducts,
  searchPartnerRevenueCustomers,
  simulatePartnerRevenue,
  getPartnerStatement,
  listPartnerLedger,
  createPartnerLedgerEntry,
  deletePartnerLedgerEntry,
} from '../services/partnerRevenue.service.js';

export const getPartnerRevenueDistributionReport = asyncHandler(async (req, res) => {
  const data = await computePartnerRevenueDistribution(req.query);
  res.json({ success: true, data });
});

export const getPartnerRevenueSettingsHandler = asyncHandler(async (_req, res) => {
  const data = await getPartnerRevenueSettings();
  res.json({ success: true, data });
});

export const updatePartnerRevenueSettingsHandler = asyncHandler(async (req, res) => {
  try {
    const data = await updatePartnerRevenueSettings(req.body, req);
    res.json({ success: true, data });
  } catch (err) {
    if (err.statusCode === 400) throw new AppError(err.message, 400);
    throw err;
  }
});

export const simulatePartnerRevenueHandler = asyncHandler(async (req, res) => {
  const data = await simulatePartnerRevenue(req.body || {});
  res.json({ success: true, data });
});

export const getPartnerStatementHandler = asyncHandler(async (req, res) => {
  try {
    const data = await getPartnerStatement(req.params.key, req.query);
    res.json({ success: true, data });
  } catch (err) {
    if (err.statusCode) throw new AppError(err.message, err.statusCode);
    throw err;
  }
});

export const getPartnerLedgerHandler = asyncHandler(async (req, res) => {
  const data = await listPartnerLedger(req.params.key);
  res.json({ success: true, data });
});

export const createPartnerLedgerEntryHandler = asyncHandler(async (req, res) => {
  try {
    const data = await createPartnerLedgerEntry(req.params.key, req.body, req.user);
    res.status(201).json({ success: true, data });
  } catch (err) {
    if (err.statusCode) throw new AppError(err.message, err.statusCode);
    throw err;
  }
});

export const deletePartnerLedgerEntryHandler = asyncHandler(async (req, res) => {
  try {
    const data = await deletePartnerLedgerEntry(req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    if (err.statusCode) throw new AppError(err.message, err.statusCode);
    throw err;
  }
});

export const searchPartnerRevenueProductsHandler = asyncHandler(async (req, res) => {
  const data = await searchPartnerRevenueProducts(req.query.q, req.query.limit);
  res.json({ success: true, data });
});

export const searchPartnerRevenueCustomersHandler = asyncHandler(async (req, res) => {
  const data = await searchPartnerRevenueCustomers(req.query.q, req.query.limit);
  res.json({ success: true, data });
});
