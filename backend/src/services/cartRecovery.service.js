/**
 * Abandoned-cart recovery: remind customers who left items in their cart, optionally with a
 * single-use coupon locked to them, and attribute the orders that follow.
 *
 * Runs from the in-process job runner (jobs/sellerJobs.js) every few minutes. Every send is
 * claimed atomically on the CartRecovery episode (stage n → n+1) before anything goes out,
 * so overlapping runs or several API instances never double-send.
 */
import crypto from 'node:crypto';
import Cart from '../models/Cart.js';
import CartRecovery from '../models/CartRecovery.js';
import Coupon from '../models/Coupon.js';
import Order from '../models/Order.js';
import StoreSettings from '../models/StoreSettings.js';
import User from '../models/User.js';
import { formatCartItem } from '../utils/formatters.js';
import { calculateItemsSubtotal } from '../utils/cartLinePricing.js';
import { endOfStoreDay } from '../utils/storeDate.js';
import { createUserNotification } from './userNotification.service.js';
import { sendEmail } from '../emails/index.js';
import { renderEmailLayout } from '../emails/layout.js';
import { clientUrl, renderButton } from '../emails/helpers.js';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
export const MAX_RECOVERY_STEPS = 3;
const CARTS_PER_RUN = 500;
const COUPON_TYPES = ['percent', 'fixed', 'free_delivery'];

const PRODUCT_FIELDS = [
  'nameAr nameEn slug price emoji unit stock reservedStock variants images isActive',
  'oldPrice discount isOffer offerActive activePromotionId promotionType promotionBuyQty promotionGetQty promotionUnit promotionSecondPercentOff',
].join(' ');

/** Keep in sync with DEFAULT_SETTINGS in frontend admin/pages/CartRecoveryPage.jsx. */
export const DEFAULT_CART_RECOVERY = Object.freeze({
  enabled: false,
  minCartValue: 50,
  maxCartAgeDays: 7,
  attributionDays: 7,
  cooldownDays: 3,
  steps: [
    {
      delayHours: 1,
      push: true,
      email: true,
      coupon: { enabled: false, discountType: 'percent', discountValue: 10, minSubtotal: 0, validDays: 2 },
      titleAr: 'نسيت شيئاً في سلتك؟ 🛒',
      titleEn: 'Forgot something? 🛒',
      messageAr: 'لديك {count} منتج في سلتك بقيمة {total}. أكمل طلبك قبل نفاد الكمية.',
      messageEn: 'You have {count} items worth {total} waiting in your cart. Check out before they sell out.',
    },
    {
      delayHours: 24,
      push: true,
      email: true,
      coupon: { enabled: true, discountType: 'percent', discountValue: 10, minSubtotal: 0, validDays: 2 },
      titleAr: 'خصم {discount} على سلتك 🎁',
      titleEn: '{discount} off your cart 🎁',
      messageAr: 'استخدم الكود {code} لإكمال طلبك — صالح حتى {expiry}.',
      messageEn: 'Use code {code} to complete your order — valid until {expiry}.',
    },
  ],
});

// ── Settings ────────────────────────────────────────────────────────────────

const num = (value, fallback, { min = 0, max = Infinity } = {}) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};
const str = (value, fallback, max = 300) => (typeof value === 'string' ? value.trim().slice(0, max) : fallback);

function normalizeStep(raw = {}, fallback = DEFAULT_CART_RECOVERY.steps[0]) {
  const coupon = raw.coupon || {};
  const fbCoupon = fallback.coupon;
  const discountType = COUPON_TYPES.includes(coupon.discountType) ? coupon.discountType : fbCoupon.discountType;
  return {
    delayHours: num(raw.delayHours, fallback.delayHours, { min: 0.25, max: 24 * 14 }),
    push: raw.push === undefined ? fallback.push : raw.push !== false,
    email: raw.email === undefined ? fallback.email : raw.email !== false,
    coupon: {
      enabled: coupon.enabled === undefined ? fbCoupon.enabled : coupon.enabled === true,
      discountType,
      discountValue: discountType === 'free_delivery'
        ? 0
        : num(coupon.discountValue, fbCoupon.discountValue, { min: 0, max: discountType === 'percent' ? 100 : 100000 }),
      minSubtotal: num(coupon.minSubtotal, fbCoupon.minSubtotal),
      validDays: Math.round(num(coupon.validDays, fbCoupon.validDays, { min: 1, max: 30 })),
    },
    titleAr: str(raw.titleAr, fallback.titleAr, 120) || fallback.titleAr,
    titleEn: str(raw.titleEn, fallback.titleEn, 120) || fallback.titleEn,
    messageAr: str(raw.messageAr, fallback.messageAr) || fallback.messageAr,
    messageEn: str(raw.messageEn, fallback.messageEn) || fallback.messageEn,
  };
}

/** Fill defaults and clamp every field; steps are kept in ascending delay order. */
export function normalizeCartRecoverySettings(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const d = DEFAULT_CART_RECOVERY;
  const rawSteps = Array.isArray(src.steps) && src.steps.length ? src.steps.slice(0, MAX_RECOVERY_STEPS) : d.steps;
  const steps = rawSteps
    .map((step, i) => normalizeStep(step, d.steps[i] || d.steps[d.steps.length - 1]))
    .sort((a, b) => a.delayHours - b.delayHours);
  return {
    enabled: src.enabled === true,
    minCartValue: num(src.minCartValue, d.minCartValue),
    maxCartAgeDays: Math.round(num(src.maxCartAgeDays, d.maxCartAgeDays, { min: 1, max: 60 })),
    attributionDays: Math.round(num(src.attributionDays, d.attributionDays, { min: 1, max: 30 })),
    cooldownDays: Math.round(num(src.cooldownDays, d.cooldownDays, { min: 0, max: 60 })),
    steps,
  };
}

export async function getCartRecoverySettings() {
  const settings = await StoreSettings.findOne({ key: 'main' }).select('cartRecovery').lean();
  return normalizeCartRecoverySettings(settings?.cartRecovery);
}

export async function updateCartRecoverySettings(payload) {
  const current = await getCartRecoverySettings();
  const next = normalizeCartRecoverySettings({ ...current, ...payload });
  await StoreSettings.findOneAndUpdate(
    { key: 'main' },
    { $set: { cartRecovery: next }, $setOnInsert: { key: 'main' } },
    { upsert: true, setDefaultsOnInsert: true },
  );
  return next;
}

// ── Message building ────────────────────────────────────────────────────────

function formatMoney(amount, lang) {
  const value = Math.round((Number(amount) || 0) * 100) / 100;
  return lang === 'ar' ? `${value} ج.م` : `EGP ${value}`;
}

function describeDiscount(coupon, lang) {
  if (!coupon) return '';
  if (coupon.discountType === 'percent') return `${coupon.discountValue}%`;
  if (coupon.discountType === 'fixed') return formatMoney(coupon.discountValue, lang);
  return lang === 'ar' ? 'توصيل مجاني' : 'free delivery';
}

export function fillTemplate(template, vars) {
  return String(template || '').replace(/\{(\w+)\}/g, (match, key) => (vars[key] !== undefined ? String(vars[key]) : match));
}

function buildVars({ user, cartValue, itemCount, coupon }, lang) {
  const expiry = coupon?.expiryDate
    ? new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'short', timeZone: 'Africa/Cairo' }).format(coupon.expiryDate)
    : '';
  return {
    name: (user?.name || '').split(' ')[0] || (lang === 'ar' ? 'عميلنا' : 'there'),
    count: itemCount,
    total: formatMoney(cartValue, lang),
    code: coupon?.code || '',
    discount: describeDiscount(coupon, lang),
    expiry,
  };
}

export function renderStepMessage(step, context) {
  const ar = buildVars(context, 'ar');
  const en = buildVars(context, 'en');
  return {
    titleAr: fillTemplate(step.titleAr, ar),
    titleEn: fillTemplate(step.titleEn, en),
    messageAr: fillTemplate(step.messageAr, ar),
    messageEn: fillTemplate(step.messageEn, en),
  };
}

function recoveryEmail({ message, coupon, items }) {
  const link = `${clientUrl().replace(/\/+$/, '')}/cart`;
  const itemList = items.slice(0, 5).map((item) => `<li style="margin:0 0 4px">${item.nameAr || item.nameEn} × ${item.quantity}</li>`).join('');
  const couponBox = coupon
    ? `<p style="margin:16px 0;padding:12px 16px;border:2px dashed #059669;border-radius:12px;text-align:center;font-size:20px;font-weight:800;letter-spacing:2px;color:#047857" dir="ltr">${coupon.code}</p>`
    : '';
  const bodyHtml = `
    <p style="margin:0 0 12px">${message.messageAr}</p>
    ${itemList ? `<ul style="margin:0 0 12px;padding-inline-start:20px">${itemList}</ul>` : ''}
    ${couponBox}
    ${renderButton(link, 'أكمل طلبك · Complete your order')}
    <p style="margin:16px 0 0;color:#64748b;font-size:13px" dir="ltr">${message.messageEn}</p>
  `;
  return {
    subject: `${message.titleAr} · ${message.titleEn}`,
    html: renderEmailLayout({ title: message.titleEn, heading: message.titleAr, bodyHtml, footerNote: 'MarketPlus' }),
    text: `${message.messageAr}\n\n${message.messageEn}${coupon ? `\n\n${coupon.code}` : ''}\n\n${link}`,
  };
}

// ── Cart valuation ──────────────────────────────────────────────────────────

/** Price a populated cart the same way the cart page does. */
export function valueCart(cart) {
  const items = (cart.items || []).map(formatCartItem).filter(Boolean);
  return { items, itemCount: items.reduce((n, i) => n + (i.quantity || 0), 0), cartValue: calculateItemsSubtotal(items) };
}

async function mintRecoveryCoupon(userId, stepCoupon, now) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = `BACK-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    try {
      // eslint-disable-next-line no-await-in-loop
      return await Coupon.create({
        code,
        discountType: stepCoupon.discountType,
        discountValue: stepCoupon.discountValue,
        minSubtotal: stepCoupon.minSubtotal,
        expiryDate: endOfStoreDay(new Date(now.getTime() + stepCoupon.validDays * DAY_MS)),
        usageLimit: 1,
        perUserLimit: 1,
        isActive: true,
        source: 'cart_recovery',
        assignedUser: userId,
        labelAr: 'كود استرجاع السلة',
        labelEn: 'Cart recovery code',
      });
    } catch (err) {
      if (err?.code !== 11000) throw err;
    }
  }
  throw new Error('Could not mint a unique recovery coupon');
}

// ── The job ─────────────────────────────────────────────────────────────────

async function deactivateEpisodeCoupons(episode) {
  if (!episode.couponCodes?.length) return;
  await Coupon.updateMany({ code: { $in: episode.couponCodes }, source: 'cart_recovery' }, { $set: { isActive: false } });
}

/**
 * Close episodes that converted (an order inside the attribution window) or ran out of time.
 * Returns { recovered, expired }.
 */
export async function attributeRecoveries(settings, now = new Date()) {
  const result = { recovered: 0, expired: 0 };
  const windowMs = settings.attributionDays * DAY_MS;
  const open = await CartRecovery.find({ status: 'active' }).limit(2000);

  for (const episode of open) {
    const since = episode.firstSentAt || episode.createdAt;
    const lastChance = new Date((episode.lastSentAt || since).getTime() + windowMs);
    // eslint-disable-next-line no-await-in-loop
    const order = await Order.findOne({
      user: episode.user,
      createdAt: { $gte: since, $lte: lastChance },
      orderStatus: { $ne: 'cancelled' },
      paymentStatus: { $ne: 'failed' },
    }).sort({ createdAt: 1 }).select('orderNumber total discount couponCode createdAt').lean();

    if (order) {
      const couponUsed = order.couponCode && episode.couponCodes.includes(order.couponCode) ? order.couponCode : null;
      // eslint-disable-next-line no-await-in-loop
      const updated = await CartRecovery.findOneAndUpdate(
        { _id: episode._id, status: 'active' },
        {
          $set: {
            status: 'recovered',
            recoveredOrder: order._id,
            recoveredOrderNumber: order.orderNumber || null,
            recoveredAt: order.createdAt,
            recoveredRevenue: Number(order.total) || 0,
            recoveredAfterStep: episode.steps.filter((s) => s.sentAt <= order.createdAt).length,
            couponUsed,
            couponDiscount: couponUsed ? Number(order.discount) || 0 : 0,
            closedAt: now,
          },
        },
        { new: true },
      );
      if (updated) {
        result.recovered += 1;
        // eslint-disable-next-line no-await-in-loop
        await deactivateEpisodeCoupons(updated);
      }
      continue;
    }

    // Still waiting on a later step? Keep it open until that step had its chance (+1h grace).
    const nextStep = settings.steps[episode.stage];
    const nextDue = nextStep ? episode.cartActivityAt.getTime() + nextStep.delayHours * HOUR_MS + HOUR_MS : 0;
    if (now > lastChance && now.getTime() > nextDue) {
      // eslint-disable-next-line no-await-in-loop
      const updated = await CartRecovery.findOneAndUpdate(
        { _id: episode._id, status: 'active' },
        { $set: { status: 'expired', closedAt: now } },
        { new: true },
      );
      if (updated) {
        result.expired += 1;
        // eslint-disable-next-line no-await-in-loop
        await deactivateEpisodeCoupons(updated);
      }
    }
  }
  return result;
}

async function sendStep({ episode, stepIndex, step, cart, user, valuation, now }) {
  const coupon = step.coupon.enabled ? await mintRecoveryCoupon(user._id, step.coupon, now) : null;
  const message = renderStepMessage(step, { user, cartValue: valuation.cartValue, itemCount: valuation.itemCount, coupon });
  const channels = [];

  if (step.push) {
    // In-app notification; also rings the phone through FCM when configured.
    await createUserNotification({
      userId: user._id,
      type: 'cart_reminder',
      ...message,
      link: '/cart',
      data: { cartId: String(cart._id), step: stepIndex, ...(coupon ? { couponCode: coupon.code } : {}) },
    });
    channels.push('push');
  }
  if (step.email && user.email) {
    try {
      const sent = await sendEmail({ to: user.email, ...recoveryEmail({ message, coupon, items: valuation.items }) });
      if (!sent?.simulated) channels.push('email');
    } catch (err) {
      console.error('[cart-recovery] email failed:', err.message);
    }
  }

  await CartRecovery.updateOne(
    { _id: episode._id },
    {
      $push: { steps: { step: stepIndex, sentAt: now, channels, couponCode: coupon?.code || null }, ...(coupon ? { couponCodes: coupon.code } : {}) },
      $set: {
        lastSentAt: now,
        cartValue: valuation.cartValue,
        itemCount: valuation.itemCount,
        ...(episode.firstSentAt ? {} : { firstSentAt: now }),
      },
    },
  );
  return channels;
}

/**
 * One pass: close finished episodes, then send whichever reminder step each idle cart is due.
 * Returns a summary that the admin "Run now" button shows.
 */
export async function runCartRecovery(now = new Date(), { force = false } = {}) {
  const settings = await getCartRecoverySettings();
  const summary = { enabled: settings.enabled, scanned: 0, sent: 0, started: 0, recovered: 0, expired: 0, skipped: 0 };

  const closed = await attributeRecoveries(settings, now);
  summary.recovered = closed.recovered;
  summary.expired = closed.expired;
  if ((!settings.enabled && !force) || !settings.steps.length) return summary;

  const firstDelayMs = settings.steps[0].delayHours * HOUR_MS;
  const carts = await Cart.find({
    'items.0': { $exists: true },
    updatedAt: { $lte: new Date(now.getTime() - firstDelayMs), $gte: new Date(now.getTime() - settings.maxCartAgeDays * DAY_MS) },
  })
    .sort({ updatedAt: -1 })
    .limit(CARTS_PER_RUN)
    .populate({ path: 'items.product', select: PRODUCT_FIELDS });

  const userIds = carts.map((c) => c.user);
  const [users, episodes, recentOrders] = await Promise.all([
    User.find({ _id: { $in: userIds }, role: 'user', isActive: { $ne: false } }).select('name email').lean(),
    CartRecovery.find({ user: { $in: userIds } }).sort({ createdAt: -1 }).lean(),
    Order.aggregate([
      { $match: { user: { $in: userIds }, createdAt: { $gte: new Date(now.getTime() - settings.maxCartAgeDays * DAY_MS) } } },
      { $group: { _id: '$user', last: { $max: '$createdAt' } } },
    ]),
  ]);
  const userById = new Map(users.map((u) => [String(u._id), u]));
  const latestEpisode = new Map();
  for (const ep of episodes) if (!latestEpisode.has(String(ep.user))) latestEpisode.set(String(ep.user), ep);
  const lastOrderAt = new Map(recentOrders.map((o) => [String(o._id), o.last]));

  for (const cart of carts) {
    summary.scanned += 1;
    const key = String(cart.user);
    const user = userById.get(key);
    // Staff/sellers/drivers, or a customer who already ordered since touching the cart.
    if (!user || (lastOrderAt.get(key) && lastOrderAt.get(key) >= cart.updatedAt)) { summary.skipped += 1; continue; }

    const valuation = valueCart(cart);
    if (valuation.itemCount < 1 || valuation.cartValue < settings.minCartValue) { summary.skipped += 1; continue; }

    const idleMs = now.getTime() - cart.updatedAt.getTime();
    let episode = latestEpisode.get(key);

    if (episode?.status !== 'active') {
      const cooledDown = !episode || now.getTime() - episode.createdAt.getTime() >= settings.cooldownDays * DAY_MS;
      if (!cooledDown) { summary.skipped += 1; continue; }
      try {
        // eslint-disable-next-line no-await-in-loop
        episode = (await CartRecovery.create({
          user: cart.user,
          cartActivityAt: cart.updatedAt,
          cartValue: valuation.cartValue,
          itemCount: valuation.itemCount,
        })).toObject();
        summary.started += 1;
      } catch (err) {
        if (err?.code === 11000) { summary.skipped += 1; continue; } // another run opened it
        throw err;
      }
    } else if (cart.updatedAt > episode.cartActivityAt) {
      // Customer came back and edited the cart: later steps count from the new activity.
      // eslint-disable-next-line no-await-in-loop
      await CartRecovery.updateOne({ _id: episode._id }, { $set: { cartActivityAt: cart.updatedAt } });
    }

    const stepIndex = episode.stage;
    const step = settings.steps[stepIndex];
    if (!step || idleMs < step.delayHours * HOUR_MS) continue;

    // Claim the step before sending — only one run can move stage n → n+1.
    // eslint-disable-next-line no-await-in-loop
    const claimed = await CartRecovery.findOneAndUpdate(
      { _id: episode._id, status: 'active', stage: stepIndex },
      { $inc: { stage: 1 } },
      { new: true },
    );
    if (!claimed) continue;

    try {
      // eslint-disable-next-line no-await-in-loop
      await sendStep({ episode: claimed, stepIndex, step, cart, user, valuation, now });
      summary.sent += 1;
    } catch (err) {
      console.error('[cart-recovery] step failed:', err.message);
    }
  }
  return summary;
}

/** Job-runner entry point: silent no-op while the feature is disabled. */
export async function runCartRecoveryJob(now = new Date()) {
  return runCartRecovery(now);
}

// ── Admin reporting ─────────────────────────────────────────────────────────

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

export async function getCartRecoveryStats({ days = 30 } = {}, now = new Date()) {
  const settings = await getCartRecoverySettings();
  const span = Math.round(num(days, 30, { min: 1, max: 365 }));
  const since = new Date(now.getTime() - span * DAY_MS);

  const [totals, perStep, daily, openCarts] = await Promise.all([
    CartRecovery.aggregate([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: null,
          episodes: { $sum: 1 },
          remindersSent: { $sum: { $size: '$steps' } },
          abandonedValue: { $sum: '$cartValue' },
          recovered: { $sum: { $cond: [{ $eq: ['$status', 'recovered'] }, 1, 0] } },
          recoveredRevenue: { $sum: '$recoveredRevenue' },
          withCoupon: { $sum: { $cond: [{ $ne: ['$couponUsed', null] }, 1, 0] } },
          couponDiscount: { $sum: '$couponDiscount' },
          active: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
        },
      },
    ]),
    CartRecovery.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $unwind: '$steps' },
      {
        $group: {
          _id: '$steps.step',
          sent: { $sum: 1 },
          recovered: {
            $sum: { $cond: [{ $and: [{ $eq: ['$status', 'recovered'] }, { $eq: ['$recoveredAfterStep', { $add: ['$steps.step', 1] }] }] }, 1, 0] },
          },
          revenue: {
            $sum: { $cond: [{ $and: [{ $eq: ['$status', 'recovered'] }, { $eq: ['$recoveredAfterStep', { $add: ['$steps.step', 1] }] }] }, '$recoveredRevenue', 0] },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    CartRecovery.aggregate([
      { $match: { status: 'recovered', recoveredAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$recoveredAt', timezone: 'Africa/Cairo' } },
          revenue: { $sum: '$recoveredRevenue' },
          orders: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    getOpenAbandonedCarts(settings, now),
  ]);

  const t = totals[0] || {};
  const episodesCount = t.episodes || 0;
  return {
    enabled: settings.enabled,
    days: span,
    episodes: episodesCount,
    active: t.active || 0,
    remindersSent: t.remindersSent || 0,
    abandonedValue: round2(t.abandonedValue),
    recovered: t.recovered || 0,
    recoveryRate: episodesCount ? round2(((t.recovered || 0) / episodesCount) * 100) : 0,
    recoveredRevenue: round2(t.recoveredRevenue),
    recoveredWithCoupon: t.withCoupon || 0,
    couponDiscount: round2(t.couponDiscount),
    perStep: perStep.map((s) => ({
      step: s._id,
      sent: s.sent,
      recovered: s.recovered,
      revenue: round2(s.revenue),
      rate: s.sent ? round2((s.recovered / s.sent) * 100) : 0,
    })),
    daily: daily.map((d) => ({ date: d._id, revenue: round2(d.revenue), orders: d.orders })),
    openCarts,
  };
}

/** Carts sitting idle right now (past the first delay, younger than max age): the money still on the table. */
async function getOpenAbandonedCarts(settings, now) {
  const firstDelayMs = (settings.steps[0]?.delayHours || 1) * HOUR_MS;
  const carts = await Cart.find({
    'items.0': { $exists: true },
    updatedAt: { $lte: new Date(now.getTime() - firstDelayMs), $gte: new Date(now.getTime() - settings.maxCartAgeDays * DAY_MS) },
  })
    .limit(1000)
    .populate({ path: 'items.product', select: PRODUCT_FIELDS })
    .populate({ path: 'user', select: 'role' });
  let count = 0;
  let value = 0;
  for (const cart of carts) {
    if (cart.user?.role !== 'user') continue;
    const v = valueCart(cart);
    if (v.itemCount < 1) continue;
    count += 1;
    value += v.cartValue;
  }
  return { count, value: round2(value), capped: carts.length >= 1000 };
}

export async function listCartRecoveries({ status, page = 1, limit = 20 } = {}) {
  const filter = ['active', 'recovered', 'expired'].includes(status) ? { status } : {};
  const pageNum = Math.max(1, Math.trunc(Number(page) || 1));
  const perPage = Math.min(100, Math.max(1, Math.trunc(Number(limit) || 20)));
  const [rows, total] = await Promise.all([
    CartRecovery.find(filter)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * perPage)
      .limit(perPage)
      .populate({ path: 'user', select: 'name phone email' })
      .lean(),
    CartRecovery.countDocuments(filter),
  ]);
  return {
    data: rows.map((r) => ({
      _id: r._id,
      user: r.user ? { _id: r.user._id, name: r.user.name, phone: r.user.phone, email: r.user.email } : null,
      status: r.status,
      cartValue: r.cartValue,
      itemCount: r.itemCount,
      stepsSent: r.steps.length,
      steps: r.steps,
      couponCodes: r.couponCodes,
      couponUsed: r.couponUsed,
      recoveredOrder: r.recoveredOrder,
      recoveredOrderNumber: r.recoveredOrderNumber,
      recoveredRevenue: r.recoveredRevenue,
      recoveredAt: r.recoveredAt,
      createdAt: r.createdAt,
      lastSentAt: r.lastSentAt,
    })),
    pagination: { page: pageNum, limit: perPage, total, totalPages: Math.max(1, Math.ceil(total / perPage)) },
  };
}
