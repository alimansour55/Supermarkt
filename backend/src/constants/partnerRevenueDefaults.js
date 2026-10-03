import { PAYMENT_METHOD_IDS } from './paymentMethods.js';
/** Default contribution weights for partner revenue distribution (weighted mode). */
export const DEFAULT_PARTNER_REVENUE_WEIGHTS = {
  products: 10,
  productSales: 25,
  categories: 5,
  brands: 5,
  fulfillmentLocations: 15,
  deliveryZones: 15,
  promotions: 10,
  zoneOrders: 12,
  deliveryFees: 8,
};

export const PARTNER_REVENUE_ROLES = ['combined', 'assigned_only', 'pool_only'];

export const PARTNER_REVENUE_ROLE_META = [
  {
    value: 'combined',
    labelAr: 'نسبة عامة + تخصيصات',
    labelEn: 'Pool % + assignments',
    descAr: 'يحصل على نسبته من الإيراد غير المُخصص + إيراد المنتجات/المناطق المُعيَّنة له مباشرة',
    descEn: 'Gets % of unassigned revenue + direct revenue from assigned products/places',
  },
  {
    value: 'assigned_only',
    labelAr: 'التخصيصات فقط',
    labelEn: 'Assignments only',
    descAr: 'يحصل فقط على إيراد المنتجات/المناطق/العملاء المُعيَّنين له — بدون نسبة من الإيراد العام',
    descEn: 'Only earns from assigned products/places/customers — no general pool share',
  },
  {
    value: 'pool_only',
    labelAr: 'النسبة العامة فقط',
    labelEn: 'Pool % only',
    descAr: 'يحصل على نسبته من إجمالي الإيراد فقط — التخصيصات للتوثيق ولا تؤثر على المبلغ',
    descEn: 'Only gets % of total revenue — assignments are informational only',
  },
];

export const PARTNER_REVENUE_MODES = ['attribution', 'fixed', 'equal', 'weighted', 'hybrid'];

export const PARTNER_REVENUE_BASES = ['total', 'productSales', 'grossProfit'];

export const PARTNER_UNASSIGNED_POLICIES = ['percentage', 'equal', 'weighted', 'platform'];

/** Revenue streams counted when mode is `attribution` (explicit product/place assignments). */
export const PARTNER_ATTRIBUTION_STREAMS = [
  { key: 'productSales', labelAr: 'مبيعات منتجات محددة', labelEn: 'Assigned product sales' },
  { key: 'zoneOrders', labelAr: 'طلبات مناطق محددة', labelEn: 'Assigned zone orders' },
  { key: 'zoneDeliveryFees', labelAr: 'رسوم توصيل مناطق محددة', labelEn: 'Assigned zone delivery fees' },
  { key: 'locationOrders', labelAr: 'طلبات من مواقع شحن محددة', labelEn: 'Assigned fulfillment location orders' },
  { key: 'customerOrders', labelAr: 'طلبات عملاء محددين', labelEn: 'Assigned customer orders' },
  { key: 'promotionSales', labelAr: 'مبيعات عروض محددة', labelEn: 'Assigned promotion sales' },
];

export const PARTNER_STATUSES = ['active', 'paused', 'archived'];

export const ORDER_PAYMENT_METHODS = PAYMENT_METHOD_IDS;
export const ORDER_DELIVERY_METHODS = ['scheduled', 'express', 'recurring'];

export const RULE_SCOPE_META = [
  { key: 'order', labelAr: 'الطلب كامل', labelEn: 'Whole order' },
  { key: 'line', labelAr: 'سطر المنتج', labelEn: 'Per product line' },
];

export const RULE_BASIS_META = [
  { key: 'orderTotal', labelAr: 'إجمالي الطلب', labelEn: 'Order total', scope: 'order' },
  { key: 'orderSubtotal', labelAr: 'مبيعات الطلب (بدون شحن)', labelEn: 'Order subtotal', scope: 'order' },
  { key: 'orderGrossProfit', labelAr: 'ربح الطلب', labelEn: 'Order gross profit', scope: 'order' },
  { key: 'lineRevenue', labelAr: 'إيراد الأسطر المطابقة', labelEn: 'Matching line revenue', scope: 'any' },
  { key: 'lineGrossProfit', labelAr: 'ربح الأسطر المطابقة', labelEn: 'Matching line gross profit', scope: 'any' },
  { key: 'deliveryFee', labelAr: 'رسوم التوصيل', labelEn: 'Delivery fee', scope: 'order' },
];

export const RULE_RATE_TYPES = [
  { key: 'percent', labelAr: 'نسبة %', labelEn: 'Percentage %' },
  { key: 'fixedPerOrder', labelAr: 'مبلغ ثابت لكل طلب', labelEn: 'Fixed amount per order' },
  { key: 'fixedPerUnit', labelAr: 'مبلغ ثابت لكل قطعة', labelEn: 'Fixed amount per unit' },
  { key: 'tiered', labelAr: 'شرائح حسب القيمة', labelEn: 'Tiered by value' },
];

export const CUSTOMER_TYPE_META = [
  { key: 'any', labelAr: 'أي عميل', labelEn: 'Any customer' },
  { key: 'new', labelAr: 'أول طلب فقط', labelEn: 'First order only' },
  { key: 'returning', labelAr: 'عملاء متكررون', labelEn: 'Returning customers' },
];

/** Every supported rule condition key, for UI iteration + warning checks. */
export const RULE_CONDITION_META = [
  { key: 'customers', labelAr: 'عملاء محددون', labelEn: 'Specific customers', kind: 'ids' },
  { key: 'customerType', labelAr: 'نوع العميل', labelEn: 'Customer type', kind: 'enum' },
  { key: 'minCustomerOrderCount', labelAr: 'أقل عدد طلبات للعميل', labelEn: 'Min customer orders', kind: 'number' },
  { key: 'maxCustomerOrderCount', labelAr: 'أقصى عدد طلبات للعميل', labelEn: 'Max customer orders', kind: 'number' },
  { key: 'deliveryZones', labelAr: 'مناطق التوصيل', labelEn: 'Delivery zones', kind: 'ids' },
  { key: 'cities', labelAr: 'مدن', labelEn: 'Cities', kind: 'strings' },
  { key: 'governorates', labelAr: 'محافظات', labelEn: 'Governorates', kind: 'strings' },
  { key: 'fulfillmentLocations', labelAr: 'مواقع الشحن', labelEn: 'Fulfillment locations', kind: 'ids' },
  { key: 'products', labelAr: 'منتجات', labelEn: 'Products', kind: 'ids' },
  { key: 'categories', labelAr: 'أقسام', labelEn: 'Categories', kind: 'ids' },
  { key: 'brands', labelAr: 'علامات تجارية', labelEn: 'Brands', kind: 'ids' },
  { key: 'promotions', labelAr: 'عروض', labelEn: 'Promotions', kind: 'ids' },
  { key: 'couponCodes', labelAr: 'أكواد خصم', labelEn: 'Coupon codes', kind: 'strings' },
  { key: 'paymentMethods', labelAr: 'طرق الدفع', labelEn: 'Payment methods', kind: 'strings' },
  { key: 'deliveryMethods', labelAr: 'طرق التوصيل', labelEn: 'Delivery methods', kind: 'strings' },
  { key: 'minOrderValue', labelAr: 'أقل قيمة طلب', labelEn: 'Min order value', kind: 'number' },
  { key: 'maxOrderValue', labelAr: 'أقصى قيمة طلب', labelEn: 'Max order value', kind: 'number' },
  { key: 'weekdays', labelAr: 'أيام الأسبوع', labelEn: 'Weekdays', kind: 'weekdays' },
  { key: 'dateFromKey', labelAr: 'ساري من', labelEn: 'Effective from', kind: 'date' },
  { key: 'dateToKey', labelAr: 'ساري حتى', labelEn: 'Effective to', kind: 'date' },
];

/** Condition keys that reference the product catalog (drive line matching). */
export const PRODUCT_CONDITION_KEYS = ['products', 'categories', 'brands', 'promotions'];

export const RULE_BASIS_KEYS = RULE_BASIS_META.map((b) => b.key);
export const RULE_RATE_TYPE_KEYS = RULE_RATE_TYPES.map((r) => r.key);
export const RULE_SCOPE_KEYS = RULE_SCOPE_META.map((s) => s.key);
export const CUSTOMER_TYPE_KEYS = CUSTOMER_TYPE_META.map((c) => c.key);

export const PARTNER_SCOPE_TYPES = [
  { key: 'products', labelAr: 'منتج', labelEn: 'Product' },
  { key: 'categories', labelAr: 'قسم', labelEn: 'Category' },
  { key: 'brands', labelAr: 'علامة تجارية', labelEn: 'Brand' },
  { key: 'deliveryZones', labelAr: 'منطقة توصيل', labelEn: 'Delivery zone' },
  { key: 'fulfillmentLocations', labelAr: 'موقع شحن', labelEn: 'Fulfillment location' },
  { key: 'users', labelAr: 'عميل', labelEn: 'Customer' },
  { key: 'promotions', labelAr: 'عرض', labelEn: 'Promotion' },
];

export const DEFAULT_ATTRIBUTION_STREAMS = Object.fromEntries(
  PARTNER_ATTRIBUTION_STREAMS.map((s) => [s.key, true]),
);

export const EMPTY_PARTNER_SCOPES = {
  products: [],
  categories: [],
  brands: [],
  fulfillmentLocations: [],
  deliveryZones: [],
  users: [],
  promotions: [],
};

export const PARTNER_REVENUE_FACTOR_META = [
  { key: 'products', labelAr: 'المنتجات المضافة', labelEn: 'Products added', descAr: 'عدد المنتجات التي أضافها الشريك', descEn: 'Products the partner added' },
  { key: 'productSales', labelAr: 'مبيعات المنتجات', labelEn: 'Product sales revenue', descAr: 'إيراد مبيعات منتجات الشريك', descEn: 'Revenue from partner products' },
  { key: 'categories', labelAr: 'الأقسام', labelEn: 'Categories', descAr: 'أقسام أضافها الشريك', descEn: 'Categories added' },
  { key: 'brands', labelAr: 'العلامات التجارية', labelEn: 'Brands', descAr: 'علامات تجارية أضافها', descEn: 'Brands added' },
  { key: 'fulfillmentLocations', labelAr: 'مواقع الشحن', labelEn: 'Fulfillment locations', descAr: 'مستودعات ومواقع شحن', descEn: 'Warehouses & ship-from locations' },
  { key: 'deliveryZones', labelAr: 'مناطق التوصيل', labelEn: 'Delivery zones', descAr: 'مناطق توصيل أضافها', descEn: 'Delivery zones added' },
  { key: 'promotions', labelAr: 'العروض والتخفيضات', labelEn: 'Promotions', descAr: 'عروض أنشأها الشريك', descEn: 'Promotions created' },
  { key: 'zoneOrders', labelAr: 'طلبات المناطق', labelEn: 'Zone orders', descAr: 'طلبات في مناطق الشريك', descEn: 'Orders in partner zones' },
  { key: 'deliveryFees', labelAr: 'رسوم التوصيل', labelEn: 'Delivery fees', descAr: 'رسوم توصيل مناطق الشريك', descEn: 'Delivery fees from partner zones' },
];

export const DEFAULT_FACTOR_ENABLED = Object.fromEntries(
  PARTNER_REVENUE_FACTOR_META.map((f) => [f.key, true]),
);

export const DEFAULT_PARTNER_REVENUE = {
  enabled: false,
  mode: 'attribution',
  revenueBasis: 'total',
  reservePercent: 0,
  unassignedPolicy: 'percentage',
  attributionStreams: { ...DEFAULT_ATTRIBUTION_STREAMS },
  weights: { ...DEFAULT_PARTNER_REVENUE_WEIGHTS },
  factorEnabled: { ...DEFAULT_FACTOR_ENABLED },
  partners: [],
  rules: [],
};

function normalizeIdList(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((id) => String(id || '').trim()).filter(Boolean))];
}

export function normalizePartnerScopes(scopes = {}) {
  return {
    products: normalizeIdList(scopes.products),
    categories: normalizeIdList(scopes.categories),
    brands: normalizeIdList(scopes.brands),
    fulfillmentLocations: normalizeIdList(scopes.fulfillmentLocations),
    deliveryZones: normalizeIdList(scopes.deliveryZones),
    users: normalizeIdList(scopes.users),
    promotions: normalizeIdList(scopes.promotions),
  };
}

/** Auto-split 100% equally among active partners. */
export function equalizePartnerPercentages(partners = []) {
  const active = partners.filter((p) => p.isActive !== false);
  if (!active.length) return partners;
  const share = Math.round((100 / active.length) * 100) / 100;
  let assigned = 0;
  return partners.map((p, index) => {
    if (p.isActive === false) return p;
    const isLast = index === partners.length - 1
      || partners.slice(index + 1).every((x) => x.isActive === false);
    const pct = isLast
      ? Math.round((100 - assigned) * 100) / 100
      : share;
    assigned += pct;
    return { ...p, fixedSharePercent: pct };
  });
}

export function detectScopeConflicts(partners = []) {
  const conflicts = [];
  const registry = {};

  for (const scopeType of PARTNER_SCOPE_TYPES) {
    registry[scopeType.key] = {};
  }

  for (const partner of partners) {
    if (partner.isActive === false) continue;
    const key = partner.userId ? String(partner.userId) : (partner._id ? String(partner._id) : null);
    const name = partner.nameAr || partner.nameEn || key;
    if (!key) continue;
    const scopes = normalizePartnerScopes(partner.scopes);
    for (const scopeType of PARTNER_SCOPE_TYPES) {
      for (const id of scopes[scopeType.key] || []) {
        if (!registry[scopeType.key][id]) registry[scopeType.key][id] = [];
        registry[scopeType.key][id].push({ partnerKey: key, name });
      }
    }
  }

  for (const scopeType of PARTNER_SCOPE_TYPES) {
    for (const [itemId, owners] of Object.entries(registry[scopeType.key])) {
      if (owners.length > 1) {
        conflicts.push({
          scopeType: scopeType.key,
          itemId,
          owners,
          labelAr: scopeType.labelAr,
          labelEn: scopeType.labelEn,
        });
      }
    }
  }

  return conflicts;
}

export function buildScopeOverview(partners = []) {
  const overview = [];
  for (const partner of partners) {
    if (partner.isActive === false) continue;
    const key = partner.userId ? String(partner.userId) : (partner._id ? String(partner._id) : null);
    if (!key) continue;
    const scopes = normalizePartnerScopes(partner.scopes);
    for (const scopeType of PARTNER_SCOPE_TYPES) {
      for (const id of scopes[scopeType.key] || []) {
        overview.push({
          scopeType: scopeType.key,
          itemId: id,
          partnerKey: key,
          partnerNameAr: partner.nameAr || '',
          partnerNameEn: partner.nameEn || '',
          fixedSharePercent: partner.fixedSharePercent,
        });
      }
    }
  }
  return overview;
}

export function partnerHasScopes(scopes = {}) {
  const normalized = normalizePartnerScopes(scopes);
  return Object.values(normalized).some((list) => list.length > 0);
}

export function normalizeAttributionStreams(streams = {}) {
  const result = { ...DEFAULT_ATTRIBUTION_STREAMS };
  for (const key of Object.keys(DEFAULT_ATTRIBUTION_STREAMS)) {
    if (typeof streams[key] === 'boolean') result[key] = streams[key];
  }
  return result;
}

export function normalizePartnerRevenueWeights(weights = {}) {
  const result = { ...DEFAULT_PARTNER_REVENUE_WEIGHTS };
  for (const key of Object.keys(DEFAULT_PARTNER_REVENUE_WEIGHTS)) {
    const value = Number(weights[key]);
    if (!Number.isNaN(value) && value >= 0) result[key] = value;
  }
  return result;
}

export function normalizeFactorEnabled(factorEnabled = {}) {
  const result = { ...DEFAULT_FACTOR_ENABLED };
  for (const key of Object.keys(DEFAULT_FACTOR_ENABLED)) {
    if (typeof factorEnabled[key] === 'boolean') result[key] = factorEnabled[key];
  }
  return result;
}

function normalizeStringList(value, { lowercase = false, max = 200 } = {}) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of value) {
    let s = String(raw ?? '').trim();
    if (!s) continue;
    if (lowercase) s = s.toLowerCase();
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
    if (out.length >= max) break;
  }
  return out;
}

function clampNumberOrNull(value, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (Number.isNaN(n)) return null;
  return Math.min(Math.max(n, min), max);
}

function isDateKey(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/** Stable identity used across rules, payouts and the ledger. */
export function partnerKeyOf(partner = {}) {
  if (partner.userId) return String(partner.userId);
  if (partner._id) return String(partner._id);
  if (partner.id) return String(partner.id);
  return null;
}

export function normalizePartnerCrm(p = {}) {
  const status = PARTNER_STATUSES.includes(p.status)
    ? p.status
    : (p.isActive === false ? 'paused' : 'active');
  return {
    status,
    displayColor: String(p.displayColor || '').trim().slice(0, 32),
    avatarUrl: String(p.avatarUrl || '').trim(),
    tags: normalizeStringList(p.tags, { max: 24 }),
    legalName: String(p.legalName || '').trim(),
    taxId: String(p.taxId || '').trim(),
    commercialRegNo: String(p.commercialRegNo || '').trim(),
    contactPerson: String(p.contactPerson || '').trim(),
    address: String(p.address || '').trim(),
    city: String(p.city || '').trim(),
    country: String(p.country || '').trim(),
    website: String(p.website || '').trim(),
    statementEmail: String(p.statementEmail || '').trim(),
    onboardingNotes: String(p.onboardingNotes || '').trim(),
    bank: {
      bankName: String(p.bank?.bankName || '').trim(),
      accountHolder: String(p.bank?.accountHolder || '').trim(),
      iban: String(p.bank?.iban || '').trim(),
      accountNumber: String(p.bank?.accountNumber || '').trim(),
      swift: String(p.bank?.swift || '').trim(),
      branch: String(p.bank?.branch || '').trim(),
    },
    payoutMethod: ['bank_transfer', 'cash', 'wallet', 'cheque', 'other'].includes(p.payoutMethod)
      ? p.payoutMethod : '',
    payoutCurrency: String(p.payoutCurrency || 'EGP').trim().toUpperCase().slice(0, 8) || 'EGP',
    payoutScheduleDay: clampNumberOrNull(p.payoutScheduleDay, { min: 1, max: 28 }),
    minPayoutThreshold: clampNumberOrNull(p.minPayoutThreshold, { min: 0 }) || 0,
    maxMonthlyPayout: clampNumberOrNull(p.maxMonthlyPayout, { min: 0 }),
    contractStartKey: isDateKey(p.contractStartKey) ? p.contractStartKey : '',
    contractEndKey: isDateKey(p.contractEndKey) ? p.contractEndKey : '',
    defaultCommissionPercent: clampNumberOrNull(p.defaultCommissionPercent, { min: 0, max: 100 }),
  };
}

function normalizeRuleRate(rate = {}) {
  const type = RULE_RATE_TYPE_KEYS.includes(rate.type) ? rate.type : 'percent';
  const value = Number(rate.value);
  const tiers = Array.isArray(rate.tiers)
    ? rate.tiers
      .map((t) => ({
        upToValue: clampNumberOrNull(t.upToValue, { min: 0 }),
        value: Number(t.value) || 0,
      }))
      .filter((t) => t.value !== 0 || t.upToValue != null)
      .slice(0, 12)
    : [];
  return {
    type,
    value: Number.isNaN(value) ? (type === 'percent' ? 100 : 0) : Math.max(value, 0),
    tiers,
  };
}

function normalizeRuleConditions(c = {}) {
  return {
    customers: normalizeIdList(c.customers),
    customerType: CUSTOMER_TYPE_KEYS.includes(c.customerType) ? c.customerType : 'any',
    minCustomerOrderCount: clampNumberOrNull(c.minCustomerOrderCount, { min: 0 }),
    maxCustomerOrderCount: clampNumberOrNull(c.maxCustomerOrderCount, { min: 0 }),
    deliveryZones: normalizeIdList(c.deliveryZones),
    cities: normalizeStringList(c.cities),
    governorates: normalizeStringList(c.governorates),
    fulfillmentLocations: normalizeIdList(c.fulfillmentLocations),
    products: normalizeIdList(c.products),
    categories: normalizeIdList(c.categories),
    brands: normalizeIdList(c.brands),
    promotions: normalizeIdList(c.promotions),
    couponCodes: normalizeStringList(c.couponCodes, { lowercase: true }),
    paymentMethods: normalizeStringList(c.paymentMethods).filter((m) => ORDER_PAYMENT_METHODS.includes(m)),
    deliveryMethods: normalizeStringList(c.deliveryMethods).filter((m) => ORDER_DELIVERY_METHODS.includes(m)),
    minOrderValue: clampNumberOrNull(c.minOrderValue, { min: 0 }),
    maxOrderValue: clampNumberOrNull(c.maxOrderValue, { min: 0 }),
    weekdays: [...new Set((Array.isArray(c.weekdays) ? c.weekdays : [])
      .map((n) => Number(n)).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6))],
    dateFromKey: isDateKey(c.dateFromKey) ? c.dateFromKey : '',
    dateToKey: isDateKey(c.dateToKey) ? c.dateToKey : '',
  };
}

export function ruleHasConditions(conditions = {}) {
  const c = normalizeRuleConditions(conditions);
  if (c.customerType !== 'any') return true;
  for (const [key, value] of Object.entries(c)) {
    if (key === 'customerType') continue;
    if (Array.isArray(value) && value.length) return true;
    if (!Array.isArray(value) && value !== '' && value != null) return true;
  }
  return false;
}

/**
 * Clamp + whitelist every rule field. Beneficiaries pointing at unknown partner
 * keys are dropped; rules with no beneficiary or no condition are removed.
 */
export function normalizeAttributionRules(rawRules, validPartnerKeys = null) {
  if (!Array.isArray(rawRules)) return [];
  const validSet = validPartnerKeys ? new Set(validPartnerKeys.map(String)) : null;

  const normalized = rawRules.map((r, index) => {
    const scope = RULE_SCOPE_KEYS.includes(r.scope) ? r.scope : 'order';
    let basis = RULE_BASIS_KEYS.includes(r.basis) ? r.basis : 'lineRevenue';
    const basisMeta = RULE_BASIS_META.find((b) => b.key === basis);
    // An order-only basis on a line rule falls back to a line basis.
    if (scope === 'line' && basisMeta && basisMeta.scope === 'order') basis = 'lineRevenue';

    const beneficiaries = (Array.isArray(r.beneficiaries) ? r.beneficiaries : [])
      .map((b) => ({
        partnerKey: String(b.partnerKey || '').trim(),
        sharePercent: Math.min(Math.max(Number(b.sharePercent) || 0, 0), 100),
      }))
      .filter((b) => b.partnerKey && (!validSet || validSet.has(b.partnerKey)) && b.sharePercent > 0);

    const ruleId = r._id || r.id || null;
    return {
      ...(ruleId ? { _id: ruleId } : {}),
      name: String(r.name || '').trim().slice(0, 120),
      description: String(r.description || '').trim().slice(0, 500),
      enabled: r.enabled !== false,
      priority: Number.isFinite(Number(r.priority)) ? Number(r.priority) : 100,
      source: r.source === 'auto' ? 'auto' : 'manual',
      sourcePartnerKey: String(r.sourcePartnerKey || '').trim(),
      scope,
      basis,
      rate: normalizeRuleRate(r.rate),
      stackable: r.stackable === true,
      beneficiaries,
      conditions: normalizeRuleConditions(r.conditions),
      _index: index,
    };
  }).filter((r) => r.beneficiaries.length > 0);

  normalized.sort((a, b) => (a.priority - b.priority) || (a._index - b._index));
  return normalized.map(({ _index, ...rule }) => rule);
}

/** Basis to use for an auto rule, derived from the store's attribution streams. */
function autoRuleBasis(attributionStreams = {}) {
  if (attributionStreams.zoneDeliveryFees && !attributionStreams.productSales) return 'deliveryFee';
  return 'lineRevenue';
}

/**
 * Turn each active partner's flat `scopes` into ONE equivalent rule so the engine
 * has a single evaluation path. Auto rules are regenerated on every save.
 */
export function convertScopesToRules(partners = [], attributionStreams = {}) {
  const rules = [];
  for (const partner of partners) {
    if (partner.status === 'archived' || partner.isActive === false) continue;
    const key = partnerKeyOf(partner);
    if (!key) continue;
    const role = partner.revenueRole || 'combined';
    if (role === 'pool_only') continue;
    const scopes = normalizePartnerScopes(partner.scopes);
    if (!Object.values(scopes).some((l) => l.length)) continue;

    const conditions = normalizeRuleConditions({
      customers: scopes.users,
      deliveryZones: scopes.deliveryZones,
      fulfillmentLocations: scopes.fulfillmentLocations,
      products: scopes.products,
      categories: scopes.categories,
      brands: scopes.brands,
      promotions: scopes.promotions,
    });

    const name = (partner.nameEn || partner.nameAr || 'Partner').trim();
    rules.push({
      _id: null,
      name: `${name} — quick assignments`,
      description: 'Auto-generated from this partner\'s assigned items. Edit the assignments on the partner card.',
      enabled: true,
      priority: 50,
      source: 'auto',
      sourcePartnerKey: key,
      scope: 'order',
      basis: autoRuleBasis(attributionStreams),
      rate: normalizeRuleRate({
        type: 'percent',
        value: partner.assignmentSharePercent != null ? partner.assignmentSharePercent : 100,
      }),
      stackable: false,
      beneficiaries: [{ partnerKey: key, sharePercent: 100 }],
      conditions,
    });
  }
  return rules;
}

/** Keep manual rules, replace every auto rule with the freshly converted set. */
export function mergeAutoRules(existingRules = [], autoRules = []) {
  const manual = (existingRules || []).filter((r) => r.source !== 'auto');
  return [...manual, ...autoRules];
}

export function detectRuleWarnings(rules = [], partners = []) {
  const warnings = [];
  const partnerNames = {};
  for (const p of partners) {
    const key = partnerKeyOf(p);
    if (key) partnerNames[key] = p.nameEn || p.nameAr || key;
  }

  for (const rule of rules) {
    const label = rule.name || (rule._id ? `Rule ${String(rule._id).slice(-6)}` : 'Untitled rule');
    const beneTotal = rule.beneficiaries.reduce((s, b) => s + (b.sharePercent || 0), 0);
    if (beneTotal > 100.01) {
      warnings.push({
        ruleId: rule._id ? String(rule._id) : null,
        level: 'error',
        code: 'beneficiary_over_100',
        messageEn: `${label}: beneficiary shares total ${beneTotal.toFixed(1)}% (max 100%).`,
        messageAr: `${label}: مجموع حصص المستفيدين ${beneTotal.toFixed(1)}% (الحد 100%).`,
      });
    }
    if (rule.enabled && !ruleHasConditions(rule.conditions) && rule.source !== 'auto') {
      warnings.push({
        ruleId: rule._id ? String(rule._id) : null,
        level: 'warn',
        code: 'no_conditions',
        messageEn: `${label}: no conditions set — it will match every order.`,
        messageAr: `${label}: بدون شروط — سيُطابق كل الطلبات.`,
      });
    }
    for (const b of rule.beneficiaries) {
      if (!partnerNames[b.partnerKey]) {
        warnings.push({
          ruleId: rule._id ? String(rule._id) : null,
          level: 'error',
          code: 'unknown_partner',
          messageEn: `${label}: beneficiary points at a partner that no longer exists.`,
          messageAr: `${label}: أحد المستفيدين يشير إلى شريك غير موجود.`,
        });
      }
    }
    if (rule.rate.type === 'tiered' && !rule.rate.tiers.length) {
      warnings.push({
        ruleId: rule._id ? String(rule._id) : null,
        level: 'warn',
        code: 'tiered_no_tiers',
        messageEn: `${label}: tiered rate has no tiers configured.`,
        messageAr: `${label}: معدل الشرائح بدون شرائح.`,
      });
    }
  }
  return warnings;
}

export function normalizePartnerRevenueSettings(raw = {}) {
  const mode = PARTNER_REVENUE_MODES.includes(raw.mode) ? raw.mode : 'weighted';
  const revenueBasis = PARTNER_REVENUE_BASES.includes(raw.revenueBasis) ? raw.revenueBasis : 'total';
  const reservePercent = Math.min(Math.max(Number(raw.reservePercent) || 0, 0), 100);
  const unassignedPolicy = PARTNER_UNASSIGNED_POLICIES.includes(raw.unassignedPolicy)
    ? raw.unassignedPolicy
    : 'percentage';

  const partners = Array.isArray(raw.partners)
    ? raw.partners.map((p, index) => {
      const crm = normalizePartnerCrm(p);
      return {
        _id: p._id || p.id || null,
        userId: p.userId || null,
        nameAr: String(p.nameAr || '').trim(),
        nameEn: String(p.nameEn || '').trim(),
        email: String(p.email || '').trim(),
        phone: String(p.phone || '').trim(),
        notes: String(p.notes || '').trim(),
        fixedSharePercent: p.fixedSharePercent != null ? Math.min(Math.max(Number(p.fixedSharePercent) || 0, 0), 100) : null,
        baseSharePercent: p.baseSharePercent != null ? Math.min(Math.max(Number(p.baseSharePercent) || 0, 0), 100) : null,
        assignmentSharePercent: p.assignmentSharePercent != null
          ? Math.min(Math.max(Number(p.assignmentSharePercent) || 0, 0), 100)
          : 100,
        revenueRole: PARTNER_REVENUE_ROLES.includes(p.revenueRole) ? p.revenueRole : 'combined',
        weightMultiplier: Math.min(Math.max(Number(p.weightMultiplier) || 1, 0.1), 10),
        scopes: normalizePartnerScopes(p.scopes),
        isActive: crm.status === 'active',
        sortOrder: Number(p.sortOrder ?? index),
        ...crm,
      };
    })
    : [];

  const validKeys = partners.map(partnerKeyOf).filter(Boolean);
  const rules = normalizeAttributionRules(raw.rules, validKeys.length ? validKeys : null);

  return {
    enabled: raw.enabled === true,
    mode,
    revenueBasis,
    reservePercent,
    unassignedPolicy,
    attributionStreams: normalizeAttributionStreams(raw.attributionStreams),
    weights: normalizePartnerRevenueWeights(raw.weights),
    factorEnabled: normalizeFactorEnabled(raw.factorEnabled),
    partners,
    rules,
  };
}
