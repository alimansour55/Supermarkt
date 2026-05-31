import { body } from 'express-validator';
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

export const updateProfileValidation = [
  body('name').optional().trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2–100 characters'),
];

export const createOrderValidation = [
  body('items').isArray({ min: 1 }).withMessage('Order must contain at least one item'),
  body('items.*.quantity').isInt({ min: 1, max: 99 }).withMessage('Invalid item quantity'),
  body('items.*.price').isFloat({ min: 0 }).withMessage('Invalid item price'),
  body('shippingAddress.street').trim().notEmpty().withMessage('Delivery street is required'),
  body('phone').trim().notEmpty().withMessage('Phone number is required').isLength({ max: 20 }),
  body('paymentMethod').optional().isIn(['stripe', 'cod']).withMessage('Invalid payment method'),
  body('deliveryMethod').optional().isIn(['scheduled', 'express']).withMessage('Invalid delivery method'),
  body('discountCode').optional().trim().isLength({ max: 50 }),
  body('notes').optional().trim().isLength({ max: 500 }),
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
