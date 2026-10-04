import mongoose from 'mongoose';
import Seller from '../models/Seller.js';
import Product from '../models/Product.js';
import Shipment, { SHIPMENT_STATUSES } from '../models/Shipment.js';
import { formatShipmentForOrder, updateShipmentStatus } from '../services/marketplaceOrder.service.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { parsePagination, paginationMeta } from '../utils/listQuery.js';
import { deleteManyFromCloudinary } from '../utils/cloudinaryUpload.js';
import { logAudit } from '../services/auditLog.service.js';
import {
  getMarketplaceSettingsDoc,
  invalidateMarketplaceSettingsCache,
  formatSellerPrivate,
  changeSellerStatus,
  sellerUsers,
  syncSellerProductNames,
} from '../services/marketplace.service.js';
import { FULFILLMENT_MODES, SELLER_STATUSES } from '../constants/marketplace.js';
import { formatSellerProduct } from './sellerPortal.controller.js';
import { validateSellerApplication, createSellerWithOwner } from './sellerPublic.controller.js';

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const isId = (v) => mongoose.Types.ObjectId.isValid(v);

function sanitizeCommissionRules(rules) {
  if (!Array.isArray(rules)) throw new AppError('categoryCommissions must be a list', 400);
  const seen = new Set();
  return rules
    .filter((r) => isId(r?.category))
    .map((r) => {
      const rate = Number(r.rate);
      if (!Number.isFinite(rate) || rate < 0 || rate > 100) throw new AppError('Commission must be 0–100%', 400);
      return { category: String(r.category), rate };
    })
    .filter((r) => (seen.has(r.category) ? false : seen.add(r.category)));
}

// ── Settings ──

export const getMarketplaceAdminSettings = asyncHandler(async (_req, res) => {
  const doc = await getMarketplaceSettingsDoc();
  res.json({ success: true, data: doc });
});

export const updateMarketplaceAdminSettings = asyncHandler(async (req, res) => {
  const doc = await getMarketplaceSettingsDoc();
  const b = req.body || {};
  const num = (v, min, max, name) => {
    const n = Number(v);
    if (!Number.isFinite(n) || n < min || n > max) throw new AppError(`${name} must be between ${min} and ${max}`, 400);
    return n;
  };
  ['enabled', 'registrationOpen', 'reviewContentEdits'].forEach((f) => {
    if (b[f] !== undefined) doc[f] = b[f] === true || b[f] === 'true';
  });
  if (b.defaultCommissionRate !== undefined) doc.defaultCommissionRate = num(b.defaultCommissionRate, 0, 100, 'Commission');
  if (b.payoutHoldDays !== undefined) doc.payoutHoldDays = Math.round(num(b.payoutHoldDays, 0, 90, 'Hold days'));
  if (b.storeFulfillmentFeePerItem !== undefined) doc.storeFulfillmentFeePerItem = num(b.storeFulfillmentFeePerItem, 0, 100000, 'Fulfillment fee');
  if (b.sellerShipmentDeliveryFee !== undefined) doc.sellerShipmentDeliveryFee = num(b.sellerShipmentDeliveryFee, 0, 100000, 'Delivery fee');
  if (b.minPayoutAmount !== undefined) doc.minPayoutAmount = num(b.minPayoutAmount, 0, 1000000, 'Minimum payout');
  if (b.categoryCommissions !== undefined) doc.categoryCommissions = sanitizeCommissionRules(b.categoryCommissions);
  ['termsAr', 'termsEn'].forEach((f) => {
    if (b[f] !== undefined) doc[f] = String(b[f]).slice(0, 20000);
  });
  await doc.save();
  invalidateMarketplaceSettingsCache();
  await logAudit({ req, action: 'update', entityType: 'marketplace_settings', entityId: doc._id, entityLabel: 'Marketplace settings' });
  res.json({ success: true, data: doc });
});

// ── Sellers ──

export const listSellers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, 100);
  const filter = {};
  if (SELLER_STATUSES.includes(req.query.status)) filter.status = req.query.status;
  if (req.query.q) {
    const q = escapeRegex(String(req.query.q).slice(0, 100));
    filter.$or = ['nameAr', 'nameEn', 'email', 'phone', 'slug', 'legalName', 'commercialRegisterNo']
      .map((f) => ({ [f]: { $regex: q, $options: 'i' } }));
  }
  const [sellers, total, statusCounts] = await Promise.all([
    Seller.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Seller.countDocuments(filter),
    Seller.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
  ]);

  const ids = sellers.map((s) => s._id);
  const productRows = ids.length ? await Product.aggregate([
    { $match: { seller: { $in: ids } } },
    {
      $group: {
        _id: '$seller',
        total: { $sum: 1 },
        live: { $sum: { $cond: ['$isActive', 1, 0] } },
        pending: { $sum: { $cond: [{ $eq: ['$listingStatus', 'pending_review'] }, 1, 0] } },
      },
    },
  ]) : [];
  const stats = new Map(productRows.map((r) => [String(r._id), r]));

  res.json({
    success: true,
    data: sellers.map((s) => ({
      ...formatSellerPrivate(s),
      products: {
        total: stats.get(String(s._id))?.total || 0,
        live: stats.get(String(s._id))?.live || 0,
        pending: stats.get(String(s._id))?.pending || 0,
      },
    })),
    counts: Object.fromEntries(SELLER_STATUSES.map((st) => [st, statusCounts.find((r) => r._id === st)?.count || 0])),
    pagination: paginationMeta(page, limit, total),
  });
});

async function findSeller(id) {
  if (!isId(id)) throw new AppError('Seller not found', 404);
  const seller = await Seller.findById(id);
  if (!seller) throw new AppError('Seller not found', 404);
  return seller;
}

export const getSellerAdmin = asyncHandler(async (req, res) => {
  const seller = await findSeller(req.params.id);
  await seller.populate([
    { path: 'intendedCategories', select: 'nameAr nameEn slug' },
    { path: 'categoryCommissions.category', select: 'nameAr nameEn slug' },
  ]);
  const [team, listingRows] = await Promise.all([
    sellerUsers(seller._id),
    Product.aggregate([
      { $match: { seller: seller._id } },
      { $group: { _id: '$listingStatus', count: { $sum: 1 } } },
    ]),
  ]);
  res.json({
    success: true,
    data: {
      ...formatSellerPrivate(seller, { revealBank: req.user.role === 'super_admin' }),
      internalNote: seller.internalNote || '',
      team,
      listings: Object.fromEntries(listingRows.map((r) => [r._id, r.count])),
    },
  });
});

/** Staff onboarding — create a seller directly (optionally already active). */
export const createSellerAdmin = asyncHandler(async (req, res) => {
  const data = await validateSellerApplication(req.body);
  const status = req.body.activate === true || req.body.activate === 'true' ? 'active' : 'under_review';
  const { seller } = await createSellerWithOwner(data, { status, actor: req.user });
  await logAudit({ req, action: 'create', entityType: 'seller', entityId: seller._id, entityLabel: seller.nameEn });
  res.status(201).json({ success: true, data: formatSellerPrivate(seller) });
});

export const updateSellerAdmin = asyncHandler(async (req, res) => {
  const seller = await findSeller(req.params.id);
  const b = req.body || {};
  const str = (v, max = 2000) => String(v ?? '').trim().slice(0, max);

  ['nameAr', 'nameEn'].forEach((f) => {
    if (b[f] !== undefined && str(b[f], 120).length >= 2) seller[f] = str(b[f], 120);
  });
  ['descriptionAr', 'descriptionEn', 'legalName', 'commercialRegisterNo', 'taxId', 'contactName', 'phone', 'internalNote']
    .forEach((f) => { if (b[f] !== undefined) seller[f] = str(b[f], f === 'internalNote' ? 4000 : 2000); });

  if (b.commissionRate !== undefined) {
    if (b.commissionRate === null || b.commissionRate === '') seller.commissionRate = null;
    else {
      const rate = Number(b.commissionRate);
      if (!Number.isFinite(rate) || rate < 0 || rate > 100) throw new AppError('Commission must be 0–100%', 400);
      seller.commissionRate = rate;
    }
  }
  if (b.categoryCommissions !== undefined) seller.categoryCommissions = sanitizeCommissionRules(b.categoryCommissions);
  if (b.allowedFulfillment !== undefined) {
    const modes = [...new Set((Array.isArray(b.allowedFulfillment) ? b.allowedFulfillment : []).filter((m) => FULFILLMENT_MODES.includes(m)))];
    if (!modes.length) throw new AppError('Choose at least one fulfillment option', 400);
    seller.allowedFulfillment = modes;
    if (!modes.includes(seller.defaultFulfillment)) seller.defaultFulfillment = modes[0];
  }
  if (b.deliveryZones !== undefined) {
    seller.deliveryZones = (Array.isArray(b.deliveryZones) ? b.deliveryZones : []).filter(isId);
  }
  if (b.autoApproveListings !== undefined) seller.autoApproveListings = b.autoApproveListings === true || b.autoApproveListings === 'true';
  if (b.handlingDays !== undefined) {
    const days = Math.round(Number(b.handlingDays));
    if (Number.isFinite(days) && days >= 0 && days <= 30) seller.handlingDays = days;
  }

  const renamed = seller.isModified('nameAr') || seller.isModified('nameEn');
  await seller.save();
  if (renamed) await syncSellerProductNames(seller);
  // Fulfillment options shrank — products using a removed mode fall back to an allowed one.
  if (b.allowedFulfillment !== undefined) {
    await Product.updateMany(
      { seller: seller._id, fulfilledBy: { $nin: seller.allowedFulfillment } },
      { $set: { fulfilledBy: seller.defaultFulfillment } },
    );
  }
  await logAudit({ req, action: 'update', entityType: 'seller', entityId: seller._id, entityLabel: seller.nameEn });
  res.json({ success: true, data: formatSellerPrivate(seller, { revealBank: req.user.role === 'super_admin' }) });
});

export const changeSellerStatusAdmin = asyncHandler(async (req, res) => {
  const seller = await findSeller(req.params.id);
  const { status, reason } = req.body || {};
  if (!SELLER_STATUSES.includes(status)) throw new AppError('Unknown status', 400);
  const from = seller.status;
  await changeSellerStatus(seller, status, { reason, actor: req.user });
  await logAudit({
    req,
    action: status === 'active' ? 'approve' : status === 'rejected' ? 'reject' : 'status_change',
    entityType: 'seller',
    entityId: seller._id,
    entityLabel: seller.nameEn,
    changes: { status: { from, to: status }, ...(reason ? { reason: { from: null, to: reason } } : {}) },
  });
  res.json({ success: true, data: formatSellerPrivate(seller) });
});

export const reviewSellerDocument = asyncHandler(async (req, res) => {
  const seller = await findSeller(req.params.id);
  const doc = seller.documents.id(req.params.docId);
  if (!doc) throw new AppError('Document not found', 404);
  const { status, note } = req.body || {};
  if (!['pending', 'accepted', 'rejected'].includes(status)) throw new AppError('Unknown document status', 400);
  doc.status = status;
  doc.note = String(note ?? '').trim().slice(0, 500);
  await seller.save();
  res.json({ success: true, data: seller.documents });
});

// ── Listing review queue ──

export const listListingQueue = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, 100);
  const state = req.query.state || 'pending';
  const filter = { seller: { $ne: null } };
  if (state === 'pending') {
    filter.$or = [{ listingStatus: 'pending_review' }, { pendingChangesAt: { $type: 'date' } }];
  } else if (['approved', 'rejected', 'draft', 'paused'].includes(state)) {
    filter.listingStatus = state;
  }
  if (isId(req.query.seller)) filter.seller = new mongoose.Types.ObjectId(String(req.query.seller));

  const [items, total] = await Promise.all([
    Product.find(filter)
      .sort(state === 'pending' ? { submittedAt: 1, pendingChangesAt: 1 } : { updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate([
        { path: 'category', select: 'slug nameAr nameEn' },
        { path: 'mainCategory', select: 'slug nameAr nameEn' },
        { path: 'seller', select: 'nameAr nameEn slug status' },
      ]),
    Product.countDocuments(filter),
  ]);
  res.json({
    success: true,
    data: items.map((p) => ({
      ...formatSellerProduct(p),
      seller: p.seller ? { _id: p.seller._id, nameAr: p.seller.nameAr, nameEn: p.seller.nameEn, slug: p.seller.slug, status: p.seller.status } : null,
    })),
    pagination: paginationMeta(page, limit, total),
  });
});

async function findSellerListing(id) {
  if (!isId(id)) throw new AppError('Product not found', 404);
  const product = await Product.findOne({ _id: id, seller: { $ne: null } });
  if (!product) throw new AppError('Product not found', 404);
  return product;
}

/** Approve a new listing and/or a pending content edit (applied onto the live product). */
export const approveListing = asyncHandler(async (req, res) => {
  const product = await findSellerListing(req.params.id);
  const seller = await Seller.findById(product.seller).select('status nameEn');
  if (seller?.status !== 'active') throw new AppError('Approve the seller account first', 400);

  const hadNew = product.listingStatus === 'pending_review';
  const hadEdit = Boolean(product.pendingChangesAt);
  if (!hadNew && !hadEdit) throw new AppError('Nothing is waiting for review on this product', 400);

  let orphaned = [];
  if (hadEdit) {
    const changes = product.pendingChanges || {};
    if (changes.cloudinaryPublicIds) {
      const keep = new Set(changes.cloudinaryPublicIds);
      orphaned = (product.cloudinaryPublicIds || []).filter((id) => id && !keep.has(id));
    }
    Object.assign(product, changes);
    product.pendingChanges = null;
    product.pendingChangesAt = null;
  }
  if (hadNew) product.listingStatus = 'approved';
  product.reviewNote = String(req.body?.note || '').trim().slice(0, 1000);
  product.reviewedAt = new Date();
  product.reviewedBy = req.user._id;
  await product.save();
  if (orphaned.length) await deleteManyFromCloudinary(orphaned);

  await logAudit({ req, action: 'approve', entityType: 'product', entityId: product._id, entityLabel: product.nameEn });
  res.json({ success: true, data: formatSellerProduct(product) });
});

export const rejectListing = asyncHandler(async (req, res) => {
  const product = await findSellerListing(req.params.id);
  const note = String(req.body?.note || '').trim().slice(0, 1000);
  if (!note) throw new AppError('Tell the seller what to fix', 400);

  if (product.listingStatus === 'pending_review') {
    product.listingStatus = 'rejected';
  } else if (product.pendingChangesAt) {
    // A rejected edit leaves the live listing untouched.
    const orphaned = (product.pendingChanges?.cloudinaryPublicIds || [])
      .filter((id) => id && !(product.cloudinaryPublicIds || []).includes(id));
    product.pendingChanges = null;
    product.pendingChangesAt = null;
    if (orphaned.length) await deleteManyFromCloudinary(orphaned);
  } else if (req.body?.unlist === true && ['approved', 'paused'].includes(product.listingStatus)) {
    // Staff take-down of a live listing (policy violation).
    product.listingStatus = 'rejected';
  } else {
    throw new AppError('Nothing is waiting for review on this product', 400);
  }
  product.reviewNote = note;
  product.reviewedAt = new Date();
  product.reviewedBy = req.user._id;
  await product.save();

  await logAudit({ req, action: 'reject', entityType: 'product', entityId: product._id, entityLabel: product.nameEn, changes: { note: { from: null, to: note } } });
  res.json({ success: true, data: formatSellerProduct(product) });
});

// ── Seller shipments (ops view) ──

export const listShipmentsAdmin = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, 100);
  const filter = {};
  if (isId(req.query.seller)) filter.seller = new mongoose.Types.ObjectId(String(req.query.seller));
  if (req.query.status === 'open') filter.status = { $in: ['pending', 'confirmed', 'packed', 'shipped'] };
  else if (SHIPMENT_STATUSES.includes(req.query.status)) filter.status = req.query.status;
  if (['seller', 'store'].includes(req.query.fulfilledBy)) filter.fulfilledBy = req.query.fulfilledBy;
  if (req.query.refund === 'manual') filter['refund.status'] = 'manual_required';
  if (req.query.q) {
    const q = escapeRegex(String(req.query.q).slice(0, 60));
    filter.$or = [{ shipmentNumber: { $regex: q, $options: 'i' } }, { orderNumber: { $regex: q, $options: 'i' } }];
  }
  const [items, total] = await Promise.all([
    Shipment.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Shipment.countDocuments(filter),
  ]);
  res.json({
    success: true,
    data: items.map((s) => ({
      ...formatShipmentForOrder(s, { isStaff: true }),
      orderId: s.order,
      orderNumber: s.orderNumber,
      items: s.items,
      paymentMethod: s.paymentMethod,
      createdAt: s.createdAt,
    })),
    pagination: paginationMeta(page, limit, total),
  });
});

/** Staff override — e.g. mark delivered when the seller forgot, or cancel on the seller's behalf. */
export const updateShipmentStatusAdmin = asyncHandler(async (req, res) => {
  const { status, note, trackingNumber, carrier } = req.body || {};
  if (!SHIPMENT_STATUSES.includes(status)) throw new AppError('Unknown status', 400);
  const shipment = await updateShipmentStatus(req.params.id, status, {
    actor: req.user,
    role: 'staff',
    note,
    trackingNumber,
    carrier,
    force: true,
  });
  await logAudit({
    req,
    action: 'status_change',
    entityType: 'order',
    entityId: shipment.order,
    entityLabel: shipment.shipmentNumber,
    changes: { shipmentStatus: { from: null, to: status } },
  });
  res.json({ success: true, data: formatShipmentForOrder(shipment, { isStaff: true }) });
});
