import mongoose from 'mongoose';
import Seller from '../models/Seller.js';
import User from '../models/User.js';
import Product from '../models/Product.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { generateToken } from '../utils/generateToken.js';
import { formatProduct } from '../utils/formatters.js';
import { featuredProductsFor } from './sellerGrowth.controller.js';
import { normalizePhone } from '../utils/phone.js';
import { buildOffersProductFilter } from '../utils/offersFilter.js';
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

  // The English name is optional: Arabic-only shops use the Arabic name everywhere.
  if (data.nameEn.length < 2 && data.nameAr.length >= 2) data.nameEn = data.nameAr;

  const errors = [];
  const add = (field, ar, en) => errors.push({ field, ar, en });
  if (data.nameAr.length < 2) add('nameAr', 'اكتب اسم المتجر بالعربية (حرفان على الأقل)', 'Enter the Arabic store name (at least 2 characters)');
  if (data.contactName.length < 2) add('contactName', 'اكتب اسم المسؤول عن المتجر', 'Enter the contact person’s name');
  if (!EMAIL_RE.test(data.email)) add('email', 'اكتب بريداً إلكترونياً صحيحاً', 'Enter a valid email');
  if (!data.phone) add('phone', 'اكتب رقم هاتف مصري صحيح (مثل 01012345678)', 'Enter a valid Egyptian phone number (e.g. 01012345678)');
  if (requirePassword && (data.password.length < 8 || !/[A-Za-z؀-ۿ]/.test(data.password) || !/\d/.test(data.password))) {
    add('password', 'كلمة المرور: 8 أحرف على الأقل وفيها حروف وأرقام', 'Password: at least 8 characters with letters and numbers');
  }
  if (!data.address.city) add('city', 'اكتب المدينة', 'Enter the city');
  if (!errors.length && await User.exists({ email: data.email })) {
    add('email', 'هذا البريد مستخدم لحساب آخر (عميل أو موظف أو بائع). استخدم بريداً مختلفاً لحساب البائع.', 'This email already belongs to another account (customer, staff or seller). Use a different email for the seller login.');
  }
  if (errors.length) {
    const status = errors.some((e) => e.field === 'email' && e.en.startsWith('This email already')) ? 409 : 400;
    throw new AppError(errors.map((e) => `${e.ar} — ${e.en}`).join(' · '), status, errors);
  }
  return data;
}

/** Create the Seller + owner User for a validated application. */
export async function createSellerWithOwner(data, { status = 'applied', actor = null, termsAccepted = false } = {}) {
  const slug = await uniqueSellerSlug(data.nameEn);
  const termsVersion = termsAccepted ? ((await getMarketplaceSettings()).termsVersion || 1) : 0;
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
    termsAcceptedVersion: termsVersion,
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
  const live = { seller: seller._id, isActive: true };
  const [productCount, offerCount, sold, featured] = await Promise.all([
    Product.countDocuments(live),
    Product.countDocuments(buildOffersProductFilter(live)),
    Product.aggregate([{ $match: live }, { $group: { _id: null, total: { $sum: { $ifNull: ['$soldCount', 0] } } } }]),
    featuredProductsFor(seller),
  ]);
  res.json({
    success: true,
    data: {
      ...formatSellerPublic(seller),
      productCount,
      offerCount,
      soldCount: sold[0]?.total || 0,
      featuredProducts: featured.map((p) => formatProduct(p)),
    },
  });
});
