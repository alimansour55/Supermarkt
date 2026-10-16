import crypto from 'node:crypto';
import mongoose from 'mongoose';
import Seller from '../models/Seller.js';
import Product from '../models/Product.js';
import User from '../models/User.js';
import SellerMessage from '../models/SellerMessage.js';
import Shipment, { SHIPMENT_STATUSES } from '../models/Shipment.js';
import { formatShipmentForOrder, updateShipmentStatus } from '../services/marketplaceOrder.service.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { parsePagination, paginationMeta } from '../utils/listQuery.js';
import { deleteManyFromCloudinary, deleteFromCloudinary, uploadFileToCloudinary, CLOUDINARY_FOLDERS } from '../utils/cloudinaryUpload.js';
import { resolveProductCategoryFields } from '../utils/productCategorySync.js';
import { logAudit } from '../services/auditLog.service.js';
import {
  getMarketplaceSettingsDoc,
  invalidateMarketplaceSettingsCache,
  formatSellerPrivate,
  changeSellerStatus,
  sellerUsers,
  syncSellerProductNames,
  notifySellerUsers,
  documentsWithLinks,
  syncSellerProductVisibility,
} from '../services/marketplace.service.js';
import { normalizePhone } from '../utils/phone.js';
import { sellerChanges, isFeeField, STAFF_ONLY_FIELDS } from '../utils/sellerAudit.js';
import { sanitizeCommissionRules } from '../services/sellerDeal.service.js';
import { logSellerActivity } from '../services/sellerActivity.service.js';
import { FULFILLMENT_MODES, SELLER_STATUSES } from '../constants/marketplace.js';
import {
  sanitizeFees,
  sanitizePlans,
  sanitizeCommissionRules as sanitizeFeeRules,
  sanitizePayoutSchedule,
  sanitizeFeeOverrides,
} from '../utils/sellerFeeInput.js';
import { formatSellerProduct } from './sellerPortal.controller.js';
import { getSellerPerformance } from '../services/sellerReputation.service.js';
import { validateSellerApplication, createSellerWithOwner } from './sellerPublic.controller.js';
import { sendSellerAccessEmail, assertStrongPassword } from './sellerAuth.controller.js';

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const isId = (v) => mongoose.Types.ObjectId.isValid(v);

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
  if (b.fees !== undefined) doc.fees = sanitizeFees(b.fees);
  if (b.plans !== undefined) doc.plans = sanitizePlans(b.plans);
  if (b.commissionRules !== undefined) {
    doc.commissionRules = sanitizeFeeRules(b.commissionRules, { planKeys: (doc.plans || []).map((p) => p.key) });
  }
  if (b.payoutSchedule !== undefined) doc.payoutSchedule = sanitizePayoutSchedule(b.payoutSchedule);
  if (b.enforcement && typeof b.enforcement === 'object') {
    const e = b.enforcement;
    if (e.autoWarnAtRisk !== undefined) doc.set('enforcement.autoWarnAtRisk', e.autoWarnAtRisk === true);
    if (e.autoSuspend !== undefined) doc.set('enforcement.autoSuspend', e.autoSuspend === true);
    if (e.maxStrikes !== undefined) doc.set('enforcement.maxStrikes', Math.round(num(e.maxStrikes, 1, 20, 'Strikes')));
    if (e.strikeWindowDays !== undefined) doc.set('enforcement.strikeWindowDays', Math.round(num(e.strikeWindowDays, 7, 365, 'Strike window')));
  }
  ['termsAr', 'termsEn'].forEach((f) => {
    if (b[f] !== undefined) doc[f] = String(b[f]).slice(0, 20000);
  });
  await doc.save();
  invalidateMarketplaceSettingsCache();
  await logAudit({ req, action: 'update', entityType: 'marketplace_settings', entityId: doc._id, entityLabel: 'Marketplace settings' });
  res.json({ success: true, data: doc });
});

// ── Sellers ──

/** Columns the seller list can sort by (`sort` + `order`, as the admin list pages send them). */
const LIST_SORT_FIELDS = {
  createdAt: ['createdAt'],
  name: ['nameEn'],
  rating: ['rating', 'ratingCount'],
  commission: ['commissionRate'],
};

function listSort(query) {
  const fields = LIST_SORT_FIELDS[query.sort] || LIST_SORT_FIELDS.createdAt;
  const dir = query.order === 'asc' ? 1 : -1;
  return { ...Object.fromEntries(fields.map((f) => [f, dir])), _id: dir };
}

export const listSellers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, 100);
  const filter = {};
  if (SELLER_STATUSES.includes(req.query.status)) filter.status = req.query.status;
  // "Waiting for you": new applications plus ones already being reviewed.
  if (req.query.status === 'waiting') filter.status = { $in: ['applied', 'under_review'] };
  if (req.query.q) {
    const q = escapeRegex(String(req.query.q).slice(0, 100));
    filter.$or = ['nameAr', 'nameEn', 'email', 'phone', 'slug', 'legalName', 'commercialRegisterNo']
      .map((f) => ({ [f]: { $regex: q, $options: 'i' } }));
  }
  const sort = listSort(req.query);
  const [sellers, total, statusCounts, pendingListings] = await Promise.all([
    Seller.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    Seller.countDocuments(filter),
    Seller.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Product.countDocuments({ seller: { $ne: null }, listingStatus: 'pending_review' }),
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
  const [unreadRows, unreadTotal] = await Promise.all([
    ids.length ? SellerMessage.aggregate([
      { $match: { seller: { $in: ids }, from: 'seller', staffReadAt: null } },
      { $group: { _id: '$seller', count: { $sum: 1 } } },
    ]) : [],
    SellerMessage.countDocuments({ from: 'seller', staffReadAt: null }),
  ]);
  const unread = new Map(unreadRows.map((r) => [String(r._id), r.count]));
  // Health only means something for selling stores; one small query per active row on this page.
  const healthRows = await Promise.all(sellers.map((s) => (s.status === 'active'
    ? getSellerPerformance(s._id).then((p) => p.health).catch(() => null)
    : null)));

  res.json({
    success: true,
    data: sellers.map((s, i) => ({
      ...formatSellerPrivate(s),
      health: healthRows[i],
      unreadMessages: unread.get(String(s._id)) || 0,
      products: {
        total: stats.get(String(s._id))?.total || 0,
        live: stats.get(String(s._id))?.live || 0,
        pending: stats.get(String(s._id))?.pending || 0,
      },
    })),
    counts: Object.fromEntries(SELLER_STATUSES.map((st) => [st, statusCounts.find((r) => r._id === st)?.count || 0])),
    summary: { pendingListings, unreadMessages: unreadTotal },
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
    { path: 'statusHistory.changedBy', select: 'name role' },
  ]);
  const [team, listingRows, performance, unreadMessages] = await Promise.all([
    sellerUsers(seller._id, { forStaff: true }),
    Product.aggregate([
      { $match: { seller: seller._id } },
      { $group: { _id: '$listingStatus', count: { $sum: 1 } } },
    ]),
    getSellerPerformance(seller._id),
    SellerMessage.countDocuments({ seller: seller._id, from: 'seller', staffReadAt: null }),
  ]);
  res.json({
    success: true,
    data: {
      ...formatSellerPrivate(seller, { revealBank: req.user.role === 'super_admin' }),
      internalNote: seller.internalNote || '',
      team,
      performance,
      unreadMessages,
      listings: Object.fromEntries(listingRows.map((r) => [r._id, r.count])),
    },
  });
});

/**
 * Staff onboarding — create a seller directly (optionally already active).
 * Without a password the owner gets an emailed invite to choose one (the recommended path:
 * staff never know the seller's password). With one, they get a welcome email with the
 * sign-in address. Either way the response carries the links so staff can share them.
 */
export const createSellerAdmin = asyncHandler(async (req, res) => {
  const invite = !String(req.body.password ?? '').trim();
  const data = await validateSellerApplication(req.body, { requirePassword: !invite });
  if (invite) {
    // Unusable placeholder until the owner sets their own password from the invite link.
    data.password = `${crypto.randomBytes(24).toString('base64url')}A1`;
  } else {
    assertStrongPassword(data.password);
  }
  const status = req.body.activate === true || req.body.activate === 'true' ? 'active' : 'under_review';
  const { seller, owner } = await createSellerWithOwner(data, { status, actor: req.user });
  const access = await sendSellerAccessEmail(owner, { seller, withPasswordLink: invite });
  await logAudit({ req, action: 'create', entityType: 'seller', entityId: seller._id, entityLabel: seller.nameEn });
  res.status(201).json({ success: true, data: formatSellerPrivate(seller), access: { ...access, invited: invite } });
});

/** Email a seller user (owner by default) a fresh sign-in + set-password link. */
export const sendSellerAccessAdmin = asyncHandler(async (req, res) => {
  const seller = await findSeller(req.params.id);
  const userId = req.body?.userId || seller.owner;
  if (!isId(userId)) throw new AppError('This seller has no login yet', 400);
  const user = await User.findOne({ _id: userId, seller: seller._id });
  if (!user) throw new AppError('Login not found for this seller', 404);
  if (user.isActive === false) throw new AppError('This login is turned off — turn it on from the seller team page first', 400);
  const access = await sendSellerAccessEmail(user, { seller });
  await logAudit({
    req,
    action: 'update',
    entityType: 'seller',
    entityId: seller._id,
    entityLabel: seller.nameEn,
    changes: { accessLinkSent: { from: null, to: user.email } },
  });
  res.json({ success: true, data: access });
});

export const updateSellerAdmin = asyncHandler(async (req, res) => {
  const seller = await findSeller(req.params.id);
  const b = req.body || {};
  const str = (v, max = 2000) => String(v ?? '').trim().slice(0, max);
  const before = seller.toObject();

  ['nameAr', 'nameEn'].forEach((f) => {
    if (b[f] === undefined) return;
    if (str(b[f], 120).length < 2) throw new AppError('Store name needs at least 2 characters', 400);
    seller[f] = str(b[f], 120);
  });
  ['descriptionAr', 'descriptionEn', 'legalName', 'commercialRegisterNo', 'taxId', 'contactName', 'internalNote']
    .forEach((f) => { if (b[f] !== undefined) seller[f] = str(b[f], f === 'internalNote' ? 4000 : 2000); });
  if (b.phone !== undefined) {
    const raw = str(b.phone, 30);
    const phone = raw ? normalizePhone(raw) : '';
    if (raw && !phone) throw new AppError('Invalid phone number', 400);
    seller.phone = phone;
  }
  if (b.email !== undefined) {
    const email = str(b.email, 200).toLowerCase();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new AppError('Invalid email', 400);
    seller.email = email;
  }
  if (b.address && typeof b.address === 'object') {
    ['street', 'city', 'governorate'].forEach((f) => {
      if (b.address[f] !== undefined) seller.set(`address.${f}`, str(b.address[f], 200));
    });
  }
  if (b.bank && typeof b.bank === 'object') {
    // Payout details decide where money goes — only super admins may change them.
    if (req.user.role !== 'super_admin') throw new AppError('Only a super admin can change payout details', 403);
    ['bankName', 'accountName', 'accountNumber', 'iban', 'walletPhone'].forEach((f) => {
      if (b.bank[f] !== undefined) seller.set(`bank.${f}`, str(b.bank[f], 120));
    });
  }
  if (b.defaultFulfillment !== undefined) {
    const allowed = Array.isArray(b.allowedFulfillment) ? b.allowedFulfillment : seller.allowedFulfillment;
    if (!allowed.includes(b.defaultFulfillment)) throw new AppError('The default must be one of the allowed shipping options', 400);
  }
  if (b.vacationOff === true && seller.vacation?.enabled) {
    seller.vacation = { enabled: false, startedAt: null, until: null, messageAr: '', messageEn: '' };
  }

  if (b.commissionRate !== undefined) {
    if (b.commissionRate === null || b.commissionRate === '') seller.commissionRate = null;
    else {
      const rate = Number(b.commissionRate);
      if (!Number.isFinite(rate) || rate < 0 || rate > 100) throw new AppError('Commission must be 0–100%', 400);
      seller.commissionRate = rate;
    }
  }
  if (b.categoryCommissions !== undefined) seller.categoryCommissions = sanitizeCommissionRules(b.categoryCommissions);
  if (b.feePlan !== undefined) {
    const key = str(b.feePlan, 40);
    if (key && !(await getMarketplaceSettingsDoc()).plans.some((p) => p.key === key)) throw new AppError('Unknown fee plan', 400);
    seller.feePlan = key;
  }
  if (b.feeOverrides !== undefined) seller.feeOverrides = sanitizeFeeOverrides(b.feeOverrides);
  if (b.allowedFulfillment !== undefined) {
    const modes = [...new Set((Array.isArray(b.allowedFulfillment) ? b.allowedFulfillment : []).filter((m) => FULFILLMENT_MODES.includes(m)))];
    if (!modes.length) throw new AppError('Choose at least one fulfillment option', 400);
    seller.allowedFulfillment = modes;
    if (!modes.includes(seller.defaultFulfillment)) seller.defaultFulfillment = modes[0];
  }
  if (b.defaultFulfillment !== undefined) seller.defaultFulfillment = b.defaultFulfillment;
  if (b.deliveryZones !== undefined) {
    seller.deliveryZones = (Array.isArray(b.deliveryZones) ? b.deliveryZones : []).filter(isId);
  }
  if (b.autoApproveListings !== undefined) seller.autoApproveListings = b.autoApproveListings === true || b.autoApproveListings === 'true';
  if (b.handlingDays !== undefined) {
    const days = Math.round(Number(b.handlingDays));
    if (Number.isFinite(days) && days >= 0 && days <= 30) seller.handlingDays = days;
  }

  const renamed = seller.isModified('nameAr') || seller.isModified('nameEn');
  const vacationEnded = before.vacation?.enabled && !seller.vacation?.enabled;
  await seller.save();
  if (renamed) await syncSellerProductNames(seller);
  if (vacationEnded) await syncSellerProductVisibility(seller._id);
  // Fulfillment options shrank — products using a removed mode fall back to an allowed one.
  if (b.allowedFulfillment !== undefined) {
    await Product.updateMany(
      { seller: seller._id, fulfilledBy: { $nin: seller.allowedFulfillment } },
      { $set: { fulfilledBy: seller.defaultFulfillment } },
    );
  }
  const changes = sellerChanges(before, seller.toObject());
  if (Object.keys(changes).length) {
    await logAudit({ req, action: 'update', entityType: 'seller', entityId: seller._id, entityLabel: seller.nameEn, changes });
    // The seller sees in its own activity log what staff changed (internal notes stay private).
    const sellerVisible = Object.keys(changes).filter((k) => !STAFF_ONLY_FIELDS.has(k));
    if (sellerVisible.length) {
      await logSellerActivity(req, { sellerId: seller._id, action: 'staff.store_updated', entityType: 'seller', entityId: seller._id, label: seller.nameEn, details: { fields: sellerVisible } });
    }
    if (Object.keys(changes).some(isFeeField)) {
      await notifySellerUsers(seller._id, {
        type: 'seller_account',
        titleAr: 'تم تحديث رسومك',
        titleEn: 'Your fees were updated',
        messageAr: 'تغيّرت شروط العمولة أو الرسوم لمتجرك. تطبق على الطلبات الجديدة فقط.',
        messageEn: 'Your commission or fee terms changed. They apply to new orders only.',
        link: '/seller-center/finance',
      });
    }
    if (Object.keys(changes).some((k) => k.startsWith('bank.'))) {
      await notifySellerUsers(seller._id, {
        type: 'seller_account',
        titleAr: 'تم تغيير بيانات استلام الأموال',
        titleEn: 'Your payout details were changed',
        messageAr: 'غيّر فريق المتجر بيانات البنك أو المحفظة لمتجرك. تواصل معنا فوراً إذا لم تطلب ذلك.',
        messageEn: 'Store staff changed your bank or wallet details. Contact us right away if you did not ask for this.',
        link: '/seller-center/finance',
      });
    }
  }
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
  res.json({ success: true, data: documentsWithLinks(seller.documents) });
});

// ── Listing review queue ──

export const listListingQueue = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, 100);
  const state = req.query.state || 'pending';
  const filter = { seller: { $ne: null } };
  const PENDING = { $or: [{ listingStatus: 'pending_review' }, { pendingChangesAt: { $type: 'date' } }] };
  // Same rule as the seller's "out of stock" badge: live, no variants, nothing left.
  const OUT_OF_STOCK = { listingStatus: 'approved', variants: { $size: 0 }, stock: { $lte: 0 } };
  if (state === 'pending') Object.assign(filter, PENDING);
  else if (state === 'out_of_stock') Object.assign(filter, OUT_OF_STOCK);
  else if (['approved', 'rejected', 'draft', 'paused'].includes(state)) filter.listingStatus = state;
  const sellerId = isId(req.query.seller) ? new mongoose.Types.ObjectId(String(req.query.seller)) : null;
  if (sellerId) filter.seller = sellerId;
  if (req.query.q) {
    const q = escapeRegex(String(req.query.q).slice(0, 80));
    const textMatch = ['nameAr', 'nameEn', 'sku'].map((f) => ({ [f]: { $regex: q, $options: 'i' } }));
    filter.$and = [...(filter.$and || []), { $or: textMatch }];
  }

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
  // Per-state counts for one seller's tab strip in its panel.
  let counts;
  if (sellerId) {
    const [byStatus, pending, out] = await Promise.all([
      Product.aggregate([{ $match: { seller: sellerId } }, { $group: { _id: '$listingStatus', count: { $sum: 1 } } }]),
      Product.countDocuments({ seller: sellerId, ...PENDING }),
      Product.countDocuments({ seller: sellerId, ...OUT_OF_STOCK }),
    ]);
    counts = { ...Object.fromEntries(byStatus.map((r) => [r._id, r.count])), pending, out_of_stock: out, all: byStatus.reduce((n, r) => n + r.count, 0) };
  }
  res.json({
    success: true,
    counts,
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
  // Staff place (or correct) the marketplace category while reviewing.
  if (isId(req.body?.category)) {
    Object.assign(product, await resolveProductCategoryFields({ category: req.body.category }));
  }
  if (!product.category) throw new AppError('Choose a marketplace category for this product first', 400);
  if (product.category) product.categorySuggestion = '';
  if (hadNew) product.listingStatus = 'approved';
  product.reviewNote = String(req.body?.note || '').trim().slice(0, 1000);
  product.reviewedAt = new Date();
  product.reviewedBy = req.user._id;
  await product.save();
  if (orphaned.length) await deleteManyFromCloudinary(orphaned);

  await logAudit({ req, action: 'approve', entityType: 'product', entityId: product._id, entityLabel: product.nameEn });
  await notifySellerUsers(product.seller, {
    type: 'seller_listing_review',
    titleAr: hadNew ? 'تم اعتماد منتجك' : 'تم اعتماد تعديلاتك',
    titleEn: hadNew ? 'Product approved' : 'Edits approved',
    messageAr: `«${product.nameAr}» ${hadNew ? 'معروض الآن للعملاء.' : 'تم تحديثه في المتجر.'}`,
    messageEn: `"${product.nameEn}" ${hadNew ? 'is now live.' : 'was updated in the store.'}`,
    link: `/seller-center/products/${product._id}`,
  });
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
  await notifySellerUsers(product.seller, {
    type: 'seller_listing_review',
    titleAr: 'منتج يحتاج تعديلاً',
    titleEn: 'Product needs changes',
    messageAr: `«${product.nameAr}»: ${note}`,
    messageEn: `"${product.nameEn}": ${note}`,
    link: `/seller-center/products/${product._id}`,
  });
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

/** Staff replace (or remove with `remove=logo|banner`) a seller's logo / banner image. */
export const updateSellerMediaAdmin = asyncHandler(async (req, res) => {
  const seller = await findSeller(req.params.id);
  const before = seller.toObject();
  for (const kind of ['logo', 'banner']) {
    const file = req.files?.[kind]?.[0];
    const remove = req.body?.remove === kind;
    if (!file && !remove) continue;
    const oldId = seller[`${kind}PublicId`];
    if (file) {
      // eslint-disable-next-line no-await-in-loop
      const up = await uploadFileToCloudinary(file, CLOUDINARY_FOLDERS.sellers);
      seller[`${kind}Url`] = up.url;
      seller[`${kind}PublicId`] = up.publicId;
    } else {
      seller[`${kind}Url`] = '';
      seller[`${kind}PublicId`] = '';
    }
    // eslint-disable-next-line no-await-in-loop
    if (oldId) await deleteFromCloudinary(oldId).catch(() => {});
  }
  await seller.save();
  const changes = sellerChanges(before, seller.toObject());
  if (Object.keys(changes).length) {
    await logAudit({ req, action: 'update', entityType: 'seller', entityId: seller._id, entityLabel: seller.nameEn, changes });
  }
  res.json({ success: true, data: formatSellerPrivate(seller, { revealBank: req.user.role === 'super_admin' }) });
});
