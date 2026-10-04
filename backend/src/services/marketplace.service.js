import crypto from 'node:crypto';
import mongoose from 'mongoose';
import MarketplaceSettings from '../models/MarketplaceSettings.js';
import Seller from '../models/Seller.js';
import Product from '../models/Product.js';
import User from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { slugify } from '../utils/slugify.js';
import {
  DEFAULT_MARKETPLACE_SETTINGS,
  FULFILLMENT_MODES,
  SELLER_CONTENT_FIELDS,
  SELLER_OPERATIONAL_FIELDS,
} from '../constants/marketplace.js';

const CACHE_MS = 30_000;
let settingsCache = { at: 0, value: null };

export function invalidateMarketplaceSettingsCache() {
  settingsCache = { at: 0, value: null };
}

export async function getMarketplaceSettingsDoc() {
  return MarketplaceSettings.findOneAndUpdate(
    { key: 'main' },
    { $setOnInsert: { key: 'main' } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
}

/** Plain marketplace settings, cached for 30s. */
export async function getMarketplaceSettings() {
  if (settingsCache.value && Date.now() - settingsCache.at < CACHE_MS) return settingsCache.value;
  const doc = await getMarketplaceSettingsDoc();
  const value = { ...DEFAULT_MARKETPLACE_SETTINGS, ...doc.toObject() };
  settingsCache = { at: Date.now(), value };
  return value;
}

// ── Commission ──

const idOf = (v) => String(v?._id || v || '');

/**
 * Commission % for one product line. Most specific rule wins:
 * seller × category → seller rate → marketplace × category → marketplace default.
 * A category rule matches the product's leaf category or any of its ancestors (deepest first).
 */
export function resolveCommissionRate({ seller, product, settings }) {
  const chain = [
    idOf(product?.category),
    ...[...(product?.categoryAncestors || [])].reverse().map(idOf),
    idOf(product?.mainCategory),
  ].filter(Boolean);

  const matchIn = (rules = []) => {
    for (const categoryId of chain) {
      const hit = rules.find((r) => idOf(r.category) === categoryId);
      if (hit) return Number(hit.rate);
    }
    return null;
  };

  const sellerCategory = matchIn(seller?.categoryCommissions);
  if (sellerCategory != null) return sellerCategory;
  if (seller?.commissionRate != null) return Number(seller.commissionRate);
  const globalCategory = matchIn(settings?.categoryCommissions);
  if (globalCategory != null) return globalCategory;
  return Number(settings?.defaultCommissionRate ?? DEFAULT_MARKETPLACE_SETTINGS.defaultCommissionRate);
}

// ── Sellers ──

export async function uniqueSellerSlug(nameEn, excludeId = null) {
  const base = slugify(nameEn) || `seller-${crypto.randomBytes(3).toString('hex')}`;
  let slug = base;
  let n = 2;
  // eslint-disable-next-line no-await-in-loop
  while (await Seller.exists({ slug, ...(excludeId ? { _id: { $ne: excludeId } } : {}) })) {
    slug = `${base}-${n}`;
    n += 1;
  }
  return slug;
}

export async function uniqueProductSlug(nameEn, excludeId = null) {
  const base = slugify(nameEn) || `item-${crypto.randomBytes(3).toString('hex')}`;
  let slug = base;
  let n = 2;
  // eslint-disable-next-line no-await-in-loop
  while (await Product.exists({ slug, ...(excludeId ? { _id: { $ne: excludeId } } : {}) })) {
    slug = `${base}-${n}`;
    n += 1;
  }
  return slug;
}

/**
 * Re-derive public visibility of every product of a seller after a status change.
 * Query updates skip the Product validate hook, so isActive is written explicitly here.
 */
export async function syncSellerProductVisibility(sellerId) {
  const seller = await Seller.findById(sellerId).select('status').lean();
  const suspended = seller?.status !== 'active';
  await Product.updateMany({ seller: sellerId }, { $set: { sellerSuspended: suspended } });
  await Product.updateMany(
    { seller: sellerId, listingStatus: 'approved', sellerSuspended: false },
    { $set: { isActive: true } },
  );
  await Product.updateMany(
    { seller: sellerId, $or: [{ listingStatus: { $ne: 'approved' } }, { sellerSuspended: true }] },
    { $set: { isActive: false } },
  );
}

/** Copy the seller's public name/slug onto its products (kept denormalized for the storefront). */
export async function syncSellerProductNames(seller) {
  await Product.updateMany(
    { seller: seller._id },
    { $set: { sellerNameAr: seller.nameAr, sellerNameEn: seller.nameEn, sellerSlug: seller.slug } },
  );
}

const ALLOWED_TRANSITIONS = {
  applied: ['under_review', 'active', 'rejected'],
  under_review: ['active', 'rejected'],
  active: ['suspended'],
  suspended: ['active'],
  rejected: ['under_review', 'active'],
};

export async function changeSellerStatus(seller, nextStatus, { reason = '', actor = null } = {}) {
  if (seller.status === nextStatus) return seller;
  if (!ALLOWED_TRANSITIONS[seller.status]?.includes(nextStatus)) {
    throw new AppError(`Cannot change seller from ${seller.status} to ${nextStatus}`, 400);
  }
  if ((nextStatus === 'rejected' || nextStatus === 'suspended') && !String(reason).trim()) {
    throw new AppError('A reason is required', 400);
  }
  seller.status = nextStatus;
  seller.statusReason = String(reason || '').trim();
  seller.statusHistory.push({ status: nextStatus, reason: seller.statusReason, changedBy: actor?._id || null });
  if (nextStatus === 'active' && !seller.approvedAt) {
    seller.approvedAt = new Date();
    seller.approvedBy = actor?._id || null;
  }
  await seller.save();
  await syncSellerProductVisibility(seller._id);
  return seller;
}

const maskTail = (value, keep = 4) => {
  const s = String(value || '');
  if (!s) return '';
  return s.length <= keep ? s : `${'•'.repeat(Math.min(8, s.length - keep))}${s.slice(-keep)}`;
};

/** Storefront-safe seller card. */
export function formatSellerPublic(seller) {
  if (!seller) return null;
  return {
    _id: seller._id,
    slug: seller.slug,
    nameAr: seller.nameAr,
    nameEn: seller.nameEn,
    descriptionAr: seller.descriptionAr || '',
    descriptionEn: seller.descriptionEn || '',
    logoUrl: seller.logoUrl || '',
    bannerUrl: seller.bannerUrl || '',
    rating: seller.rating || 0,
    ratingCount: seller.ratingCount || 0,
    handlingDays: seller.handlingDays ?? 2,
    city: seller.address?.city || '',
    joinedAt: seller.approvedAt || seller.createdAt,
  };
}

/** Full seller profile for the seller itself and staff. Bank numbers masked unless `revealBank`. */
export function formatSellerPrivate(seller, { revealBank = false } = {}) {
  if (!seller) return null;
  const s = seller.toObject ? seller.toObject() : seller;
  const bank = s.bank || {};
  return {
    ...formatSellerPublic(s),
    status: s.status,
    statusReason: s.statusReason || '',
    statusHistory: s.statusHistory || [],
    legalName: s.legalName || '',
    commercialRegisterNo: s.commercialRegisterNo || '',
    taxId: s.taxId || '',
    contactName: s.contactName || '',
    email: s.email || '',
    phone: s.phone || '',
    address: s.address || {},
    bank: revealBank ? bank : {
      ...bank,
      accountNumber: maskTail(bank.accountNumber),
      iban: maskTail(bank.iban),
    },
    documents: s.documents || [],
    commissionRate: s.commissionRate,
    categoryCommissions: s.categoryCommissions || [],
    allowedFulfillment: s.allowedFulfillment || ['seller'],
    defaultFulfillment: s.defaultFulfillment || 'seller',
    deliveryZones: s.deliveryZones || [],
    autoApproveListings: s.autoApproveListings === true,
    intendedCategories: s.intendedCategories || [],
    applicationNote: s.applicationNote || '',
    termsAcceptedAt: s.termsAcceptedAt,
    approvedAt: s.approvedAt,
    owner: s.owner,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  };
}

// ── Seller product input ──

const toNum = (v, { min = 0 } = {}) => {
  if (v === '' || v == null) return undefined;
  const n = Number(v);
  if (!Number.isFinite(n) || n < min) throw new AppError(`Invalid number: ${v}`, 400);
  return n;
};

const cleanStr = (v, max = 5000) => (v == null ? undefined : String(v).trim().slice(0, max));

function sanitizeVariants(variants) {
  if (!Array.isArray(variants)) return undefined;
  return variants.slice(0, 50).map((v) => ({
    ...(v._id && mongoose.Types.ObjectId.isValid(v._id) ? { _id: v._id } : {}),
    type: cleanStr(v.type, 40),
    valueAr: cleanStr(v.valueAr, 120),
    valueEn: cleanStr(v.valueEn, 120),
    sku: cleanStr(v.sku, 80),
    barcode: cleanStr(v.barcode, 80),
    price: toNum(v.price),
    oldPrice: toNum(v.oldPrice) ?? null,
    stock: Math.floor(toNum(v.stock) ?? 0),
    isDefault: v.isDefault === true,
  }));
}

function sanitizeSpecs(specs) {
  if (!Array.isArray(specs)) return undefined;
  return specs.slice(0, 40).map((s) => ({
    keyAr: cleanStr(s.keyAr, 120),
    keyEn: cleanStr(s.keyEn, 120),
    valueAr: cleanStr(s.valueAr, 500),
    valueEn: cleanStr(s.valueEn, 500),
  }));
}

function sanitizeMedia(media) {
  if (!Array.isArray(media)) return undefined;
  const items = media
    .slice(0, 12)
    // Only media uploaded through our Cloudinary account — no hot-linked third-party URLs.
    .filter((m) => typeof m?.url === 'string' && /^https:\/\/res\.cloudinary\.com\//.test(m.url));
  return {
    images: items.map((m) => m.url),
    cloudinaryPublicIds: items.map((m) => String(m.publicId || '')),
    mediaTypes: items.map((m) => (m.type === 'video' ? 'video' : 'image')),
  };
}

/**
 * Whitelist + coerce a seller's product payload. Returns `{ content, operational }` so callers
 * can route content edits of live listings to review while price/stock apply immediately.
 */
export function sanitizeSellerProductInput(body = {}, seller) {
  const content = {};
  const operational = {};

  for (const field of SELLER_CONTENT_FIELDS) {
    if (body[field] === undefined) continue;
    if (field === 'specs') content.specs = sanitizeSpecs(body.specs);
    else if (field === 'searchKeywordsAr' || field === 'searchKeywordsEn') {
      content[field] = (Array.isArray(body[field]) ? body[field] : String(body[field]).split(','))
        .map((k) => String(k).trim()).filter(Boolean).slice(0, 30);
    } else content[field] = cleanStr(body[field]);
  }
  if (body.media !== undefined) Object.assign(content, sanitizeMedia(body.media));

  for (const field of SELLER_OPERATIONAL_FIELDS) {
    if (body[field] === undefined) continue;
    if (field === 'price') operational.price = toNum(body.price);
    else if (field === 'oldPrice') operational.oldPrice = toNum(body.oldPrice) ?? null;
    else if (field === 'stock') operational.stock = Math.floor(toNum(body.stock) ?? 0);
    else if (field === 'variants') operational.variants = sanitizeVariants(body.variants);
    else if (field === 'sku') operational.sku = cleanStr(body.sku, 80);
    else if (field === 'fulfilledBy') {
      const mode = String(body.fulfilledBy);
      const allowed = seller?.allowedFulfillment?.length ? seller.allowedFulfillment : ['seller'];
      if (!FULFILLMENT_MODES.includes(mode) || !allowed.includes(mode)) {
        throw new AppError('This fulfillment option is not enabled for your store', 400);
      }
      operational.fulfilledBy = mode;
    }
  }

  if (operational.oldPrice != null && operational.price != null && operational.oldPrice <= operational.price) {
    operational.oldPrice = null;
  }
  return { content, operational };
}

/** Seller ids of users — tiny helper for routes that receive a seller user. */
export async function loadSellerForUser(user) {
  if (!user?.seller) return null;
  return Seller.findById(user.seller);
}

export async function sellerUsers(sellerId) {
  return User.find({ seller: sellerId }).select('name email role isActive lastLoginAt createdAt').lean();
}
