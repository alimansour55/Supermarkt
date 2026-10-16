/**
 * Seller fee engine — pure functions, no database. Decides what the marketplace earns on every
 * seller sale, Amazon/Jumia style:
 *
 *   commission %  (most specific rule wins — see resolveCommission)
 *     clamped per unit to [minCommissionPerItem, maxCommissionPerItem]
 * + fixed fee per item sold   ("closing fee")
 * + fixed fee per shipment
 * + store fulfillment fee per item (store-shipped only)
 * + payment fee (% + fixed, per payment method) on the seller's share
 * + VAT on all of the above (fee VAT is tax collected, not profit)
 *
 * Every number is snapshotted onto the shipment at order time, so changing the fee setup never
 * rewrites past sales.
 */

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const idOf = (v) => String(v?._id || v || '');
const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v));
const DAY = 86400000;

/** The fee plan a seller is on (its key, else the default plan, else none). */
export function findSellerPlan(settings, seller) {
  const plans = settings?.plans || [];
  if (!plans.length) return null;
  const key = seller?.feePlan || '';
  return plans.find((p) => p.key === key) || plans.find((p) => p.isDefault) || null;
}

/**
 * Effective fee setup for one seller: seller overrides → its plan → marketplace defaults.
 * `null` on a seller or plan field means "inherit".
 */
export function effectiveFeeConfig(settings = {}, seller = null) {
  const fees = settings.fees || {};
  const plan = findSellerPlan(settings, seller);
  const o = seller?.feeOverrides || {};
  const pick = (...vals) => {
    for (const v of vals) {
      const n = num(v);
      if (n !== null && Number.isFinite(n)) return n;
    }
    return 0;
  };
  return {
    plan: plan ? { key: plan.key, nameAr: plan.nameAr, nameEn: plan.nameEn } : null,
    defaultCommissionRate: pick(plan?.commissionRate, settings.defaultCommissionRate),
    minCommissionPerItem: pick(o.minCommissionPerItem, plan?.minCommissionPerItem, fees.minCommissionPerItem),
    maxCommissionPerItem: pick(o.maxCommissionPerItem, plan?.maxCommissionPerItem, fees.maxCommissionPerItem),
    fixedFeePerItem: pick(o.fixedFeePerItem, plan?.fixedFeePerItem, fees.fixedFeePerItem),
    fixedFeePerShipment: pick(o.fixedFeePerShipment, plan?.fixedFeePerShipment, fees.fixedFeePerShipment),
    storeFulfillmentFeePerItem: pick(o.storeFulfillmentFeePerItem, plan?.storeFulfillmentFeePerItem, settings.storeFulfillmentFeePerItem),
    monthlyFee: pick(o.monthlyFee, plan?.monthlyFee, fees.monthlyFee),
    payoutHoldDays: pick(o.payoutHoldDays, plan?.payoutHoldDays, settings.payoutHoldDays),
    commissionOnDeliveryFee: fees.commissionOnDeliveryFee === true,
    vatPercent: o.vatExempt === true ? 0 : pick(fees.vatPercent),
    returnAdminFeePercent: pick(fees.returnAdminFeePercent),
    paymentFees: Array.isArray(fees.paymentFees) ? fees.paymentFees : [],
    commissionFreeUntil: o.commissionFreeUntil ? new Date(o.commissionFreeUntil) : null,
  };
}

/** Category ids of a product, deepest first (leaf → ancestors → main category). */
export function categoryChain(product) {
  return [
    idOf(product?.category),
    ...[...(product?.categoryAncestors || [])].reverse().map(idOf),
    idOf(product?.mainCategory),
  ].filter(Boolean);
}

function ruleIsLive(rule, now) {
  if (rule.active === false) return false;
  if (rule.startsAt && new Date(rule.startsAt) > now) return false;
  if (rule.endsAt && new Date(rule.endsAt) <= now) return false;
  return true;
}

/** Does a commission rule apply to this sale? Empty condition = matches anything. */
export function ruleMatches(rule, { seller, product, unitPrice, fulfilledBy, planKey, now = new Date() }) {
  if (!ruleIsLive(rule, now)) return false;
  const sellers = (rule.sellers || []).map(idOf);
  if (sellers.length && !sellers.includes(idOf(seller))) return false;
  const plans = rule.plans || [];
  if (plans.length && !plans.includes(planKey || '')) return false;
  const cats = (rule.categories || []).map(idOf);
  if (cats.length && !categoryChain(product).some((c) => cats.includes(c))) return false;
  if (rule.fulfillment && rule.fulfillment !== 'any' && rule.fulfillment !== fulfilledBy) return false;
  const min = num(rule.minPrice);
  const max = num(rule.maxPrice);
  if (min !== null && unitPrice < min) return false;
  if (max !== null && unitPrice > max) return false;
  const newDays = num(rule.newSellerDays);
  if (newDays) {
    const since = seller?.approvedAt || seller?.createdAt;
    if (!since || now - new Date(since) > newDays * DAY) return false;
  }
  return true;
}

/**
 * Commission % for one sale and why. Most specific wins:
 *  1. seller commission-free period
 *  2. campaign rules marked "applies even to custom deals" (first match, in list order)
 *  3. a rate staff set on this one product
 *  4. seller × category deal → seller's own rate
 *  5. other rules (first match, in list order)
 *  6. marketplace × category rate
 *  7. the seller's plan rate → marketplace default
 * A matching rule may also replace the fixed fee per item.
 */
export function resolveCommission({ settings = {}, seller = null, product = null, unitPrice = 0, fulfilledBy = 'seller', now = new Date(), config = null }) {
  const cfg = config || effectiveFeeConfig(settings, seller);
  const ctx = { seller, product, unitPrice, fulfilledBy, planKey: cfg.plan?.key || '', now };
  const chain = categoryChain(product);
  const inCats = (rules = []) => {
    for (const c of chain) {
      const hit = rules.find((r) => idOf(r.category) === c);
      if (hit) return Number(hit.rate);
    }
    return null;
  };
  const out = (rate, source, label = '', rule = null) => ({
    rate: Number(rate) || 0,
    source,
    label,
    fixedFeePerItem: rule && num(rule.fixedFeePerItem) !== null ? Number(rule.fixedFeePerItem) : cfg.fixedFeePerItem,
  });

  if (cfg.commissionFreeUntil && cfg.commissionFreeUntil > now) return out(0, 'seller_free');

  const rules = settings.commissionRules || [];
  const strong = rules.find((r) => r.overrideSellerDeals && ruleMatches(r, ctx));
  if (strong) return out(strong.rate, 'rule', strong.name || '', strong);

  const productRate = num(product?.sellerCommissionRate);
  if (productRate !== null && Number.isFinite(productRate)) return out(productRate, 'product');

  const sellerCat = inCats(seller?.categoryCommissions);
  if (sellerCat !== null) return out(sellerCat, 'seller_category');
  if (seller?.commissionRate !== null && seller?.commissionRate !== undefined) return out(seller.commissionRate, 'seller');

  const rule = rules.find((r) => !r.overrideSellerDeals && ruleMatches(r, ctx));
  if (rule) return out(rule.rate, 'rule', rule.name || '', rule);

  const globalCat = inCats(settings.categoryCommissions);
  if (globalCat !== null) return out(globalCat, 'category');
  return out(cfg.defaultCommissionRate, cfg.plan ? 'plan' : 'default', cfg.plan ? (cfg.plan.nameEn || cfg.plan.key) : '');
}

/** Commission on one unit, with the per-item minimum and cap. A 0% rate stays free. */
export function unitCommission(unitPrice, rate, cfg) {
  if (!rate) return 0;
  let c = (unitPrice * rate) / 100;
  if (cfg.minCommissionPerItem > 0) c = Math.max(c, cfg.minCommissionPerItem);
  if (cfg.maxCommissionPerItem > 0) c = Math.min(c, cfg.maxCommissionPerItem);
  return Math.min(c, unitPrice);
}

export function paymentFeeRule(cfg, paymentMethod) {
  return cfg.paymentFees.find((f) => f.method === paymentMethod) || cfg.paymentFees.find((f) => f.method === '*') || null;
}

/**
 * Every fee on one shipment. `lines`: [{ product, quantity, lineTotal }] (lineTotal = what the
 * customer pays for the line before order-level discounts).
 */
export function computeShipmentFees({ settings = {}, seller = null, lines = [], fulfilledBy = 'seller', deliveryFee = 0, paymentMethod = '', now = new Date() }) {
  const cfg = effectiveFeeConfig(settings, seller);
  const items = lines.map((line) => {
    const quantity = Math.max(1, Number(line.quantity) || 1);
    const lineTotal = round2(line.lineTotal);
    const unitPrice = lineTotal / quantity;
    const r = resolveCommission({ settings, seller, product: line.product, unitPrice, fulfilledBy, now, config: cfg });
    return {
      commissionRate: r.rate,
      commission: round2(unitCommission(unitPrice, r.rate, cfg) * quantity),
      commissionSource: r.source,
      commissionRule: r.label,
      fixedFee: round2(Math.max(0, r.fixedFeePerItem) * quantity),
    };
  });

  const subtotal = round2(lines.reduce((s, l) => s + (Number(l.lineTotal) || 0), 0));
  const units = lines.reduce((s, l) => s + Math.max(1, Number(l.quantity) || 1), 0);
  const fee = round2(deliveryFee);
  const blendedRate = subtotal > 0 ? items.reduce((s, it) => s + it.commission, 0) / subtotal : 0;
  const deliveryCommission = cfg.commissionOnDeliveryFee ? round2(fee * blendedRate) : 0;
  const commissionTotal = round2(items.reduce((s, it) => s + it.commission, 0) + deliveryCommission);
  const fixedFees = round2(items.reduce((s, it) => s + it.fixedFee, 0) + (lines.length ? cfg.fixedFeePerShipment : 0));
  const fulfillmentFee = fulfilledBy === 'store' ? round2(units * cfg.storeFulfillmentFeePerItem) : 0;
  const pf = paymentFeeRule(cfg, paymentMethod);
  const paymentFee = pf ? round2(((subtotal + fee) * (Number(pf.percent) || 0)) / 100 + (Number(pf.fixed) || 0)) : 0;
  const feesBeforeVat = round2(commissionTotal + fixedFees + fulfillmentFee + paymentFee);
  const feeVat = round2((feesBeforeVat * cfg.vatPercent) / 100);

  return {
    items,
    subtotal,
    deliveryFee: fee,
    deliveryCommission,
    commissionTotal,
    fixedFees,
    fulfillmentFee,
    paymentFee,
    feeVat,
    vatPercent: cfg.vatPercent,
    marketplaceFees: round2(feesBeforeVat + feeVat),
    sellerNet: round2(subtotal + fee - feesBeforeVat - feeVat),
    plan: cfg.plan,
  };
}

/**
 * What goes back to the seller when part of a line is returned: the line value is taken back,
 * the commission is given back minus the "refund admin fee" share the marketplace keeps
 * (Amazon keeps 20%), and the VAT charged on that commission is returned with it.
 * Fixed fees are not refunded.
 */
export function computeReturnReversal({ line, ratio, vatPercent = 0, returnAdminFeePercent = 0 }) {
  const r = Math.min(1, Math.max(0, Number(ratio) || 0));
  const value = round2((Number(line?.lineTotal) || 0) * r);
  const commission = (Number(line?.commission) || 0) * r;
  const kept = (commission * Math.min(100, Math.max(0, returnAdminFeePercent))) / 100;
  const commissionBack = round2(commission - kept);
  return {
    value,
    commissionBack,
    adminFeeKept: round2(kept),
    vatBack: round2((commissionBack * (Number(vatPercent) || 0)) / 100),
  };
}

/** `YYYY-MM` of a date in Cairo — the billing month for subscription fees. */
export function cairoMonthKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit' }).format(date);
}

/** Calendar day of a date in Cairo: { y, m, d, weekday (0 = Sunday) }. */
export function cairoDayParts(date = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Cairo', year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short',
  }).formatToParts(date).map((p) => [p.type, p.value]));
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday);
  return { y: Number(parts.year), m: Number(parts.month), d: Number(parts.day), weekday };
}

/**
 * The payout run a date belongs to, or null when that day is not a payout day.
 * weekly → every `weekday`; biweekly → every other `weekday` (even ISO-ish week number);
 * monthly → on `monthDay` (clamped to the month's length).
 */
export function payoutRunKey(schedule = {}, date = new Date()) {
  const { y, m, d, weekday } = cairoDayParts(date);
  const freq = schedule.frequency || 'manual';
  if (freq === 'manual') return null;
  if (freq === 'monthly') {
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const target = Math.min(Math.max(1, Number(schedule.monthDay) || 1), last);
    return d === target ? `${y}-${String(m).padStart(2, '0')}` : null;
  }
  const wd = Number.isInteger(Number(schedule.weekday)) ? Number(schedule.weekday) : 0;
  if (weekday !== wd) return null;
  const dayNumber = Math.floor(Date.UTC(y, m - 1, d) / DAY);
  const week = Math.floor(dayNumber / 7);
  if (freq === 'biweekly' && week % 2 !== 0) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/**
 * "What does this seller pay?" in one object — for the admin deal card and the seller's own
 * fee page. `categories` are { _id, nameAr, nameEn } rows (top-level categories plus any the
 * seller has a deal on). Rates are computed the same way checkout does (resolveCommission),
 * for a typical sale: the seller's default shipping mode and `samplePrice`.
 * Rules whose conditions depend on price, shipping mode or seller age are listed under
 * `rules` so staff know the rate can differ for some sales.
 */
export function sellerDealSummary({ settings = {}, seller = null, categories = [], samplePrice = 100, now = new Date() }) {
  const cfg = effectiveFeeConfig(settings, seller);
  const fulfilledBy = seller?.defaultFulfillment || (seller?.allowedFulfillment || ['seller'])[0] || 'seller';
  const rateFor = (catId) => resolveCommission({
    settings, seller, config: cfg, unitPrice: samplePrice, fulfilledBy, now,
    product: catId ? { category: catId, categoryAncestors: [], mainCategory: catId } : null,
  });
  const base = rateFor(null);
  const rows = categories.map((c) => {
    const r = rateFor(idOf(c._id || c));
    return { category: idOf(c._id || c), nameAr: c.nameAr || '', nameEn: c.nameEn || '', rate: r.rate, source: r.source, label: r.label };
  });
  const planKey = cfg.plan?.key || '';
  const rules = (settings.commissionRules || [])
    .filter((r) => ruleIsLive(r, now))
    .filter((r) => {
      const sellers = (r.sellers || []).map(idOf);
      const plans = r.plans || [];
      return (!sellers.length || sellers.includes(idOf(seller))) && (!plans.length || plans.includes(planKey));
    })
    .map((r) => ({
      name: r.name || '',
      rate: Number(r.rate) || 0,
      overridesDeal: r.overrideSellerDeals === true,
      categories: (r.categories || []).map(idOf),
      conditional: Boolean(num(r.minPrice) !== null || num(r.maxPrice) !== null || (r.fulfillment && r.fulfillment !== 'any') || num(r.newSellerDays)),
      endsAt: r.endsAt || null,
    }));
  return {
    plan: cfg.plan,
    commissionFreeUntil: cfg.commissionFreeUntil && cfg.commissionFreeUntil > now ? cfg.commissionFreeUntil : null,
    baseRate: { rate: base.rate, source: base.source, label: base.label },
    sellerRate: seller?.commissionRate ?? null,
    categories: rows,
    rules,
    fees: {
      minCommissionPerItem: cfg.minCommissionPerItem,
      maxCommissionPerItem: cfg.maxCommissionPerItem,
      fixedFeePerItem: cfg.fixedFeePerItem,
      fixedFeePerShipment: cfg.fixedFeePerShipment,
      storeFulfillmentFeePerItem: cfg.storeFulfillmentFeePerItem,
      monthlyFee: cfg.monthlyFee,
      vatPercent: cfg.vatPercent,
      paymentFees: cfg.paymentFees,
    },
    payout: {
      holdDays: cfg.payoutHoldDays,
      frequency: seller?.feeOverrides?.payoutFrequency || '',
    },
    fulfilledBy,
    samplePrice,
  };
}
