import mongoose from 'mongoose';
import Product from '../models/Product.js';
import Category from '../models/Category.js';
import { AppError } from '../utils/AppError.js';
import { formatProduct } from '../utils/formatters.js';
import { slugify } from '../utils/slugify.js';
import {
  uploadFilesToCloudinary,
  deleteManyFromCloudinary,
  appendProductImages,
  removeProductImageByPublicId,
  CLOUDINARY_FOLDERS,
} from '../utils/cloudinaryUpload.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { parsePagination, parseSort, paginationMeta } from '../utils/listQuery.js';
import { toCsv, sendCsv } from '../utils/csvExport.js';
import { logAudit, pickChanges } from '../services/auditLog.service.js';
import { checkInventoryAlert } from '../services/inventoryAlert.service.js';

const ADMIN_PRODUCT_SORT = ['createdAt', 'nameEn', 'price', 'stock'];

async function buildAdminProductFilter(query) {
  const filter = {};

  if (query.isActive !== undefined && query.isActive !== '') {
    filter.isActive = query.isActive === 'true';
  }
  if (query.category) {
    const categoryId = await resolveCategoryRef(query.category);
    if (categoryId) filter.category = categoryId;
  }
  if (query.stock === 'low') filter.stock = { $lte: 10, $gt: 0 };
  else if (query.stock === 'out') filter.stock = 0;
  else if (query.stock === 'in') filter.stock = { $gt: 10 };

  if (query.q) {
    filter.$or = [
      { nameAr: { $regex: query.q, $options: 'i' } },
      { nameEn: { $regex: query.q, $options: 'i' } },
      { slug: { $regex: query.q, $options: 'i' } },
      { brand: { $regex: query.q, $options: 'i' } },
    ];
  }

  return filter;
}

const isObjectId = (value) => mongoose.Types.ObjectId.isValid(value)
  && String(new mongoose.Types.ObjectId(value)) === value;

const resolveCategoryRef = async (categoryRef) => {
  if (!categoryRef) return null;
  if (isObjectId(categoryRef)) return categoryRef;
  const category = await Category.findOne({ slug: categoryRef });
  return category?._id || null;
};

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

const resolveCategoryId = async (slug) => {
  if (!slug) return null;
  const cat = await Category.findOne({ slug, isActive: true }).select('_id');
  return cat?._id || null;
};

const buildFilter = async (query) => {
  const filter = { isActive: true };
  const { category, section, offers, q, brand, minPrice, maxPrice, minRating } = query;

  if (category) {
    const categoryId = await resolveCategoryId(category);
    if (categoryId) filter.category = categoryId;
  }

  if (brand) filter.brand = brand;

  if (section) {
    if (section === 'offers') {
      filter.isOffer = true;
    } else if (section === 'top') {
      filter.isFeatured = true;
    } else {
      const categoryId = await resolveCategoryId(section);
      if (categoryId) filter.category = categoryId;
    }
  }

  if (offers === 'true') filter.isOffer = true;
  if (minPrice || maxPrice) {
    filter.price = {};
    if (minPrice) filter.price.$gte = Number(minPrice);
    if (maxPrice) filter.price.$lte = Number(maxPrice);
  }
  if (minRating) filter.rating = { $gte: Number(minRating) };
  if (q) {
    filter.$or = [
      { nameAr: { $regex: q, $options: 'i' } },
      { nameEn: { $regex: q, $options: 'i' } },
      { slug: { $regex: q, $options: 'i' } },
      { brand: { $regex: q, $options: 'i' } },
    ];
  }

  return filter;
};

const fetchProducts = async (filter, sort, page, limit) => {
  const skip = (Number(page) - 1) * Number(limit);
  const [products, total] = await Promise.all([
    Product.find(filter)
      .populate('category', 'slug nameAr nameEn')
      .sort(buildSort(sort))
      .skip(skip)
      .limit(Number(limit)),
    Product.countDocuments(filter),
  ]);

  return { products, total, page: Number(page), limit: Number(limit) };
};

export const getProducts = asyncHandler(async (req, res) => {
  const { sort, page = 1, limit = 24 } = req.query;
  const filter = await buildFilter(req.query);
  const { products, total, page: p, limit: l } = await fetchProducts(filter, sort, page, limit);

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

export const getProductFilters = asyncHandler(async (_req, res) => {
  const [categories, brands, priceRange] = await Promise.all([
    Category.find({ isActive: true, parentCategory: null }).sort({ sortOrder: 1 }).select('slug nameAr nameEn icon image'),
    Product.distinct('brand', { isActive: true, brand: { $ne: null, $ne: '' } }),
    Product.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: null, minPrice: { $min: '$price' }, maxPrice: { $max: '$price' } } },
    ]),
  ]);

  res.json({
    success: true,
    categories: categories.map((c) => ({
      slug: c.slug,
      nameAr: c.nameAr,
      nameEn: c.nameEn,
      icon: c.icon,
      image: c.image,
    })),
    brands: brands.filter(Boolean).sort(),
    priceRange: priceRange[0] || { minPrice: 0, maxPrice: 1000 },
  });
});

export const getProductById = asyncHandler(async (req, res) => {
  const query = isObjectId(req.params.id) ? { _id: req.params.id } : { slug: req.params.id };
  const product = await Product.findOne({ ...query, isActive: true })
    .populate('category', 'slug nameAr nameEn')
    .populate('subCategory', 'slug nameAr nameEn');

  if (!product) throw new AppError('Product not found', 404);
  res.json({ success: true, data: formatProduct(product) });
});

export const getProductBySlug = getProductById;

export const getProductsByCategory = asyncHandler(async (req, res) => {
  const category = await Category.findOne({ slug: req.params.slug, isActive: true });
  if (!category) throw new AppError('Category not found', 404);

  const children = await Category.find({ parentCategory: category._id, isActive: true }).sort({ sortOrder: 1 });
  const parentDoc = category.parentCategory
    ? await Category.findById(category.parentCategory).select('slug nameAr nameEn icon color')
    : null;

  const chipSubcategories = parentDoc
    ? await Category.find({ parentCategory: parentDoc._id, isActive: true }).sort({ sortOrder: 1 })
    : children;

  const categoryIds = children.length > 0
    ? [category._id, ...children.map((c) => c._id)]
    : [category._id];

  const { sort, page = 1, limit = 24 } = req.query;
  const filter = await buildFilter({ ...req.query, category: undefined });
  filter.category = { $in: categoryIds };

  const { products, total, page: p, limit: l } = await fetchProducts(filter, sort, page, limit);

  res.json({
    success: true,
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
    subcategories: chipSubcategories.map((c) => ({
      slug: c.slug,
      nameAr: c.nameAr,
      nameEn: c.nameEn,
      icon: c.icon,
      color: c.color,
    })),
    data: products.map(formatProduct),
    pagination: { page: p, limit: l, total, pages: Math.ceil(total / l) },
  });
});

export const getOffers = asyncHandler(async (req, res) => {
  req.query.offers = 'true';
  const filter = await buildFilter(req.query);
  const { sort, page = 1, limit = 24 } = req.query;
  const { products, total, page: p, limit: l } = await fetchProducts(filter, sort, page, limit);

  res.json({
    success: true,
    data: products.map(formatProduct),
    pagination: { page: p, limit: l, total, pages: Math.ceil(total / l) },
  });
});

export const getAdminProducts = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = await buildAdminProductFilter(req.query);
  const sort = parseSort(req.query, ADMIN_PRODUCT_SORT);

  const [products, total] = await Promise.all([
    Product.find(filter)
      .populate('category', 'slug nameAr nameEn')
      .populate('subCategory', 'slug nameAr nameEn')
      .sort(sort)
      .skip(skip)
      .limit(limit),
    Product.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: products.map(formatProduct),
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
    await Product.updateMany(filter, { isActive: true });
  } else if (action === 'deactivate') {
    await Product.updateMany(filter, { isActive: false });
  } else if (action === 'delete') {
    const products = await Product.find(filter);
    const publicIds = products.flatMap((p) => p.cloudinaryPublicIds || []);
    if (publicIds.length) await deleteManyFromCloudinary(publicIds);
    await Product.deleteMany(filter);
  } else {
    throw new AppError('Invalid action', 400);
  }

  res.json({ success: true, affected: ids.length });
});

export const duplicateAdminProduct = asyncHandler(async (req, res) => {
  const source = await Product.findById(req.params.id);
  if (!source) throw new AppError('Product not found', 404);

  const baseSlug = `${source.slug}-copy`;
  let productSlug = baseSlug;
  let n = 1;
  while (await Product.findOne({ slug: productSlug })) {
    productSlug = `${baseSlug}-${n}`;
    n += 1;
  }

  const copy = await Product.create({
    nameAr: `${source.nameAr} (نسخة)`,
    nameEn: `${source.nameEn} (copy)`,
    slug: productSlug,
    descriptionAr: source.descriptionAr,
    descriptionEn: source.descriptionEn,
    price: source.price,
    wholesalePrice: source.wholesalePrice ?? 0,
    oldPrice: source.oldPrice,
    category: source.category,
    subCategory: source.subCategory,
    brand: source.brand,
    stock: source.stock,
    unit: source.unit,
    images: source.images || [],
    isFeatured: false,
    isOffer: source.isOffer,
    isActive: false,
    emoji: source.emoji,
  });

  await copy.populate('category', 'slug nameAr nameEn');
  res.status(201).json({ success: true, data: formatProduct(copy) });
});

export const exportAdminProducts = asyncHandler(async (req, res) => {
  const filter = await buildAdminProductFilter(req.query);
  const sort = parseSort(req.query, ADMIN_PRODUCT_SORT);

  const products = await Product.find(filter)
    .populate('category', 'slug nameAr nameEn')
    .sort(sort)
    .limit(5000);

  const csv = toCsv(products, [
    { header: 'ID', value: (p) => p._id },
    { header: 'Name EN', value: (p) => p.nameEn },
    { header: 'Name AR', value: (p) => p.nameAr },
    { header: 'Slug', value: (p) => p.slug },
    { header: 'Category', value: (p) => p.category?.slug || '' },
    { header: 'Selling price', value: (p) => p.price },
    { header: 'Wholesale price', value: (p) => p.wholesalePrice ?? 0 },
    { header: 'Stock', value: (p) => p.stock },
    { header: 'Active', value: (p) => p.isActive },
    { header: 'Brand', value: (p) => p.brand || '' },
  ]);

  sendCsv(res, 'products.csv', csv);
});

export const getAdminProductById = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id)
    .populate('category', 'slug nameAr nameEn')
    .populate('subCategory', 'slug nameAr nameEn');

  if (!product) throw new AppError('Product not found', 404);
  res.json({ success: true, data: formatProduct(product) });
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
    category,
    subCategory,
    brand,
    stock,
    unit,
    images,
    isFeatured,
    isOffer,
    isActive,
    emoji,
  } = req.body;

  if (!nameAr || !nameEn || price == null || !category) {
    throw new AppError('nameAr, nameEn, price, and category are required', 400);
  }

  const categoryId = await resolveCategoryRef(category);
  if (!categoryId) throw new AppError('Category not found', 400);

  const subCategoryId = subCategory ? await resolveCategoryRef(subCategory) : null;
  const productSlug = slug || slugify(nameEn);

  const existing = await Product.findOne({ slug: productSlug });
  if (existing) throw new AppError('Product slug already exists', 400);

  const product = await Product.create({
    nameAr,
    nameEn,
    slug: productSlug,
    descriptionAr,
    descriptionEn,
    price,
    wholesalePrice: wholesalePrice != null ? Number(wholesalePrice) : 0,
    oldPrice,
    category: categoryId,
    subCategory: subCategoryId,
    brand,
    stock,
    unit,
    images,
    isFeatured,
    isOffer,
    isActive: isActive ?? true,
    emoji,
  });

  await product.populate('category', 'slug nameAr nameEn');

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
  if (updates.category) {
    updates.category = await resolveCategoryRef(updates.category);
    if (!updates.category) throw new AppError('Category not found', 400);
  }
  if (updates.subCategory) {
    updates.subCategory = await resolveCategoryRef(updates.subCategory);
  }
  if (updates.slug && updates.slug !== product.slug) {
    const exists = await Product.findOne({ slug: updates.slug, _id: { $ne: product._id } });
    if (exists) throw new AppError('Product slug already exists', 400);
  }

  if (updates.stock !== undefined) {
    recordStockChange(product, updates.stock);
  }

  Object.assign(product, updates);
  await product.save();
  await product.populate('category', 'slug nameAr nameEn');

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
    await deleteManyFromCloudinary(product.cloudinaryPublicIds);
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
    throw new AppError('No images uploaded', 400);
  }

  const uploaded = await uploadFilesToCloudinary(req.files, CLOUDINARY_FOLDERS.products);
  const { productId } = req.body;

  if (productId) {
    const product = await Product.findById(productId);
    if (!product) throw new AppError('Product not found', 404);

    appendProductImages(product, uploaded);
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
