import Brand from '../models/Brand.js';
import Product from '../models/Product.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { parsePagination, parseSort, paginationMeta } from '../utils/listQuery.js';
import { slugify } from '../utils/slugify.js';
import {
  uploadFileToCloudinary,
  deleteFromCloudinary,
  CLOUDINARY_FOLDERS,
} from '../utils/cloudinaryUpload.js';
import { DEFAULT_BRANDS } from '../constants/defaultBrands.js';
import { repairProductBrands } from '../utils/repairProductBrands.js';
import { countActiveProductsForBrand } from '../utils/brandProductFilter.js';

const ADMIN_BRAND_SORT = ['sortOrder', 'nameEn', 'nameAr', 'createdAt'];

const parseOptionalBoolean = (value, fallback) => {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  return value === 'true' || value === '1';
};

const parseOptionalNumber = (value, fallback) => {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? fallback : parsed;
};

export function formatBrand(brand, productCount = null) {
  const row = brand.toObject ? brand.toObject() : brand;
  return {
    _id: row._id,
    slug: row.slug,
    nameAr: row.nameAr,
    nameEn: row.nameEn,
    queryValue: row.queryValue,
    emoji: row.emoji || '🏷️',
    logo: row.logo || null,
    descriptionAr: row.descriptionAr || '',
    descriptionEn: row.descriptionEn || '',
    website: row.website || '',
    sortOrder: row.sortOrder ?? 0,
    isActive: row.isActive !== false,
    isFeatured: !!row.isFeatured,
    productCount: typeof productCount === 'number' ? productCount : row.productCount ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function countProductsForBrand(brand) {
  return countActiveProductsForBrand(Product, Brand, brand);
}

async function attachProductCounts(brands) {
  if (!brands.length) return [];
  return Promise.all(
    brands.map(async (brand) => ({
      brand,
      productCount: await countProductsForBrand(brand),
    })),
  );
}

export async function ensureDefaultBrands() {
  const count = await Brand.countDocuments();
  if (count > 0) return;
  await Brand.insertMany(
    DEFAULT_BRANDS.map((row) => ({
      ...row,
      isActive: true,
      isFeatured: row.isFeatured ?? false,
    })),
  );
}

function buildAdminBrandFilter(query) {
  const filter = {};
  if (query.isActive !== undefined && query.isActive !== '') {
    filter.isActive = query.isActive === 'true';
  }
  if (query.isFeatured !== undefined && query.isFeatured !== '') {
    filter.isFeatured = query.isFeatured === 'true';
  }
  if (query.q) {
    const rx = { $regex: query.q, $options: 'i' };
    filter.$or = [
      { nameAr: rx },
      { nameEn: rx },
      { slug: rx },
      { queryValue: rx },
    ];
  }
  return filter;
}

export const getPublicBrands = asyncHandler(async (req, res) => {
  await ensureDefaultBrands();
  const filter = { isActive: true };
  if (req.query.featured === 'true') filter.isFeatured = true;

  const brands = await Brand.find(filter).sort({ sortOrder: 1, nameEn: 1 });
  const withCounts = await attachProductCounts(brands);

  res.json({
    success: true,
    data: withCounts.map(({ brand, productCount }) => formatBrand(brand, productCount)),
  });
});

export const getAdminBrands = asyncHandler(async (req, res) => {
  await ensureDefaultBrands();
  const { page, limit, skip } = parsePagination(req.query);
  const filter = buildAdminBrandFilter(req.query);
  const sort = parseSort(req.query, ADMIN_BRAND_SORT);

  const [brands, total] = await Promise.all([
    Brand.find(filter).sort(sort).skip(skip).limit(limit),
    Brand.countDocuments(filter),
  ]);
  const withCounts = await attachProductCounts(brands);

  res.json({
    success: true,
    data: withCounts.map(({ brand, productCount }) => formatBrand(brand, productCount)),
    pagination: paginationMeta(page, limit, total),
  });
});

export const getAdminBrandStats = asyncHandler(async (_req, res) => {
  await ensureDefaultBrands();
  const [total, active, featured] = await Promise.all([
    Brand.countDocuments(),
    Brand.countDocuments({ isActive: true }),
    Brand.countDocuments({ isActive: true, isFeatured: true }),
  ]);
  const productBrandAgg = await Product.distinct('brand', { isActive: true, brand: { $nin: [null, ''] } });
  res.json({
    success: true,
    data: {
      total,
      active,
      featured,
      productBrandValues: productBrandAgg.length,
    },
  });
});

export const createBrand = asyncHandler(async (req, res) => {
  const {
    nameAr,
    nameEn,
    slug,
    queryValue,
    emoji,
    descriptionAr,
    descriptionEn,
    website,
    sortOrder,
    isActive,
    isFeatured,
    logo,
  } = req.body;

  if (!nameAr || !nameEn) {
    throw new AppError('nameAr and nameEn are required', 400);
  }

  const brandSlug = (slug || slugify(nameEn)).toLowerCase().trim();
  const existingSlug = await Brand.findOne({ slug: brandSlug });
  if (existingSlug) throw new AppError('Brand slug already exists', 400);

  const filterValue = (queryValue || nameEn).trim();
  let logoUrl = logo || null;
  let cloudinaryPublicId = null;

  if (req.file) {
    try {
      const uploaded = await uploadFileToCloudinary(req.file, `${CLOUDINARY_FOLDERS.store}/brands`);
      logoUrl = uploaded.url;
      cloudinaryPublicId = uploaded.publicId;
    } catch {
      throw new AppError('Logo upload failed — configure Cloudinary or provide logo URL', 400);
    }
  }

  const brand = await Brand.create({
    nameAr,
    nameEn,
    slug: brandSlug,
    queryValue: filterValue,
    emoji: emoji || '🏷️',
    logo: logoUrl,
    cloudinaryPublicId,
    descriptionAr: descriptionAr || '',
    descriptionEn: descriptionEn || '',
    website: website || '',
    sortOrder: parseOptionalNumber(sortOrder, 0),
    isActive: parseOptionalBoolean(isActive, true),
    isFeatured: parseOptionalBoolean(isFeatured, false),
    createdBy: req.user?._id || null,
  });

  const productCount = await countProductsForBrand(brand);
  res.status(201).json({ success: true, data: formatBrand(brand, productCount) });
});

export const updateBrand = asyncHandler(async (req, res) => {
  const brand = await Brand.findById(req.params.id);
  if (!brand) throw new AppError('Brand not found', 404);

  if (req.body.slug && req.body.slug !== brand.slug) {
    const exists = await Brand.findOne({ slug: req.body.slug, _id: { $ne: brand._id } });
    if (exists) throw new AppError('Brand slug already exists', 400);
  }

  if (req.file) {
    try {
      if (brand.cloudinaryPublicId) {
        await deleteFromCloudinary(brand.cloudinaryPublicId).catch(() => {});
      }
      const uploaded = await uploadFileToCloudinary(req.file, `${CLOUDINARY_FOLDERS.store}/brands`);
      brand.logo = uploaded.url;
      brand.cloudinaryPublicId = uploaded.publicId;
    } catch {
      throw new AppError('Logo upload failed', 400);
    }
  } else if (req.body.clearLogo === 'true' || req.body.clearLogo === true) {
    if (brand.cloudinaryPublicId) {
      await deleteFromCloudinary(brand.cloudinaryPublicId).catch(() => {});
    }
    brand.logo = null;
    brand.cloudinaryPublicId = null;
  } else if (req.body.logo !== undefined) {
    brand.logo = req.body.logo || null;
  }

  const fields = [
    'nameAr', 'nameEn', 'slug', 'queryValue', 'emoji',
    'descriptionAr', 'descriptionEn', 'website', 'sortOrder',
  ];
  fields.forEach((key) => {
    if (req.body[key] !== undefined) brand[key] = req.body[key];
  });
  if (req.body.isActive !== undefined) brand.isActive = parseOptionalBoolean(req.body.isActive, brand.isActive);
  if (req.body.isFeatured !== undefined) brand.isFeatured = parseOptionalBoolean(req.body.isFeatured, brand.isFeatured);

  if (!brand.queryValue?.trim()) {
    brand.queryValue = brand.nameEn;
  }

  await brand.save();
  const productCount = await countProductsForBrand(brand);
  res.json({ success: true, data: formatBrand(brand, productCount) });
});

export const deleteBrand = asyncHandler(async (req, res) => {
  const brand = await Brand.findById(req.params.id);
  if (!brand) throw new AppError('Brand not found', 404);
  if (brand.cloudinaryPublicId) {
    await deleteFromCloudinary(brand.cloudinaryPublicId).catch(() => {});
  }
  await brand.deleteOne();
  res.json({ success: true, message: 'Brand deleted' });
});

export const bulkAdminBrands = asyncHandler(async (req, res) => {
  const { ids, action } = req.body;
  if (!Array.isArray(ids) || !ids.length) {
    throw new AppError('ids array is required', 400);
  }
  const filter = { _id: { $in: ids } };
  if (action === 'activate') await Brand.updateMany(filter, { isActive: true });
  else if (action === 'deactivate') await Brand.updateMany(filter, { isActive: false });
  else if (action === 'feature') await Brand.updateMany(filter, { isFeatured: true });
  else if (action === 'unfeature') await Brand.updateMany(filter, { isFeatured: false });
  else if (action === 'delete') await Brand.deleteMany(filter);
  else throw new AppError('Invalid action', 400);
  res.json({ success: true, affected: ids.length });
});

export const syncBrandsFromProducts = asyncHandler(async (_req, res) => {
  const distinct = await Product.distinct('brand', { isActive: true, brand: { $nin: [null, ''] } });
  const existing = await Brand.find({ queryValue: { $in: distinct } }).select('queryValue');
  const existingSet = new Set(existing.map((b) => b.queryValue));
  const missing = distinct.filter((name) => !existingSet.has(name));

  let created = 0;
  for (const name of missing) {
    let slug = slugify(name);
    let attempt = slug;
    let i = 1;
    while (await Brand.findOne({ slug: attempt })) {
      attempt = `${slug}-${i}`;
      i += 1;
    }
    await Brand.create({
      nameAr: name,
      nameEn: name,
      slug: attempt,
      queryValue: name,
      emoji: '🏷️',
      isActive: true,
      sortOrder: 100 + created,
    });
    created += 1;
  }

  res.json({
    success: true,
    created,
    message: created
      ? `Imported ${created} brand(s) from products`
      : 'All product brands are already in the catalog',
  });
});

export const repairProductBrandLinks = asyncHandler(async (req, res) => {
  const dryRun = req.body?.dryRun === true || req.query?.dryRun === 'true';
  const result = await repairProductBrands({ dryRun });
  res.json({
    success: true,
    dryRun,
    data: result,
    message: dryRun
      ? `Would fix ${result.productsWouldFix || result.productsFixed} product(s)`
      : `Fixed ${result.productsFixed} product(s)`,
  });
});
