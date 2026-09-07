/**
 * Shared Mongo filter for real on-sale / offer products.
 * Excludes products flagged isOffer without an actual discount or active promotion.
 */
export const REAL_OFFER_CONDITION = {
  offerActive: { $ne: false },
  $or: [
    { discount: { $gt: 0 } },
    { activePromotionId: { $ne: null } },
  ],
};

/** @deprecated Use REAL_OFFER_CONDITION — kept for imports; same rules as storefront. */
export const CATALOG_OFFER_CONDITION = REAL_OFFER_CONDITION;

export function applyOffersOnlyFilter(filter = {}) {
  const next = { ...filter };
  next.$and = [...(next.$and || []), REAL_OFFER_CONDITION];
  return next;
}

export function buildOffersProductFilter(base = {}) {
  return applyOffersOnlyFilter({
    ...base,
    isActive: base.isActive !== false,
  });
}

export function isRealOfferProduct(product) {
  if (!product) return false;
  const discount = Number(product.discount ?? 0);
  if (discount > 0) return true;
  if (product.activePromotionId) return true;
  const oldPrice = Number(product.oldPrice ?? 0);
  const price = Number(product.price ?? 0);
  return oldPrice > price && price > 0;
}
