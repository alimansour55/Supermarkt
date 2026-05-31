import Category from '../models/Category.js';
import Product from '../models/Product.js';
import { AppError } from '../utils/AppError.js';
import { formatCategory } from '../utils/formatters.js';
import { slugify } from '../utils/slugify.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { parsePagination, parseSort, paginationMeta } from '../utils/listQuery.js';

const ADMIN_CATEGORY_SORT = ['sortOrder', 'nameEn', 'createdAt'];
import {
  uploadFileToCloudinary,
  deleteFromCloudinary,
  CLOUDINARY_FOLDERS,
} from '../utils/cloudinaryUpload.js';

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

export const getCategories = asyncHandler(async (_req, res) => {
  const categories = await Category.find({ isActive: true }).sort({ sortOrder: 1 });
  res.json({ success: true, data: categories.map(formatCategory) });
});

export const getCategoryBySlug = asyncHandler(async (req, res) => {
  const category = await Category.findOne({ slug: req.params.slug, isActive: true });
  if (!category) throw new AppError('Category not found', 404);
  res.json({ success: true, data: formatCategory(category) });
});

export const createCategory = asyncHandler(async (req, res) => {
  const {
    nameAr,
    nameEn,
    slug,
    image,
    parentCategory,
    isActive,
    icon,
    color,
    sortOrder,
  } = req.body;

  if (!nameAr || !nameEn) {
    throw new AppError('nameAr and nameEn are required', 400);
  }

  const categorySlug = slug || slugify(nameEn);
  const existing = await Category.findOne({ slug: categorySlug });
  if (existing) throw new AppError('Category slug already exists', 400);

  let imageUrl = image || null;
  let cloudinaryPublicId = null;

  if (req.file) {
    try {
      const uploaded = await uploadFileToCloudinary(req.file, CLOUDINARY_FOLDERS.categories);
      imageUrl = uploaded.url;
      cloudinaryPublicId = uploaded.publicId;
    } catch {
      throw new AppError('Image upload failed — configure Cloudinary or provide image URL', 400);
    }
  }

  const category = await Category.create({
    nameAr,
    nameEn,
    slug: categorySlug,
    image: imageUrl,
    cloudinaryPublicId,
    parentCategory: parentCategory || null,
    isActive: parseOptionalBoolean(isActive, true),
    icon,
    color,
    sortOrder: parseOptionalNumber(sortOrder, 0),
  });

  res.status(201).json({ success: true, data: formatCategory(category) });
});

export const updateCategory = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) throw new AppError('Category not found', 404);

  if (req.body.slug && req.body.slug !== category.slug) {
    const exists = await Category.findOne({ slug: req.body.slug, _id: { $ne: category._id } });
    if (exists) throw new AppError('Category slug already exists', 400);
  }

  if (req.file) {
    try {
      if (category.cloudinaryPublicId) {
        await deleteFromCloudinary(category.cloudinaryPublicId);
      }
      const uploaded = await uploadFileToCloudinary(req.file, CLOUDINARY_FOLDERS.categories);
      category.image = uploaded.url;
      category.cloudinaryPublicId = uploaded.publicId;
    } catch {
      throw new AppError('Image upload failed', 400);
    }
  } else if (req.body.image !== undefined) {
    category.image = req.body.image || null;
    if (!req.body.image && category.cloudinaryPublicId) {
      await deleteFromCloudinary(category.cloudinaryPublicId);
      category.cloudinaryPublicId = null;
    }
  }

  const { nameAr, nameEn, slug, parentCategory, isActive, icon, color, sortOrder } = req.body;

  if (nameAr !== undefined) category.nameAr = nameAr;
  if (nameEn !== undefined) category.nameEn = nameEn;
  if (slug !== undefined) category.slug = slug;
  if (parentCategory !== undefined) category.parentCategory = parentCategory || null;
  if (isActive !== undefined) category.isActive = parseOptionalBoolean(isActive, category.isActive);
  if (icon !== undefined) category.icon = icon;
  if (color !== undefined) category.color = color;
  if (sortOrder !== undefined) category.sortOrder = parseOptionalNumber(sortOrder, category.sortOrder);

  await category.save();

  res.json({ success: true, data: formatCategory(category) });
});

export const deleteCategory = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) throw new AppError('Category not found', 404);

  const productCount = await Product.countDocuments({ category: category._id });
  if (productCount > 0) {
    throw new AppError('Cannot delete category with linked products', 400);
  }

  if (category.cloudinaryPublicId) {
    await deleteFromCloudinary(category.cloudinaryPublicId);
  }

  await category.deleteOne();
  res.json({ success: true, message: 'Category deleted' });
});

function buildAdminCategoryFilter(query) {
  const filter = {};
  if (query.isActive !== undefined && query.isActive !== '') {
    filter.isActive = query.isActive === 'true';
  }
  if (query.q) {
    const rx = { $regex: query.q, $options: 'i' };
    filter.$or = [{ nameAr: rx }, { nameEn: rx }, { slug: rx }];
  }
  return filter;
}

export const getAdminCategories = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = buildAdminCategoryFilter(req.query);
  const sort = parseSort(req.query, ADMIN_CATEGORY_SORT, 'sortOrder');

  const [categories, total] = await Promise.all([
    Category.find(filter)
      .populate('parentCategory', 'nameAr nameEn slug')
      .sort(sort)
      .skip(skip)
      .limit(limit),
    Category.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: categories.map(formatCategory),
    pagination: paginationMeta(page, limit, total),
  });
});

export const bulkAdminCategories = asyncHandler(async (req, res) => {
  const { ids, action } = req.body;
  if (!Array.isArray(ids) || !ids.length) {
    throw new AppError('ids array is required', 400);
  }

  const filter = { _id: { $in: ids } };
  if (action === 'activate') await Category.updateMany(filter, { isActive: true });
  else if (action === 'deactivate') await Category.updateMany(filter, { isActive: false });
  else if (action === 'delete') await Category.deleteMany(filter);
  else throw new AppError('Invalid action', 400);

  res.json({ success: true, affected: ids.length });
});
