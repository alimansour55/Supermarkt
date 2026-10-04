import mongoose from 'mongoose';
import Seller from '../models/Seller.js';
import User from '../models/User.js';
import Product from '../models/Product.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { generateToken } from '../utils/generateToken.js';
import { normalizePhone } from '../utils/phone.js';
import {
  getMarketplaceSettings,
  uniqueSellerSlug,
  formatSellerPublic,
} from '../services/marketplace.service.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Public marketplace switches the "Sell with us" page needs. */
export const getMarketplaceConfig = asyncHandler(async (_req, res) => {
  const s = await getMarketplaceSettings();
  res.json({
    success: true,
    data: {
      enabled: s.enabled,
      registrationOpen: s.enabled && s.registrationOpen,
      defaultCommissionRate: s.defaultCommissionRate,
      payoutHoldDays: s.payoutHoldDays,
      termsAr: s.termsAr || '',
      termsEn: s.termsEn || '',
    },
  });
});

/**
 * Validate an application / staff-created seller payload. Shared with the admin
 * "create seller" endpoint so both paths enforce the same rules.
 */
export async function validateSellerApplication(body, { requirePassword = true } = {}) {
  const str = (v, max = 200) => String(v ?? '').trim().slice(0, max);
  const data = {
    nameAr: str(body.nameAr, 120),
    nameEn: str(body.nameEn, 120),
    contactName: str(body.contactName, 100),
    email: str(body.email, 200).toLowerCase(),
    phone: body.phone ? normalizePhone(str(body.phone, 30)) : '',
    password: String(body.password ?? ''),
    legalName: str(body.legalName),
    commercialRegisterNo: str(body.commercialRegisterNo, 60),
    taxId: str(body.taxId, 60),
    address: {
      street: str(body.address?.street ?? body.street),
      city: str(body.address?.city ?? body.city, 100),
      governorate: str(body.address?.governorate ?? body.governorate, 100),
    },
    applicationNote: str(body.applicationNote ?? body.note, 2000),
    intendedCategories: (Array.isArray(body.intendedCategories) ? body.intendedCategories : [])
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .slice(0, 20),
  };

  const errors = [];
  if (data.nameAr.length < 2) errors.push('Arabic store name is required');
  if (data.nameEn.length < 2) errors.push('English store name is required');
  if (data.contactName.length < 2) errors.push('Contact name is required');
  if (!EMAIL_RE.test(data.email)) errors.push('A valid email is required');
  if (!data.phone) errors.push('A valid phone number is required');
  if (requirePassword && data.password.length < 8) errors.push('Password must be at least 8 characters');
  if (!data.address.city) errors.push('City is required');
  if (errors.length) throw new AppError(errors.join('. '), 400);

  if (await User.exists({ email: data.email })) {
    throw new AppError('This email is already registered — sign in or use another email', 409);
  }
  return data;
}

/** Create the Seller + owner User for a validated application. */
export async function createSellerWithOwner(data, { status = 'applied', actor = null, termsAccepted = false } = {}) {
  const slug = await uniqueSellerSlug(data.nameEn);
  const seller = await Seller.create({
    nameAr: data.nameAr,
    nameEn: data.nameEn,
    slug,
    legalName: data.legalName,
    commercialRegisterNo: data.commercialRegisterNo,
    taxId: data.taxId,
    contactName: data.contactName,
    email: data.email,
    phone: data.phone,
    address: data.address,
    applicationNote: data.applicationNote,
    intendedCategories: data.intendedCategories,
    status,
    statusHistory: [{ status, changedBy: actor?._id || null }],
    termsAcceptedAt: termsAccepted ? new Date() : null,
    ...(status === 'active' ? { approvedAt: new Date(), approvedBy: actor?._id || null } : {}),
  });

  try {
    const owner = await User.create({
      name: data.contactName,
      email: data.email,
      password: data.password,
      role: 'seller_owner',
      seller: seller._id,
      createdBy: actor?._id || null,
    });
    seller.owner = owner._id;
    await seller.save();
    return { seller, owner };
  } catch (err) {
    // No transactions on a standalone MongoDB — undo the seller so a retry can succeed.
    await Seller.deleteOne({ _id: seller._id });
    if (err?.code === 11000) throw new AppError('This email is already registered', 409);
    throw err;
  }
}

/** Public "Sell with us" application. Signs the new owner in so they can track the review. */
export const applyAsSeller = asyncHandler(async (req, res) => {
  const settings = await getMarketplaceSettings();
  if (!settings.enabled || !settings.registrationOpen) {
    throw new AppError('Seller registration is closed right now', 403);
  }
  if (req.body.acceptTerms !== true && req.body.acceptTerms !== 'true') {
    throw new AppError('You must accept the seller terms', 400);
  }

  const data = await validateSellerApplication(req.body);
  const { seller, owner } = await createSellerWithOwner(data, { termsAccepted: true });

  res.status(201).json({
    success: true,
    token: generateToken(owner._id),
    user: {
      id: owner._id,
      name: owner.name,
      email: owner.email,
      role: owner.role,
      seller: seller._id,
    },
    seller: { _id: seller._id, slug: seller.slug, status: seller.status },
  });
});

/** Public seller store card. */
export const getPublicSeller = asyncHandler(async (req, res) => {
  const seller = await Seller.findOne({ slug: String(req.params.slug).toLowerCase(), status: 'active' }).lean();
  if (!seller) throw new AppError('Seller not found', 404);
  const productCount = await Product.countDocuments({ seller: seller._id, isActive: true });
  res.json({ success: true, data: { ...formatSellerPublic(seller), productCount } });
});
