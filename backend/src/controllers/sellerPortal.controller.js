/**
 * Seller portal (/api/seller/*). Every query here is scoped by `req.seller._id` — a seller can
 * only ever see or change its own records. Ids from the request are looked up *within* that scope,
 * so another seller's id simply 404s.
 */
import mongoose from 'mongoose';
import Product from '../models/Product.js';
import Category from '../models/Category.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { formatProduct } from '../utils/formatters.js';
import { parsePagination, paginationMeta } from '../utils/listQuery.js';
import { resolveProductCategoryFields } from '../utils/productCategorySync.js';
import { resolveProductSku } from '../utils/productSku.js';
import {
  uploadFilesToCloudinary,
  uploadFileToCloudinary,
  deleteFromCloudinary,
  deleteManyFromCloudinary,
  CLOUDINARY_FOLDERS,
} from '../utils/cloudinaryUpload.js';
import {
  getMarketplaceSettings,
  formatSellerPrivate,
  sanitizeSellerProductInput,
  uniqueProductSlug,
  changeSellerStatus,
  sellerUsers,
} from '../services/marketplace.service.js';
import { SELLER_DOCUMENT_TYPES, LISTING_STATUSES } from '../constants/marketplace.js';
import { normalizePhone } from '../utils/phone.js';

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ── Profile ──

export const getSellerMe = asyncHandler(async (req, res) => {
  const [settings, team] = await Promise.all([
    getMarketplaceSettings(),
    req.user.role === 'seller_owner' ? sellerUsers(req.seller._id) : [],
  ]);
  res.json({
    success: true,
    data: {
      seller: formatSellerPrivate(req.seller, { revealBank: req.user.role === 'seller_owner' }),
      user: { id: req.user._id, name: req.user.name, email: req.user.email, role: req.user.role },
      team,
      marketplace: {
        defaultCommissionRate: settings.defaultCommissionRate,
        payoutHoldDays: settings.payoutHoldDays,
        reviewContentEdits: settings.reviewContentEdits,
      },
    },
  });
});

/** Legal identity is editable until the store is approved; storefront fields any time. */
export const updateSellerProfile = asyncHandler(async (req, res) => {
  const seller = req.seller;
  const body = req.body || {};
  const str = (v, max = 2000) => String(v ?? '').trim().slice(0, max);

  ['descriptionAr', 'descriptionEn', 'contactName'].forEach((f) => {
    if (body[f] !== undefined) seller[f] = str(body[f]);
  });
  if (body.phone !== undefined) {
    const phone = normalizePhone(str(body.phone, 30));
    if (!phone) throw new AppError('Invalid phone number', 400);
    seller.phone = phone;
  }
  const address = typeof body.address === 'string' ? JSON.parse(body.address) : body.address;
  if (address && typeof address === 'object') {
    ['street', 'city', 'governorate'].forEach((f) => {
      if (address[f] !== undefined) seller.address[f] = str(address[f], 200);
    });
  }
  if (body.handlingDays !== undefined) {
    const days = Math.round(Number(body.handlingDays));
    if (!Number.isFinite(days) || days < 0 || days > 30) throw new AppError('Handling days must be 0–30', 400);
    seller.handlingDays = days;
  }
  if (body.defaultFulfillment !== undefined) {
    if (!seller.allowedFulfillment.includes(body.defaultFulfillment)) {
      throw new AppError('This fulfillment option is not enabled for your store', 400);
    }
    seller.defaultFulfillment = body.defaultFulfillment;
  }

  if (seller.status !== 'active') {
    ['nameAr', 'nameEn'].forEach((f) => {
      if (body[f] !== undefined && str(body[f], 120).length >= 2) seller[f] = str(body[f], 120);
    });
    ['legalName', 'commercialRegisterNo', 'taxId'].forEach((f) => {
      if (body[f] !== undefined) seller[f] = str(body[f], 200);
    });
  }

  const logo = req.files?.logo?.[0];
  const banner = req.files?.banner?.[0];
  if (logo) {
    const up = await uploadFileToCloudinary(logo, CLOUDINARY_FOLDERS.sellers);
    if (seller.logoPublicId) await deleteFromCloudinary(seller.logoPublicId);
    seller.logoUrl = up.url;
    seller.logoPublicId = up.publicId;
  }
  if (banner) {
    const up = await uploadFileToCloudinary(banner, CLOUDINARY_FOLDERS.sellers);
    if (seller.bannerPublicId) await deleteFromCloudinary(seller.bannerPublicId);
    seller.bannerUrl = up.url;
    seller.bannerPublicId = up.publicId;
  }

  await seller.save();
  res.json({ success: true, data: formatSellerPrivate(seller, { revealBank: req.user.role === 'seller_owner' }) });
});

export const updateSellerBank = asyncHandler(async (req, res) => {
  const str = (v, max = 120) => String(v ?? '').trim().slice(0, max);
  const body = req.body || {};
  ['bankName', 'accountName', 'accountNumber', 'iban', 'walletPhone'].forEach((f) => {
    if (body[f] !== undefined) req.seller.bank[f] = str(body[f]);
  });
  await req.seller.save();
  res.json({ success: true, data: formatSellerPrivate(req.seller, { revealBank: true }) });
});

export const uploadSellerDocument = asyncHandler(async (req, res) => {
  const type = String(req.body.type || '');
  if (!SELLER_DOCUMENT_TYPES.includes(type)) throw new AppError('Unknown document type', 400);
  if (!req.file) throw new AppError('Document image is required', 400);
  if (req.seller.documents.length >= 20) throw new AppError('Too many documents — remove one first', 400);

  const up = await uploadFileToCloudinary(req.file, CLOUDINARY_FOLDERS.sellerDocuments);
  req.seller.documents.push({ type, url: up.url, publicId: up.publicId });
  await req.seller.save();
  res.status(201).json({ success: true, data: req.seller.documents });
});

export const deleteSellerDocument = asyncHandler(async (req, res) => {
  const doc = req.seller.documents.id(req.params.docId);
  if (!doc) throw new AppError('Document not found', 404);
  if (doc.status === 'accepted') throw new AppError('Accepted documents can only be changed by staff', 400);
  if (doc.publicId) await deleteFromCloudinary(doc.publicId);
  doc.deleteOne();
  await req.seller.save();
  res.json({ success: true, data: req.seller.documents });
});

/** A rejected applicant fixes their details and asks for another review. */
export const resubmitApplication = asyncHandler(async (req, res) => {
  if (!['rejected', 'applied'].includes(req.seller.status)) {
    throw new AppError('Your application is not waiting for changes', 400);
  }
  await changeSellerStatus(req.seller, 'under_review', { actor: req.user });
  res.json({ success: true, data: formatSellerPrivate(req.seller, { revealBank: req.user.role === 'seller_owner' }) });
});

// ── Dashboard ──

export const getSellerDashboard = asyncHandler(async (req, res) => {
  const sellerId = req.seller._id;
  const [byStatus, pendingEdits, stock] = await Promise.all([
    Product.aggregate([
      { $match: { seller: sellerId } },
      { $group: { _id: '$listingStatus', count: { $sum: 1 } } },
    ]),
    Product.countDocuments({ seller: sellerId, pendingChangesAt: { $type: 'date' } }),
    Product.aggregate([
      { $match: { seller: sellerId, listingStatus: { $in: ['approved', 'paused'] } } },
      { $project: { available: { $subtract: [{ $ifNull: ['$stock', 0] }, { $ifNull: ['$reservedStock', 0] }] }, hasVariants: { $gt: [{ $size: { $ifNull: ['$variants', []] } }, 0] } } },
      { $match: { hasVariants: false } },
      {
        $group: {
          _id: null,
          outOfStock: { $sum: { $cond: [{ $lte: ['$available', 0] }, 1, 0] } },
          lowStock: { $sum: { $cond: [{ $and: [{ $gt: ['$available', 0] }, { $lte: ['$available', 5] }] }, 1, 0] } },
        },
      },
    ]),
  ]);

  const listings = Object.fromEntries(LISTING_STATUSES.map((s) => [s, 0]));
  byStatus.forEach((row) => { if (row._id in listings) listings[row._id] = row.count; });

  res.json({
    success: true,
    data: {
      status: req.seller.status,
      listings,
      totalProducts: Object.values(listings).reduce((a, b) => a + b, 0),
      pendingEdits,
      outOfStock: stock[0]?.outOfStock || 0,
      lowStock: stock[0]?.lowStock || 0,
    },
  });
});

// ── Products ──

/** [{url, publicId, type}] — the editor's media list (`cloudinaryPublicIds` is stripped for non-staff). */
function mediaList(source) {
  if (!source?.images) return null;
  return source.images.map((url, i) => ({
    url,
    publicId: source.cloudinaryPublicIds?.[i] || '',
    type: source.mediaTypes?.[i] === 'video' ? 'video' : 'image',
  }));
}

/** Seller-facing product view: public shape + moderation state. */
export function formatSellerProduct(product) {
  return {
    ...formatProduct(product),
    media: mediaList(product) || [],
    pendingMedia: mediaList(product.pendingChanges),
    listingStatus: product.listingStatus,
    reviewNote: product.reviewNote || '',
    submittedAt: product.submittedAt,
    reviewedAt: product.reviewedAt,
    pendingChanges: product.pendingChanges || null,
    pendingChangesAt: product.pendingChangesAt,
    fulfilledBy: product.fulfilledBy || 'store',
    reservedStock: product.reservedStock || 0,
  };
}

const POPULATE_CATEGORY = [
  { path: 'category', select: 'slug nameAr nameEn' },
  { path: 'mainCategory', select: 'slug nameAr nameEn' },
];

async function findOwnProduct(req) {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) throw new AppError('Product not found', 404);
  const product = await Product.findOne({ _id: req.params.id, seller: req.seller._id });
  if (!product) throw new AppError('Product not found', 404);
  return product;
}

const canPublishDirectly = (seller) => seller.status === 'active' && seller.autoApproveListings === true;

export const listSellerProducts = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, 100);
  const filter = { seller: req.seller._id };
  if (LISTING_STATUSES.includes(req.query.listingStatus)) filter.listingStatus = req.query.listingStatus;
  if (req.query.pendingEdits === 'true') filter.pendingChangesAt = { $type: 'date' };
  if (req.query.q) {
    const q = escapeRegex(String(req.query.q).slice(0, 100));
    filter.$or = [
      { nameAr: { $regex: q, $options: 'i' } },
      { nameEn: { $regex: q, $options: 'i' } },
      { sku: { $regex: q, $options: 'i' } },
      { barcode: { $regex: q, $options: 'i' } },
    ];
  }
  const [items, total] = await Promise.all([
    Product.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit).populate(POPULATE_CATEGORY),
    Product.countDocuments(filter),
  ]);
  res.json({ success: true, data: items.map(formatSellerProduct), pagination: paginationMeta(page, limit, total) });
});

export const getSellerProduct = asyncHandler(async (req, res) => {
  const product = await findOwnProduct(req);
  await product.populate(POPULATE_CATEGORY);
  res.json({ success: true, data: formatSellerProduct(product) });
});

export const uploadSellerProductMedia = asyncHandler(async (req, res) => {
  if (!req.files?.length) throw new AppError('No media files uploaded', 400);
  const uploaded = await uploadFilesToCloudinary(req.files, CLOUDINARY_FOLDERS.sellerProducts);
  res.json({ success: true, data: uploaded });
});

async function resolveCategoryInput(content, product = null) {
  if (content.category === undefined && content.mainCategory === undefined) return;
  const fields = await resolveProductCategoryFields({
    mainCategory: content.mainCategory ?? product?.mainCategory,
    category: content.category ?? product?.category,
  });
  Object.assign(content, fields);
}

function recordStockChange(product, nextStock) {
  if (nextStock === undefined || nextStock === product.stock) return;
  const entry = { previousStock: product.stock, stock: nextStock, changedAt: new Date() };
  product.stockHistory = [entry, ...(product.stockHistory || [])].slice(0, 20);
  product.stockUpdatedAt = entry.changedAt;
}

/** Keep `reservedStock` of existing variants — a seller edit must not release live reservations. */
function mergeVariants(product, incoming) {
  const existing = new Map((product.variants || []).map((v) => [String(v._id), v]));
  return incoming.map((v) => {
    const prev = v._id ? existing.get(String(v._id)) : null;
    return prev ? { ...v, reservedStock: prev.reservedStock || 0, wholesalePrice: prev.wholesalePrice || 0 } : v;
  });
}

function applyOperational(product, operational) {
  const { variants, stock, ...rest } = operational;
  if (stock !== undefined) {
    recordStockChange(product, stock);
    product.stock = stock;
  }
  if (variants !== undefined) product.variants = mergeVariants(product, variants);
  Object.assign(product, rest);
}

const comparable = (v) => JSON.stringify(v, (_k, val) => (val instanceof mongoose.Types.ObjectId ? String(val) : val));

/** Content fields whose new value differs from what the product shows now. */
function contentDiff(product, content) {
  const changed = {};
  for (const [field, value] of Object.entries(content)) {
    const current = product.toObject()[field];
    if (comparable(current ?? null) !== comparable(value ?? null)) changed[field] = value;
  }
  return changed;
}

/** Cloudinary assets present before but no longer referenced. */
function droppedPublicIds(beforeIds = [], afterIds = []) {
  const keep = new Set(afterIds.filter(Boolean));
  return beforeIds.filter((id) => id && !keep.has(id));
}

export const createSellerProduct = asyncHandler(async (req, res) => {
  const seller = req.seller;
  const { content, operational } = sanitizeSellerProductInput(req.body, seller);

  if (!content.nameAr || !content.nameEn) throw new AppError('Arabic and English names are required', 400);
  if (operational.price == null || operational.price <= 0) throw new AppError('A price above zero is required', 400);
  if (!content.category) throw new AppError('Choose a category', 400);
  await resolveCategoryInput(content);

  const slug = await uniqueProductSlug(content.nameEn);
  const leaf = await Category.findById(content.category).select('slug').lean();
  const sku = await resolveProductSku({
    sku: operational.sku,
    nameEn: content.nameEn,
    brand: content.brand,
    unit: content.unit,
    slug,
    categorySlug: leaf?.slug || '',
  });

  const submit = req.body.submit === true || req.body.submit === 'true';
  const now = new Date();
  const product = new Product({
    ...content,
    ...operational,
    variants: operational.variants || [],
    slug,
    sku,
    seller: seller._id,
    sellerSuspended: seller.status !== 'active',
    fulfilledBy: operational.fulfilledBy || seller.defaultFulfillment || 'seller',
    listingStatus: submit ? (canPublishDirectly(seller) ? 'approved' : 'pending_review') : 'draft',
    submittedAt: submit ? now : null,
    ...(submit && canPublishDirectly(seller) ? { reviewedAt: now } : {}),
    createdBy: req.user._id,
    stockUpdatedAt: now,
  });
  await product.save();
  await product.populate(POPULATE_CATEGORY);
  res.status(201).json({ success: true, data: formatSellerProduct(product) });
});

export const updateSellerProduct = asyncHandler(async (req, res) => {
  const seller = req.seller;
  const product = await findOwnProduct(req);
  const { content, operational } = sanitizeSellerProductInput(req.body, seller);
  if (operational.price !== undefined && !(operational.price > 0)) throw new AppError('A price above zero is required', 400);
  await resolveCategoryInput(content, product);

  if (operational.sku !== undefined && operational.sku !== product.sku) {
    operational.sku = operational.sku
      ? await resolveProductSku({ sku: operational.sku, excludeProductId: product._id })
      : product.sku;
  }

  const settings = await getMarketplaceSettings();
  const live = ['approved', 'paused'].includes(product.listingStatus);
  const needsReview = live && settings.reviewContentEdits && !canPublishDirectly(seller);

  applyOperational(product, operational);

  let dropped = [];
  if (needsReview) {
    const changed = contentDiff(product, content);
    if (Object.keys(changed).length) {
      // Media uploaded for an earlier pending edit that this edit replaces is orphaned.
      if (changed.cloudinaryPublicIds && product.pendingChanges?.cloudinaryPublicIds) {
        dropped = droppedPublicIds(
          droppedPublicIds(product.pendingChanges.cloudinaryPublicIds, product.cloudinaryPublicIds),
          changed.cloudinaryPublicIds,
        );
      }
      product.pendingChanges = { ...(product.pendingChanges || {}), ...changed };
      product.pendingChangesAt = new Date();
      product.markModified('pendingChanges');
    }
  } else {
    if (content.cloudinaryPublicIds) dropped = droppedPublicIds(product.cloudinaryPublicIds, content.cloudinaryPublicIds);
    Object.assign(product, content);
  }

  await product.save();
  if (dropped.length) await deleteManyFromCloudinary(dropped);
  await product.populate(POPULATE_CATEGORY);
  res.json({
    success: true,
    data: formatSellerProduct(product),
    pendingReview: needsReview && Boolean(product.pendingChangesAt),
  });
});

export const submitSellerProduct = asyncHandler(async (req, res) => {
  const product = await findOwnProduct(req);
  if (!['draft', 'rejected'].includes(product.listingStatus)) {
    throw new AppError('Only drafts or rejected products can be submitted', 400);
  }
  const now = new Date();
  product.listingStatus = canPublishDirectly(req.seller) ? 'approved' : 'pending_review';
  product.submittedAt = now;
  if (product.listingStatus === 'approved') product.reviewedAt = now;
  product.reviewNote = '';
  await product.save();
  await product.populate(POPULATE_CATEGORY);
  res.json({ success: true, data: formatSellerProduct(product) });
});

export const pauseSellerProduct = asyncHandler(async (req, res) => {
  const product = await findOwnProduct(req);
  if (product.listingStatus !== 'approved') throw new AppError('Only live products can be paused', 400);
  product.listingStatus = 'paused';
  await product.save();
  await product.populate(POPULATE_CATEGORY);
  res.json({ success: true, data: formatSellerProduct(product) });
});

export const unpauseSellerProduct = asyncHandler(async (req, res) => {
  const product = await findOwnProduct(req);
  if (product.listingStatus !== 'paused') throw new AppError('This product is not paused', 400);
  product.listingStatus = 'approved';
  await product.save();
  await product.populate(POPULATE_CATEGORY);
  res.json({ success: true, data: formatSellerProduct(product) });
});

/** Drop a pending content edit — the live listing stays as it is. */
export const discardSellerProductChanges = asyncHandler(async (req, res) => {
  const product = await findOwnProduct(req);
  const orphaned = droppedPublicIds(product.pendingChanges?.cloudinaryPublicIds || [], product.cloudinaryPublicIds);
  product.pendingChanges = null;
  product.pendingChangesAt = null;
  await product.save();
  if (orphaned.length) await deleteManyFromCloudinary(orphaned);
  await product.populate(POPULATE_CATEGORY);
  res.json({ success: true, data: formatSellerProduct(product) });
});

export const deleteSellerProduct = asyncHandler(async (req, res) => {
  const product = await findOwnProduct(req);
  if ((product.soldCount || 0) > 0) {
    throw new AppError('This product has sales history — pause it instead of deleting', 400);
  }
  const ids = [...(product.cloudinaryPublicIds || []), ...(product.pendingChanges?.cloudinaryPublicIds || [])];
  await product.deleteOne();
  if (ids.length) await deleteManyFromCloudinary([...new Set(ids.filter(Boolean))]);
  res.json({ success: true });
});

/** Quick stock edit from the product list. */
export const updateSellerProductStock = asyncHandler(async (req, res) => {
  const product = await findOwnProduct(req);
  const { operational } = sanitizeSellerProductInput({ stock: req.body.stock, variants: req.body.variants }, req.seller);
  applyOperational(product, operational);
  await product.save();
  await product.populate(POPULATE_CATEGORY);
  res.json({ success: true, data: formatSellerProduct(product) });
});
