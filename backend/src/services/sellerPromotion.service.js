/**
 * Seller promotions as price markdowns. One promotion per product at a time — a product
 * already in a running promotion (seller or store) is skipped, never discounted twice.
 */
import Product from '../models/Product.js';
import SellerPromotion from '../models/SellerPromotion.js';
import { AppError } from '../utils/AppError.js';
import { notifySellerUsers } from './marketplace.service.js';

const round2 = (n) => Math.round(n * 100) / 100;
const discounted = (price, percent) => Math.max(0.01, round2(price * (1 - percent / 100)));

export function promotionProductFilter(promo) {
  const filter = { seller: promo.seller, listingStatus: { $in: ['approved', 'paused'] } };
  if (promo.scope === 'sections') filter.sellerCategories = { $in: promo.sections || [] };
  if (promo.scope === 'products') filter._id = { $in: promo.products || [] };
  return filter;
}

/** Products in an active seller promotion can't have their prices edited until it ends. */
export function assertPriceEditable(product, operational) {
  if (!product.sellerPromotion) return;
  const touchesPrice = operational.price !== undefined || operational.oldPrice !== undefined
    || (operational.variants || []).some((v) => {
      const prev = (product.variants || []).find((x) => String(x._id) === String(v._id));
      return !prev || Number(prev.price) !== Number(v.price);
    });
  if (touchesPrice) {
    throw new AppError('This product is in an active promotion — prices can change after it ends', 400);
  }
}

export async function activatePromotion(promo, now = new Date()) {
  const products = await Product.find(promotionProductFilter(promo));
  const applied = [];
  let skipped = 0;
  for (const p of products) {
    if (p.sellerPromotion || p.activePromotionId) { skipped += 1; continue; }
    const snap = { product: p._id, price: p.price, oldPrice: p.oldPrice ?? null, variants: [] };
    p.oldPrice = p.oldPrice > p.price ? p.oldPrice : p.price;
    p.price = discounted(p.price, promo.percent);
    for (const v of p.variants || []) {
      if (!(v.price > 0)) continue;
      snap.variants.push({ variant: v._id, price: v.price, oldPrice: v.oldPrice ?? null });
      v.oldPrice = v.oldPrice > v.price ? v.oldPrice : v.price;
      v.price = discounted(v.price, promo.percent);
    }
    p.sellerPromotion = promo._id;
    // eslint-disable-next-line no-await-in-loop
    await p.save();
    applied.push(snap);
  }
  promo.applied = applied;
  promo.skipped = skipped;
  promo.status = 'active';
  promo.activatedAt = now;
  await promo.save();
  await notifySellerUsers(promo.seller, {
    type: 'seller_promotion',
    titleAr: 'بدأ العرض',
    titleEn: 'Promotion started',
    messageAr: `«${promo.name}» يعمل الآن على ${applied.length} منتج.`,
    messageEn: `"${promo.name}" is live on ${applied.length} product(s).`,
    link: '/seller-center/promotions',
  });
  return promo;
}

export async function endPromotion(promo, { status = 'ended', now = new Date() } = {}) {
  for (const snap of promo.applied || []) {
    // eslint-disable-next-line no-await-in-loop
    const p = await Product.findOne({ _id: snap.product, sellerPromotion: promo._id });
    if (!p) continue;
    p.price = snap.price;
    p.oldPrice = snap.oldPrice;
    for (const vs of snap.variants || []) {
      const v = p.variants.id(vs.variant);
      if (v) { v.price = vs.price; v.oldPrice = vs.oldPrice; }
    }
    p.sellerPromotion = null;
    // eslint-disable-next-line no-await-in-loop
    await p.save();
  }
  promo.status = status;
  promo.endedAt = now;
  await promo.save();
  return promo;
}

/** Job: start approved promotions whose time came; end active ones whose time passed. */
export async function runPromotionSchedule(now = new Date()) {
  const toStart = await SellerPromotion.find({ status: 'approved', startsAt: { $lte: now }, endsAt: { $gt: now } });
  for (const promo of toStart) {
    // eslint-disable-next-line no-await-in-loop
    await activatePromotion(promo, now);
  }
  const toEnd = await SellerPromotion.find({ status: { $in: ['active', 'approved'] }, endsAt: { $lte: now } });
  for (const promo of toEnd) {
    // eslint-disable-next-line no-await-in-loop
    await endPromotion(promo, { now });
  }
  return { started: toStart.length, ended: toEnd.length };
}
