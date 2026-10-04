import mongoose from 'mongoose';
import Product from '../models/Product.js';
import Brand from '../models/Brand.js';
import Category from '../models/Category.js';
import { AppError } from '../utils/AppError.js';
import { formatProduct } from '../utils/formatters.js';
import { buildSimilarProducts } from '../utils/relatedProducts.js';
import { slugify } from '../utils/slugify.js';
import {
  uploadFilesToCloudinary,
  deleteProductCloudinaryAssets,
  appendProductMedia,
  removeProductImageByPublicId,
  CLOUDINARY_FOLDERS,
} from '../utils/cloudinaryUpload.js';
import {
  buildSkuCandidates,
  findFirstAvailableSku,
  isSkuAvailable,
  resolveProductSku,
  generateBarcodeFromSeed,
  buildVariantSku,
} from '../utils/productSku.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { parsePagination, parseSort, paginationMeta } from '../utils/listQuery.js';
import { toCsv, sendCsv, parseCsv } from '../utils/csvExport.js';
import { logAudit, pickChanges } from '../services/auditLog.service.js';
import { checkInventoryAlert } from '../services/inventoryAlert.service.js';
import { resolveProductSearchFilter, arabicSearchPattern, fetchRankedProducts } from '../utils/searchQuery.js';
import { searchProductIds } from '../services/searchIndex.service.js';
import { applyOffersOnlyFilter } from '../utils/offersFilter.js';
import StoreSettings from '../models/StoreSettings.js';
import { normalizeProductFilterSettings } from '../utils/productFilterSettings.js';
import { PRODUCT_SOURCE_OPTION_IDS } from '../constants/productFilterSettings.js';
import { productsFromActiveLimitedPromotions } from '../services/homepageDealPromotion.service.js';
import { syncTimedPromotionLifecycles } from '../services/promotion.service.js';
import { buildBrandProductFilterForQuery } from '../utils/brandProductFilter.js';
import {
  getActiveChildren,
  getActiveDescendantsFlat,
  resolveCategoryProductFilter,
  resolveCategoryChainBySlugs,
  attachProductCounts,
  getCategoryChainFromId,
  applyProductCategoryQueryToFilter,
  CATEGORY_LEVEL,
  parseSlugPathParam,
} from '../utils/categoryTree.js';
import {
  resolveProductCategoryFields,
  resolveProductCategoryFieldsFromImport,
  buildExportCategoryMetaMap,
} from '../utils/productCategorySync.js';
import {
  scanProductCategoryIntegrity,
  repairProductCategories,
  repairCategoryLinks,
  diagnoseProductCategory,
} from '../utils/repairCategoryLinks.js';
import { LOW_STOCK_THRESHOLD } from '../services/inventoryAlert.service.js';
import { getAdminStockAlertThreshold, normalizeAdminStockAlertThreshold } from '../utils/adminStockThreshold.js';

const ADMIN_PRODUCT_SORT = ['createdAt', 'nameEn', 'nameAr', 'price', 'wholesalePrice', 'stock', 'soldCount'];

function parseAdminProductSort(query) {
  const alias = String(query.sort || '').trim();
  if (alias === 'best-selling') return { soldCount: -1, createdAt: -1 };
  if (alias === 'newest') return { createdAt: -1 };
  if (alias === 'name') return { nameEn: 1 };
  if (alias === 'price-low') return { price: 1 };
  if (alias === 'price-high') return { price: -1 };
  return parseSort(query, ADMIN_PRODUCT_SORT);
}

function parseStockThreshold(query, fallback = LOW_STOCK_THRESHOLD) {
  const raw = query.stockMax ?? query.stockThreshold ?? query.threshold;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return normalizeAdminStockAlertThreshold(n, fallback);
}

async function resolveStockThreshold(query) {
  const raw = query.stockMax ?? query.stockThreshold ?? query.threshold;
  if (raw !== undefined && raw !== '') {
    return parseStockThreshold(query);
  }
  return getAdminStockAlertThreshold();
}

function applyStockFilter(filter, query, threshold) {
  const stockMode = String(query.stock || '').trim();

  if (stockMode === 'low') {
    filter.stock = { $lte: threshold, $gt: 0 };
  } else if (stockMode === 'out') {
    filter.stock = 0;
  } else if (stockMode === 'below') {
    filter.stock = { $lte: threshold };
  } else if (stockMode === 'in') {
    filter.stock = { $gt: threshold };
  }

  return threshold;
}

async function buildAdminProductFilter(query) {
  const filter = {};
  const threshold = await resolveStockThreshold(query);

  if (query.isActive !== undefined && query.isActive !== '') {
    filter.isActive = query.isActive === 'true';
  }
  await applyProductCategoryQueryToFilter(filter, query);
  applyStockFilter(filter, query, threshold);
  if (query.offers === 'true') applyOffersOnlyFilter(filter);
  if (query.brand?.trim()) {
    const brandClause = await buildBrandProductFilterForQuery(Brand, query.brand);
    if (brandClause) Object.assign(filter, brandClause);
  }

  const section = query.section;
  if (query.isFeatured === 'true' || section === 'top' || section === 'new-arrivals') {
    filter.isFeatured = true;
  }
  if (query.isBestSeller === 'true' || section === 'best-sellers') {
    filter.isBestSeller = true;
  }
  if (query.isOurProduct === 'true') {
    filter.isOurProduct = true;
  } else if (query.isOurProduct === 'false') {
    filter.isOurProduct = false;
  }
  if (section === 'offers') applyOffersOnlyFilter(filter);

  if (query.q) {
    const q = String(query.q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { nameAr: { $regex: q, $options: 'i' } },
      { nameEn: { $regex: q, $options: 'i' } },
      { slug: { $regex: q, $options: 'i' } },
      { brand: { $regex: q, $options: 'i' } },
      { sku: { $regex: q, $options: 'i' } },
      { barcode: { $regex: q, $options: 'i' } },
    ];
  }

  const priceMin = Number(query.priceMin);
  const priceMax = Number(query.priceMax);
  if (Number.isFinite(priceMin) || Number.isFinite(priceMax)) {
    filter.price = {};
    if (Number.isFinite(priceMin)) filter.price.$gte = priceMin;
    if (Number.isFinite(priceMax)) filter.price.$lte = priceMax;
  }

  const marginBelow = Number(query.marginBelow);
  if (Number.isFinite(marginBelow) && marginBelow > 0) {
    filter.$expr = {
      $and: [
        { $gt: ['$price', 0] },
        {
          $lt: [
            { $divide: [{ $subtract: ['$price', { $ifNull: ['$wholesalePrice', 0] }] }, '$price'] },
            marginBelow / 100,
          ],
        },
      ],
    };
  }

  if (query.noCategory === 'true') {
    const candidates = await Product.find(filter).select('mainCategory category').lean();
    const categoryCache = new Map();
    const badIds = [];
    for (const product of candidates) {
      // eslint-disable-next-line no-await-in-loop
      const diagnosis = await diagnoseProductCategory(product, categoryCache);
      if (!diagnosis.healthy) badIds.push(product._id);
    }
    filter._id = { $in: badIds };
  }

  return filter;
}

const isObjectId = (value) => mongoose.Types.ObjectId.isValid(value)
  && String(new mongoose.Types.ObjectId(value)) === value;

const buildSort = (sort) => {
  switch (sort) {
    case 'price-low': return { price: 1 };
    case 'price-high': return { price: -1 };
    case 'newest': return { createdAt: -1 };
    case 'best-selling': return { soldCount: -1, rating: -1 };
    case 'discount': return { discount: -1, price: 1 };
    case 'top': return { rating: -1 };
    default: return { createdAt: -1 };
  }
};

/** Default list sort when the client omits sort but asks for a ranked collection. */
const resolveProductListSort = (query = {}) => {
  if (query.sort) return query.sort;
  const section = String(query.section || '').trim();
  const source = String(query.productSource || '').trim();
  if (section === 'best-sellers' || source === 'best_sellers') return 'best-selling';
  return query.sort;
};

const applyProductSourceFilter = (filter, productSource) => {
  const source = String(productSource || '').trim();
  if (!source || source === 'all') return;

  switch (source) {
    case 'our_products':
      filter.isOurProduct = true;
      break;
    case 'offers':
      applyOffersOnlyFilter(filter);
      break;
    case 'best_sellers':
      // Top sellers are ranked by soldCount (sort=best-selling), not the isBestSeller badge flag.
      break;
    case 'new_arrivals':
      filter.isFeatured = true;
      break;
    default:
      break;
  }
};

const buildFilter = async (query, { includeSearch = true } = {}) => {
  const filter = { isActive: true };
  const {
    section, offers, q, brand, minPrice, maxPrice, minRating, minDiscount, inStock, productSource,
  } = query;

  await applyProductCategoryQueryToFilter(filter, query);

  if (brand) {
    const brandClause = await buildBrandProductFilterForQuery(Brand, brand);
    if (brandClause) Object.assign(filter, brandClause);
  }

  if (section) {
    if (section === 'offers') {
      applyOffersOnlyFilter(filter);
    } else if (section === 'top' || section === 'new-arrivals') {
      filter.isFeatured = true;
    } else if (section === 'best-sellers') {
      // No extra filter — best sellers are ranked by soldCount via sort=best-selling.
    } else {
      const categoryFilter = await resolveCategoryProductFilter(section);
      if (categoryFilter) filter.category = categoryFilter;
    }
  }

  applyProductSourceFilter(filter, productSource);
  if (offers === 'true') applyOffersOnlyFilter(filter);
  if (minPrice || maxPrice) {
    filter.price = {};
    if (minPrice) filter.price.$gte = Number(minPrice);
    if (maxPrice) filter.price.$lte = Number(maxPrice);
  }
  if (minRating) filter.rating = { $gte: Number(minRating) };
  if (minDiscount) filter.discount = { $gte: Number(minDiscount) };

  if (inStock === 'true') {
    filter.$and = [
      ...(filter.$and || []),
      {
        $or: [
          { stock: { $gt: 0 } },
          { variants: { $elemMatch: { stock: { $gt: 0 } } } },
        ],
      },
    ];
  }

  if (includeSearch && q?.trim()) {
    const rankedIds = await searchProductIds(q.trim());
    if (rankedIds) {
      filter.$and = [...(filter.$and || []), { _id: { $in: rankedIds } }];
      return filter;
    }
    const pattern = arabicSearchPattern(q.trim());
    const searchOr = [
      { nameAr: { $regex: pattern, $options: 'i' } },
      { nameEn: { $regex: pattern, $options: 'i' } },
      { slug: { $regex: pattern, $options: 'i' } },
      { brand: { $regex: pattern, $options: 'i' } },
      { brandAr: { $regex: pattern, $options: 'i' } },
      { brandEn: { $regex: pattern, $options: 'i' } },
      { searchKeywordsAr: { $regex: pattern, $options: 'i' } },
      { searchKeywordsEn: { $regex: pattern, $options: 'i' } },
    ];
    filter.$and = [...(filter.$and || []), { $or: searchOr }];
  }

  return filter;
};

const buildFilterForFacets = async (query, exclude = []) => {
  const q = { ...query };
  exclude.forEach((key) => { delete q[key]; });
  if (exclude.includes('mainCategory') || exclude.includes('subCategory')) {
    delete q.category;
  }
  return buildFilter(q, { includeSearch: true });
};

/** Build filter for one facet option: drop active facet selection, then apply the candidate value. */
const buildFacetOptionFilter = async (query, { apply = {}, exclude = [] } = {}) => {
  const q = { ...query };
  exclude.forEach((key) => { delete q[key]; });
  if (exclude.includes('mainCategory') || exclude.includes('subCategory')) {
    delete q.category;
  }
  return buildFilter({ ...q, ...apply }, { includeSearch: true });
};

const fetchProducts = async (filter, sort, page, limit, { useTextScore = false } = {}) => {
  const skip = (Number(page) - 1) * Number(limit);
  let sortObj = buildSort(sort);
  if (useTextScore) {
    sortObj = { score: { $meta: 'textScore' }, ...sortObj };
  }

  const [products, total] = await Promise.all([
    Product.find(filter)
      .populate('category', 'slug nameAr nameEn')
      .sort(sortObj)
      .skip(skip)
      .limit(Number(limit)),
    Product.countDocuments(filter),
  ]);

  return { products, total, page: Number(page), limit: Number(limit) };
};

export const getProductsByIds = asyncHandler(async (req, res) => {
  const rawIds = Array.isArray(req.body?.ids) ? req.body.ids : [];
  const validIds = [...new Set(rawIds.map(String).filter((id) => mongoose.Types.ObjectId.isValid(id)))];

  if (!validIds.length) {
    res.json({ success: true, data: [] });
    return;
  }

  const products = await Product.find({ _id: { $in: validIds }, isActive: true })
    .populate('category', 'slug nameAr nameEn');

  const order = new Map(validIds.map((id, index) => [id, index]));
  products.sort((a, b) => (order.get(String(a._id)) ?? 0) - (order.get(String(b._id)) ?? 0));

  res.json({
    success: true,
    data: products.map(formatProduct),
  });
});

export const getProducts = asyncHandler(async (req, res) => {
  const { page = 1, limit = 24, q } = req.query;
  const sort = resolveProductListSort(req.query);
  const baseFilter = await buildFilter(req.query, { includeSearch: false });

  let filter = baseFilter;
  let useTextScore = false;
  let rankedIds = null;

  if (q?.trim()) {
    const resolved = await resolveProductSearchFilter(baseFilter, q.trim(), Product, Category);
    filter = resolved.filter;
    useTextScore = resolved.useTextScore;
    rankedIds = resolved.rankedIds || null;
  }

  // No explicit sort on a search → most relevant first (search-engine order).
  const { products, total, page: p, limit: l } = rankedIds && (!sort || sort === 'relevance')
    ? {
      ...(await fetchRankedProducts(Product, filter, rankedIds, {
        page,
        limit,
        populate: ['category', 'slug nameAr nameEn'],
      })),
      page: Number(page),
      limit: Number(limit),
    }
    : await fetchProducts(filter, sort, page, limit, { useTextScore });

  res.json({
    success: true,
    data: products.map(formatProduct),
    pagination: {
      page: p,
      limit: l,
      total,
      pages: Math.ceil(total / l),
    },
  });
});

export const getProductFilters = asyncHandler(async (req, res) => {
  const query = req.query || {};

  const mains = await Category.find({ isActive: true, parentCategory: null })
    .sort({ sortOrder: 1, nameEn: 1 })
    .select('slug nameAr nameEn icon image color');

  const mainCategories = await Promise.all(
    mains.map(async (main) => {
      const filter = await buildFacetOptionFilter(query, {
        apply: { mainCategory: main.slug },
        exclude: ['mainCategory', 'subCategory', 'category'],
      });
      const count = await Product.countDocuments(filter);
      return {
        slug: main.slug,
        nameAr: main.nameAr,
        nameEn: main.nameEn,
        icon: main.icon,
        image: main.image,
        color: main.color,
        count,
      };
    }),
  );

  let subcategories = [];
  const mainSlug = query.mainCategory || query.main;
  if (mainSlug) {
    let main = await Category.findOne({ slug: mainSlug, isActive: true, parentCategory: null });
    if (!main) {
      main = await Category.findOne({ slug: mainSlug, isActive: true, level: CATEGORY_LEVEL.MAIN });
    }
    if (main) {
      const descendants = await getActiveDescendantsFlat(main._id);

      subcategories = await Promise.all(
        descendants.map(async (sub) => {
          const chain = await getCategoryChainFromId(sub._id);
          const parent = chain.length > 1 ? chain[chain.length - 2] : main;
          const filter = await buildFacetOptionFilter(query, {
            apply: { subCategory: sub.slug },
            exclude: ['subCategory', 'category', 'mainCategory'],
          });
          const count = await Product.countDocuments(filter);
          const pathPartsAr = chain.slice(1).map((c) => c.nameAr);
          const pathPartsEn = chain.slice(1).map((c) => c.nameEn);
          return {
            slug: sub.slug,
            nameAr: sub.nameAr,
            nameEn: sub.nameEn,
            icon: sub.icon,
            image: sub.image,
            color: sub.color,
            parentSlug: parent.slug,
            rootSlug: main.slug,
            depth: chain.length - 1,
            pathLabelAr: pathPartsAr.join(' › '),
            pathLabelEn: pathPartsEn.join(' › '),
            count,
          };
        }),
      );
    }
  }

  const brandFilter = await buildFilterForFacets(query, ['brand']);
  const brandAgg = await Product.aggregate([
    { $match: brandFilter },
    { $match: { brand: { $nin: [null, ''] } } },
    { $group: { _id: '$brand', count: { $sum: 1 } } },
    { $sort: { count: -1, _id: 1 } },
  ]);

  const priceFilter = await buildFilterForFacets(query, ['minPrice', 'maxPrice']);
  const priceRange = await Product.aggregate([
    { $match: priceFilter },
    { $group: { _id: null, minPrice: { $min: '$price' }, maxPrice: { $max: '$price' } } },
  ]);

  const appliedFilter = await buildFilter(query);
  const totalMatching = await Product.countDocuments(appliedFilter);
  const totalAllCategories = await Product.countDocuments(
    await buildFacetOptionFilter(query, { exclude: ['mainCategory', 'subCategory', 'category'] }),
  );

  const settingsDoc = await StoreSettings.findOne({ key: 'main' }).select('productFilterSettings').lean();
  const filterSettings = normalizeProductFilterSettings(settingsDoc?.productFilterSettings || {});
  const enabledSourceIds = filterSettings.sourceOptions
    .filter((opt) => opt.enabled !== false)
    .map((opt) => opt.id)
    .filter((id) => PRODUCT_SOURCE_OPTION_IDS.includes(id));

  const productSources = await Promise.all(
    enabledSourceIds.map(async (sourceId) => {
      const option = filterSettings.sourceOptions.find((row) => row.id === sourceId);
      const facetFilter = sourceId === 'all'
        ? await buildFacetOptionFilter(query, { exclude: ['productSource'] })
        : await buildFacetOptionFilter(query, {
          apply: { productSource: sourceId },
          exclude: ['productSource'],
        });
      const count = await Product.countDocuments(facetFilter);
      return {
        id: sourceId,
        labelAr: option?.labelAr || '',
        labelEn: option?.labelEn || '',
        count,
      };
    }),
  );

  res.json({
    success: true,
    mainCategories,
    subcategories,
    categories: mainCategories,
    brands: brandAgg.map((row) => ({ name: row._id, count: row.count })),
    priceRange: priceRange[0] || { minPrice: 0, maxPrice: 1000 },
    totalMatching,
    totalAllCategories,
    productSources,
    filterSettings,
  });
});

export const getProductById = asyncHandler(async (req, res) => {
  const query = isObjectId(req.params.id) ? { _id: req.params.id } : { slug: req.params.id };
  const product = await Product.findOne({ ...query, isActive: true })
    .populate('category', 'slug nameAr nameEn')
    .populate('reviews.user', 'name')
    .populate('reviews.adminReply.repliedBy', 'name')
    .populate('frequentlyBoughtTogether', 'nameAr nameEn slug price emoji images stock variants sku isActive')
    .lean();

  if (!product) throw new AppError('Product not found', 404);

  product._fbtProducts = (product.frequentlyBoughtTogether || [])
    .filter((p) => p?.isActive !== false)
    .map((p) => formatProduct(p));

  const fbtIds = (product.frequentlyBoughtTogether || []).map((p) => String(p?._id ?? p));
  product._relatedProducts = await buildSimilarProducts(product, { limit: 8, excludeIds: fbtIds });

  res.json({ success: true, data: formatProduct(product) });
});

export const getProductBySlug = getProductById;

export const getProductsByMainSub = asyncHandler(async (req, res) => {
  const main = await Category.findOne({
    slug: req.params.mainSlug,
    isActive: true,
    parentCategory: null,
  });
  if (!main) throw new AppError('Main category not found', 404);

  const sub = await Category.findOne({
    slug: req.params.subSlug,
    isActive: true,
    parentCategory: main._id,
  });
  if (!sub) throw new AppError('Sub category not found', 404);

  const { sort, page = 1, limit = 24 } = req.query;
  const filter = await buildFilter({ ...req.query, category: undefined, mainCategory: undefined, subCategory: undefined });
  filter.category = sub._id;

  const siblings = await getActiveChildren(main._id);
  const { products, total, page: p, limit: l } = await fetchProducts(filter, sort, page, limit);

  const formatSub = (c) => ({
    slug: c.slug,
    nameAr: c.nameAr,
    nameEn: c.nameEn,
    icon: c.icon,
    color: c.color,
    image: c.image,
  });

  res.json({
    success: true,
    categoryType: 'sub',
    mainCategory: {
      slug: main.slug,
      nameAr: main.nameAr,
      nameEn: main.nameEn,
      icon: main.icon,
      color: main.color,
      image: main.image,
    },
    category: {
      slug: sub.slug,
      nameAr: sub.nameAr,
      nameEn: sub.nameEn,
      icon: sub.icon,
      color: sub.color,
      image: sub.image,
    },
    parentCategory: {
      slug: main.slug,
      nameAr: main.nameAr,
      nameEn: main.nameEn,
      icon: main.icon,
    },
    subcategories: siblings.map(formatSub),
    data: products.map(formatProduct),
    pagination: { page: p, limit: l, total, pages: Math.ceil(total / l) },
  });
});

export const getProductsByCategory = asyncHandler(async (req, res) => {
  const category = await Category.findOne({ slug: req.params.slug, isActive: true });
  if (!category) throw new AppError('Category not found', 404);

  const children = await getActiveChildren(category._id);
  const chainDocs = await getCategoryChainFromId(category._id);
  const mainDoc = chainDocs[0] || category;
  const parentDoc = chainDocs.length > 1 ? chainDocs[chainDocs.length - 2] : null;
  const { sort, page = 1, limit = 24 } = req.query;

  const formatSub = (c, productCount = null) => ({
    slug: c.slug,
    nameAr: c.nameAr,
    nameEn: c.nameEn,
    icon: c.icon,
    color: c.color,
    image: c.image,
    level: c.level,
    ...(productCount != null ? { productCount } : {}),
  });

  if (children.length > 0) {
    const withCounts = await attachProductCounts(children);
    res.json({
      success: true,
      categoryType: category.level === 1 ? 'main' : 'branch',
      mainCategory: {
        slug: mainDoc.slug,
        nameAr: mainDoc.nameAr,
        nameEn: mainDoc.nameEn,
        icon: mainDoc.icon,
        color: mainDoc.color,
        image: mainDoc.image,
      },
      category: {
        slug: category.slug,
        nameAr: category.nameAr,
        nameEn: category.nameEn,
        icon: category.icon,
        color: category.color,
        image: category.image,
      },
      parentCategory: parentDoc
        ? { slug: parentDoc.slug, nameAr: parentDoc.nameAr, nameEn: parentDoc.nameEn, icon: parentDoc.icon }
        : null,
      chain: chainDocs.map((c) => ({
        slug: c.slug,
        nameAr: c.nameAr,
        nameEn: c.nameEn,
        level: c.level,
      })),
      subcategories: withCounts.map(({ sub, productCount }) => formatSub(sub, productCount)),
      data: [],
      pagination: { page: 1, limit: Number(limit), total: 0, pages: 0 },
    });
    return;
  }

  const chipSubcategories = parentDoc
    ? await getActiveChildren(parentDoc._id)
    : children;

  const filter = await buildFilter({ ...req.query, category: undefined });
  filter.category = category._id;

  const { products, total, page: p, limit: l } = await fetchProducts(filter, sort, page, limit);

  res.json({
    success: true,
    categoryType: 'leaf',
    mainCategory: {
      slug: mainDoc.slug,
      nameAr: mainDoc.nameAr,
      nameEn: mainDoc.nameEn,
      icon: mainDoc.icon,
      color: mainDoc.color,
      image: mainDoc.image,
    },
    category: {
      slug: category.slug,
      nameAr: category.nameAr,
      nameEn: category.nameEn,
      icon: category.icon,
      color: category.color,
      image: category.image,
    },
    parentCategory: parentDoc
      ? { slug: parentDoc.slug, nameAr: parentDoc.nameAr, nameEn: parentDoc.nameEn, icon: parentDoc.icon }
      : null,
    chain: chainDocs.map((c) => ({
      slug: c.slug,
      nameAr: c.nameAr,
      nameEn: c.nameEn,
      level: c.level,
    })),
    subcategories: chipSubcategories.map((c) => formatSub(c)),
    data: products.map(formatProduct),
    pagination: { page: p, limit: l, total, pages: Math.ceil(total / l) },
  });
});

export const getProductsByCategoryPath = asyncHandler(async (req, res) => {
  const slugs = parseSlugPathParam(req.params.slugPath);
  const chainDocs = await resolveCategoryChainBySlugs(slugs);
  const current = chainDocs[chainDocs.length - 1];
  const children = await getActiveChildren(current._id);

  if (children.length > 0) {
    throw new AppError('This category has subcategories — choose a deeper subcategory', 400);
  }

  const mainDoc = chainDocs[0];
  const parentDoc = chainDocs.length > 1 ? chainDocs[chainDocs.length - 2] : null;
  const { sort, page = 1, limit = 24 } = req.query;

  const formatSub = (c) => ({
    slug: c.slug,
    nameAr: c.nameAr,
    nameEn: c.nameEn,
    icon: c.icon,
    color: c.color,
    image: c.image,
    level: c.level,
  });

  const chipSubcategories = parentDoc
    ? await getActiveChildren(parentDoc._id)
    : [];

  const filter = await buildFilter({ ...req.query, category: undefined });
  filter.category = current._id;

  const { products, total, page: p, limit: l } = await fetchProducts(filter, sort, page, limit);

  res.json({
    success: true,
    slugPath: slugs.join('/'),
    categoryType: 'leaf',
    mainCategory: {
      slug: mainDoc.slug,
      nameAr: mainDoc.nameAr,
      nameEn: mainDoc.nameEn,
      icon: mainDoc.icon,
      color: mainDoc.color,
      image: mainDoc.image,
    },
    category: {
      slug: current.slug,
      nameAr: current.nameAr,
      nameEn: current.nameEn,
      icon: current.icon,
      color: current.color,
      image: current.image,
    },
    parentCategory: parentDoc
      ? { slug: parentDoc.slug, nameAr: parentDoc.nameAr, nameEn: parentDoc.nameEn, icon: parentDoc.icon }
      : null,
    chain: chainDocs.map((c) => ({
      slug: c.slug,
      nameAr: c.nameAr,
      nameEn: c.nameEn,
      level: c.level,
    })),
    subcategories: chipSubcategories.map(formatSub),
    data: products.map(formatProduct),
    pagination: { page: p, limit: l, total, pages: Math.ceil(total / l) },
  });
});

export const getOffers = asyncHandler(async (req, res) => {
  const { sort, page = 1, limit = 24, limitedTime } = req.query;

  if (limitedTime === 'true') {
    await syncTimedPromotionLifecycles();
    const result = await productsFromActiveLimitedPromotions({
      limit: Number(limit) || 24,
      sort: sort || 'discount',
      page: Number(page) || 1,
    });
    const p = Number(page) || 1;
    const l = Number(limit) || 24;
    return res.json({
      success: true,
      data: result.products,
      pagination: {
        page: p,
        limit: l,
        total: result.total,
        pages: Math.ceil(result.total / l) || 0,
      },
      meta: {
        countdownEnd: result.countdownEnd?.toISOString?.() || null,
      },
    });
  }

  req.query.offers = 'true';
  const filter = await buildFilter(req.query);
  const { products, total, page: p, limit: l } = await fetchProducts(filter, sort, page, limit);

  res.json({
    success: true,
    data: products.map(formatProduct),
    pagination: { page: p, limit: l, total, pages: Math.ceil(total / l) },
  });
});

export const getAdminStockSummary = asyncHandler(async (req, res) => {
  const threshold = await resolveStockThreshold(req.query);
  const baseFilter = {};

  if (req.query.isActive !== undefined && req.query.isActive !== '') {
    baseFilter.isActive = req.query.isActive === 'true';
  }

  await applyProductCategoryQueryToFilter(baseFilter, req.query);

  const [outOfStock, lowStock, belowThreshold, wellStocked, totalProducts] = await Promise.all([
    Product.countDocuments({ ...baseFilter, stock: 0 }),
    Product.countDocuments({ ...baseFilter, stock: { $gt: 0, $lte: threshold } }),
    Product.countDocuments({ ...baseFilter, stock: { $lte: threshold } }),
    Product.countDocuments({ ...baseFilter, stock: { $gt: threshold } }),
    Product.countDocuments(baseFilter),
  ]);

  res.json({
    success: true,
    data: {
      threshold,
      outOfStock,
      lowStock,
      belowThreshold,
      wellStocked,
      totalProducts,
    },
  });
});

export const getAdminProductsStats = asyncHandler(async (req, res) => {
  const threshold = await resolveStockThreshold(req.query);
  const filter = await buildAdminProductFilter(req.query);

  const [total, active, outOfStock, lowStock, valueAgg, categoryRows] = await Promise.all([
    Product.countDocuments(filter),
    Product.countDocuments({ ...filter, isActive: true }),
    Product.countDocuments({ ...filter, stock: 0 }),
    Product.countDocuments({ ...filter, stock: { $gt: 0, $lte: threshold } }),
    Product.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          retailValue: { $sum: { $multiply: ['$price', '$stock'] } },
          costValue: { $sum: { $multiply: [{ $ifNull: ['$wholesalePrice', 0] }, '$stock'] } },
          marginSum: {
            $sum: {
              $cond: [
                { $gt: ['$price', 0] },
                { $divide: [{ $subtract: ['$price', { $ifNull: ['$wholesalePrice', 0] }] }, '$price'] },
                0,
              ],
            },
          },
          marginCount: { $sum: { $cond: [{ $gt: ['$price', 0] }, 1, 0] } },
        },
      },
    ]),
    Product.find(filter).select('mainCategory category').lean(),
  ]);

  const { retailValue = 0, costValue = 0, marginSum = 0, marginCount = 0 } = valueAgg[0] || {};
  const avgMarginPct = marginCount > 0 ? Math.round((marginSum / marginCount) * 1000) / 10 : 0;

  const categoryCache = new Map();
  let noCategory = 0;
  for (const product of categoryRows) {
    // eslint-disable-next-line no-await-in-loop
    const diagnosis = await diagnoseProductCategory(product, categoryCache);
    if (!diagnosis.healthy) noCategory += 1;
  }

  res.json({
    success: true,
    data: {
      total,
      active,
      inactive: total - active,
      outOfStock,
      lowStock,
      noCategory,
      retailValue: Math.round(retailValue * 100) / 100,
      costValue: Math.round(costValue * 100) / 100,
      avgMarginPct,
      threshold,
    },
  });
});

export const getAdminProducts = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = await buildAdminProductFilter(req.query);
  const sort = parseAdminProductSort(req.query);

  const [products, total] = await Promise.all([
    Product.find(filter)
      .populate('category', 'slug nameAr nameEn')
      .populate('mainCategory', 'slug nameAr nameEn')
      .sort(sort)
      .skip(skip)
      .limit(limit),
    Product.countDocuments(filter),
  ]);

  const pathCache = new Map();
  const data = await Promise.all(products.map(async (product) => {
    const leafId = product.category?._id || product.category;
    const formatted = formatProduct(product);
    if (!leafId) {
      return {
        ...formatted,
        categoryPathAr: '',
        categoryPathEn: '',
        categoryPathSlugs: '',
        categoryIntegrityOk: false,
      };
    }

    const cacheKey = String(leafId);
    let chainMeta = pathCache.get(cacheKey);
    if (!chainMeta) {
      const chain = await getCategoryChainFromId(leafId);
      chainMeta = {
        categoryPathAr: chain.map((c) => c.nameAr).join(' › '),
        categoryPathEn: chain.map((c) => c.nameEn).join(' › '),
        categoryPathSlugs: chain.map((c) => c.slug).join('/'),
        rootId: chain[0]?._id,
        resolvedLeafId: chain[chain.length - 1]?._id,
      };
      pathCache.set(cacheKey, chainMeta);
    }

    const productMain = product.mainCategory?._id || product.mainCategory;
    const productSub = product.category?._id || product.category;

    return {
      ...formatted,
      categoryPathAr: chainMeta.categoryPathAr,
      categoryPathEn: chainMeta.categoryPathEn,
      categoryPathSlugs: chainMeta.categoryPathSlugs,
      categoryIntegrityOk: String(productMain) === String(chainMeta.rootId)
        && String(productSub) === String(chainMeta.resolvedLeafId),
    };
  }));

  res.json({
    success: true,
    data,
    pagination: paginationMeta(page, limit, total),
  });
});

export const bulkAdminProducts = asyncHandler(async (req, res) => {
  const { ids, action } = req.body;
  if (!Array.isArray(ids) || !ids.length) {
    throw new AppError('ids array is required', 400);
  }

  const filter = { _id: { $in: ids } };

  if (action === 'activate') {
    // Seller listings go live only through listing approval, never a bulk toggle.
    await Product.updateMany({ ...filter, seller: null }, { isActive: true });
  } else if (action === 'deactivate') {
    await Product.updateMany(filter, { isActive: false });
  } else if (action === 'delete') {
    const products = await Product.find(filter);
    await Promise.all(products.map((p) => deleteProductCloudinaryAssets(p)));
    await Product.deleteMany(filter);
  } else if (action === 'setCategory') {
    const categoryFields = await resolveProductCategoryFields({
      mainCategory: req.body.mainCategory,
      category: req.body.category ?? req.body.subCategory,
    });
    await Product.updateMany(filter, { $set: categoryFields });
  } else if (action === 'markOurProduct') {
    await Product.updateMany(filter, { isOurProduct: true });
  } else if (action === 'unmarkOurProduct') {
    await Product.updateMany(filter, { isOurProduct: false });
  } else {
    throw new AppError('Invalid action', 400);
  }

  res.json({ success: true, affected: ids.length });
});

export const duplicateAdminProduct = asyncHandler(async (req, res) => {
  const source = await Product.findById(req.params.id);
  if (!source) throw new AppError('Product not found', 404);

  let productSlug = source.slug;
  let n = 2;
  while (await Product.findOne({ slug: productSlug })) {
    productSlug = `${source.slug}-${n}`;
    n += 1;
  }

  const categoryFields = await resolveProductCategoryFields({
    mainCategory: source.mainCategory,
    category: source.category,
  });

  let categorySlug = '';
  if (categoryFields.category) {
    const cat = await Category.findById(categoryFields.category).select('slug').lean();
    categorySlug = cat?.slug || '';
  }

  const resolvedSku = await resolveProductSku({
    nameEn: source.nameEn,
    brand: source.brand,
    unit: source.unit,
    slug: productSlug,
    categorySlug,
  });

  const copy = await Product.create({
    nameAr: source.nameAr,
    nameEn: source.nameEn,
    slug: productSlug,
    descriptionAr: source.descriptionAr,
    descriptionEn: source.descriptionEn,
    price: source.price,
    wholesalePrice: source.wholesalePrice ?? 0,
    oldPrice: source.oldPrice,
    ...categoryFields,
    brand: source.brand,
    stock: source.stock,
    unit: source.unit,
    images: source.images || [],
    mediaTypes: source.mediaTypes || [],
    sku: resolvedSku,
    barcode: undefined,
    variants: (source.variants || []).map((v) => ({
      type: v.type,
      valueAr: v.valueAr,
      valueEn: v.valueEn,
      sku: buildVariantSku(resolvedSku, v.valueEn, v.valueAr) || undefined,
      barcode: undefined,
      price: v.price,
      wholesalePrice: v.wholesalePrice,
      oldPrice: v.oldPrice,
      stock: v.stock,
      isDefault: v.isDefault,
    })),
    specs: source.specs || [],
    frequentlyBoughtTogether: [],
    similarProducts: [],
    isFeatured: false,
    isOffer: source.isOffer,
    isBestSeller: false,
    isOurProduct: source.isOurProduct || false,
    isActive: false,
    emoji: source.emoji,
  });

  await copy.populate([
    { path: 'category', select: 'slug nameAr nameEn' },
    { path: 'mainCategory', select: 'slug nameAr nameEn' },
  ]);
  res.status(201).json({ success: true, data: formatProduct(copy) });
});

export const exportAdminProducts = asyncHandler(async (req, res) => {
  const filter = await buildAdminProductFilter(req.query);
  const sort = parseAdminProductSort(req.query);

  const products = await Product.find(filter)
    .populate('category', 'slug nameAr nameEn')
    .populate('mainCategory', 'slug nameAr nameEn')
    .sort(sort)
    .limit(5000);

  const categoryMetaById = await buildExportCategoryMetaMap(products);

  const csv = toCsv(products, [
    { header: 'slug', value: (p) => p.slug },
    { header: 'nameEn', value: (p) => p.nameEn },
    { header: 'nameAr', value: (p) => p.nameAr },
    {
      header: 'categoryPathSlugs',
      value: (p) => categoryMetaById.get(String(p._id))?.categoryPathSlugs || '',
    },
    {
      header: 'categoryPathEn',
      value: (p) => categoryMetaById.get(String(p._id))?.categoryPathEn || '',
    },
    {
      header: 'categoryPathAr',
      value: (p) => categoryMetaById.get(String(p._id))?.categoryPathAr || '',
    },
    {
      header: 'mainCategorySlug',
      value: (p) => categoryMetaById.get(String(p._id))?.mainCategorySlug || p.mainCategory?.slug || '',
    },
    {
      header: 'categorySlug',
      value: (p) => categoryMetaById.get(String(p._id))?.categorySlug || p.category?.slug || '',
    },
    { header: 'sku', value: (p) => p.sku || '' },
    { header: 'barcode', value: (p) => p.barcode || '' },
    { header: 'sellingPrice', value: (p) => p.price },
    { header: 'wholesalePrice', value: (p) => p.wholesalePrice ?? 0 },
    { header: 'stock', value: (p) => p.stock },
    { header: 'brand', value: (p) => p.brand || '' },
    { header: 'unit', value: (p) => p.unit || '' },
    { header: 'emoji', value: (p) => p.emoji || '' },
    { header: 'imageUrls', value: (p) => (p.images || []).join('|') },
    { header: 'descriptionEn', value: (p) => p.descriptionEn || '' },
    { header: 'descriptionAr', value: (p) => p.descriptionAr || '' },
    { header: 'isActive', value: (p) => p.isActive },
    { header: 'variantType', value: (p) => p.variants?.[0]?.type || '' },
    { header: 'variantValueEn', value: (p) => p.variants.map((v) => v.valueEn).join('|') },
    { header: 'variantValueAr', value: (p) => p.variants.map((v) => v.valueAr).join('|') },
    { header: 'variantSku', value: (p) => p.variants.map((v) => v.sku || '').join('|') },
    { header: 'variantPrice', value: (p) => p.variants.map((v) => v.price ?? p.price).join('|') },
    { header: 'variantStock', value: (p) => p.variants.map((v) => v.stock ?? 0).join('|') },
    { header: 'specKeyEn', value: (p) => p.specs.map((s) => s.keyEn || '').join('|') },
    { header: 'specValueEn', value: (p) => p.specs.map((s) => s.valueEn || '').join('|') },
    { header: 'specKeyAr', value: (p) => p.specs.map((s) => s.keyAr || '').join('|') },
    { header: 'specValueAr', value: (p) => p.specs.map((s) => s.valueAr || '').join('|') },
  ]);

  sendCsv(res, 'products.csv', csv);
});

export const getAdminProductById = asyncHandler(async (req, res) => {
  const linkSelect = 'nameAr nameEn slug brand price emoji images';
  const product = await Product.findById(req.params.id)
    .populate('category', 'slug nameAr nameEn')
    .populate('frequentlyBoughtTogether', linkSelect)
    .populate('similarProducts', linkSelect);

  if (!product) throw new AppError('Product not found', 404);

  const seed = (p) => ({
    _id: p._id,
    nameAr: p.nameAr,
    nameEn: p.nameEn,
    brand: p.brand,
    price: p.price,
    image: p.images?.[0] || p.emoji || null,
  });
  const data = formatProduct(product);
  data.linkedProducts = [
    ...(product.frequentlyBoughtTogether || []),
    ...(product.similarProducts || []),
  ]
    .filter((p) => p && typeof p === 'object' && p._id)
    .map(seed);

  res.json({ success: true, data });
});

export const createProduct = asyncHandler(async (req, res) => {
  const {
    nameAr,
    nameEn,
    slug,
    descriptionAr,
    descriptionEn,
    price,
    wholesalePrice,
    oldPrice,
    mainCategory,
    category,
    subCategory, // legacy client field name, treated as an alias of `category`
    brand,
    stock,
    unit,
    unitAr,
    unitEn,
    images,
    isFeatured,
    isOffer,
    isBestSeller,
    isOurProduct,
    isActive,
    emoji,
    sku,
    barcode,
    variants,
    specs,
    frequentlyBoughtTogether,
    similarProducts,
    similarMode,
  } = req.body;

  if (!nameAr || !nameEn || price == null) {
    throw new AppError('nameAr, nameEn, and price are required', 400);
  }

  const categoryFields = await resolveProductCategoryFields({
    mainCategory,
    category: category ?? subCategory,
  });
  const productSlug = slug || slugify(nameEn);

  const existing = await Product.findOne({ slug: productSlug });
  if (existing) throw new AppError('Product slug already exists', 400);

  let categorySlug = '';
  if (categoryFields.category) {
    const cat = await Category.findById(categoryFields.category).select('slug').lean();
    categorySlug = cat?.slug || '';
  }

  const resolvedSku = await resolveProductSku({
    sku,
    nameEn,
    brand,
    unit,
    slug: productSlug,
    categorySlug,
  });

  const product = await Product.create({
    nameAr,
    nameEn,
    slug: productSlug,
    descriptionAr,
    descriptionEn,
    price,
    wholesalePrice: wholesalePrice != null ? Number(wholesalePrice) : 0,
    oldPrice,
    ...categoryFields,
    brand,
    stock,
    unit,
    unitAr,
    unitEn,
    images,
    isFeatured,
    isOffer,
    isBestSeller,
    isOurProduct: isOurProduct === true || isOurProduct === 'true',
    isActive: isActive ?? true,
    emoji,
    sku: resolvedSku,
    barcode,
    variants: variants || [],
    specs: specs || [],
    frequentlyBoughtTogether: frequentlyBoughtTogether || [],
    similarProducts: similarProducts || [],
    similarMode: ['auto', 'manual', 'off'].includes(similarMode) ? similarMode : 'auto',
    createdBy: req.user?._id || null,
  });

  await product.populate([
    { path: 'category', select: 'slug nameAr nameEn' },
    { path: 'mainCategory', select: 'slug nameAr nameEn' },
  ]);

  await logAudit({
    req,
    action: 'create',
    entityType: 'product',
    entityId: product._id,
    entityLabel: product.nameEn || product.nameAr,
  });

  if (product.stock <= 10) {
    await checkInventoryAlert(product, null);
  }

  res.status(201).json({ success: true, data: formatProduct(product) });
});

const recordStockChange = (product, newStock) => {
  const next = Number(newStock);
  if (Number.isNaN(next) || next === product.stock) return;

  const entry = {
    previousStock: product.stock,
    stock: next,
    changedAt: new Date(),
  };
  product.stockHistory = [entry, ...(product.stockHistory || [])].slice(0, 20);
  product.stockUpdatedAt = entry.changedAt;
};

export const updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new AppError('Product not found', 404);

  const previousStock = product.stock;
  const before = {
    nameEn: product.nameEn,
    price: product.price,
    stock: product.stock,
    isActive: product.isActive,
  };

  const updates = { ...req.body };
  delete updates.subCategory; // legacy client field name — folded into `category` below

  const categoryTouched = ['mainCategory', 'category'].some(
    (key) => updates[key] !== undefined && updates[key] !== null && updates[key] !== '',
  ) || req.body.subCategory != null;
  if (categoryTouched) {
    const categoryFields = await resolveProductCategoryFields({
      mainCategory: updates.mainCategory ?? product.mainCategory,
      category: updates.category ?? req.body.subCategory ?? product.category,
    });
    Object.assign(updates, categoryFields);
  }

  if (updates.slug && updates.slug !== product.slug) {
    const exists = await Product.findOne({ slug: updates.slug, _id: { $ne: product._id } });
    if (exists) throw new AppError('Product slug already exists', 400);
  }

  if (updates.sku !== undefined) {
    const trimmed = updates.sku?.trim();
    if (trimmed) {
      const taken = await Product.findOne({ sku: trimmed, _id: { $ne: product._id } });
      if (taken) throw new AppError('SKU already in use', 400);
      updates.sku = trimmed;
    } else {
      let categorySlug = '';
      const leafId = updates.category || product.category;
      if (leafId) {
        const cat = await Category.findById(leafId).select('slug').lean();
        categorySlug = cat?.slug || '';
      }
      updates.sku = await resolveProductSku({
        nameEn: updates.nameEn ?? product.nameEn,
        brand: updates.brand ?? product.brand,
        unit: updates.unit ?? product.unit,
        slug: updates.slug ?? product.slug,
        categorySlug,
        excludeProductId: product._id,
      });
    }
  }

  if (updates.stock !== undefined) {
    recordStockChange(product, updates.stock);
  }

  if (updates.isOurProduct !== undefined) {
    updates.isOurProduct = updates.isOurProduct === true || updates.isOurProduct === 'true';
  }

  Object.assign(product, updates);
  await product.save();
  await product.populate([
    { path: 'category', select: 'slug nameAr nameEn' },
    { path: 'mainCategory', select: 'slug nameAr nameEn' },
  ]);

  await checkInventoryAlert(product, previousStock);

  const changes = pickChanges(before, {
    nameEn: product.nameEn,
    price: product.price,
    stock: product.stock,
    isActive: product.isActive,
  }, ['nameEn', 'price', 'stock', 'isActive']);

  if (changes) {
    await logAudit({
      req,
      action: 'update',
      entityType: 'product',
      entityId: product._id,
      entityLabel: product.nameEn || product.nameAr,
      changes,
    });
  }

  res.json({ success: true, data: formatProduct(product) });
});

export const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new AppError('Product not found', 404);

  const label = product.nameEn || product.nameAr;

  if (product.cloudinaryPublicIds?.length) {
    await deleteProductCloudinaryAssets(product);
  }

  await product.deleteOne();

  await logAudit({
    req,
    action: 'delete',
    entityType: 'product',
    entityId: product._id,
    entityLabel: label,
  });

  res.json({ success: true, message: 'Product deleted' });
});

export const uploadProductImages = asyncHandler(async (req, res) => {
  if (!req.files?.length) {
    throw new AppError('No media files uploaded', 400);
  }

  const uploaded = await uploadFilesToCloudinary(req.files, CLOUDINARY_FOLDERS.products);
  const { productId } = req.body;

  if (productId) {
    const product = await Product.findById(productId);
    if (!product) throw new AppError('Product not found', 404);

    appendProductMedia(product, uploaded);
    await product.save();

    return res.json({
      success: true,
      productId: product._id,
      images: uploaded,
      data: formatProduct(product),
    });
  }

  res.json({ success: true, images: uploaded });
});

export const reorderProductImages = asyncHandler(async (req, res) => {
  const { images } = req.body;
  if (!Array.isArray(images) || !images.length) {
    throw new AppError('images array is required', 400);
  }

  const product = await Product.findById(req.params.id);
  if (!product) throw new AppError('Product not found', 404);

  product.images = images.map((img) => img.url).filter(Boolean);
  product.cloudinaryPublicIds = images.map((img) => img.publicId || '');
  product.mediaTypes = images.map((img) => (img.type === 'video' ? 'video' : 'image'));

  await product.save();
  await product.populate('category', 'slug nameAr nameEn');

  res.json({ success: true, data: formatProduct(product) });
});

export const removeProductImage = asyncHandler(async (req, res) => {
  const { publicId } = req.body;

  if (!publicId) {
    throw new AppError('publicId is required', 400);
  }

  const product = await Product.findById(req.params.id);
  if (!product) throw new AppError('Product not found', 404);

  await removeProductImageByPublicId(product, publicId);
  await product.populate('category', 'slug nameAr nameEn');

  res.json({
    success: true,
    message: 'Image removed',
    data: formatProduct(product),
  });
});

function splitPipe(value) {
  if (!value) return [];
  return String(value).split('|').map((s) => s.trim()).filter(Boolean);
}

function buildVariantsFromRow(row, basePrice) {
  const type = row.variantType?.trim();
  const valuesEn = splitPipe(row.variantValueEn);
  if (!type || !valuesEn.length) return [];

  const valuesAr = splitPipe(row.variantValueAr);
  const skus = splitPipe(row.variantSku);
  const prices = splitPipe(row.variantPrice);
  const stocks = splitPipe(row.variantStock);

  return valuesEn.map((valueEn, i) => ({
    type,
    valueEn,
    valueAr: valuesAr[i] || valueEn,
    sku: skus[i] || undefined,
    price: prices[i] ? Number(prices[i]) : Number(basePrice),
    stock: stocks[i] ? Number(stocks[i]) : 0,
    isDefault: i === 0,
  }));
}

function buildSpecsFromRow(row) {
  const keysEn = splitPipe(row.specKeyEn);
  const valsEn = splitPipe(row.specValueEn);
  const keysAr = splitPipe(row.specKeyAr);
  const valsAr = splitPipe(row.specValueAr);

  if (!keysEn.length) return [];

  return keysEn.map((keyEn, i) => ({
    keyEn,
    keyAr: keysAr[i] || keyEn,
    valueEn: valsEn[i] || '',
    valueAr: valsAr[i] || valsEn[i] || '',
  }));
}

export const importAdminProducts = asyncHandler(async (req, res) => {
  const csvText = req.body.csv || req.body.data;
  if (!csvText?.trim()) throw new AppError('CSV data is required', 400);

  const { records } = parseCsv(csvText.replace(/^\uFEFF/, ''));
  let created = 0;
  let updated = 0;
  const errors = [];

  for (let i = 0; i < records.length; i += 1) {
    const row = records[i];
    try {
      const slug = row.slug || slugify(row.nameEn || row.nameAr);
      if (!slug || !row.nameEn || !row.nameAr) {
        throw new Error('slug, nameEn, and nameAr are required');
      }

      const categoryFields = await resolveProductCategoryFieldsFromImport(row);

      const images = splitPipe(row.imageUrls);
      const variants = buildVariantsFromRow(row, row.sellingPrice || row.price);
      const specs = buildSpecsFromRow(row);

      const payload = {
        nameEn: row.nameEn,
        nameAr: row.nameAr,
        slug,
        descriptionEn: row.descriptionEn || '',
        descriptionAr: row.descriptionAr || '',
        ...categoryFields,
        sku: row.sku || undefined,
        barcode: row.barcode || undefined,
        price: Number(row.sellingPrice || row.price || 0),
        wholesalePrice: Number(row.wholesalePrice || 0),
        stock: Number(row.stock || 0),
        brand: row.brand || 'MarketPlus',
        unit: row.unit || 'piece',
        emoji: row.emoji || '🛍️',
        images,
        isActive: row.isActive !== 'false' && row.isActive !== '0',
        variants,
        specs,
      };

      const existing = await Product.findOne({ slug });
      if (existing) {
        Object.assign(existing, payload);
        await existing.save();
        updated += 1;
      } else {
        await Product.create(payload);
        created += 1;
      }
    } catch (err) {
      const message = err instanceof AppError ? err.message : (err.message || 'Import failed');
      errors.push({ row: i + 2, slug: row.slug || row.nameEn || '', message });
    }
  }

  res.json({
    success: true,
    created,
    updated,
    errors,
    total: records.length,
  });
});

export const suggestProductSku = asyncHandler(async (req, res) => {
  const {
    nameEn = '',
    brand = '',
    unit = '',
    slug = '',
    categorySlug = '',
    excludeProductId,
    seed,
    barcodeOnly,
  } = req.body;

  if (barcodeOnly) {
    const barcode = generateBarcodeFromSeed(seed || slug || nameEn || Date.now());
    return res.json({ success: true, barcode });
  }

  const candidates = buildSkuCandidates({ nameEn, brand, unit, slug, categorySlug });
  const availability = await Promise.all(
    candidates.map(async (sku) => ({
      sku,
      available: await isSkuAvailable(sku, excludeProductId),
    })),
  );

  const availableSkus = availability.filter((row) => row.available).map((row) => row.sku);
  const recommended = availableSkus[0]
    || await findFirstAvailableSku(candidates, excludeProductId);

  res.json({
    success: true,
    suggestions: availableSkus.length ? availableSkus : candidates,
    recommended,
  });
});

export const checkProductSku = asyncHandler(async (req, res) => {
  const sku = String(req.query.sku || '').trim();
  const excludeProductId = req.query.excludeId || undefined;

  if (!sku) {
    return res.json({ success: true, available: false });
  }

  const available = await isSkuAvailable(sku, excludeProductId);
  res.json({ success: true, available });
});

export const getProductCategoryIntegrity = asyncHandler(async (req, res) => {
  const sampleLimit = Math.min(Number(req.query.sampleLimit) || 50, 200);
  const report = await scanProductCategoryIntegrity({ sampleLimit });
  res.json({ success: true, data: report });
});

export const repairProductCategoryIntegrity = asyncHandler(async (req, res) => {
  const dryRun = req.body.dryRun === true || req.query.dryRun === 'true';
  const productIds = Array.isArray(req.body.productIds) ? req.body.productIds : null;

  const result = productIds?.length
    ? await repairProductCategories({ dryRun, productIds })
    : await repairCategoryLinks({ dryRun });

  await logAudit({
    req,
    action: dryRun ? 'preview' : 'repair',
    entityType: 'product_category_integrity',
    entityId: null,
    entityLabel: productIds?.length
      ? `${productIds.length} products`
      : 'all products',
    changes: {
      dryRun,
      ...result,
      results: undefined,
    },
  });

  res.json({ success: true, data: result });
});
