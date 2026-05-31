import Coupon from '../models/Coupon.js';
import { validateCoupon, calculateCartTotals } from '../utils/cartCalculations.js';
import { formatCoupon } from '../utils/formatters.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { AppError } from '../utils/AppError.js';
import { parsePagination, parseSort, paginationMeta } from '../utils/listQuery.js';

const ADMIN_COUPON_SORT = ['createdAt', 'code', 'expiryDate'];

export const validateDiscountCode = asyncHandler(async (req, res) => {
  const { code, subtotal = 0 } = req.body;

  if (!code) {
    throw new AppError('Discount code is required', 400);
  }

  const validation = await validateCoupon(code, Number(subtotal));

  if (!validation.valid) {
    throw new AppError(validation.message, 400);
  }

  res.json({
    success: true,
    coupon: validation.coupon,
    message: 'Discount code applied successfully',
  });
});

export const listCoupons = asyncHandler(async (_req, res) => {
  const coupons = await Coupon.find({ isActive: true, expiryDate: { $gt: new Date() } })
    .select('code discountType discountValue minSubtotal labelAr labelEn expiryDate usageLimit usedCount')
    .sort({ createdAt: -1 });

  res.json({
    success: true,
    coupons: coupons.map((c) => ({
      ...formatCoupon(c),
      minSubtotal: c.minSubtotal,
    })),
  });
});

export const createCoupon = asyncHandler(async (req, res) => {
  const {
    code,
    discountType,
    discountValue,
    expiryDate,
    usageLimit,
    isActive,
    minSubtotal,
    labelAr,
    labelEn,
  } = req.body;

  if (!code || !discountType || discountValue == null || !expiryDate) {
    throw new AppError('code, discountType, discountValue, and expiryDate are required', 400);
  }

  const normalized = code.toUpperCase().trim();
  const existing = await Coupon.findOne({ code: normalized });
  if (existing) throw new AppError('Coupon code already exists', 400);

  const coupon = await Coupon.create({
    code: normalized,
    discountType,
    discountValue,
    expiryDate,
    usageLimit,
    isActive: isActive ?? true,
    minSubtotal,
    labelAr,
    labelEn,
  });

  res.status(201).json({ success: true, data: formatCoupon(coupon) });
});

function buildAdminCouponFilter(query) {
  const filter = {};
  if (query.isActive !== undefined && query.isActive !== '') {
    filter.isActive = query.isActive === 'true';
  }
  if (query.q) {
    const rx = { $regex: query.q, $options: 'i' };
    filter.$or = [{ code: rx }, { labelAr: rx }, { labelEn: rx }];
  }
  return filter;
}

export const getAdminCoupons = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = buildAdminCouponFilter(req.query);
  const sort = parseSort(req.query, ADMIN_COUPON_SORT);

  const [coupons, total] = await Promise.all([
    Coupon.find(filter).sort(sort).skip(skip).limit(limit),
    Coupon.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: coupons.map((c) => ({
      ...formatCoupon(c),
      minSubtotal: c.minSubtotal,
      usedCount: c.usedCount,
      expiryDate: c.expiryDate,
      usageLimit: c.usageLimit,
      isActive: c.isActive,
    })),
    pagination: paginationMeta(page, limit, total),
  });
});

export const bulkAdminCoupons = asyncHandler(async (req, res) => {
  const { ids, action } = req.body;
  if (!Array.isArray(ids) || !ids.length) {
    throw new AppError('ids array is required', 400);
  }

  const filter = { _id: { $in: ids } };
  if (action === 'activate') await Coupon.updateMany(filter, { isActive: true });
  else if (action === 'deactivate') await Coupon.updateMany(filter, { isActive: false });
  else if (action === 'delete') await Coupon.deleteMany(filter);
  else throw new AppError('Invalid action', 400);

  res.json({ success: true, affected: ids.length });
});

export const updateCoupon = asyncHandler(async (req, res) => {
  const coupon = await Coupon.findById(req.params.id);
  if (!coupon) throw new AppError('Coupon not found', 404);

  const updates = { ...req.body };
  if (updates.code) updates.code = updates.code.toUpperCase().trim();

  Object.assign(coupon, updates);
  await coupon.save();

  res.json({ success: true, data: formatCoupon(coupon) });
});

export const deleteCoupon = asyncHandler(async (req, res) => {
  const coupon = await Coupon.findById(req.params.id);
  if (!coupon) throw new AppError('Coupon not found', 404);
  await coupon.deleteOne();
  res.json({ success: true, message: 'Coupon deleted' });
});

export { calculateCartTotals };
