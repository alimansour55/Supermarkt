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

/**
 * Restrict a Mongo product filter to real offers.
 * Mutates `filter` in place (appending to `$and`) AND returns it, so both
 * `applyOffersOnlyFilter(filter)` and `const f = applyOffersOnlyFilter({...})`
 * call styles work.
 */
export function applyOffersOnlyFilter(filter = {}) {
  filter.$and = [...(filter.$and || []), REAL_OFFER_CONDITION];
  return filter;
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
