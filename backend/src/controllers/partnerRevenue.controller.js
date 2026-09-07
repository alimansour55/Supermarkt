import { asyncHandler } from '../middleware/errorHandler.js';
import { AppError } from '../utils/AppError.js';
import {
  computePartnerRevenueDistribution,
  getPartnerRevenueSettings,
  updatePartnerRevenueSettings,
  searchPartnerRevenueProducts,
  searchPartnerRevenueCustomers,
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
    const data = await updatePartnerRevenueSettings(req.body);
    res.json({ success: true, data });
  } catch (err) {
    if (err.statusCode === 400) throw new AppError(err.message, 400);
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
