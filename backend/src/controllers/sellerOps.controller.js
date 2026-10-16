/**
 * Seller operations beyond the catalog: staff logins (owner only) and inbound stock to the
 * store's warehouse, plus the staff side of receiving that stock.
 */
import mongoose from 'mongoose';
import Product from '../models/Product.js';
import User from '../models/User.js';
import Counter from '../models/Counter.js';
import FulfillmentLocation from '../models/FulfillmentLocation.js';
import InboundShipment, { INBOUND_STATUSES } from '../models/InboundShipment.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { parsePagination, paginationMeta } from '../utils/listQuery.js';
import { logAudit } from '../services/auditLog.service.js';
import { sellerUsers, notifySellerUsers } from '../services/marketplace.service.js';
import { normalizeVariantId } from '../utils/productCatalog.js';
import { SELLER_PERMISSIONS, DEFAULT_STAFF_PERMISSIONS, sellerUserPermissions } from '../constants/marketplace.js';
import { logSellerActivity } from '../services/sellerActivity.service.js';
import { assertStrongPassword } from './sellerAuth.controller.js';

export function readPermissions(value, fallback) {
  if (!Array.isArray(value)) return fallback;
  return [...new Set(value.map(String).filter((p) => SELLER_PERMISSIONS.includes(p)))];
}

const teamRow = (m) => ({
  _id: m._id, name: m.name, email: m.email, role: m.role, isActive: m.isActive !== false,
  permissions: sellerUserPermissions(m), twoFactorEnabled: m.twoFactorEnabled === true, lastLoginAt: m.lastLoginAt || null,
});

const isId = (v) => mongoose.Types.ObjectId.isValid(v);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const MAX_STAFF = 10;

// ── Team (seller staff logins) ──

export const listTeam = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await sellerUsers(req.seller._id) });
});

export const addTeamMember = asyncHandler(async (req, res) => {
  const name = String(req.body?.name || '').trim().slice(0, 100);
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (name.length < 2) throw new AppError('Name is required', 400);
  if (!EMAIL_RE.test(email)) throw new AppError('A valid email is required', 400);
  assertStrongPassword(password);
  if (await User.countDocuments({ seller: req.seller._id }) >= MAX_STAFF + 1) {
    throw new AppError(`Up to ${MAX_STAFF} staff logins per store`, 400);
  }
  if (await User.exists({ email })) throw new AppError('This email is already registered', 409);
  const member = await User.create({
    name,
    email,
    password,
    role: 'seller_staff',
    seller: req.seller._id,
    createdBy: req.user._id,
    sellerPermissions: readPermissions(req.body?.permissions, DEFAULT_STAFF_PERMISSIONS),
  });
  await logSellerActivity(req, { action: 'team.add', entityType: 'user', entityId: member._id, label: member.name, details: { permissions: member.sellerPermissions } });
  res.status(201).json({ success: true, data: teamRow(member) });
});

/** Activate / deactivate a staff login. The owner login can't be changed here. */
export const updateTeamMember = asyncHandler(async (req, res) => {
  if (!isId(req.params.userId)) throw new AppError('Team member not found', 404);
  const member = await User.findOne({ _id: req.params.userId, seller: req.seller._id, role: 'seller_staff' });
  if (!member) throw new AppError('Team member not found', 404);
  const changes = {};
  if (req.body?.isActive !== undefined) {
    member.isActive = req.body.isActive === true || req.body.isActive === 'true';
    changes.isActive = member.isActive;
    // Deactivating signs the login out everywhere at once.
    if (!member.isActive) member.sessionVersion = (member.sessionVersion || 0) + 1;
  }
  if (req.body?.permissions !== undefined) {
    member.sellerPermissions = readPermissions(req.body.permissions, member.sellerPermissions);
    changes.permissions = member.sellerPermissions;
  }
  if (req.body?.password) {
    assertStrongPassword(req.body.password);
    member.password = String(req.body.password);
    member.sessionVersion = (member.sessionVersion || 0) + 1;
    changes.password = 'reset';
  }
  await member.save();
  await logSellerActivity(req, { action: 'team.update', entityType: 'user', entityId: member._id, label: member.name, details: changes });
  res.json({ success: true, data: teamRow(member) });
});

// ── Inbound stock (seller side) ──

async function nextInboundNumber() {
  const counter = await Counter.findOneAndUpdate({ _id: 'inbound' }, { $inc: { seq: 1 } }, { new: true, upsert: true });
  return `IN-${String(counter.seq).padStart(5, '0')}`;
}

function formatInbound(doc) {
  const d = doc.toObject ? doc.toObject() : doc;
  return {
    ...d,
    totalUnits: (d.items || []).reduce((s, it) => s + it.quantity, 0),
    receivedUnits: (d.items || []).reduce((s, it) => s + (it.receivedQuantity || 0), 0),
  };
}

export const listMyInbound = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, 50);
  const filter = { seller: req.seller._id };
  if (INBOUND_STATUSES.includes(req.query.status)) filter.status = req.query.status;
  const [items, total, locations] = await Promise.all([
    InboundShipment.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('fulfillmentLocation', 'name address').lean(),
    InboundShipment.countDocuments(filter),
    FulfillmentLocation.find({ isActive: true }).select('name address isDefault').lean(),
  ]);
  res.json({ success: true, data: items.map(formatInbound), locations, pagination: paginationMeta(page, limit, total) });
});

export const createInbound = asyncHandler(async (req, res) => {
  const rawItems = Array.isArray(req.body?.items) ? req.body.items.slice(0, 100) : [];
  if (!rawItems.length) throw new AppError('Add at least one product', 400);

  const productIds = [...new Set(rawItems.map((it) => String(it.productId)).filter(isId))];
  const products = await Product.find({ _id: { $in: productIds }, seller: req.seller._id })
    .select('nameAr nameEn sku fulfilledBy variants')
    .lean();
  const byId = new Map(products.map((p) => [String(p._id), p]));

  const items = rawItems.map((it) => {
    const product = byId.get(String(it.productId));
    if (!product) throw new AppError('Product not found', 404);
    if (product.fulfilledBy !== 'store') {
      throw new AppError(`"${product.nameEn}" ships from you — only store-fulfilled products are sent to our warehouse`, 400);
    }
    const quantity = Math.floor(Number(it.quantity));
    if (!(quantity >= 1 && quantity <= 100000)) throw new AppError('Quantities must be at least 1', 400);
    let variant = null;
    if (product.variants?.length) {
      variant = product.variants.find((v) => String(v._id) === String(it.variantId));
      if (!variant) throw new AppError(`Choose a variant for "${product.nameEn}"`, 400);
    }
    return {
      product: product._id,
      variantId: variant?._id || null,
      nameAr: product.nameAr,
      nameEn: product.nameEn,
      variantLabelAr: variant?.valueAr || '',
      variantLabelEn: variant?.valueEn || '',
      sku: variant?.sku || product.sku,
      quantity,
    };
  });

  let location = null;
  if (isId(req.body?.fulfillmentLocation)) {
    location = await FulfillmentLocation.findOne({ _id: req.body.fulfillmentLocation, isActive: true }).select('_id').lean();
    if (!location) throw new AppError('Unknown warehouse', 400);
  } else {
    location = await FulfillmentLocation.findOne({ isActive: true, isDefault: true }).select('_id').lean();
  }

  const expectedAt = req.body?.expectedAt ? new Date(req.body.expectedAt) : null;
  const inbound = await InboundShipment.create({
    inboundNumber: await nextInboundNumber(),
    seller: req.seller._id,
    sellerNameAr: req.seller.nameAr,
    sellerNameEn: req.seller.nameEn,
    fulfillmentLocation: location?._id || null,
    items,
    expectedAt: expectedAt && !Number.isNaN(expectedAt.getTime()) ? expectedAt : null,
    carrier: String(req.body?.carrier || '').trim().slice(0, 60),
    trackingNumber: String(req.body?.trackingNumber || '').trim().slice(0, 80),
    note: String(req.body?.note || '').trim().slice(0, 500),
    createdBy: req.user._id,
  });
  res.status(201).json({ success: true, data: formatInbound(inbound) });
});

export const cancelMyInbound = asyncHandler(async (req, res) => {
  if (!isId(req.params.id)) throw new AppError('Inbound shipment not found', 404);
  const inbound = await InboundShipment.findOneAndUpdate(
    { _id: req.params.id, seller: req.seller._id, status: 'pending' },
    { $set: { status: 'cancelled', cancelledAt: new Date() } },
    { new: true },
  );
  if (!inbound) throw new AppError('Only pending inbound shipments can be cancelled', 400);
  res.json({ success: true, data: formatInbound(inbound) });
});

// ── Inbound stock (staff side) ──

export const listInboundAdmin = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, 100);
  const filter = {};
  if (INBOUND_STATUSES.includes(req.query.status)) filter.status = req.query.status;
  if (isId(req.query.seller)) filter.seller = req.query.seller;
  const [items, total] = await Promise.all([
    InboundShipment.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('fulfillmentLocation', 'name').lean(),
    InboundShipment.countDocuments(filter),
  ]);
  res.json({ success: true, data: items.map(formatInbound), pagination: paginationMeta(page, limit, total) });
});

/**
 * Staff count what arrived. Received quantities (0 … sent) are added to warehouse stock
 * atomically; the pending → received switch is itself atomic, so a double submit can't
 * add the stock twice.
 */
export const receiveInboundAdmin = asyncHandler(async (req, res) => {
  if (!isId(req.params.id)) throw new AppError('Inbound shipment not found', 404);
  const current = await InboundShipment.findOne({ _id: req.params.id, status: 'pending' }).lean();
  if (!current) throw new AppError('Only pending inbound shipments can be received', 400);

  const counts = Array.isArray(req.body?.items) ? req.body.items : [];
  const received = current.items.map((it, index) => {
    const row = counts.find((c) => Number(c.index) === index);
    const qty = row ? Math.floor(Number(row.receivedQuantity)) : it.quantity;
    if (!(qty >= 0 && qty <= it.quantity)) throw new AppError(`Line ${index + 1}: received must be 0–${it.quantity}`, 400);
    return { ...it, receivedQuantity: qty };
  });

  const claimed = await InboundShipment.findOneAndUpdate(
    { _id: current._id, status: 'pending' },
    {
      $set: {
        status: 'received',
        items: received,
        receivedAt: new Date(),
        receivedBy: req.user._id,
        receiveNote: String(req.body?.note || '').trim().slice(0, 500),
      },
    },
    { new: true },
  );
  if (!claimed) throw new AppError('This inbound shipment was already processed', 409);

  for (const it of received) {
    if (!it.receivedQuantity) continue;
    const now = new Date();
    if (it.variantId) {
      // eslint-disable-next-line no-await-in-loop
      await Product.updateOne(
        { _id: it.product, 'variants._id': normalizeVariantId(it.variantId) },
        { $inc: { 'variants.$.stock': it.receivedQuantity }, $set: { stockUpdatedAt: now } },
      );
    } else {
      // eslint-disable-next-line no-await-in-loop
      await Product.updateOne({ _id: it.product }, { $inc: { stock: it.receivedQuantity }, $set: { stockUpdatedAt: now } });
    }
  }

  const sent = received.reduce((s, it) => s + it.quantity, 0);
  const got = received.reduce((s, it) => s + it.receivedQuantity, 0);
  await logAudit({
    req, action: 'update', entityType: 'seller', entityId: claimed.seller, entityLabel: `${claimed.inboundNumber} received`,
    changes: { units: { from: sent, to: got } },
  });
  await notifySellerUsers(claimed.seller, {
    type: 'seller_account',
    titleAr: 'استلمنا شحنتك',
    titleEn: 'Inbound shipment received',
    messageAr: `${claimed.inboundNumber}: استلمنا ${got} من ${sent} قطعة وأضفناها لمخزونك.`,
    messageEn: `${claimed.inboundNumber}: received ${got} of ${sent} units — added to your stock.`,
    link: '/seller-center/inbound',
  });
  res.json({ success: true, data: formatInbound(claimed) });
});
