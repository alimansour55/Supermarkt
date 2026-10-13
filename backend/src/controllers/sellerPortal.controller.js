/**
 * Seller portal (/api/seller/*). Every query here is scoped by `req.seller._id` — a seller can
 * only ever see or change its own records. Ids from the request are looked up *within* that scope,
 * so another seller's id simply 404s.
 */
import mongoose from 'mongoose';
import Product from '../models/Product.js';
import Order from '../models/Order.js';
import Shipment, { SHIPMENT_STATUSES } from '../models/Shipment.js';
import { formatShipmentForSeller, updateShipmentStatus } from '../services/marketplaceOrder.service.js';
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
  uploadPrivateFileToCloudinary,
  CLOUDINARY_FOLDERS,
} from '../utils/cloudinaryUpload.js';
import {
  getMarketplaceSettings,
  formatSellerPrivate,
  sanitizeSellerProductInput,
  uniqueProductSlug,
  changeSellerStatus,
  sellerUsers,
  syncSellerProductNames,
  documentsWithLinks,
} from '../services/marketplace.service.js';
import { SELLER_DOCUMENT_TYPES, LISTING_STATUSES, sellerUserPermissions } from '../constants/marketplace.js';
import { normalizePhone } from '../utils/phone.js';
import { parseCsv, toCsv, sendCsv } from '../utils/csvExport.js';
import { logSellerActivity, diffFields } from '../services/sellerActivity.service.js';
import {
  ownSellerCategoryIds,
  resolveSellerCategoryNames,
  sellerCategoryWithChildren,
} from '../services/sellerCategory.service.js';

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
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        permissions: sellerUserPermissions(req.user),
      },
      team,
      marketplace: {
        defaultCommissionRate: settings.defaultCommissionRate,
        payoutHoldDays: settings.payoutHoldDays,
        reviewContentEdits: settings.reviewContentEdits,
        minPayoutAmount: settings.minPayoutAmount,
        storeFulfillmentFeePerItem: settings.storeFulfillmentFeePerItem,
        sellerShipmentDeliveryFee: settings.sellerShipmentDeliveryFee,
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

  const notificationPrefs = typeof body.notificationPrefs === 'string' ? JSON.parse(body.notificationPrefs) : body.notificationPrefs;
  if (notificationPrefs && typeof notificationPrefs === 'object') {
    ['emailOrders', 'whatsappOrders', 'emailLowStock', 'shipByReminders'].forEach((k) => {
      if (notificationPrefs[k] !== undefined) seller.set(`notificationPrefs.${k}`, notificationPrefs[k] === true);
    });
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

  const renamed = seller.isModified('nameAr') || seller.isModified('nameEn');
  await seller.save();
  if (renamed) await syncSellerProductNames(seller);
  await logSellerActivity(req, { action: 'store.profile', entityType: 'seller', entityId: seller._id, label: seller.nameEn });
  res.json({ success: true, data: formatSellerPrivate(seller, { revealBank: req.user.role === 'seller_owner' }) });
});

export const updateSellerBank = asyncHandler(async (req, res) => {
  const str = (v, max = 120) => String(v ?? '').trim().slice(0, max);
  const body = req.body || {};
  ['bankName', 'accountName', 'accountNumber', 'iban', 'walletPhone'].forEach((f) => {
    if (body[f] !== undefined) req.seller.bank[f] = str(body[f]);
  });
  await req.seller.save();
  await logSellerActivity(req, { action: 'store.bank', entityType: 'seller', entityId: req.seller._id });
  res.json({ success: true, data: formatSellerPrivate(req.seller, { revealBank: true }) });
});

export const uploadSellerDocument = asyncHandler(async (req, res) => {
  const type = String(req.body.type || '');
  if (!SELLER_DOCUMENT_TYPES.includes(type)) throw new AppError('Unknown document type', 400);
  if (!req.file) throw new AppError('Document image is required', 400);
  if (req.seller.documents.length >= 20) throw new AppError('Too many documents — remove one first', 400);

  // ID cards and registers are private: no public URL, staff see them through expiring links.
  const up = await uploadPrivateFileToCloudinary(req.file, CLOUDINARY_FOLDERS.sellerDocuments);
  req.seller.documents.push({ type, publicId: up.publicId, format: up.format, private: true });
  await req.seller.save();
  res.status(201).json({ success: true, data: documentsWithLinks(req.seller.documents) });
});

export const deleteSellerDocument = asyncHandler(async (req, res) => {
  const doc = req.seller.documents.id(req.params.docId);
  if (!doc) throw new AppError('Document not found', 404);
  if (doc.status === 'accepted') throw new AppError('Accepted documents can only be changed by staff', 400);
  if (doc.publicId) await deleteFromCloudinary(doc.publicId, 'image', doc.private ? 'authenticated' : 'upload');
  doc.deleteOne();
  await req.seller.save();
  res.json({ success: true, data: documentsWithLinks(req.seller.documents) });
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
  const since30 = new Date(Date.now() - 30 * 86400000);
  const [byStatus, pendingEdits, stock, shipmentRows, sales30] = await Promise.all([
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
    Shipment.aggregate([
      { $match: { seller: sellerId } },
      { $group: { _id: { status: '$status', fulfilledBy: '$fulfilledBy' }, count: { $sum: 1 } } },
    ]),
    Shipment.aggregate([
      { $match: { seller: sellerId, status: 'delivered', deliveredAt: { $gte: since30 } } },
      { $group: { _id: null, gross: { $sum: '$subtotal' }, net: { $sum: '$sellerNet' }, orders: { $sum: 1 } } },
    ]),
  ]);
  const countShipments = (statuses, fulfilledBy) => shipmentRows
    .filter((r) => statuses.includes(r._id.status) && (!fulfilledBy || r._id.fulfilledBy === fulfilledBy))
    .reduce((sum, r) => sum + r.count, 0);

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
      orders: {
        toConfirm: countShipments(['pending'], 'seller'),
        toShip: countShipments(['confirmed', 'packed'], 'seller'),
        inTransit: countShipments(['shipped']),
        storeFulfilledOpen: countShipments(['pending', 'confirmed', 'shipped'], 'store'),
      },
      last30Days: {
        orders: sales30[0]?.orders || 0,
        gross: Math.round((sales30[0]?.gross || 0) * 100) / 100,
        net: Math.round((sales30[0]?.net || 0) * 100) / 100,
      },
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
    sellerCategories: (product.sellerCategories || []).map((c) => String(c?._id ?? c)),
    lowStockThreshold: product.lowStockThreshold ?? null,
    hasMarketplaceCategory: Boolean(product.category),
    categorySuggestion: product.categorySuggestion || '',
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
/** Auto-approved sellers still go through review when staff must place the product in a category. */
const canPublish = (seller, product) => canPublishDirectly(seller) && Boolean(product.category);

export const listSellerProducts = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, 100);
  const filter = { seller: req.seller._id };
  if (LISTING_STATUSES.includes(req.query.listingStatus)) filter.listingStatus = req.query.listingStatus;
  if (req.query.pendingEdits === 'true') filter.pendingChangesAt = { $type: 'date' };
  if (req.query.sellerCategory === 'none') {
    filter.sellerCategories = { $size: 0 };
  } else if (req.query.sellerCategory) {
    const ids = await sellerCategoryWithChildren(req.seller._id, req.query.sellerCategory);
    filter.sellerCategories = { $in: ids || [] };
  }
  if (req.query.stock === 'out') filter.stock = { $lte: 0 };
  else if (req.query.stock === 'low') filter.stock = { $gt: 0, $lte: 5 };
  if (req.query.q) {
    const q = escapeRegex(String(req.query.q).slice(0, 100));
    filter.$or = [
      { nameAr: { $regex: q, $options: 'i' } },
      { nameEn: { $regex: q, $options: 'i' } },
      { sku: { $regex: q, $options: 'i' } },
      { barcode: { $regex: q, $options: 'i' } },
    ];
  }
  const SORTS = {
    updated: { updatedAt: -1 },
    newest: { createdAt: -1 },
    name: { nameEn: 1 },
    'price-asc': { price: 1 },
    'price-desc': { price: -1 },
    'stock-asc': { stock: 1 },
    'best-selling': { soldCount: -1 },
  };
  const [items, total] = await Promise.all([
    Product.find(filter).sort(SORTS[req.query.sort] || SORTS.updated).skip(skip).limit(limit).populate(POPULATE_CATEGORY),
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

/**
 * Resolve the marketplace category of a seller payload. It's optional: an empty value leaves
 * the product uncategorized (staff place it on review) — except on a live listing, which
 * keeps its current category.
 */
async function resolveCategoryInput(content, product = null) {
  if (content.category === undefined && content.mainCategory === undefined) return;
  if (!content.category) {
    const live = product && ['approved', 'paused'].includes(product.listingStatus);
    delete content.mainCategory;
    if (live || content.category === undefined) {
      delete content.category;
      return;
    }
    content.category = null;
    content.mainCategory = null;
    return;
  }
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

/**
 * Stock of a store-fulfilled product is physically in the store's warehouse — the seller can't
 * type it in; it changes only when staff receive an inbound shipment (or sell it). Switching
 * fulfillment mode is allowed only while no warehouse stock is held.
 */
function guardStoreHeldStock(product, operational) {
  const heldNow = product.fulfilledBy === 'store';
  const switching = operational.fulfilledBy && operational.fulfilledBy !== product.fulfilledBy;
  const warehouseUnits = (product.stock || 0) + (product.variants || []).reduce((s, v) => s + (v.stock || 0), 0);

  if (switching && heldNow && warehouseUnits > 0) {
    throw new AppError('Your units are in our warehouse — ask staff to return them before switching to shipping yourself', 400);
  }
  if (switching && operational.fulfilledBy === 'store') {
    // Moving to store fulfillment: the seller's own stock doesn't come along.
    operational.stock = 0;
    if (operational.variants) operational.variants = operational.variants.map((v) => ({ ...v, stock: 0 }));
    else product.variants = (product.variants || []).map((v) => ({ ...v.toObject(), stock: 0 }));
    return;
  }
  if (heldNow && !switching) {
    if (operational.stock !== undefined && operational.stock !== product.stock) {
      throw new AppError('Stock of store-fulfilled items is updated when we receive your inbound shipments', 400);
    }
    delete operational.stock;
    if (operational.variants) {
      const prev = new Map((product.variants || []).map((v) => [String(v._id), v.stock || 0]));
      operational.variants = operational.variants.map((v) => ({ ...v, stock: v._id ? prev.get(String(v._id)) ?? 0 : 0 }));
    }
  }
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

/**
 * Create one seller product (form or CSV row). Store-fulfilled products start at zero stock:
 * their stock lives in the store's warehouse and only grows through received inbound shipments.
 */
export async function createProductForSeller(seller, user, body, { submit = false } = {}) {
  const { content, operational } = sanitizeSellerProductInput(body, seller);

  if (!content.nameAr || !content.nameEn) throw new AppError('Arabic and English names are required', 400);
  if (operational.price == null || operational.price <= 0) throw new AppError('A price above zero is required', 400);
  await resolveCategoryInput(content);
  if (operational.sellerCategories) operational.sellerCategories = await ownSellerCategoryIds(seller._id, operational.sellerCategories);

  const slug = await uniqueProductSlug(content.nameEn);
  const leaf = content.category ? await Category.findById(content.category).select('slug').lean() : null;
  const sku = await resolveProductSku({
    sku: operational.sku,
    nameEn: content.nameEn,
    brand: content.brand,
    unit: content.unit,
    slug,
    categorySlug: leaf?.slug || '',
  });

  const now = new Date();
  const fulfilledBy = operational.fulfilledBy || seller.defaultFulfillment || 'seller';
  const storeHeld = fulfilledBy === 'store';
  const publishNow = submit && canPublish(seller, content);
  const product = new Product({
    ...content,
    ...operational,
    ...(storeHeld ? { stock: 0 } : {}),
    variants: (operational.variants || []).map((v) => (storeHeld ? { ...v, stock: 0 } : v)),
    slug,
    sku,
    seller: seller._id,
    sellerNameAr: seller.nameAr,
    sellerNameEn: seller.nameEn,
    sellerSlug: seller.slug,
    sellerSuspended: seller.status !== 'active',
    fulfilledBy,
    listingStatus: submit ? (publishNow ? 'approved' : 'pending_review') : 'draft',
    submittedAt: submit ? now : null,
    ...(publishNow ? { reviewedAt: now } : {}),
    createdBy: user._id,
    stockUpdatedAt: now,
  });
  await product.save();
  return product;
}

export const createSellerProduct = asyncHandler(async (req, res) => {
  const submit = req.body.submit === true || req.body.submit === 'true';
  const product = await createProductForSeller(req.seller, req.user, req.body, { submit });
  await product.populate(POPULATE_CATEGORY);
  await logSellerActivity(req, { action: 'product.create', entityType: 'product', entityId: product._id, label: product.nameEn });
  res.status(201).json({ success: true, data: formatSellerProduct(product) });
});

const CSV_COLUMNS = ['nameAr', 'nameEn', 'price'];
const MAX_IMPORT_ROWS = 500;

/**
 * Bulk create drafts from CSV text. Required columns: nameAr, nameEn, price.
 * Optional: `category` (marketplace category — Arabic/English name or slug; `categorySlug` is
 * accepted too), `storeCategory` (the seller's own sections, "Honey|Gift boxes" — missing ones
 * are created), descriptionAr, descriptionEn, oldPrice, stock, brand, sku, barcode, unit, size,
 * fulfilledBy. Images are added afterwards in the editor. Returns a result per row.
 */
export const importSellerProducts = asyncHandler(async (req, res) => {
  const { records, headers } = parseCsv(String(req.body?.csv || '').replace(/^﻿/, ''));
  const missing = CSV_COLUMNS.filter((c) => !headers.includes(c));
  if (missing.length) throw new AppError(`Missing columns: ${missing.join(', ')}`, 400);
  if (!records.length) throw new AppError('The file has no product rows', 400);
  if (records.length > MAX_IMPORT_ROWS) throw new AppError(`Up to ${MAX_IMPORT_ROWS} rows per file`, 400);

  // Match a category by slug, Arabic name or English name (case-insensitive).
  const categories = await Category.find({ isActive: true }).select('_id slug nameAr nameEn').lean();
  const categoryByKey = new Map();
  for (const c of categories) {
    [c.slug, c.nameAr, c.nameEn].filter(Boolean).forEach((k) => {
      const key = String(k).trim().toLowerCase();
      if (!categoryByKey.has(key)) categoryByKey.set(key, c._id);
    });
  }

  const results = [];
  for (const [i, row] of records.entries()) {
    const line = i + 2; // header is line 1
    try {
      const wanted = String(row.category || row.categorySlug || '').trim();
      const category = wanted ? categoryByKey.get(wanted.toLowerCase()) : null;
      if (wanted && !category) throw new AppError(`Unknown category "${wanted}"`, 400);
      // eslint-disable-next-line no-await-in-loop
      const sellerCategories = await resolveSellerCategoryNames(req.seller._id, row.storeCategory || row.storeCategories);
      // eslint-disable-next-line no-await-in-loop
      const product = await createProductForSeller(req.seller, req.user, {
        ...row,
        category: category ? String(category) : undefined,
        sellerCategories,
        ...(row.fulfilledBy ? {} : { fulfilledBy: undefined }),
      });
      results.push({ line, ok: true, productId: product._id, nameEn: product.nameEn });
    } catch (err) {
      results.push({ line, ok: false, nameEn: row.nameEn || '', error: err.message });
    }
  }
  const created = results.filter((r) => r.ok).length;
  if (created) await logSellerActivity(req, { action: 'product.import', label: `${created} products`, details: { created, failed: results.length - created } });
  res.status(created ? 201 : 400).json({ success: created > 0, created, failed: results.length - created, results });
});

/**
 * Copy a product into a new draft — same details, price, variants and sections. Photos are not
 * copied: each listing owns its uploads, so deleting one never breaks the other.
 */
export const duplicateSellerProduct = asyncHandler(async (req, res) => {
  const source = await findOwnProduct(req);
  const pending = source.pendingChanges || {};
  const base = { ...source.toObject(), ...pending };
  const copy = await createProductForSeller(req.seller, req.user, {
    ...Object.fromEntries(['descriptionAr', 'descriptionEn', 'brand', 'size', 'unit', 'unitAr', 'unitEn', 'emoji',
      'searchKeywordsAr', 'searchKeywordsEn', 'specs', 'price', 'oldPrice'].map((k) => [k, base[k]])),
    nameAr: `${base.nameAr} (نسخة)`.slice(0, 200),
    nameEn: `${base.nameEn} (copy)`.slice(0, 200),
    category: base.category ? String(base.category) : undefined,
    sellerCategories: (source.sellerCategories || []).map(String),
    fulfilledBy: source.fulfilledBy,
    stock: 0,
    variants: (source.variants || []).map((v) => ({
      type: v.type, valueAr: v.valueAr, valueEn: v.valueEn, price: v.price, oldPrice: v.oldPrice, stock: 0,
    })),
  });
  await copy.populate(POPULATE_CATEGORY);
  await logSellerActivity(req, { action: 'product.duplicate', entityType: 'product', entityId: copy._id, label: copy.nameEn, details: { from: source.nameEn } });
  res.status(201).json({ success: true, data: formatSellerProduct(copy) });
});

/** Add / remove store sections on many products at once (list bulk action). */
export const bulkSellerProductCategories = asyncHandler(async (req, res) => {
  const ids = (Array.isArray(req.body?.ids) ? req.body.ids : [])
    .map(String).filter((id) => mongoose.Types.ObjectId.isValid(id)).slice(0, 200);
  if (!ids.length) throw new AppError('Select at least one product', 400);
  const add = await ownSellerCategoryIds(req.seller._id, req.body?.add);
  const remove = await ownSellerCategoryIds(req.seller._id, req.body?.remove);
  if (!add.length && !remove.length) throw new AppError('Choose a section to add or remove', 400);

  const filter = { _id: { $in: ids }, seller: req.seller._id };
  // Two steps — MongoDB can't $addToSet and $pull the same array in one update.
  if (remove.length) await Product.updateMany(filter, { $pull: { sellerCategories: { $in: remove } } });
  let modified = 0;
  if (add.length) {
    const r = await Product.updateMany(filter, { $addToSet: { sellerCategories: { $each: add } } });
    modified = r.modifiedCount;
  }
  res.json({ success: true, data: { matched: ids.length, modified } });
});

export const updateSellerProduct = asyncHandler(async (req, res) => {
  const seller = req.seller;
  const product = await findOwnProduct(req);
  const before = { price: product.price, oldPrice: product.oldPrice, stock: product.stock, nameEn: product.nameEn, nameAr: product.nameAr };
  const { content, operational } = sanitizeSellerProductInput(req.body, seller);
  if (operational.price !== undefined && !(operational.price > 0)) throw new AppError('A price above zero is required', 400);
  await resolveCategoryInput(content, product);
  if (operational.sellerCategories) operational.sellerCategories = await ownSellerCategoryIds(seller._id, operational.sellerCategories);

  if (operational.sku !== undefined && operational.sku !== product.sku) {
    operational.sku = operational.sku
      ? await resolveProductSku({ sku: operational.sku, excludeProductId: product._id })
      : product.sku;
  }

  const settings = await getMarketplaceSettings();
  const live = ['approved', 'paused'].includes(product.listingStatus);
  const needsReview = live && settings.reviewContentEdits && !canPublishDirectly(seller);

  guardStoreHeldStock(product, operational);
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
  await logSellerActivity(req, {
    action: 'product.update',
    entityType: 'product',
    entityId: product._id,
    label: product.nameEn,
    details: diffFields(before, product, ['price', 'oldPrice', 'stock', 'nameEn', 'nameAr']),
  });
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
  product.listingStatus = canPublish(req.seller, product) ? 'approved' : 'pending_review';
  product.submittedAt = now;
  if (product.listingStatus === 'approved') product.reviewedAt = now;
  product.reviewNote = '';
  await product.save();
  await product.populate(POPULATE_CATEGORY);
  await logSellerActivity(req, { action: 'product.submit', entityType: 'product', entityId: product._id, label: product.nameEn });
  res.json({ success: true, data: formatSellerProduct(product) });
});

export const pauseSellerProduct = asyncHandler(async (req, res) => {
  const product = await findOwnProduct(req);
  if (product.listingStatus !== 'approved') throw new AppError('Only live products can be paused', 400);
  product.listingStatus = 'paused';
  await product.save();
  await product.populate(POPULATE_CATEGORY);
  await logSellerActivity(req, { action: 'product.pause', entityType: 'product', entityId: product._id, label: product.nameEn });
  res.json({ success: true, data: formatSellerProduct(product) });
});

export const unpauseSellerProduct = asyncHandler(async (req, res) => {
  const product = await findOwnProduct(req);
  if (product.listingStatus !== 'paused') throw new AppError('This product is not paused', 400);
  product.listingStatus = 'approved';
  await product.save();
  await product.populate(POPULATE_CATEGORY);
  await logSellerActivity(req, { action: 'product.unpause', entityType: 'product', entityId: product._id, label: product.nameEn });
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
  await logSellerActivity(req, { action: 'product.delete', entityType: 'product', entityId: product._id, label: product.nameEn });
  if (ids.length) await deleteManyFromCloudinary([...new Set(ids.filter(Boolean))]);
  res.json({ success: true });
});

/** Quick stock edit from the product list. */
export const updateSellerProductStock = asyncHandler(async (req, res) => {
  const product = await findOwnProduct(req);
  const { operational } = sanitizeSellerProductInput({ stock: req.body.stock, variants: req.body.variants }, req.seller);
  const stockBefore = product.stock;
  guardStoreHeldStock(product, operational);
  applyOperational(product, operational);
  await product.save();
  await product.populate(POPULATE_CATEGORY);
  await logSellerActivity(req, { action: 'product.stock', entityType: 'product', entityId: product._id, label: product.nameEn, details: { stock: [stockBefore, product.stock] } });
  res.json({ success: true, data: formatSellerProduct(product) });
});

const MAX_BULK_ROWS = 200;

/**
 * Inventory manager "Save all": price / old price / stock for many products at once, variants
 * patched by id. Each row runs through the same rules as the editor (store-held stock is read
 * only, prices above zero). Returns a result per row so one bad row never blocks the rest.
 */
export const bulkUpdateSellerInventory = asyncHandler(async (req, res) => {
  const rows = (Array.isArray(req.body?.items) ? req.body.items : []).slice(0, MAX_BULK_ROWS);
  if (!rows.length) throw new AppError('Nothing to update', 400);
  const ids = rows.map((r) => String(r?.id || '')).filter((id) => mongoose.Types.ObjectId.isValid(id));
  const products = await Product.find({ _id: { $in: ids }, seller: req.seller._id });
  const byId = new Map(products.map((p) => [String(p._id), p]));

  const results = [];
  for (const row of rows) {
    const product = byId.get(String(row?.id));
    if (!product) {
      results.push({ id: row?.id, ok: false, error: 'Product not found' });
      continue;
    }
    try {
      const input = {};
      if (row.price !== undefined) input.price = row.price;
      if (row.oldPrice !== undefined) input.oldPrice = row.oldPrice;
      if (row.stock !== undefined && !product.variants?.length) input.stock = row.stock;
      if (row.lowStockThreshold !== undefined) {
        const t = row.lowStockThreshold === null || row.lowStockThreshold === '' ? null : Math.floor(Number(row.lowStockThreshold));
        if (t !== null && (!Number.isFinite(t) || t < 0 || t > 100000)) throw new AppError('Invalid low-stock alert level', 400);
        product.lowStockThreshold = t;
        product.lowStockAlertedAt = null;
      }
      if (Array.isArray(row.variants) && product.variants?.length) {
        const patch = new Map(row.variants.map((v) => [String(v._id), v]));
        input.variants = product.variants.map((v) => {
          const p = patch.get(String(v._id)) || {};
          return {
            ...v.toObject(),
            price: p.price !== undefined ? p.price : v.price,
            stock: p.stock !== undefined ? p.stock : v.stock,
          };
        });
      }
      const { operational } = sanitizeSellerProductInput(input, req.seller);
      if (operational.price !== undefined && !(operational.price > 0)) throw new AppError('A price above zero is required', 400);
      if (operational.variants?.some((v) => !(v.price > 0))) throw new AppError('Every variant needs a price above zero', 400);
      // Old price must stay above the price it's compared with.
      const nextPrice = operational.price ?? product.price;
      if (operational.oldPrice != null && operational.oldPrice <= nextPrice) operational.oldPrice = null;
      if (product.fulfilledBy === 'store') {
        delete operational.stock;
        if (operational.variants) {
          const held = new Map(product.variants.map((v) => [String(v._id), v.stock || 0]));
          operational.variants = operational.variants.map((v) => ({ ...v, stock: held.get(String(v._id)) ?? 0 }));
        }
      }
      const before = { price: product.price, oldPrice: product.oldPrice, stock: product.stock };
      applyOperational(product, operational);
      // eslint-disable-next-line no-await-in-loop
      await product.save();
      results.push({ id: product._id, ok: true, data: formatSellerProduct(product), changes: diffFields(before, product, ['price', 'oldPrice', 'stock']) });
    } catch (err) {
      results.push({ id: product._id, ok: false, error: err.message });
    }
  }
  const saved = results.filter((r) => r.ok).length;
  await Promise.all(results.filter((r) => r.ok).map((r) => logSellerActivity(req, {
    action: 'inventory.update', entityType: 'product', entityId: r.id, label: r.data.nameEn, details: r.changes || { variants: 'updated' },
  })));
  results.forEach((r) => { delete r.changes; });
  res.status(saved ? 200 : 400).json({ success: saved > 0, saved, failed: results.length - saved, results });
});

// ── Orders (shipments) ──

const OPEN_SHIPMENT = ['pending', 'confirmed', 'packed', 'shipped'];

const ORDER_CONTACT_FIELDS = 'user phone alternatePhone shippingAddress notes deliveryMethod scheduledDate';

/** Fulfillment, search and date filters shared by the order list and its CSV export. */
function applyShipmentFilters(filter, query) {
  if (['seller', 'store'].includes(query.fulfilledBy)) filter.fulfilledBy = query.fulfilledBy;
  if (query.q) {
    const q = escapeRegex(String(query.q).slice(0, 60));
    filter.$or = [{ shipmentNumber: { $regex: q, $options: 'i' } }, { orderNumber: { $regex: q, $options: 'i' } }];
  }
  const from = query.from ? new Date(`${query.from}T00:00:00+02:00`) : null;
  const to = query.to ? new Date(`${query.to}T23:59:59.999+02:00`) : null;
  if ((from && !Number.isNaN(from.getTime())) || (to && !Number.isNaN(to.getTime()))) {
    filter.createdAt = {};
    if (from && !Number.isNaN(from.getTime())) filter.createdAt.$gte = from;
    if (to && !Number.isNaN(to.getTime())) filter.createdAt.$lte = to;
  }
}

export const listSellerShipments = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, 100);
  const filter = { seller: req.seller._id };
  if (req.query.status === 'open') filter.status = { $in: OPEN_SHIPMENT };
  else if (SHIPMENT_STATUSES.includes(req.query.status)) filter.status = req.query.status;
  applyShipmentFilters(filter, req.query);
  const [items, total, counts] = await Promise.all([
    Shipment.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Shipment.countDocuments(filter),
    Shipment.aggregate([{ $match: { seller: req.seller._id } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
  ]);
  res.json({
    success: true,
    data: items.map((s) => formatShipmentForSeller(s)),
    counts: Object.fromEntries(counts.map((c) => [c._id, c.count])),
    pagination: paginationMeta(page, limit, total),
  });
});

export const getSellerShipment = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) throw new AppError('Shipment not found', 404);
  const shipment = await Shipment.findOne({ _id: req.params.id, seller: req.seller._id });
  if (!shipment) throw new AppError('Shipment not found', 404);
  const order = await Order.findById(shipment.order).select(ORDER_CONTACT_FIELDS).populate('user', 'name');
  res.json({ success: true, data: formatShipmentForSeller(shipment, order) });
});

export const updateSellerShipmentStatus = asyncHandler(async (req, res) => {
  const { status, trackingNumber, carrier, note } = req.body || {};
  const shipment = await updateShipmentStatus(req.params.id, String(status || ''), {
    scope: { sellerId: req.seller._id },
    actor: req.user,
    role: 'seller',
    trackingNumber,
    carrier,
    note,
  });
  const order = await Order.findById(shipment.order).select(ORDER_CONTACT_FIELDS).populate('user', 'name');
  await logSellerActivity(req, { action: 'order.status', entityType: 'shipment', entityId: shipment._id, label: shipment.shipmentNumber, details: { status: shipment.status } });
  res.json({ success: true, data: formatShipmentForSeller(shipment, order) });
});

export const exportSellerShipments = asyncHandler(async (req, res) => {
  const filter = { seller: req.seller._id };
  if (req.query.status === 'open') filter.status = { $in: OPEN_SHIPMENT };
  else if (SHIPMENT_STATUSES.includes(req.query.status)) filter.status = req.query.status;
  applyShipmentFilters(filter, req.query);
  const rows = await Shipment.find(filter).sort({ createdAt: -1 }).limit(5000).lean();
  const csv = toCsv(rows, [
    { header: 'shipment', value: (r) => r.shipmentNumber },
    { header: 'order', value: (r) => r.orderNumber },
    { header: 'date', value: (r) => new Date(r.createdAt).toISOString() },
    { header: 'status', value: (r) => r.status },
    { header: 'fulfilledBy', value: (r) => r.fulfilledBy },
    { header: 'items', value: (r) => (r.items || []).map((i) => `${i.quantity}x ${i.nameEn || i.nameAr}`).join(' | ') },
    { header: 'units', value: (r) => (r.items || []).reduce((n, i) => n + (i.quantity || 0), 0) },
    { header: 'subtotal', value: (r) => r.subtotal },
    { header: 'deliveryFee', value: (r) => r.deliveryFee },
    { header: 'commission', value: (r) => r.commissionTotal },
    { header: 'fulfillmentFee', value: (r) => r.fulfillmentFee },
    { header: 'net', value: (r) => r.sellerNet },
    { header: 'payment', value: (r) => r.paymentMethod || '' },
    { header: 'tracking', value: (r) => r.trackingNumber || '' },
  ]);
  sendCsv(res, `orders-${new Date().toISOString().slice(0, 10)}.csv`, csv);
});

/** Confirm / mark packed many seller-shipped orders at once. Result per shipment. */
export const bulkUpdateSellerShipments = asyncHandler(async (req, res) => {
  const status = String(req.body?.status || '');
  if (!['confirmed', 'packed'].includes(status)) throw new AppError('Bulk updates support confirm and packed only', 400);
  const ids = (Array.isArray(req.body?.ids) ? req.body.ids : [])
    .map(String).filter((id) => mongoose.Types.ObjectId.isValid(id)).slice(0, 100);
  if (!ids.length) throw new AppError('Select at least one order', 400);
  const results = [];
  for (const id of ids) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const shipment = await updateShipmentStatus(id, status, { scope: { sellerId: req.seller._id }, actor: req.user, role: 'seller' });
      // eslint-disable-next-line no-await-in-loop
      await logSellerActivity(req, { action: 'order.status', entityType: 'shipment', entityId: shipment._id, label: shipment.shipmentNumber, details: { status, bulk: true } });
      results.push({ id, ok: true });
    } catch (err) {
      results.push({ id, ok: false, error: err.message });
    }
  }
  const updated = results.filter((r) => r.ok).length;
  res.status(updated ? 200 : 400).json({ success: updated > 0, updated, failed: results.length - updated, results });
});
