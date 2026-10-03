import mongoose from 'mongoose';
import Order from '../models/Order.js';
import Promotion from '../models/Promotion.js';
import { getAllDescendantIds } from '../utils/categoryTree.js';
import { STORE_TIMEZONE, getStoreDateKey } from '../utils/revenueReport.js';
import { partnerKeyOf } from '../constants/partnerRevenueDefaults.js';

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

function toObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(String(id)) : null;
}

function storeWeekday(date) {
  // 0 = Sunday … 6 = Saturday, in the store timezone.
  const wd = new Intl.DateTimeFormat('en-US', { timeZone: STORE_TIMEZONE, weekday: 'short' }).format(new Date(date));
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(wd);
}

/** One aggregate: orders in range, each with a flattened line array carrying catalog ids. */
async function loadOrdersWithLines(revenueMatch) {
  return Order.aggregate([
    { $match: revenueMatch },
    { $unwind: { path: '$items', preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: 'products',
        localField: 'items.product',
        foreignField: '_id',
        as: 'prod',
      },
    },
    { $unwind: { path: '$prod', preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: '$_id',
        user: { $first: '$user' },
        total: { $first: { $ifNull: ['$total', 0] } },
        subtotal: { $first: { $ifNull: ['$subtotal', 0] } },
        deliveryFee: { $first: { $ifNull: ['$deliveryFee', 0] } },
        deliveryZone: { $first: '$deliveryZone' },
        fulfillmentLocationId: { $first: '$fulfillmentLocationId' },
        paymentMethod: { $first: '$paymentMethod' },
        deliveryMethod: { $first: '$deliveryMethod' },
        couponCode: { $first: '$couponCode' },
        city: { $first: '$shippingAddress.city' },
        governorate: { $first: '$shippingAddress.governorate' },
        createdAt: { $first: '$createdAt' },
        lines: {
          $push: {
            productId: { $toString: '$prod._id' },
            categoryId: { $toString: '$prod.category' },
            mainCategoryId: { $toString: '$prod.mainCategory' },
            ancestors: '$prod.categoryAncestors',
            brandId: { $toString: '$prod.brand' },
            price: { $ifNull: ['$items.price', 0] },
            qty: { $ifNull: ['$items.quantity', 0] },
            wholesale: { $ifNull: ['$items.wholesalePrice', '$prod.wholesalePrice', 0] },
          },
        },
      },
    },
  ]);
}

/** Lifetime order count + first-order timestamp per customer (used by customer conditions). */
async function loadCustomerStats(revenueMatch) {
  const baseMatch = { ...revenueMatch };
  delete baseMatch.createdAt;
  const rows = await Order.aggregate([
    { $match: baseMatch },
    { $group: { _id: '$user', count: { $sum: 1 }, firstAt: { $min: '$createdAt' } } },
  ]);
  const map = {};
  for (const row of rows) {
    if (!row._id) continue;
    map[String(row._id)] = { count: row.count, firstAt: row.firstAt };
  }
  return map;
}

/** Expand every category condition to {selected + all descendants}. */
async function buildCategoryExpansion(rules) {
  const expansion = {};
  const seed = new Set();
  for (const rule of rules) {
    for (const id of rule.conditions.categories || []) seed.add(String(id));
  }
  for (const id of seed) {
    const descendants = await getAllDescendantIds(id);
    expansion[id] = new Set([id, ...descendants.map(String)]);
  }
  return expansion;
}

/** Promotion → { productIds:Set, categoryIds:Set (expanded) }. */
async function buildPromotionMembership(rules) {
  const promoIds = new Set();
  for (const rule of rules) {
    for (const id of rule.conditions.promotions || []) promoIds.add(String(id));
  }
  if (!promoIds.size) return {};
  const promotions = await Promotion.find({ _id: { $in: [...promoIds].map(toObjectId).filter(Boolean) } })
    .select('productIds categoryIds')
    .lean();
  const membership = {};
  for (const promo of promotions) {
    const catSet = new Set();
    for (const catId of promo.categoryIds || []) {
      catSet.add(String(catId));
      const descendants = await getAllDescendantIds(catId);
      descendants.forEach((d) => catSet.add(String(d)));
    }
    membership[String(promo._id)] = {
      productIds: new Set((promo.productIds || []).map(String)),
      categoryIds: catSet,
    };
  }
  return membership;
}

function lineMatchesProductConditions(line, rule, ctx) {
  const c = rule.conditions;
  const hasProductFilter = (c.products?.length || c.categories?.length || c.brands?.length || c.promotions?.length);
  if (!hasProductFilter) return true;

  if (c.products?.length && line.productId && c.products.map(String).includes(line.productId)) return true;
  if (c.brands?.length && line.brandId && c.brands.map(String).includes(line.brandId)) return true;

  if (c.categories?.length) {
    const lineCats = new Set([line.categoryId, line.mainCategoryId, ...(line.ancestors || []).map(String)].filter(Boolean));
    for (const catId of c.categories) {
      const expanded = ctx.categoryExpansion[String(catId)] || new Set([String(catId)]);
      for (const lc of lineCats) if (expanded.has(lc)) return true;
    }
  }

  if (c.promotions?.length) {
    for (const promoId of c.promotions) {
      const member = ctx.promotionMembership[String(promoId)];
      if (!member) continue;
      if (line.productId && member.productIds.has(line.productId)) return true;
      const lineCats = new Set([line.categoryId, line.mainCategoryId, ...(line.ancestors || []).map(String)].filter(Boolean));
      for (const lc of lineCats) if (member.categoryIds.has(lc)) return true;
    }
  }
  return false;
}

function orderMatchesOrderConditions(order, rule, ctx) {
  const c = rule.conditions;
  const orderKey = ctx.orderDateKey(order);

  if (c.dateFromKey && orderKey < c.dateFromKey) return false;
  if (c.dateToKey && orderKey > c.dateToKey) return false;

  if (c.customers?.length) {
    if (!order.user || !c.customers.map(String).includes(String(order.user))) return false;
  }
  if (c.customerType !== 'any' || c.minCustomerOrderCount != null || c.maxCustomerOrderCount != null) {
    const stat = ctx.customerStats[String(order.user)] || { count: 0, firstAt: null };
    if (c.customerType === 'new') {
      if (!stat.firstAt || +new Date(stat.firstAt) !== +new Date(order.createdAt)) return false;
    }
    if (c.customerType === 'returning' && stat.count <= 1) return false;
    if (c.minCustomerOrderCount != null && stat.count < c.minCustomerOrderCount) return false;
    if (c.maxCustomerOrderCount != null && stat.count > c.maxCustomerOrderCount) return false;
  }
  if (c.deliveryZones?.length) {
    if (!order.deliveryZone || !c.deliveryZones.map(String).includes(String(order.deliveryZone))) return false;
  }
  if (c.fulfillmentLocations?.length) {
    if (!order.fulfillmentLocationId
      || !c.fulfillmentLocations.map(String).includes(String(order.fulfillmentLocationId))) return false;
  }
  if (c.cities?.length) {
    const city = String(order.city || '').trim().toLowerCase();
    if (!c.cities.map((x) => x.toLowerCase()).includes(city)) return false;
  }
  if (c.governorates?.length) {
    const gov = String(order.governorate || '').trim().toLowerCase();
    if (!c.governorates.map((x) => x.toLowerCase()).includes(gov)) return false;
  }
  if (c.couponCodes?.length) {
    const code = String(order.couponCode || '').trim().toLowerCase();
    if (!code || !c.couponCodes.includes(code)) return false;
  }
  if (c.paymentMethods?.length && !c.paymentMethods.includes(String(order.paymentMethod || ''))) return false;
  if (c.deliveryMethods?.length && !c.deliveryMethods.includes(String(order.deliveryMethod || ''))) return false;
  if (c.minOrderValue != null && (order.total || 0) < c.minOrderValue) return false;
  if (c.maxOrderValue != null && (order.total || 0) > c.maxOrderValue) return false;
  if (c.weekdays?.length && !c.weekdays.includes(storeWeekday(order.createdAt))) return false;

  return true;
}

function lineRevenue(line) { return (line.price || 0) * (line.qty || 0); }
function lineProfit(line) { return Math.max(((line.price || 0) - (line.wholesale || 0)) * (line.qty || 0), 0); }

function applyRate(rule, basisAmount, matchedQty) {
  const { type, value, tiers } = rule.rate;
  if (type === 'fixedPerOrder') return value;
  if (type === 'fixedPerUnit') return value * (matchedQty || 0);
  if (type === 'tiered') {
    const sorted = [...tiers].sort((a, b) => {
      const av = a.upToValue == null ? Infinity : a.upToValue;
      const bv = b.upToValue == null ? Infinity : b.upToValue;
      return av - bv;
    });
    const tier = sorted.find((t) => basisAmount <= (t.upToValue == null ? Infinity : t.upToValue));
    const pct = tier ? tier.value : (sorted[sorted.length - 1]?.value || 0);
    return basisAmount * (pct / 100);
  }
  return basisAmount * (value / 100); // percent
}

/**
 * Evaluate ordered attribution rules against orders in `revenueMatch`.
 * Returns per-partner attributed totals plus rich breakdowns for reports/statements.
 */
export async function computeRuleAttribution(revenueMatch, rules, partners, { revenueBasis } = {}) {
  const activeRules = (rules || []).filter((r) => r.enabled && r.beneficiaries?.length);
  if (!activeRules.length) {
    return {
      attribution: {}, totalAttributed: 0, ruleBreakdown: [], byPartnerBreakdown: {}, hasRules: false,
    };
  }

  const anyCustomerCond = activeRules.some((r) => r.conditions.customers?.length
    || r.conditions.customerType !== 'any'
    || r.conditions.minCustomerOrderCount != null
    || r.conditions.maxCustomerOrderCount != null);

  const [orders, customerStats, categoryExpansion, promotionMembership] = await Promise.all([
    loadOrdersWithLines(revenueMatch),
    anyCustomerCond ? loadCustomerStats(revenueMatch) : Promise.resolve({}),
    buildCategoryExpansion(activeRules),
    buildPromotionMembership(activeRules),
  ]);

  const dateKeyCache = new Map();
  const ctx = {
    customerStats,
    categoryExpansion,
    promotionMembership,
    orderDateKey: (order) => {
      const id = String(order._id);
      if (!dateKeyCache.has(id)) dateKeyCache.set(id, getStoreDateKey(order.createdAt));
      return dateKeyCache.get(id);
    },
  };

  const sortedRules = [...activeRules]
    .map((rule, i) => ({ ...rule, _rid: rule._id ? String(rule._id) : `rule-${i}` }))
    .sort((a, b) => (a.priority - b.priority));

  const attribution = {};        // partnerKey -> { total, byRule }
  const ruleBreakdown = {};       // ruleId -> aggregate
  const byPartnerBreakdown = {};  // partnerKey -> dimensional breakdown
  const consumedOrders = new Set();
  const consumedLines = new Set();

  const partnerName = {};
  for (const p of partners || []) {
    const key = partnerKeyOf(p);
    if (key) partnerName[key] = p.nameEn || p.nameAr || key;
  }

  const ensurePartner = (key) => {
    if (!attribution[key]) attribution[key] = { total: 0, byRule: {} };
    if (!byPartnerBreakdown[key]) {
      byPartnerBreakdown[key] = {
        total: 0, byRule: {}, byZone: {}, byProduct: {}, byCustomer: {}, byBasis: {},
      };
    }
  };

  const credit = (rule, key, amount, { order, productId }) => {
    if (amount <= 0) return;
    ensurePartner(key);
    const a = round2(amount);
    attribution[key].total = round2(attribution[key].total + a);
    attribution[key].byRule[rule._rid] = round2((attribution[key].byRule[rule._rid] || 0) + a);

    const bp = byPartnerBreakdown[key];
    bp.total = round2(bp.total + a);
    bp.byRule[rule._rid] = round2((bp.byRule[rule._rid] || 0) + a);
    bp.byBasis[rule.basis] = round2((bp.byBasis[rule.basis] || 0) + a);
    if (order?.deliveryZone) bp.byZone[String(order.deliveryZone)] = round2((bp.byZone[String(order.deliveryZone)] || 0) + a);
    if (order?.user) bp.byCustomer[String(order.user)] = round2((bp.byCustomer[String(order.user)] || 0) + a);
    if (productId) bp.byProduct[productId] = round2((bp.byProduct[productId] || 0) + a);

    const rb = ruleBreakdown[rule._rid];
    rb.amount = round2(rb.amount + a);
    rb.byPartner[key] = round2((rb.byPartner[key] || 0) + a);
  };

  const splitToBeneficiaries = (rule, grossAmount, meta) => {
    for (const b of rule.beneficiaries) {
      credit(rule, b.partnerKey, grossAmount * (b.sharePercent / 100), meta);
    }
  };

  for (const rule of sortedRules) {
    ruleBreakdown[rule._rid] = {
      ruleId: rule._rid,
      name: rule.name || partnerName[rule.sourcePartnerKey] || 'Rule',
      source: rule.source,
      sourcePartnerKey: rule.sourcePartnerKey || null,
      scope: rule.scope,
      basis: rule.basis,
      priority: rule.priority,
      stackable: rule.stackable,
      matchedOrders: 0,
      amount: 0,
      byPartner: {},
    };
    const rb = ruleBreakdown[rule._rid];
    const nonStackable = !rule.stackable;

    for (const order of orders) {
      const oid = String(order._id);
      if (nonStackable && consumedOrders.has(oid)) continue;
      if (!orderMatchesOrderConditions(order, rule, ctx)) continue;

      const lines = order.lines || [];
      const matchingLines = lines
        .map((line, idx) => ({ line, idx }))
        .filter(({ line }) => lineMatchesProductConditions(line, rule, ctx));

      const hasProductFilter = Boolean(rule.conditions.products?.length || rule.conditions.categories?.length
        || rule.conditions.brands?.length || rule.conditions.promotions?.length);
      if (hasProductFilter && !matchingLines.length) continue;

      if (rule.scope === 'line') {
        let matchedThisOrder = false;
        for (const { line, idx } of matchingLines) {
          const lineKey = `${oid}:${idx}`;
          if (nonStackable && (consumedOrders.has(oid) || consumedLines.has(lineKey))) continue;
          const basisAmount = rule.basis === 'lineGrossProfit' ? lineProfit(line) : lineRevenue(line);
          if (basisAmount <= 0 && rule.rate.type !== 'fixedPerUnit' && rule.rate.type !== 'fixedPerOrder') continue;
          const gross = applyRate(rule, basisAmount, line.qty);
          splitToBeneficiaries(rule, gross, { order, productId: line.productId });
          if (nonStackable) consumedLines.add(lineKey);
          matchedThisOrder = true;
        }
        if (matchedThisOrder) rb.matchedOrders += 1;
        continue;
      }

      // scope === 'order'
      const effectiveLines = hasProductFilter ? matchingLines.map((m) => m.line) : lines;
      let basisAmount;
      let matchedQty = effectiveLines.reduce((s, l) => s + (l.qty || 0), 0);
      switch (rule.basis) {
        case 'orderTotal': basisAmount = order.total || 0; break;
        case 'orderSubtotal': basisAmount = order.subtotal || 0; break;
        case 'deliveryFee': basisAmount = order.deliveryFee || 0; break;
        case 'orderGrossProfit':
          basisAmount = Math.max(lines.reduce((s, l) => s + lineProfit(l), 0), 0); break;
        case 'lineGrossProfit':
          basisAmount = effectiveLines.reduce((s, l) => s + lineProfit(l), 0); break;
        case 'lineRevenue':
        default:
          basisAmount = effectiveLines.reduce((s, l) => s + lineRevenue(l), 0); break;
      }
      if (basisAmount <= 0 && rule.rate.type === 'percent') continue;

      const gross = applyRate(rule, basisAmount, matchedQty);
      if (gross <= 0) continue;

      // Attribute byProduct proportionally across the effective lines.
      const revTotal = effectiveLines.reduce((s, l) => s + lineRevenue(l), 0) || 1;
      for (const b of rule.beneficiaries) {
        const beneGross = gross * (b.sharePercent / 100);
        if (effectiveLines.length && rule.basis !== 'deliveryFee') {
          for (const l of effectiveLines) {
            credit(rule, b.partnerKey, beneGross * (lineRevenue(l) / revTotal), { order, productId: l.productId });
          }
        } else {
          credit(rule, b.partnerKey, beneGross, { order });
        }
      }
      rb.matchedOrders += 1;
      if (nonStackable) consumedOrders.add(oid);
    }
  }

  const totalAttributed = round2(
    Object.values(attribution).reduce((s, row) => s + (row.total || 0), 0),
  );

  return {
    attribution,
    totalAttributed,
    ruleBreakdown: Object.values(ruleBreakdown),
    byPartnerBreakdown,
    hasRules: true,
    ordersScanned: orders.length,
  };
}
