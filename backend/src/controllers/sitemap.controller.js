/**
 * Lightweight public data for the storefront's XML sitemaps (slugs + last-modified dates).
 */
import Product from '../models/Product.js';
import Category from '../models/Category.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const MAX_PRODUCTS_PER_PAGE = 20000;

function firstImage(product) {
  const types = product.mediaTypes || [];
  const images = Array.isArray(product.images) ? product.images : [];
  return images.find((src, index) => types[index] !== 'video' && /^https?:\/\//.test(src || '')) || null;
}

/** GET /api/sitemap/products?page=1&limit=20000 — active products, oldest first. */
export const getSitemapProducts = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(
    MAX_PRODUCTS_PER_PAGE,
    Math.max(1, Number.parseInt(req.query.limit, 10) || MAX_PRODUCTS_PER_PAGE),
  );
  const filter = { isActive: true, slug: { $nin: [null, ''] } };

  const [total, rows] = await Promise.all([
    Product.countDocuments(filter),
    Product.find(filter)
      .select('slug updatedAt images mediaTypes nameAr nameEn')
      .sort({ _id: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
  ]);

  res.json({
    success: true,
    data: rows.map((product) => ({
      slug: product.slug,
      updatedAt: product.updatedAt,
      image: firstImage(product),
      nameAr: product.nameAr || '',
      nameEn: product.nameEn || '',
    })),
    pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
  });
});

/** GET /api/sitemap/categories — every active category with its full slug path. */
export const getSitemapCategories = asyncHandler(async (_req, res) => {
  const categories = await Category.find({})
    .select('slug parentCategory isActive updatedAt')
    .lean();
  const byId = new Map(categories.map((cat) => [String(cat._id), cat]));

  const slugPathOf = (cat) => {
    const slugs = [];
    const seen = new Set();
    let current = cat;
    while (current) {
      const id = String(current._id);
      // A hidden ancestor hides the whole branch; `seen` guards against bad parent loops.
      if (seen.has(id) || current.isActive === false || !current.slug) return null;
      seen.add(id);
      slugs.unshift(current.slug);
      current = current.parentCategory ? byId.get(String(current.parentCategory)) : null;
    }
    return slugs.join('/');
  };

  const data = categories
    .map((cat) => ({ slugPath: slugPathOf(cat), updatedAt: cat.updatedAt }))
    .filter((entry) => entry.slugPath);

  res.json({ success: true, data });
});
