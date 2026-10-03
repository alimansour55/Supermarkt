import mongoose from 'mongoose';
import StoreSettings from '../models/StoreSettings.js';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import Category from '../models/Category.js';
import Brand from '../models/Brand.js';
import FulfillmentLocation from '../models/FulfillmentLocation.js';
import DeliveryZone from '../models/DeliveryZone.js';
import Promotion from '../models/Promotion.js';
import User from '../models/User.js';
import { DEFAULT_PARTNER_REVENUE } from '../constants/storeDefaults.js';
import {
  normalizePartnerRevenueSettings,
  PARTNER_REVENUE_FACTOR_META,
  partnerHasScopes,
  normalizePartnerScopes,
  detectScopeConflicts,
  buildScopeOverview,
  partnerKeyOf,
  convertScopesToRules,
  mergeAutoRules,
  normalizeAttributionRules,
  detectRuleWarnings,
} from '../constants/partnerRevenueDefaults.js';
import { getAllDescendantIds } from '../utils/categoryTree.js';
import { parseRevenueRangeQuery, revenueOrderMatch } from '../utils/revenueReport.js';
import { computeRuleAttribution } from './partnerRuleEngine.js';
import { logAudit } from './auditLog.service.js';
import PartnerLedgerEntry, { PARTNER_LEDGER_TYPES, PARTNER_LEDGER_SIGN } from '../models/PartnerLedgerEntry.js';
import PartnerPayout from '../models/PartnerPayout.js';

const SETTINGS_KEY = 'main';
const PARTNER_CANDIDATE_ROLES = ['manager', 'admin', 'super_admin'];

function partnerKey(partner) {
  if (partner.userId) return String(partner.userId);
  if (partner._id) return String(partner._id);
  return null;
}

function isValidPartner(partner) {
  if (!partner || partner.isActive === false) return false;
  const key = partnerKey(partner);
  if (!key) return false;
  return Boolean(partner.userId || partner.nameAr?.trim() || partner.nameEn?.trim());
}

async function loadPartnerCandidates() {
  const users = await User.find({
    role: { $in: PARTNER_CANDIDATE_ROLES },
    isActive: { $ne: false },
    username: { $exists: true, $nin: [null, ''] },
  })
    .select('name username role')
    .sort({ name: 1 })
    .lean();

  return users.map((u) => ({
    id: u._id,
    name: u.name,
    username: u.username,
    role: u.role,
  }));
}

async function loadPartnerRevenueSettings() {
  let settings = await StoreSettings.findOne({ key: SETTINGS_KEY })
    .select('partnerRevenue')
    .lean();

  if (!settings?.partnerRevenue) {
    settings = await StoreSettings.findOneAndUpdate(
      { key: SETTINGS_KEY },
      { $setOnInsert: { key: SETTINGS_KEY, partnerRevenue: DEFAULT_PARTNER_REVENUE } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).select('partnerRevenue').lean();
  }

  return normalizePartnerRevenueSettings(settings?.partnerRevenue || DEFAULT_PARTNER_REVENUE);
}

async function loadAssignedScopeLabels(partners) {
  const productIds = new Set();
  const userIds = new Set();
  for (const partner of partners || []) {
    const scopes = normalizePartnerScopes(partner.scopes);
    scopes.products.forEach((id) => productIds.add(id));
    scopes.users.forEach((id) => userIds.add(id));
  }

  const [products, users] = await Promise.all([
    productIds.size
      ? Product.find({ _id: { $in: [...productIds] } }).select('_id nameAr nameEn sku').lean()
      : Promise.resolve([]),
    userIds.size
      ? User.find({ _id: { $in: [...userIds] } }).select('_id name username email phone').lean()
      : Promise.resolve([]),
  ]);

  return { products, users };
}

async function loadOrderFacets() {
  const [cities, governorates, coupons] = await Promise.all([
    Order.distinct('shippingAddress.city'),
    Order.distinct('shippingAddress.governorate'),
    Order.distinct('couponCode'),
  ]);
  const clean = (list) => [...new Set(list.map((s) => String(s || '').trim()).filter(Boolean))].sort().slice(0, 300);
  return { cities: clean(cities), governorates: clean(governorates), couponCodes: clean(coupons) };
}

export async function getPartnerRevenueSettings() {
  const [settings, candidates, catalog, orderFacets] = await Promise.all([
    loadPartnerRevenueSettings(),
    loadPartnerCandidates(),
    loadPartnerRevenueCatalog(),
    loadOrderFacets(),
  ]);
  const conflicts = detectScopeConflicts(settings.partners);
  const scopeOverview = buildScopeOverview(settings.partners);
  const ruleWarnings = detectRuleWarnings(settings.rules || [], settings.partners || []);
  const { products, users } = await loadAssignedScopeLabels(settings.partners);
  return {
    settings,
    candidates,
    conflicts,
    scopeOverview,
    ruleWarnings,
    catalog: { ...catalog, ...orderFacets, products, users },
  };
}

async function loadPartnerRevenueCatalog() {
  const [categories, brands, deliveryZones, fulfillmentLocations, promotions] = await Promise.all([
    Category.find({ isActive: true })
      .select('_id nameAr nameEn slug parentCategory level sortOrder')
      .populate('parentCategory', 'nameAr nameEn slug')
      .sort({ sortOrder: 1, nameEn: 1 })
      .limit(1000)
      .lean(),
    Brand.find({ isActive: true }).select('_id nameAr nameEn slug').sort({ sortOrder: 1, nameEn: 1 }).limit(500).lean(),
    DeliveryZone.find({ isActive: { $ne: false } }).select('_id areaAr areaEn slug cityAr cityEn').sort({ areaEn: 1 }).lean(),
    FulfillmentLocation.find({ isActive: { $ne: false } }).select('_id name').sort({ name: 1 }).lean(),
    Promotion.find({ isActive: true }).select('_id nameAr nameEn slug type').sort({ priority: -1, nameEn: 1 }).limit(300).lean(),
  ]);

  return {
    categories: categories.map((c) => ({
      _id: c._id,
      nameAr: c.nameAr,
      nameEn: c.nameEn,
      slug: c.slug,
      parentCategory: c.parentCategory?._id || c.parentCategory || null,
      level: c.level,
    })),
    brands,
    deliveryZones,
    fulfillmentLocations,
    promotions,
  };
}

export async function searchPartnerRevenueProducts(query = '', limit = 20) {
  const q = String(query || '').trim();
  if (q.length < 2) return [];

  const products = await Product.find({
    isActive: true,
    $or: [
      { nameAr: { $regex: q, $options: 'i' } },
      { nameEn: { $regex: q, $options: 'i' } },
      { sku: { $regex: q, $options: 'i' } },
    ],
  })
    .select('_id nameAr nameEn sku')
    .sort({ nameEn: 1 })
    .limit(Math.min(Number(limit) || 20, 50))
    .lean();

  return products;
}

export async function searchPartnerRevenueCustomers(query = '', limit = 20) {
  const q = String(query || '').trim();
  if (q.length < 2) return [];

  const users = await User.find({
    role: 'user',
    isActive: { $ne: false },
    $or: [
      { name: { $regex: q, $options: 'i' } },
      { email: { $regex: q, $options: 'i' } },
      { phone: { $regex: q, $options: 'i' } },
      { username: { $regex: q, $options: 'i' } },
    ],
  })
    .select('_id name email phone username')
    .sort({ name: 1 })
    .limit(Math.min(Number(limit) || 20, 50))
    .lean();

  return users;
}

function reconcileRules(normalized) {
  const validKeys = normalized.partners.map(partnerKeyOf).filter(Boolean);
  const autoRules = convertScopesToRules(normalized.partners, normalized.attributionStreams);
  const merged = mergeAutoRules(normalized.rules || [], autoRules);
  return normalizeAttributionRules(merged, validKeys.length ? validKeys : null);
}

export async function updatePartnerRevenueSettings(payload, req = null) {
  let normalized = normalizePartnerRevenueSettings(payload);
  normalized.rules = reconcileRules(normalized);
  const activePartners = normalized.partners.filter(isValidPartner);

  for (const p of normalized.partners) {
    if (p.contractStartKey && p.contractEndKey && p.contractEndKey < p.contractStartKey) {
      const err = new Error(`Partner "${p.nameEn || p.nameAr}" contract end is before its start`);
      err.statusCode = 400;
      throw err;
    }
  }
  for (const rule of normalized.rules) {
    const total = rule.beneficiaries.reduce((s, b) => s + (b.sharePercent || 0), 0);
    if (total > 100.01) {
      const err = new Error(`Rule "${rule.name || 'Untitled'}" beneficiary shares exceed 100%`);
      err.statusCode = 400;
      throw err;
    }
  }

  if (normalized.enabled && activePartners.length === 0) {
    const err = new Error('Add at least one active partner with a name or team account');
    err.statusCode = 400;
    throw err;
  }

  if (normalized.mode === 'fixed' || normalized.unassignedPolicy === 'percentage') {
    const poolEligible = activePartners.filter((p) => (p.revenueRole || 'combined') !== 'assigned_only');
    const totalFixed = poolEligible.reduce((sum, p) => sum + (Number(p.fixedSharePercent) || 0), 0);
    if (poolEligible.length > 0 && Math.abs(totalFixed - 100) > 0.01) {
      const err = new Error('Partner pool share percentages must total 100% (excluding assignments-only partners)');
      err.statusCode = 400;
      throw err;
    }
  }

  if (normalized.mode === 'hybrid') {
    const totalBase = activePartners.reduce((sum, p) => sum + (Number(p.baseSharePercent) || 0), 0);
    const maxBase = 100 - normalized.reservePercent;
    if (activePartners.length > 0 && totalBase >= maxBase) {
      const err = new Error(`Base shares must total less than ${maxBase}% (after platform reserve)`);
      err.statusCode = 400;
      throw err;
    }
  }

  let saved;
  const doc = await StoreSettings.findOne({ key: SETTINGS_KEY });
  if (doc) {
    doc.partnerRevenue = normalized;
    doc.markModified('partnerRevenue');
    await doc.save();
    saved = normalizePartnerRevenueSettings(doc.partnerRevenue?.toObject?.() || doc.partnerRevenue || normalized);
  } else {
    const settings = await StoreSettings.findOneAndUpdate(
      { key: SETTINGS_KEY },
      { $set: { partnerRevenue: normalized } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).select('partnerRevenue').lean();
    saved = normalizePartnerRevenueSettings(settings?.partnerRevenue || normalized);
  }

  if (req) {
    await logAudit({
      req,
      action: 'update',
      entityType: 'store_settings',
      entityLabel: 'Partner revenue distribution',
      changes: {
        enabled: saved.enabled,
        mode: saved.mode,
        partners: saved.partners.length,
        rules: saved.rules.length,
      },
    });
  }

  return saved;
}

function splitAmongPartners(amount, partnerKeys) {
  if (!partnerKeys.length || amount <= 0) return {};
  const share = amount / partnerKeys.length;
  const result = {};
  for (const key of partnerKeys) {
    result[key] = (result[key] || 0) + share;
  }
  return result;
}

function buildScopeLookupMaps(partners) {
  const productMap = {};
  const categoryMap = {};
  const brandMap = {};
  const zoneMap = {};
  const locationMap = {};
  const userMap = {};
  const promotionMap = {};

  for (const partner of partners) {
    const key = partnerKey(partner);
    if (!key) continue;
    const scopes = normalizePartnerScopes(partner.scopes);
    for (const id of scopes.products) {
      if (!productMap[id]) productMap[id] = [];
      productMap[id].push(key);
    }
    for (const id of scopes.categories) {
      if (!categoryMap[id]) categoryMap[id] = [];
      categoryMap[id].push(key);
    }
    for (const id of scopes.brands) {
      if (!brandMap[id]) brandMap[id] = [];
      brandMap[id].push(key);
    }
    for (const id of scopes.deliveryZones) {
      if (!zoneMap[id]) zoneMap[id] = [];
      zoneMap[id].push(key);
    }
    for (const id of scopes.fulfillmentLocations) {
      if (!locationMap[id]) locationMap[id] = [];
      locationMap[id].push(key);
    }
    for (const id of scopes.users) {
      if (!userMap[id]) userMap[id] = [];
      userMap[id].push(key);
    }
    for (const id of scopes.promotions) {
      if (!promotionMap[id]) promotionMap[id] = [];
      promotionMap[id].push(key);
    }
  }

  return { productMap, categoryMap, brandMap, zoneMap, locationMap, userMap, promotionMap };
}

function lineRevenueFromBasis(linePrice, lineQty, wholesalePrice, revenueBasis) {
  const revenue = linePrice * lineQty;
  if (revenueBasis === 'grossProfit') {
    return Math.max(revenue - (wholesalePrice || 0) * lineQty, 0);
  }
  return revenue;
}

function orderRevenueFromBasis(orderTotal, orderSubtotal, revenueBasis) {
  if (revenueBasis === 'productSales') {
    return orderSubtotal || 0;
  }
  if (revenueBasis === 'grossProfit') {
    return orderSubtotal || 0;
  }
  return orderTotal || 0;
}

async function computeScopedAttribution(revenueMatch, partners, { revenueBasis, attributionStreams }) {
  const active = partners.filter(isValidPartner);
  const attribution = {};
  const streams = attributionStreams || {};
  const {
    productMap, categoryMap, brandMap, zoneMap, locationMap, userMap, promotionMap,
  } = buildScopeLookupMaps(active);

  const hasProductScopes = Object.keys(productMap).length > 0
    || Object.keys(categoryMap).length > 0
    || Object.keys(brandMap).length > 0
    || Object.keys(promotionMap).length > 0;
  const hasZoneScopes = Object.keys(zoneMap).length > 0;
  const hasLocationScopes = Object.keys(locationMap).length > 0;
  const hasUserScopes = Object.keys(userMap).length > 0;

  const hasPromotionScopes = Object.keys(promotionMap).length > 0;

  if (!hasProductScopes && !hasZoneScopes && !hasLocationScopes && !hasUserScopes && !hasPromotionScopes) {
    return { attribution, totalAttributed: 0, hasScopes: false };
  }

  const emptyAttr = () => ({
    productSales: 0,
    zoneOrders: 0,
    zoneDeliveryFees: 0,
    locationOrders: 0,
    customerOrders: 0,
    promotionSales: 0,
    total: 0,
  });

  const addAttr = (key, field, amount) => {
    if (!attribution[key]) attribution[key] = emptyAttr();
    attribution[key][field] += amount;
    attribution[key].total += amount;
  };

  const categoryPartnerLookup = {};
  for (const [catId, partnerKeys] of Object.entries(categoryMap)) {
    categoryPartnerLookup[catId] = partnerKeys;
    const descendants = await getAllDescendantIds(catId);
    for (const descId of descendants) {
      const sid = String(descId);
      if (!categoryPartnerLookup[sid]) categoryPartnerLookup[sid] = [];
      partnerKeys.forEach((k) => {
        if (!categoryPartnerLookup[sid].includes(k)) categoryPartnerLookup[sid].push(k);
      });
    }
  }

  if (streams.productSales !== false && hasProductScopes) {
    const lineRows = await Order.aggregate([
      { $match: revenueMatch },
      { $unwind: '$items' },
      {
        $lookup: {
          from: 'products',
          localField: 'items.product',
          foreignField: '_id',
          as: 'prod',
        },
      },
      { $unwind: { path: '$prod', preserveNullAndEmptyArrays: false } },
      {
        $project: {
          productId: { $toString: '$prod._id' },
          categoryId: { $toString: '$prod.category' },
          brandId: { $toString: '$prod.brand' },
          linePrice: '$items.price',
          lineQty: '$items.quantity',
          wholesalePrice: { $ifNull: ['$items.wholesalePrice', '$prod.wholesalePrice'] },
        },
      },
    ]);

    for (const row of lineRows) {
      const matchedKeys = new Set();
      if (productMap[row.productId]) productMap[row.productId].forEach((k) => matchedKeys.add(k));
      if (row.categoryId && categoryPartnerLookup[row.categoryId]) {
        categoryPartnerLookup[row.categoryId].forEach((k) => matchedKeys.add(k));
      }
      if (row.brandId && brandMap[row.brandId]) brandMap[row.brandId].forEach((k) => matchedKeys.add(k));

      if (!matchedKeys.size) continue;
      const amount = lineRevenueFromBasis(
        row.linePrice || 0,
        row.lineQty || 0,
        row.wholesalePrice || 0,
        revenueBasis,
      );
      const additions = splitAmongPartners(amount, [...matchedKeys]);
      for (const [key, share] of Object.entries(additions)) {
        addAttr(key, 'productSales', share);
      }
    }
  }

  if (streams.promotionSales !== false && Object.keys(promotionMap).length > 0) {
    const promotionIds = Object.keys(promotionMap).map((id) => new mongoose.Types.ObjectId(id));
    const promotions = await Promotion.find({ _id: { $in: promotionIds } })
      .select('productIds categoryIds')
      .lean();

    const promoProductMap = {};
    const promoCategoryIds = new Set();
    for (const promo of promotions) {
      const pid = String(promo._id);
      promoProductMap[pid] = (promo.productIds || []).map(String);
      (promo.categoryIds || []).forEach((cid) => promoCategoryIds.add(String(cid)));
    }

    const promoCategoryLookup = {};
    for (const catId of promoCategoryIds) {
      const descendants = await getAllDescendantIds(catId);
      promoCategoryLookup[catId] = [catId, ...descendants.map(String)];
    }

    const lineRows = await Order.aggregate([
      { $match: revenueMatch },
      { $unwind: '$items' },
      {
        $lookup: {
          from: 'products',
          localField: 'items.product',
          foreignField: '_id',
          as: 'prod',
        },
      },
      { $unwind: { path: '$prod', preserveNullAndEmptyArrays: false } },
      {
        $project: {
          productId: { $toString: '$prod._id' },
          categoryId: { $toString: '$prod.category' },
          linePrice: '$items.price',
          lineQty: '$items.quantity',
          wholesalePrice: { $ifNull: ['$items.wholesalePrice', '$prod.wholesalePrice'] },
        },
      },
    ]);

    for (const row of lineRows) {
      const matchedKeys = new Set();
      for (const [promoId, productIds] of Object.entries(promoProductMap)) {
        if (productIds.includes(row.productId)) {
          promotionMap[promoId]?.forEach((k) => matchedKeys.add(k));
        }
      }
      for (const promo of promotions) {
        const promoId = String(promo._id);
        const catIds = (promo.categoryIds || []).map(String);
        for (const catId of catIds) {
          const expanded = promoCategoryLookup[catId] || [catId];
          if (row.categoryId && expanded.includes(row.categoryId)) {
            promotionMap[promoId]?.forEach((k) => matchedKeys.add(k));
            break;
          }
        }
      }

      if (!matchedKeys.size) continue;
      const amount = lineRevenueFromBasis(
        row.linePrice || 0,
        row.lineQty || 0,
        row.wholesalePrice || 0,
        revenueBasis,
      );
      for (const [key, share] of Object.entries(splitAmongPartners(amount, [...matchedKeys]))) {
        addAttr(key, 'promotionSales', share);
      }
    }
  }

  if ((streams.zoneOrders !== false || streams.zoneDeliveryFees !== false) && hasZoneScopes) {
    const zoneIds = Object.keys(zoneMap).map((id) => new mongoose.Types.ObjectId(id));
    const zoneRows = await Order.aggregate([
      { $match: { ...revenueMatch, deliveryZone: { $in: zoneIds } } },
      {
        $project: {
          zoneId: { $toString: '$deliveryZone' },
          total: { $ifNull: ['$total', 0] },
          subtotal: { $ifNull: ['$subtotal', 0] },
          deliveryFee: { $ifNull: ['$deliveryFee', 0] },
        },
      },
    ]);

    for (const row of zoneRows) {
      const partnerKeys = zoneMap[row.zoneId];
      if (!partnerKeys?.length) continue;

      if (streams.zoneOrders !== false) {
        const amount = orderRevenueFromBasis(row.total, row.subtotal, revenueBasis);
        for (const [key, share] of Object.entries(splitAmongPartners(amount, partnerKeys))) {
          addAttr(key, 'zoneOrders', share);
        }
      }

      if (streams.zoneDeliveryFees !== false) {
        for (const [key, share] of Object.entries(splitAmongPartners(row.deliveryFee || 0, partnerKeys))) {
          addAttr(key, 'zoneDeliveryFees', share);
        }
      }
    }
  }

  if (streams.locationOrders !== false && hasLocationScopes) {
    const locationIds = Object.keys(locationMap).map((id) => new mongoose.Types.ObjectId(id));
    const locationRows = await Order.aggregate([
      { $match: { ...revenueMatch, fulfillmentLocationId: { $in: locationIds } } },
      {
        $project: {
          locationId: { $toString: '$fulfillmentLocationId' },
          total: { $ifNull: ['$total', 0] },
          subtotal: { $ifNull: ['$subtotal', 0] },
        },
      },
    ]);

    for (const row of locationRows) {
      const partnerKeys = locationMap[row.locationId];
      if (!partnerKeys?.length) continue;
      const amount = orderRevenueFromBasis(row.total, row.subtotal, revenueBasis);
      for (const [key, share] of Object.entries(splitAmongPartners(amount, partnerKeys))) {
        addAttr(key, 'locationOrders', share);
      }
    }
  }

  if (streams.customerOrders !== false && hasUserScopes) {
    const customerIds = Object.keys(userMap).map((id) => new mongoose.Types.ObjectId(id));
    const customerRows = await Order.aggregate([
      { $match: { ...revenueMatch, user: { $in: customerIds } } },
      {
        $project: {
          userId: { $toString: '$user' },
          total: { $ifNull: ['$total', 0] },
          subtotal: { $ifNull: ['$subtotal', 0] },
        },
      },
    ]);

    for (const row of customerRows) {
      const partnerKeys = userMap[row.userId];
      if (!partnerKeys?.length) continue;
      const amount = orderRevenueFromBasis(row.total, row.subtotal, revenueBasis);
      for (const [key, share] of Object.entries(splitAmongPartners(amount, partnerKeys))) {
        addAttr(key, 'customerOrders', share);
      }
    }
  }

  const totalAttributed = Object.values(attribution).reduce((sum, row) => sum + (row.total || 0), 0);
  const hasAnyScopes = hasProductScopes || hasZoneScopes || hasLocationScopes || hasUserScopes
    || Object.keys(promotionMap).length > 0;
  return { attribution, totalAttributed, hasScopes: hasAnyScopes };
}

async function aggregateScopedProductSales(revenueMatch, partners) {
  const { attribution } = await computeScopedAttribution(revenueMatch, partners, {
    revenueBasis: 'productSales',
    attributionStreams: { productSales: true, zoneOrders: false, zoneDeliveryFees: false, locationOrders: false },
  });
  const result = {};
  for (const [key, row] of Object.entries(attribution)) {
    result[key] = { revenue: row.productSales || 0, cost: 0, units: 0 };
  }
  return result;
}

async function aggregateScopedZoneStats(revenueMatch, partners) {
  const { attribution } = await computeScopedAttribution(revenueMatch, partners, {
    revenueBasis: 'total',
    attributionStreams: { productSales: false, zoneOrders: true, zoneDeliveryFees: true, locationOrders: false },
  });
  const orders = {};
  const fees = {};
  for (const [key, row] of Object.entries(attribution)) {
    if (row.zoneOrders > 0) orders[key] = row.zoneOrders;
    if (row.zoneDeliveryFees > 0) fees[key] = row.zoneDeliveryFees;
  }
  return { orders, fees };
}

function distributeAttributionAmounts({
  partners,
  distributable,
  attribution,
  totalAttributed,
  unassignedPolicy,
  contributions,
  rulesMode = false,
}) {
  const active = partners.filter(isValidPartner);
  if (!active.length) return [];

  const rawAttributed = totalAttributed || 0;
  const attributedPool = Math.min(rawAttributed, distributable);
  const unassignedPool = Math.max(distributable - attributedPool, 0);
  const attrScale = rawAttributed > 0 ? attributedPool / rawAttributed : 0;

  const poolEligible = active.filter((p) => {
    const role = p.revenueRole || 'combined';
    return role === 'combined' || role === 'pool_only';
  });
  const poolTotalPct = poolEligible.reduce((sum, p) => sum + (Number(p.fixedSharePercent) || 0), 0);

  const rows = active.map((partner) => {
    const key = partnerKey(partner);
    const role = partner.revenueRole || 'combined';
    // Rules already bake the partner's share into each rule's rate, so don't re-apply it.
    const assignPct = rulesMode ? 1 : (Number(partner.assignmentSharePercent ?? 100)) / 100;
    const rawAttr = (attribution[key]?.total || 0) * assignPct;
    const directAttr = Math.round(rawAttr * attrScale * 100) / 100;

    let poolBonus = 0;
    if (role === 'pool_only') {
      const pct = Number(partner.fixedSharePercent) || 0;
      poolBonus = poolTotalPct > 0
        ? Math.round(distributable * (pct / poolTotalPct) * 100) / 100
        : 0;
    } else if (role === 'combined' && unassignedPool > 0) {
      const pct = Number(partner.fixedSharePercent) || 0;
      if (unassignedPolicy === 'percentage' && poolTotalPct > 0 && pct > 0) {
        poolBonus = Math.round(unassignedPool * (pct / poolTotalPct) * 100) / 100;
      } else if (unassignedPolicy === 'equal') {
        poolBonus = Math.round((unassignedPool / poolEligible.length) * 100) / 100;
      } else if (unassignedPolicy === 'weighted') {
        const totalScore = poolEligible.reduce(
          (sum, p) => sum + (contributions[partnerKey(p)]?.score || 0),
          0,
        );
        const score = contributions[key]?.score || 0;
        if (totalScore > 0 && score > 0) {
          poolBonus = Math.round(unassignedPool * (score / totalScore) * 100) / 100;
        }
      }
    }

    let amount;
    if (role === 'assigned_only') {
      amount = directAttr;
    } else if (role === 'pool_only') {
      amount = poolBonus;
    } else {
      amount = Math.round((directAttr + poolBonus) * 100) / 100;
    }

    return {
      partner,
      revenueRole: role,
      attributedAmount: directAttr,
      attribution: attribution[key] || null,
      poolAmount: poolBonus,
      unassignedBonus: role === 'combined' ? poolBonus : 0,
      amount,
      sharePercent: distributable > 0 ? Math.round((amount / distributable) * 10000) / 100 : 0,
      score: rawAttr,
      contribution: contributions[key] || null,
    };
  });

  return rows;
}

async function countByCreatedBy(Model, userIds) {
  if (!userIds.length) return {};
  const rows = await Model.aggregate([
    { $match: { createdBy: { $in: userIds } } },
    { $group: { _id: '$createdBy', count: { $sum: 1 } } },
  ]);
  return Object.fromEntries(rows.map((row) => [String(row._id), row.count]));
}

async function aggregateProductSalesByPartner(revenueMatch, userIds) {
  if (!userIds.length) return {};
  const rows = await Order.aggregate([
    { $match: revenueMatch },
    { $unwind: '$items' },
    {
      $lookup: {
        from: 'products',
        localField: 'items.product',
        foreignField: '_id',
        as: 'prod',
      },
    },
    { $unwind: { path: '$prod', preserveNullAndEmptyArrays: false } },
    { $match: { 'prod.createdBy': { $in: userIds } } },
    {
      $group: {
        _id: '$prod.createdBy',
        revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
        cost: { $sum: { $multiply: [{ $ifNull: ['$items.wholesalePrice', 0] }, '$items.quantity'] } },
        units: { $sum: '$items.quantity' },
      },
    },
  ]);
  return Object.fromEntries(rows.map((row) => [String(row._id), {
    revenue: row.revenue || 0,
    cost: row.cost || 0,
    units: row.units || 0,
  }]));
}

async function aggregateZoneStatsByPartner(revenueMatch, userIds) {
  if (!userIds.length) return { orders: {}, fees: {} };

  const zones = await DeliveryZone.find({ createdBy: { $in: userIds } })
    .select('_id createdBy slug')
    .lean();

  if (!zones.length) return { orders: {}, fees: {} };

  const zoneToPartner = Object.fromEntries(zones.map((z) => [String(z._id), String(z.createdBy)]));
  const zoneIds = zones.map((z) => z._id);

  const rows = await Order.aggregate([
    { $match: { ...revenueMatch, deliveryZone: { $in: zoneIds } } },
    {
      $group: {
        _id: '$deliveryZone',
        orders: { $sum: 1 },
        deliveryFees: { $sum: { $ifNull: ['$deliveryFee', 0] } },
      },
    },
  ]);

  const orders = {};
  const fees = {};
  for (const row of rows) {
    const partnerId = zoneToPartner[String(row._id)];
    if (!partnerId) continue;
    orders[partnerId] = (orders[partnerId] || 0) + (row.orders || 0);
    fees[partnerId] = (fees[partnerId] || 0) + (row.deliveryFees || 0);
  }
  return { orders, fees };
}

async function computeRevenuePool(revenueMatch, revenueBasis) {
  if (revenueBasis === 'productSales') {
    const [agg] = await Order.aggregate([
      { $match: revenueMatch },
      { $unwind: '$items' },
      {
        $group: {
          _id: null,
          revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
          orders: { $addToSet: '$_id' },
        },
      },
      { $project: { revenue: 1, orders: { $size: '$orders' } } },
    ]);
    return { revenue: agg?.revenue || 0, orders: agg?.orders || 0 };
  }

  if (revenueBasis === 'grossProfit') {
    const [agg] = await Order.aggregate([
      { $match: revenueMatch },
      { $unwind: '$items' },
      {
        $group: {
          _id: null,
          revenue: {
            $sum: {
              $subtract: [
                { $multiply: ['$items.price', '$items.quantity'] },
                { $multiply: [{ $ifNull: ['$items.wholesalePrice', 0] }, '$items.quantity'] },
              ],
            },
          },
          orders: { $addToSet: '$_id' },
        },
      },
      { $project: { revenue: 1, orders: { $size: '$orders' } } },
    ]);
    return { revenue: Math.max(agg?.revenue || 0, 0), orders: agg?.orders || 0 };
  }

  const [agg] = await Order.aggregate([
    { $match: revenueMatch },
    { $group: { _id: null, revenue: { $sum: '$total' }, orders: { $sum: 1 } } },
  ]);
  return { revenue: agg?.revenue || 0, orders: agg?.orders || 0 };
}

function buildContribution(partnerUserId, counts, sales, zoneStats, weights, factorEnabled, multiplier = 1) {
  const salesRow = sales[partnerUserId] || { revenue: 0, units: 0 };
  const raw = {
    products: counts.products[partnerUserId] || 0,
    productSales: salesRow.revenue,
    categories: counts.categories[partnerUserId] || 0,
    brands: counts.brands[partnerUserId] || 0,
    fulfillmentLocations: counts.fulfillmentLocations[partnerUserId] || 0,
    deliveryZones: counts.deliveryZones[partnerUserId] || 0,
    promotions: counts.promotions[partnerUserId] || 0,
    zoneOrders: zoneStats.orders[partnerUserId] || 0,
    deliveryFees: zoneStats.fees[partnerUserId] || 0,
  };

  const weighted = {};
  let score = 0;
  for (const factor of PARTNER_REVENUE_FACTOR_META) {
    if (factorEnabled[factor.key] === false) {
      weighted[factor.key] = 0;
      continue;
    }
    const value = raw[factor.key];
    const weight = Number(weights[factor.key]) || 0;
    let points;
    if (factor.key === 'productSales' || factor.key === 'deliveryFees') {
      points = (value / 1000) * weight;
    } else {
      points = value * weight;
    }
    weighted[factor.key] = Math.round(points * 100) / 100;
    score += points;
  }

  score = Math.round(score * multiplier * 100) / 100;

  return {
    raw,
    weighted,
    score,
    productUnitsSold: salesRow.units,
  };
}

function distributeWeightedRemainder(active, remainder, contributions) {
  const totalScore = active.reduce(
    (sum, partner) => sum + (contributions[partnerKey(partner)]?.score || 0),
    0,
  );

  if (remainder <= 0 || totalScore <= 0) {
    const share = remainder > 0 ? remainder / active.length : 0;
    return active.map((partner) => ({
      partner,
      sharePercent: remainder > 0 ? Math.round((100 / active.length) * (remainder / (remainder || 1)) * 100) / 100 : 0,
      amount: Math.round(share * 100) / 100,
      score: contributions[partnerKey(partner)]?.score || 0,
      contribution: contributions[partnerKey(partner)] || null,
      fallbackEqual: totalScore <= 0 && remainder > 0,
    }));
  }

  return active.map((partner) => {
    const key = partnerKey(partner);
    const score = contributions[key]?.score || 0;
    const amount = Math.round(remainder * (score / totalScore) * 100) / 100;
    return {
      partner,
      sharePercent: Math.round((amount / (remainder || 1)) * 10000) / 100,
      amount,
      score,
      contribution: contributions[key] || null,
    };
  });
}

function distributeAmounts({ partners, mode, distributable, contributions }) {
  const active = partners.filter(isValidPartner);
  if (!active.length) return [];

  if (mode === 'equal') {
    const share = distributable / active.length;
    return active.map((partner) => ({
      partner,
      sharePercent: Math.round((100 / active.length) * 100) / 100,
      amount: Math.round(share * 100) / 100,
      score: contributions[partnerKey(partner)]?.score || 0,
      contribution: contributions[partnerKey(partner)] || null,
    }));
  }

  if (mode === 'fixed') {
    return active.map((partner) => {
      const pct = Number(partner.fixedSharePercent) || 0;
      return {
        partner,
        sharePercent: pct,
        amount: Math.round(distributable * (pct / 100) * 100) / 100,
        score: contributions[partnerKey(partner)]?.score || 0,
        contribution: contributions[partnerKey(partner)] || null,
      };
    });
  }

  if (mode === 'hybrid') {
    const baseRows = active.map((partner) => {
      const pct = Number(partner.baseSharePercent) || 0;
      return {
        partner,
        basePercent: pct,
        baseAmount: Math.round(distributable * (pct / 100) * 100) / 100,
        score: contributions[partnerKey(partner)]?.score || 0,
        contribution: contributions[partnerKey(partner)] || null,
      };
    });
    const baseTotal = baseRows.reduce((sum, row) => sum + row.baseAmount, 0);
    const remainder = Math.max(distributable - baseTotal, 0);
    const weightedRows = distributeWeightedRemainder(active, remainder, contributions);
    const weightedMap = Object.fromEntries(weightedRows.map((r) => [partnerKey(r.partner), r]));

    return baseRows.map((row) => {
      const weighted = weightedMap[partnerKey(row.partner)] || { amount: 0, sharePercent: 0 };
      const amount = Math.round((row.baseAmount + weighted.amount) * 100) / 100;
      const sharePercent = distributable > 0
        ? Math.round((amount / distributable) * 10000) / 100
        : 0;
      return {
        partner: row.partner,
        sharePercent,
        amount,
        score: row.score,
        contribution: row.contribution,
        baseAmount: row.baseAmount,
        weightedAmount: weighted.amount,
        fallbackEqual: weighted.fallbackEqual === true,
      };
    });
  }

  const totalScore = active.reduce(
    (sum, partner) => sum + (contributions[partnerKey(partner)]?.score || 0),
    0,
  );

  if (totalScore <= 0) {
    const share = distributable / active.length;
    return active.map((partner) => ({
      partner,
      sharePercent: Math.round((100 / active.length) * 100) / 100,
      amount: Math.round(share * 100) / 100,
      score: 0,
      contribution: contributions[partnerKey(partner)] || null,
      fallbackEqual: true,
    }));
  }

  return active.map((partner) => {
    const key = partnerKey(partner);
    const score = contributions[key]?.score || 0;
    const sharePercent = Math.round((score / totalScore) * 10000) / 100;
    return {
      partner,
      sharePercent,
      amount: Math.round(distributable * (score / totalScore) * 100) / 100,
      score,
      contribution: contributions[key] || null,
    };
  });
}

export async function computePartnerRevenueDistribution(query = {}, { overrideSettings = null } = {}) {
  const settings = overrideSettings
    ? normalizePartnerRevenueSettings(overrideSettings)
    : await loadPartnerRevenueSettings();
  const rulesMode = settings.mode === 'attribution' && (settings.rules || []).length > 0;
  const range = parseRevenueRangeQuery(query);
  const revenueMatch = revenueOrderMatch({
    createdAt: { $gte: range.since, $lt: range.until },
  });

  const { revenue: totalRevenue, orders: totalOrders } = await computeRevenuePool(
    revenueMatch,
    settings.revenueBasis,
  );

  const activePartners = (settings.partners || [])
    .filter(isValidPartner)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  const reserveAmount = Math.round(totalRevenue * (settings.reservePercent / 100) * 100) / 100;
  const distributable = Math.round((totalRevenue - reserveAmount) * 100) / 100;

  const baseResponse = {
    period: {
      startKey: range.startKey,
      endKey: range.endKey,
      days: range.days,
      periodKey: range.periodKey,
    },
    summary: {
      totalRevenue,
      totalOrders,
      reservePercent: settings.reservePercent,
      reserveAmount,
      distributable,
      partnerCount: activePartners.length,
      mode: settings.mode,
      revenueBasis: settings.revenueBasis,
    },
    factors: PARTNER_REVENUE_FACTOR_META,
    factorEnabled: settings.factorEnabled,
  };

  if (!settings.enabled) {
    return {
      ...baseResponse,
      enabled: false,
      settings,
      partners: [],
      message: 'Partner revenue distribution is disabled',
    };
  }

  if (activePartners.length === 0) {
    return {
      ...baseResponse,
      enabled: true,
      settings,
      partners: [],
      message: 'No active partners configured',
    };
  }

  const linkedUserIds = activePartners
    .filter((p) => p.userId)
    .map((p) => new mongoose.Types.ObjectId(String(p.userId)));

  const anyPartnerHasScopes = activePartners.some((p) => partnerHasScopes(p.scopes));

  const [
    productCounts,
    categoryCounts,
    brandCounts,
    locationCounts,
    zoneCounts,
    promotionCounts,
    productSales,
    zoneStats,
    scopedProductSales,
    scopedZoneStats,
    scopedAttributionResult,
    users,
  ] = await Promise.all([
    countByCreatedBy(Product, linkedUserIds),
    countByCreatedBy(Category, linkedUserIds),
    countByCreatedBy(Brand, linkedUserIds),
    countByCreatedBy(FulfillmentLocation, linkedUserIds),
    countByCreatedBy(DeliveryZone, linkedUserIds),
    countByCreatedBy(Promotion, linkedUserIds),
    aggregateProductSalesByPartner(revenueMatch, linkedUserIds),
    aggregateZoneStatsByPartner(revenueMatch, linkedUserIds),
    anyPartnerHasScopes
      ? aggregateScopedProductSales(revenueMatch, activePartners)
      : Promise.resolve({}),
    anyPartnerHasScopes
      ? aggregateScopedZoneStats(revenueMatch, activePartners)
      : Promise.resolve({ orders: {}, fees: {} }),
    // eslint-disable-next-line no-nested-ternary
    settings.mode === 'attribution'
      ? (rulesMode
        ? computeRuleAttribution(revenueMatch, settings.rules, activePartners, {
          revenueBasis: settings.revenueBasis,
        }).then((r) => ({ ...r, hasScopes: r.hasRules }))
        : computeScopedAttribution(revenueMatch, activePartners, {
          revenueBasis: settings.revenueBasis,
          attributionStreams: settings.attributionStreams,
        }))
      : Promise.resolve({ attribution: {}, totalAttributed: 0, hasScopes: false }),
    linkedUserIds.length
      ? User.find({ _id: { $in: linkedUserIds } }).select('name username role').lean()
      : [],
  ]);

  const userMap = Object.fromEntries(users.map((u) => [String(u._id), u]));
  const counts = {
    products: productCounts,
    categories: categoryCounts,
    brands: brandCounts,
    fulfillmentLocations: locationCounts,
    deliveryZones: zoneCounts,
    promotions: promotionCounts,
  };

  const contributions = {};
  for (const partner of activePartners) {
    const userId = partner.userId ? String(partner.userId) : null;
    const key = partnerKey(partner);
    const hasScopes = partnerHasScopes(partner.scopes);

    if (userId) {
      const mergedSales = { ...productSales };
      const mergedZoneStats = {
        orders: { ...zoneStats.orders },
        fees: { ...zoneStats.fees },
      };

      if (hasScopes) {
        const scopedSales = scopedProductSales[key];
        if (scopedSales?.revenue) {
          mergedSales[userId] = {
            revenue: (mergedSales[userId]?.revenue || 0) + scopedSales.revenue,
            cost: mergedSales[userId]?.cost || 0,
            units: mergedSales[userId]?.units || 0,
          };
        }
        if (scopedZoneStats.orders[key]) {
          mergedZoneStats.orders[userId] = (mergedZoneStats.orders[userId] || 0) + scopedZoneStats.orders[key];
        }
        if (scopedZoneStats.fees[key]) {
          mergedZoneStats.fees[userId] = (mergedZoneStats.fees[userId] || 0) + scopedZoneStats.fees[key];
        }
      }

      contributions[key] = buildContribution(
        userId,
        counts,
        mergedSales,
        mergedZoneStats,
        settings.weights,
        settings.factorEnabled,
        partner.weightMultiplier || 1,
      );

      if (hasScopes) {
        contributions[key].scoped = scopedAttributionResult.attribution[key] || null;
      }
    } else if (hasScopes) {
      const scopedSales = scopedProductSales[key] || { revenue: 0 };
      const raw = {
        products: 0,
        productSales: scopedSales.revenue || 0,
        categories: 0,
        brands: 0,
        fulfillmentLocations: partner.scopes?.fulfillmentLocations?.length || 0,
        deliveryZones: partner.scopes?.deliveryZones?.length || 0,
        promotions: 0,
        zoneOrders: scopedZoneStats.orders[key] || 0,
        deliveryFees: scopedZoneStats.fees[key] || 0,
      };
      contributions[key] = {
        raw,
        weighted: Object.fromEntries(PARTNER_REVENUE_FACTOR_META.map((f) => [f.key, 0])),
        score: scopedAttributionResult.attribution[key]?.total || raw.productSales / 1000,
        productUnitsSold: 0,
        externalPartner: true,
        scoped: scopedAttributionResult.attribution[key] || null,
      };
    } else {
      contributions[key] = {
        raw: Object.fromEntries(PARTNER_REVENUE_FACTOR_META.map((f) => [f.key, 0])),
        weighted: Object.fromEntries(PARTNER_REVENUE_FACTOR_META.map((f) => [f.key, 0])),
        score: 0,
        productUnitsSold: 0,
        externalPartner: true,
      };
    }
  }

  const byPartnerBreakdown = scopedAttributionResult.byPartnerBreakdown || {};
  if (rulesMode) {
    for (const partner of activePartners) {
      const key = partnerKey(partner);
      if (contributions[key]) contributions[key].scoped = byPartnerBreakdown[key] || null;
    }
  }

  let rows;
  if (settings.mode === 'attribution') {
    if (!scopedAttributionResult.hasScopes) {
      rows = distributeAmounts({
        partners: activePartners,
        mode: 'equal',
        distributable,
        contributions,
      }).map((row) => ({ ...row, fallbackEqual: true, attributionModeFallback: true }));
    } else if (scopedAttributionResult.totalAttributed <= 0) {
      rows = distributeAmounts({
        partners: activePartners,
        mode: settings.unassignedPolicy === 'weighted' ? 'weighted' : 'equal',
        distributable,
        contributions,
      }).map((row) => ({ ...row, fallbackEqual: true }));
    } else {
      rows = distributeAttributionAmounts({
        partners: activePartners,
        distributable,
        attribution: scopedAttributionResult.attribution,
        totalAttributed: scopedAttributionResult.totalAttributed,
        unassignedPolicy: settings.unassignedPolicy,
        contributions,
        rulesMode,
      });
    }
  } else {
    rows = distributeAmounts({
      partners: activePartners,
      mode: settings.mode,
      distributable,
      contributions,
    });
  }

  const partners = rows.map((row) => {
    const key = partnerKey(row.partner);
    const user = row.partner.userId ? userMap[String(row.partner.userId)] : null;
    return {
      partnerId: row.partner._id || key,
      userId: row.partner.userId || null,
      nameAr: row.partner.nameAr || user?.name || '',
      nameEn: row.partner.nameEn || user?.name || '',
      email: row.partner.email || '',
      phone: row.partner.phone || '',
      username: user?.username || null,
      role: user?.role || null,
      isExternal: !row.partner.userId,
      fixedSharePercent: row.partner.fixedSharePercent,
      baseSharePercent: row.partner.baseSharePercent,
      assignmentSharePercent: row.partner.assignmentSharePercent,
      revenueRole: row.partner.revenueRole || row.revenueRole,
      weightMultiplier: row.partner.weightMultiplier,
      sharePercent: row.sharePercent,
      amount: row.amount,
      attributedAmount: row.attributedAmount,
      poolAmount: row.poolAmount,
      unassignedBonus: row.unassignedBonus,
      attributionDetail: rulesMode
        ? (byPartnerBreakdown[key] || null)
        : (row.attribution || row.contribution?.scoped || null),
      baseAmount: row.baseAmount,
      weightedAmount: row.weightedAmount,
      score: row.score,
      fallbackEqual: row.fallbackEqual === true,
      contribution: row.contribution,
    };
  });

  return {
    ...baseResponse,
    enabled: true,
    settings: {
      enabled: settings.enabled,
      mode: settings.mode,
      revenueBasis: settings.revenueBasis,
      reservePercent: settings.reservePercent,
      unassignedPolicy: settings.unassignedPolicy,
      attributionStreams: settings.attributionStreams,
      weights: settings.weights,
      factorEnabled: settings.factorEnabled,
      partnerCount: activePartners.length,
    },
    attributionSummary: settings.mode === 'attribution' ? {
      totalAttributed: scopedAttributionResult.totalAttributed || 0,
      hasScopes: scopedAttributionResult.hasScopes,
      unassignedPolicy: settings.unassignedPolicy,
      engine: rulesMode ? 'rules' : 'scopes',
      ruleCount: (settings.rules || []).length,
      ordersScanned: scopedAttributionResult.ordersScanned || 0,
    } : null,
    rulesApplied: rulesMode,
    ruleBreakdown: rulesMode ? (scopedAttributionResult.ruleBreakdown || []) : [],
    byPartnerBreakdown: rulesMode ? byPartnerBreakdown : {},
    rules: rulesMode ? settings.rules : [],
    partners,
  };
}

/** Run the full distribution against an unsaved settings payload (no DB write). */
export async function simulatePartnerRevenue(payload = {}) {
  const { settings: candidate, ...query } = payload;
  const normalized = normalizePartnerRevenueSettings(candidate || {});
  normalized.rules = reconcileRules(normalized);
  const report = await computePartnerRevenueDistribution(query, { overrideSettings: normalized });
  return {
    ...report,
    ruleWarnings: detectRuleWarnings(normalized.rules, normalized.partners),
  };
}

function findPartnerByKey(settings, partnerKeyStr) {
  const target = String(partnerKeyStr);
  return (settings.partners || []).find((p) => partnerKeyOf(p) === target) || null;
}

async function ledgerTotalsFor(partnerKeyStr) {
  const rows = await PartnerLedgerEntry.aggregate([
    { $match: { partnerKey: String(partnerKeyStr) } },
    { $group: { _id: '$type', amount: { $sum: '$amount' } } },
  ]);
  let net = 0;
  const byType = {};
  for (const row of rows) {
    const signed = (PARTNER_LEDGER_SIGN[row._id] || 1) * (row.amount || 0);
    byType[row._id] = signed;
    net += signed;
  }
  return { net: Math.round(net * 100) / 100, byType };
}

/** Per-partner statement: period earnings breakdown + lifetime payouts/ledger balance. */
export async function getPartnerStatement(partnerKeyStr, query = {}) {
  const settings = await loadPartnerRevenueSettings();
  const partner = findPartnerByKey(settings, partnerKeyStr);
  if (!partner) {
    const err = new Error('Partner not found');
    err.statusCode = 404;
    throw err;
  }
  const key = partnerKeyOf(partner);

  const report = await computePartnerRevenueDistribution(query);
  const row = (report.partners || []).find((p) => String(p.userId || p.partnerId) === key
    || String(p.partnerId) === key) || null;
  const breakdown = report.byPartnerBreakdown?.[key] || null;

  const [payouts, ledger, ledgerTotals, paidAgg] = await Promise.all([
    PartnerPayout.find({ partnerKey: key }).sort({ createdAt: -1 }).limit(50).lean(),
    PartnerLedgerEntry.find({ partnerKey: key }).sort({ dateKey: -1, createdAt: -1 }).limit(50).lean(),
    ledgerTotalsFor(key),
    PartnerPayout.aggregate([
      { $match: { partnerKey: key, status: 'paid' } },
      { $group: { _id: null, amount: { $sum: '$amount' } } },
    ]),
  ]);

  const pendingAmount = payouts
    .filter((p) => p.status === 'pending')
    .reduce((s, p) => s + (p.amount || 0), 0);
  const paidToDate = Math.round((paidAgg[0]?.amount || 0) * 100) / 100;
  const earnedThisPeriod = row?.amount || 0;

  return {
    partner: {
      partnerKey: key,
      nameAr: partner.nameAr,
      nameEn: partner.nameEn,
      email: partner.email,
      phone: partner.phone,
      status: partner.status,
      tags: partner.tags || [],
      bank: partner.bank || {},
      payoutMethod: partner.payoutMethod,
      payoutCurrency: partner.payoutCurrency,
      payoutScheduleDay: partner.payoutScheduleDay,
      minPayoutThreshold: partner.minPayoutThreshold,
      maxMonthlyPayout: partner.maxMonthlyPayout,
      contractStartKey: partner.contractStartKey,
      contractEndKey: partner.contractEndKey,
      revenueRole: partner.revenueRole,
    },
    period: report.period,
    earned: {
      total: earnedThisPeriod,
      attributedAmount: row?.attributedAmount ?? null,
      poolAmount: row?.poolAmount ?? row?.unassignedBonus ?? null,
      sharePercent: row?.sharePercent ?? 0,
      byRule: breakdown?.byRule || {},
      byZone: breakdown?.byZone || {},
      byProduct: breakdown?.byProduct || {},
      byCustomer: breakdown?.byCustomer || {},
      byBasis: breakdown?.byBasis || {},
    },
    ruleBreakdown: (report.ruleBreakdown || []).filter((r) => r.byPartner?.[key]),
    ledger,
    ledgerTotals,
    payouts,
    balance: {
      earnedThisPeriod,
      paidToDate,
      pendingAmount: Math.round(pendingAmount * 100) / 100,
      adjustmentsToDate: ledgerTotals.net,
      outstanding: Math.round((earnedThisPeriod + ledgerTotals.net - pendingAmount) * 100) / 100,
    },
  };
}

export async function listPartnerLedger(partnerKeyStr) {
  return PartnerLedgerEntry.find({ partnerKey: String(partnerKeyStr) })
    .sort({ dateKey: -1, createdAt: -1 })
    .limit(200)
    .populate('createdBy', 'name username')
    .lean();
}

export async function createPartnerLedgerEntry(partnerKeyStr, payload = {}, actorUser = null) {
  const settings = await loadPartnerRevenueSettings();
  const partner = findPartnerByKey(settings, partnerKeyStr);

  const type = PARTNER_LEDGER_TYPES.includes(payload.type) ? payload.type : null;
  if (!type) {
    const err = new Error('Invalid ledger entry type');
    err.statusCode = 400;
    throw err;
  }
  const amount = Math.abs(Number(payload.amount));
  if (!(amount > 0)) {
    const err = new Error('Amount must be greater than 0');
    err.statusCode = 400;
    throw err;
  }

  const doc = await PartnerLedgerEntry.create({
    partnerKey: String(partnerKeyStr),
    partnerUserId: partner?.userId || null,
    partnerNameAr: partner?.nameAr || '',
    partnerNameEn: partner?.nameEn || '',
    type,
    amount: Math.round(amount * 100) / 100,
    currency: String(payload.currency || partner?.payoutCurrency || 'EGP').toUpperCase(),
    dateKey: /^\d{4}-\d{2}-\d{2}$/.test(payload.dateKey) ? payload.dateKey : '',
    periodStartKey: String(payload.periodStartKey || ''),
    periodEndKey: String(payload.periodEndKey || ''),
    note: String(payload.note || '').trim(),
    createdBy: actorUser?._id || actorUser?.id || null,
    createdByName: actorUser?.name || '',
  });
  return doc.toObject();
}

export async function deletePartnerLedgerEntry(id) {
  const entry = await PartnerLedgerEntry.findById(id);
  if (!entry) {
    const err = new Error('Ledger entry not found');
    err.statusCode = 404;
    throw err;
  }
  await entry.deleteOne();
  return { deleted: true };
}
