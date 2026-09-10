import { body } from 'express-validator';
import { PAYMENT_METHOD_IDS } from '../constants/paymentMethods.js';
import { normalizePhone } from '../utils/phone.js';

const egyptianPhoneValidator = body('phone')
  .trim()
  .notEmpty()
  .withMessage('Phone number is required')
  .custom((value) => {
    if (!normalizePhone(value)) {
      throw new Error('Invalid Egyptian mobile number (e.g. 01xxxxxxxxx)');
    }
    return true;
  });

export const sendOtpValidation = [
  egyptianPhoneValidator,
  body('name').optional().trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2–100 characters'),
];

export const verifyOtpValidation = [
  egyptianPhoneValidator,
  body('code')
    .trim()
    .matches(/^\d{6}$/)
    .withMessage('Enter the 6-digit SMS code'),
];

export const createAdminUserValidation = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ min: 2, max: 100 }),
  egyptianPhoneValidator,
  body('role').optional().isIn(['user', 'driver']).withMessage('Role must be customer or driver'),
];

export const bulkAdminUsersValidation = [
  body('ids').isArray({ min: 1 }).withMessage('Select at least one user'),
  body('ids.*').trim().notEmpty().withMessage('Invalid user id'),
  body('action').trim().equals('delete').withMessage('Invalid bulk action'),
];

export const adminLoginValidation = [
  body('username')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ min: 3, max: 32 })
    .withMessage('Username must be 3–32 characters')
    .matches(/^[a-zA-Z0-9._-]+$/)
    .withMessage('Username may only contain letters, numbers, dots, hyphens, and underscores'),
  body('password').trim().notEmpty().withMessage('Password is required'),
];

export const driverLoginValidation = [
  body('username')
    .trim()
    .notEmpty()
    .withMessage('Username is required')
    .isLength({ min: 3, max: 32 })
    .withMessage('Username must be 3–32 characters')
    .matches(/^[a-zA-Z0-9._-]+$/)
    .withMessage('Username may only contain letters, numbers, dots, hyphens, and underscores'),
  body('password').trim().notEmpty().withMessage('Password is required'),
];

export const updateProfileValidation = [
  body('name').optional().trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2–100 characters'),
];

export const addAddressValidation = [
  body('label').optional().trim().isLength({ max: 50 }),
  body('street').trim().notEmpty().withMessage('Street is required').isLength({ max: 200 }),
  body('building').optional().trim().isLength({ max: 50 }),
  body('floor').optional().trim().isLength({ max: 20 }),
  body('city').optional().trim().isLength({ max: 100 }),
  body('governorate').optional().trim().isLength({ max: 100 }),
  body('area').optional().trim().isLength({ max: 100 }),
  body('postalCode').optional().trim().isLength({ max: 20 }),
  body('isDefault').optional().isBoolean(),
  body('lat').optional().isFloat({ min: -90, max: 90 }),
  body('lng').optional().isFloat({ min: -180, max: 180 }),
  body('formattedAddress').optional().trim().isLength({ max: 500 }),
  body('placeId').optional().trim().isLength({ max: 200 }),
  body('deliveryZoneId').optional().trim().isLength({ max: 100 }),
];

export const updateAddressValidation = [
  body('label').optional().trim().isLength({ max: 50 }),
  body('street').optional().trim().notEmpty().withMessage('Street is required').isLength({ max: 200 }),
  body('building').optional().trim().isLength({ max: 50 }),
  body('floor').optional().trim().isLength({ max: 20 }),
  body('city').optional().trim().isLength({ max: 100 }),
  body('governorate').optional().trim().isLength({ max: 100 }),
  body('area').optional().trim().isLength({ max: 100 }),
  body('postalCode').optional().trim().isLength({ max: 20 }),
  body('isDefault').optional().isBoolean(),
  body('lat').optional().isFloat({ min: -90, max: 90 }),
  body('lng').optional().isFloat({ min: -180, max: 180 }),
  body('formattedAddress').optional().trim().isLength({ max: 500 }),
  body('placeId').optional().trim().isLength({ max: 200 }),
  body('deliveryZoneId').optional().trim().isLength({ max: 100 }),
];

export const createOrderValidation = [
  body('items').isArray({ min: 1 }).withMessage('Order must contain at least one item'),
  body('items.*.quantity').isInt({ min: 1, max: 99 }).withMessage('Invalid item quantity'),
  body('items.*.price').isFloat({ min: 0 }).withMessage('Invalid item price'),
  body('shippingAddress.street').trim().notEmpty().withMessage('Delivery street is required'),
  body('shippingAddress.lat').optional({ nullable: true, checkFalsy: true }).isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude'),
  body('shippingAddress.lng').optional({ nullable: true, checkFalsy: true }).isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude'),
  body('shippingAddress.formattedAddress').optional().trim().isLength({ max: 500 }),
  body('shippingAddress.placeId').optional().trim().isLength({ max: 200 }),
  body('phone').trim().notEmpty().withMessage('Phone number is required').isLength({ max: 20 }),
  body('alternatePhone').optional({ values: 'falsy' }).trim().isLength({ max: 20 }),
  body('paymentMethod').optional().isIn(PAYMENT_METHOD_IDS).withMessage('Invalid payment method'),
  body('manualPaymentAccount').optional().trim().isLength({ max: 50 }),
  body('deliveryMethod').optional().isIn(['scheduled', 'express', 'recurring']).withMessage('Invalid delivery method'),
  body('recurringFrequency').optional().isIn(['weekly', 'biweekly', 'monthly']).withMessage('Invalid recurring frequency'),
  body('recurringPreferredWeekday').optional().isInt({ min: 0, max: 6 }),
  body('recurringPreferredDayOfMonth').optional().isInt({ min: 1, max: 31 }),
  body('scheduledDate').optional().isISO8601().withMessage('Invalid delivery date'),
  body('deliveryZoneId').optional().trim().isLength({ max: 100 }),
  body('timeSlotId').optional().trim().isLength({ max: 100 }),
  body('discountCode').optional().trim().isLength({ max: 50 }),
  body('pointsToRedeem').optional().isInt({ min: 0 }).withMessage('Invalid points amount'),
  body('notes').optional().trim().isLength({ max: 500 }),
];

export const updateOrderItemsValidation = [
  body('items').isArray({ min: 1 }).withMessage('Order must contain at least one item'),
  body('items.*.productId').notEmpty().withMessage('Product is required'),
  body('items.*.quantity').isInt({ min: 1, max: 99 }).withMessage('Invalid item quantity'),
  body('items.*.variantId').optional({ nullable: true }),
  body('lang').optional().isIn(['ar', 'en']),
];

export const updateRecurringDeliveryValidation = [
  body('frequency').optional().isIn(['weekly', 'biweekly', 'monthly']).withMessage('Invalid recurring frequency'),
  body('preferredWeekday').optional().isInt({ min: 0, max: 6 }),
  body('preferredDayOfMonth').optional().isInt({ min: 1, max: 31 }),
  body('notes').optional().trim().isLength({ max: 500 }),
  body('adminNotes').optional().trim().isLength({ max: 1000 }),
  body('deliveryTimeSlot.labelAr').optional().trim().isLength({ max: 100 }),
  body('deliveryTimeSlot.labelEn').optional().trim().isLength({ max: 100 }),
  body('deliveryTimeSlot.from').optional().trim().isLength({ max: 10 }),
  body('deliveryTimeSlot.to').optional().trim().isLength({ max: 10 }),
];

export const driverTrackingLocationValidation = [
  body('lat').isFloat({ min: -90, max: 90 }).withMessage('Valid latitude is required'),
  body('lng').isFloat({ min: -180, max: 180 }).withMessage('Valid longitude is required'),
  body('heading').optional({ nullable: true }).isFloat({ min: 0, max: 360 }),
  body('speed').optional({ nullable: true }).isFloat({ min: 0 }),
  body('status').optional().isIn(['en_route', 'arrived', 'idle']),
];

export const driverFailDeliveryValidation = [
  body('deliveryFailureReasonKey').optional().trim(),
  body('deliveryFailureReason').optional().trim(),
];

const COUPON_DISCOUNT_TYPES = ['percent', 'fixed', 'free_delivery'];

/** Shared discount-value rule: percent 1–100, fixed > 0, free_delivery ignored. */
const couponDiscountValueRule = (getType) =>
  body('discountValue').custom((value, { req }) => {
    const type = getType(req);
    if (type === 'free_delivery') return true;
    const num = Number(value);
    if (!Number.isFinite(num)) throw new Error('Discount value must be a number');
    if (type === 'percent') {
      if (num < 1 || num > 100) throw new Error('Percentage discount must be between 1 and 100');
    } else if (type === 'fixed') {
      if (num <= 0) throw new Error('Fixed discount must be greater than 0');
    }
    return true;
  });

const couponExpiryRule = (optional) => {
  const chain = body('expiryDate');
  const base = optional ? chain.optional({ nullable: true, checkFalsy: true }) : chain.notEmpty().withMessage('Expiry date is required');
  return base.custom((value) => {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) throw new Error('Expiry date is invalid');
    // Compare on calendar day so "today" is still allowed.
    const dayEnd = new Date(d);
    dayEnd.setHours(23, 59, 59, 999);
    if (dayEnd.getTime() < Date.now()) throw new Error('Expiry date must be in the future');
    return true;
  });
};

export const createCouponValidation = [
  body('code')
    .trim()
    .notEmpty().withMessage('Coupon code is required')
    .matches(/^[A-Za-z0-9_-]{3,32}$/).withMessage('Code must be 3–32 letters, digits, - or _'),
  body('discountType')
    .notEmpty().withMessage('Discount type is required')
    .isIn(COUPON_DISCOUNT_TYPES).withMessage('Invalid discount type'),
  couponDiscountValueRule((req) => req.body.discountType),
  body('minSubtotal').optional({ nullable: true }).isFloat({ min: 0 }).withMessage('Minimum order must be 0 or more'),
  couponExpiryRule(false),
  body('usageLimit').optional({ nullable: true, checkFalsy: true }).isInt({ min: 1 }).withMessage('Usage limit must be a whole number ≥ 1'),
  body('perUserLimit').optional({ nullable: true, checkFalsy: true }).isInt({ min: 1 }).withMessage('Per-customer limit must be a whole number ≥ 1'),
  body('isActive').optional().isBoolean().withMessage('isActive must be true or false'),
  body('labelAr').optional({ nullable: true }).isString().trim().isLength({ max: 120 }),
  body('labelEn').optional({ nullable: true }).isString().trim().isLength({ max: 120 }),
];

export const updateCouponValidation = [
  body('code')
    .optional()
    .trim()
    .matches(/^[A-Za-z0-9_-]{3,32}$/).withMessage('Code must be 3–32 letters, digits, - or _'),
  body('discountType')
    .optional()
    .isIn(COUPON_DISCOUNT_TYPES).withMessage('Invalid discount type'),
  body('discountValue')
    .optional({ nullable: true })
    .custom((value, { req }) => {
      // Only enforce when a value is actually being changed.
      if (value === undefined) return true;
      const type = req.body.discountType || 'percent';
      const num = Number(value);
      if (type === 'free_delivery') return true;
      if (!Number.isFinite(num)) throw new Error('Discount value must be a number');
      if (type === 'percent' && (num < 1 || num > 100)) throw new Error('Percentage discount must be between 1 and 100');
      if (type === 'fixed' && num <= 0) throw new Error('Fixed discount must be greater than 0');
      return true;
    }),
  body('minSubtotal').optional({ nullable: true }).isFloat({ min: 0 }).withMessage('Minimum order must be 0 or more'),
  couponExpiryRule(true),
  body('usageLimit').optional({ nullable: true, checkFalsy: true }).isInt({ min: 1 }).withMessage('Usage limit must be a whole number ≥ 1'),
  body('perUserLimit').optional({ nullable: true, checkFalsy: true }).isInt({ min: 1 }).withMessage('Per-customer limit must be a whole number ≥ 1'),
  body('isActive').optional().isBoolean().withMessage('isActive must be true or false'),
  body('labelAr').optional({ nullable: true }).isString().trim().isLength({ max: 120 }),
  body('labelEn').optional({ nullable: true }).isString().trim().isLength({ max: 120 }),
];

export const validateDiscountCodeValidation = [
  body('code').trim().notEmpty().withMessage('Discount code is required'),
  body('subtotal').optional().isFloat({ min: 0 }).withMessage('Subtotal must be 0 or more'),
];

export const validate = (validations) => async (req, res, next) => {
  await Promise.all(validations.map((v) => v.run(req)));

  const { validationResult } = await import('express-validator');
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: errors.array()[0].msg,
      errors: errors.array(),
    });
  }

  next();
};
