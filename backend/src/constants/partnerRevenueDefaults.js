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

export function normalizePartnerRevenueSettings(raw = {}) {
  const mode = PARTNER_REVENUE_MODES.includes(raw.mode) ? raw.mode : 'weighted';
  const revenueBasis = PARTNER_REVENUE_BASES.includes(raw.revenueBasis) ? raw.revenueBasis : 'total';
  const reservePercent = Math.min(Math.max(Number(raw.reservePercent) || 0, 0), 100);
  const unassignedPolicy = PARTNER_UNASSIGNED_POLICIES.includes(raw.unassignedPolicy)
    ? raw.unassignedPolicy
    : 'percentage';

  const partners = Array.isArray(raw.partners)
    ? raw.partners.map((p, index) => ({
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
      isActive: p.isActive !== false,
      sortOrder: Number(p.sortOrder ?? index),
    }))
    : [];

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
  };
}
