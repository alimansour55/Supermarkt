/**
 * Product rating is derived only from approved customer reviews.
 */

export const getApprovedReviews = (product) =>
  (product?.reviews || []).filter((review) => review.status === 'approved');

export const computeProductRating = (product) => {
  const approved = getApprovedReviews(product);
  if (!approved.length) return 0;
  const total = approved.reduce((sum, review) => sum + Number(review.rating || 0), 0);
  return Math.round((total / approved.length) * 10) / 10;
};

export const applyProductRating = (product) => {
  if (!product) return 0;
  const rating = computeProductRating(product);
  product.rating = rating;
  return rating;
};

/** Count reviews awaiting moderation. */
export const countPendingReviews = async (ProductModel) => {
  const [row] = await ProductModel.aggregate([
    { $unwind: '$reviews' },
    { $match: { 'reviews.status': 'pending' } },
    { $count: 'total' },
  ]);
  return row?.total || 0;
};

/** Recompute stored rating for every product (e.g. after seed or data repair). */
export const syncAllProductRatings = async (ProductModel) => {
  const products = await ProductModel.find({}).select('reviews rating');
  let updated = 0;
  for (const product of products) {
    const next = computeProductRating(product);
    if (product.rating !== next) {
      product.rating = next;
      await product.save();
      updated += 1;
    }
  }
  return { total: products.length, updated };
};
