/**
 * Share & earn (affiliate) rules — pure, no database.
 *
 * A customer shares their link; when someone orders through it and the order is
 * delivered, the link owner earns a reward. The admin decides whether that reward is
 * wallet money or loyalty points, and whether it is a percent of the order or a fixed
 * amount. Rewards wait `holdDays` after delivery (the return window) before they are paid.
 */

export const AFFILIATE_REWARD_TYPES = ['wallet', 'points'];
export const AFFILIATE_CALC_TYPES = ['percent', 'fixed'];
export const AFFILIATE_JOIN_MODES = ['open', 'approval'];
export const AFFILIATE_STATUSES = ['active', 'pending', 'paused', 'blocked', 'rejected'];
/**
 * pending   — order placed, not delivered yet
 * holding   — delivered, waiting for the return window (holdUntil)
 * paid      — reward credited to the link owner
 * cancelled — order cancelled / refunded / failed before the reward was paid
 * reversed  — reward was paid, then the order was fully refunded and it was taken back
 */
export const COMMISSION_STATUSES = ['pending', 'holding', 'paid', 'cancelled', 'reversed'];

export const DEFAULT_AFFILIATE_SETTINGS = {
  enabled: false,
  joinMode: 'open',
  rewardType: 'wallet',
  calcType: 'percent',
  percent: 3,
  fixedAmount: 20,
  maxRewardPerOrder: 100,
  minOrderTotal: 100,
  holdDays: 7,
  attributionDays: 7,
  newCustomersOnly: false,
  maxRewardedOrdersPerBuyer: 0,
  termsAr: '',
  termsEn: '',
};

const CODE_RE = /^[A-Z0-9][A-Z0-9_-]{3,19}$/;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const clampNum = (value, min, max, fallback) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};

export function normalizeAffiliateSettings(src = {}) {
  const s = src?.toObject?.({ depopulate: true }) ?? src ?? {};
  const D = DEFAULT_AFFILIATE_SETTINGS;
  return {
    enabled: s.enabled === true,
    joinMode: AFFILIATE_JOIN_MODES.includes(s.joinMode) ? s.joinMode : D.joinMode,
    rewardType: AFFILIATE_REWARD_TYPES.includes(s.rewardType) ? s.rewardType : D.rewardType,
    calcType: AFFILIATE_CALC_TYPES.includes(s.calcType) ? s.calcType : D.calcType,
    percent: clampNum(s.percent, 0, 100, D.percent),
    fixedAmount: clampNum(s.fixedAmount, 0, 1_000_000, D.fixedAmount),
    maxRewardPerOrder: clampNum(s.maxRewardPerOrder, 0, 1_000_000, D.maxRewardPerOrder),
    minOrderTotal: clampNum(s.minOrderTotal, 0, 1_000_000, D.minOrderTotal),
    holdDays: Math.round(clampNum(s.holdDays, 0, 90, D.holdDays)),
    attributionDays: Math.round(clampNum(s.attributionDays, 1, 90, D.attributionDays)),
    newCustomersOnly: s.newCustomersOnly === true,
    maxRewardedOrdersPerBuyer: Math.round(clampNum(s.maxRewardedOrdersPerBuyer, 0, 1000, D.maxRewardedOrdersPerBuyer)),
    termsAr: String(s.termsAr ?? '').slice(0, 2000),
    termsEn: String(s.termsEn ?? '').slice(0, 2000),
  };
}

export function normalizeAffiliateCode(value) {
  return String(value ?? '').trim().toUpperCase();
}

export function isValidAffiliateCode(value) {
  return CODE_RE.test(normalizeAffiliateCode(value));
}

/** Random, easy-to-read code (no 0/O, 1/I) — `random` is injectable for tests. */
export function generateAffiliateCode(length = 7, random = Math.random) {
  let code = '';
  for (let i = 0; i < length; i += 1) {
    code += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)];
  }
  return code;
}

/**
 * The rate that applies to one affiliate: their own deal when the admin set one,
 * otherwise the program defaults. Reward type (wallet/points) is always program-wide.
 */
export function effectiveAffiliateRate(settings, affiliate = null) {
  const rules = normalizeAffiliateSettings(settings);
  const custom = affiliate?.customCalcType && AFFILIATE_CALC_TYPES.includes(affiliate.customCalcType);
  if (!custom) {
    return { calcType: rules.calcType, percent: rules.percent, fixedAmount: rules.fixedAmount, custom: false };
  }
  return {
    calcType: affiliate.customCalcType,
    percent: clampNum(affiliate.customPercent, 0, 100, rules.percent),
    fixedAmount: clampNum(affiliate.customFixedAmount, 0, 1_000_000, rules.fixedAmount),
    custom: true,
  };
}

/**
 * What the reward is calculated on: the products the buyer actually paid for —
 * subtotal minus coupon and points discounts, minus anything refunded. Delivery fees
 * never earn a reward.
 */
export function affiliateBaseAmount(order = {}) {
  const products = Number(order.subtotal || 0)
    - Number(order.discount || 0)
    - Number(order.pointsDiscount || 0);
  const refunded = Number(order.refundAmount || 0);
  return round2(Math.max(0, products - refunded));
}

/**
 * Reward for one order. Returns
 *   { eligible, reason, baseAmount, cashValue, rewardAmount, rewardType }
 * where `cashValue` is the EGP value and `rewardAmount` is in the reward unit
 * (EGP for wallet, whole points for points). `pointValueEGP` is the loyalty
 * "1 point = X EGP" rate, needed to turn money into points.
 */
export function calculateAffiliateReward({ settings, affiliate = null, order, pointValueEGP = 0.1 }) {
  const rules = normalizeAffiliateSettings(settings);
  const rate = effectiveAffiliateRate(rules, affiliate);
  const baseAmount = affiliateBaseAmount(order);
  const none = (reason) => ({
    eligible: false, reason, baseAmount, cashValue: 0, rewardAmount: 0, rewardType: rules.rewardType,
  });

  if (baseAmount <= 0) return none('empty_order');
  // The minimum is checked on the original order value: a partial return later
  // shrinks the reward but does not wipe it out.
  const orderValue = Number(order?.subtotal || 0) - Number(order?.discount || 0) - Number(order?.pointsDiscount || 0);
  if (orderValue < rules.minOrderTotal) return none('below_minimum');

  let cashValue;
  if (rate.calcType === 'percent') {
    cashValue = baseAmount * (rate.percent / 100);
  } else {
    // A fixed reward shrinks with the share of the order that was returned.
    const share = orderValue > 0 ? Math.min(1, baseAmount / orderValue) : 0;
    const fixedCash = rules.rewardType === 'points'
      ? rate.fixedAmount * (Number(pointValueEGP) || 0)
      : rate.fixedAmount;
    cashValue = fixedCash * share;
  }
  if (rules.maxRewardPerOrder > 0) {
    const capCash = rules.rewardType === 'points'
      ? rules.maxRewardPerOrder * (Number(pointValueEGP) || 0)
      : rules.maxRewardPerOrder;
    cashValue = Math.min(cashValue, capCash);
  }
  cashValue = round2(Math.max(0, cashValue));

  let rewardAmount = cashValue;
  if (rules.rewardType === 'points') {
    const pv = Number(pointValueEGP) || 0;
    rewardAmount = pv > 0 ? Math.floor(cashValue / pv + 1e-9) : 0;
    cashValue = round2(rewardAmount * pv);
  }
  if (rewardAmount <= 0) return none('zero_reward');

  return { eligible: true, reason: '', baseAmount, cashValue, rewardAmount, rewardType: rules.rewardType };
}

/**
 * Should this order be credited to this link at all? `buyer` and `owner` are users
 * ({ _id, phone }); `buyerPastOrders` counts the buyer's earlier, non-cancelled orders;
 * `rewardedOrdersFromBuyer` counts orders this buyer already earned this affiliate.
 */
export function checkAffiliateAttribution({
  settings,
  affiliate,
  owner,
  buyer,
  buyerPastOrders = 0,
  rewardedOrdersFromBuyer = 0,
}) {
  const rules = normalizeAffiliateSettings(settings);
  if (!rules.enabled) return { ok: false, reason: 'program_off' };
  if (!affiliate || affiliate.status !== 'active') return { ok: false, reason: 'link_inactive' };
  if (!owner || !buyer) return { ok: false, reason: 'unknown_user' };
  if (String(owner._id) === String(buyer._id)) return { ok: false, reason: 'self_referral' };
  const ownerPhone = String(owner.phone || '').replace(/\D/g, '').slice(-10);
  const buyerPhone = String(buyer.phone || '').replace(/\D/g, '').slice(-10);
  if (ownerPhone && ownerPhone.length >= 8 && ownerPhone === buyerPhone) {
    return { ok: false, reason: 'self_referral' };
  }
  if (rules.newCustomersOnly && buyerPastOrders > 0) return { ok: false, reason: 'not_new_customer' };
  if (rules.maxRewardedOrdersPerBuyer > 0 && rewardedOrdersFromBuyer >= rules.maxRewardedOrdersPerBuyer) {
    return { ok: false, reason: 'buyer_limit' };
  }
  return { ok: true, reason: '' };
}

export function holdUntilFrom(deliveredAt, holdDays) {
  const start = deliveredAt ? new Date(deliveredAt) : new Date();
  return new Date(start.getTime() + Math.max(0, Number(holdDays) || 0) * 24 * 60 * 60 * 1000);
}

/** One plain sentence describing the reward, for the customer page and admin preview. */
export function describeAffiliateReward(settings, { lang = 'ar', affiliate = null, pointValueEGP = 0.1 } = {}) {
  const rules = normalizeAffiliateSettings(settings);
  const rate = effectiveAffiliateRate(rules, affiliate);
  const isAr = lang === 'ar';
  const points = rules.rewardType === 'points';
  let what;
  if (rate.calcType === 'percent') {
    what = points
      ? (isAr ? `نقاطاً بقيمة ${rate.percent}% من قيمة الطلب` : `points worth ${rate.percent}% of the order`)
      : (isAr ? `${rate.percent}% من قيمة الطلب في محفظتك` : `${rate.percent}% of the order in your wallet`);
  } else {
    what = points
      ? (isAr ? `${rate.fixedAmount} نقطة عن كل طلب` : `${rate.fixedAmount} points per order`)
      : (isAr ? `${rate.fixedAmount} EGP في محفظتك عن كل طلب` : `EGP ${rate.fixedAmount} in your wallet per order`);
  }
  const cap = rules.maxRewardPerOrder > 0
    ? (points
      ? (isAr ? ` (حتى ${rules.maxRewardPerOrder} نقطة للطلب)` : ` (up to ${rules.maxRewardPerOrder} points per order)`)
      : (isAr ? ` (حتى ${rules.maxRewardPerOrder} EGP للطلب)` : ` (up to EGP ${rules.maxRewardPerOrder} per order)`))
    : '';
  const pv = Number(pointValueEGP) || 0;
  const pointsNote = points && pv > 0
    ? (isAr ? ` · كل ${Math.round(1 / pv)} نقطة = 1 EGP` : ` · every ${Math.round(1 / pv)} points = EGP 1`)
    : '';
  return isAr
    ? `اكسب ${what}${cap} عندما يشتري أحد من رابطك ويُسلَّم طلبه${pointsNote}.`
    : `Earn ${what}${cap} when someone buys through your link and the order is delivered${pointsNote}.`;
}
