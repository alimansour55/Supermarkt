import Category from '../models/Category.js';
import { AppError } from '../utils/AppError.js';
import { formatCategory } from '../utils/formatters.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { parsePagination, parseSort, paginationMeta } from '../utils/listQuery.js';
import {
  uploadFileToCloudinary,
  deleteFromCloudinary,
  CLOUDINARY_FOLDERS,
} from '../utils/cloudinaryUpload.js';
import {
  assertValidParent,
  assertCategorySlugAvailable,
  assertCategoryParentConsistency,
  attachProductCounts,
  attachAdminCategoryMeta,
  countLinkedProducts,
  countActiveLinkedProducts,
  reassignActiveProductsFromCategory,
  buildNestedCategoryTree,
  resolveCategoryChainBySlugs,
  buildCategorySlugPath,
  getCategoryChainFromId,
  getCanonicalSlugPath,
  parseSlugPathParam,
  rebuildDescendantPaths,
  refreshProductCategoryPaths,
  CATEGORY_SOFT_MAX_LEVEL,
} from '../utils/categoryTree.js';
import { resolveProductCategoryFields } from '../utils/productCategorySync.js';

const ADMIN_CATEGORY_SORT = ['sortOrder', 'nameEn', 'createdAt'];

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

/** Non-blocking notice when a category sits deeper than the recommended 3 levels. */
const depthWarningFor = (category) => {
  const depth = typeof category.depth === 'number'
    ? category.depth
    : Math.max(0, (category.level || 1) - 1);
  if (depth + 1 <= CATEGORY_SOFT_MAX_LEVEL) return null;
  return {
    code: 'depth_exceeds_recommended',
    en: `This category is ${depth + 1} levels deep. Keeping the catalog to ${CATEGORY_SOFT_MAX_LEVEL} levels (Main › Section › Subsection) is easier for shoppers.`,
    ar: `هذا القسم في المستوى ${depth + 1}. يُفضّل إبقاء الشجرة عند ${CATEGORY_SOFT_MAX_LEVEL} مستويات (رئيسي › قسم › قسم فرعي) لتسهيل التصفح.`,
  };
};

const populateCategoryQuery = () =>
  Category.find({ isActive: true })
    .populate('parentCategory', 'slug nameAr nameEn icon color image')
    .sort({ sortOrder: 1, nameEn: 1 });

export const getMainCategories = asyncHandler(async (_req, res) => {
  const categories = await populateCategoryQuery().where({ parentCategory: null });
  res.json({ success: true, data: categories.map(formatCategory) });
});

export const getCategoryTree = asyncHandler(async (_req, res) => {
  const all = await populateCategoryQuery();
  const nested = buildNestedCategoryTree(all);

  const toTreeNode = (node) => ({
    ...formatCategory(node.category),
    children: node.children.map(toTreeNode),
  });

  res.json({ success: true, data: nested.map(toTreeNode) });
});

export const getCategoryBrowse = asyncHandler(async (req, res) => {
  const slugs = parseSlugPathParam(req.params.slugPath);
  const chainDocs = await resolveCategoryChainBySlugs(slugs);
  const canonicalSlugPath = getCanonicalSlugPath(chainDocs);
  const requestedPath = slugs.join('/');
  const current = chainDocs[chainDocs.length - 1];
  const children = await Category.find({ parentCategory: current._id, isActive: true })
    .sort({ sortOrder: 1, nameEn: 1 });
  const withCounts = await attachProductCounts(children);

  res.json({
    success: true,
    slugPath: canonicalSlugPath,
    requestedPath,
    canonicalSlugPath,
    redirectTo: canonicalSlugPath !== requestedPath ? canonicalSlugPath : null,
    chain: chainDocs.map(formatCategory),
    category: formatCategory(current),
    children: withCounts.map(({ sub, productCount }) => ({
      ...formatCategory(sub),
      productCount,
    })),
    isLeaf: children.length === 0,
    main: chainDocs[0] ? formatCategory(chainDocs[0]) : formatCategory(current),
  });
});

export const getCategorySlugPath = asyncHandler(async (req, res) => {
  const category = await Category.findOne({ slug: req.params.slug, isActive: true });
  if (!category) throw new AppError('Category not found', 404);
  const slugPath = await buildCategorySlugPath(category._id);
  const chain = await getCategoryChainFromId(category._id);
  res.json({
    success: true,
    slugPath,
    chain: chain.map(formatCategory),
  });
});

export const getSubcategoriesBySlug = asyncHandler(async (req, res) => {
  const category = await Category.findOne({
    slug: req.params.slug,
    isActive: true,
  });
  if (!category) throw new AppError('Category not found', 404);

  const chainDocs = await getCategoryChainFromId(category._id);
  const main = chainDocs[0] || category;

  const children = await Category.find({ parentCategory: category._id, isActive: true })
    .sort({ sortOrder: 1, nameEn: 1 });

  const withCounts = await attachProductCounts(children);

  res.json({
    success: true,
    main: formatCategory(main),
    category: formatCategory(category),
    chain: chainDocs.map(formatCategory),
    data: withCounts.map(({ sub, productCount }) => ({
      ...formatCategory(sub),
      productCount,
    })),
  });
});

export const getCategories = asyncHandler(async (req, res) => {
  const filter = { isActive: true };
  if (req.query.rootsOnly === 'true' || req.query.level === '1') {
    filter.parentCategory = null;
  }
  if (req.query.level === '2' || req.query.level === '3' || req.query.level === '4') {
    filter.level = Number(req.query.level);
  }
  const categories = await Category.find(filter)
    .populate('parentCategory', 'slug nameAr nameEn')
    .sort({ sortOrder: 1 });
  res.json({ success: true, data: categories.map(formatCategory) });
});

export const getCategoryBySlug = asyncHandler(async (req, res) => {
  const category = await Category.findOne({ slug: req.params.slug, isActive: true })
    .populate('parentCategory', 'slug nameAr nameEn icon color image');
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
    level,
  } = req.body;

  if (!nameAr || !nameEn) {
    throw new AppError('nameAr and nameEn are required', 400);
  }

  const categorySlug = await assertCategorySlugAvailable(slug || nameEn);

  const hasParent = Boolean(parentCategory);
  const requestedLevel = Number(level) || (hasParent ? null : 1);
  await assertCategoryParentConsistency({
    parentId: hasParent ? parentCategory : null,
    requestedLevel,
  });
  if (hasParent) {
    await assertValidParent(parentCategory);
  }

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
    parentCategory: hasParent ? parentCategory : null,
    isActive: parseOptionalBoolean(isActive, true),
    icon,
    color,
    sortOrder: parseOptionalNumber(sortOrder, 0),
    createdBy: req.user?._id || null,
  });

  const warning = depthWarningFor(category);
  res.status(201).json({ success: true, data: formatCategory(category), ...(warning ? { warning } : {}) });
});

export const updateCategory = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) throw new AppError('Category not found', 404);

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
  if (slug !== undefined && slug === category.slug) {
    // unchanged
  } else if (slug !== undefined) {
    category.slug = await assertCategorySlugAvailable(slug, category._id);
  }

  let parentChanged = false;
  if (parentCategory !== undefined) {
    const nextParent = parentCategory || null;
    const currentParent = category.parentCategory ? String(category.parentCategory) : null;
    parentChanged = currentParent !== (nextParent ? String(nextParent) : null);
    if (parentChanged) {
      // Cycle / self-parent / "under own descendant" are still rejected here.
      // Categories with subcategories CAN be reparented — the whole subtree's
      // path is rebuilt after save.
      await assertCategoryParentConsistency({ categoryId: category._id, parentId: nextParent });
      if (nextParent) await assertValidParent(nextParent);
      category.parentCategory = nextParent;
    }
  }

  if (isActive !== undefined) {
    const nextActive = parseOptionalBoolean(isActive, category.isActive);
    if (nextActive === false && category.isActive !== false) {
      await assertCategoryCanDeactivate(category);
    }
    category.isActive = nextActive;
  }
  if (icon !== undefined) category.icon = icon;
  if (color !== undefined) category.color = color;
  if (sortOrder !== undefined) category.sortOrder = parseOptionalNumber(sortOrder, category.sortOrder);

  await category.save();

  if (parentChanged) {
    const touched = await rebuildDescendantPaths(category._id);
    await refreshProductCategoryPaths([category._id, ...touched]);
  }

  const warning = depthWarningFor(category);
  res.json({ success: true, data: formatCategory(category), ...(warning ? { warning } : {}) });
});

async function assertCategoryCanDeactivate(category) {
  const childCount = await Category.countDocuments({ parentCategory: category._id });
  const activeCount = await countActiveLinkedProducts(category._id, childCount);
  if (activeCount > 0) {
    throw new AppError(
      `Cannot deactivate category with ${activeCount} active product(s) — reassign products first`,
      400,
    );
  }
}

async function assertCategoryCanDelete(category) {
  const childCount = await Category.countDocuments({ parentCategory: category._id });
  if (childCount > 0) {
    throw new AppError('Cannot delete category with subcategories — remove or reassign children first', 400);
  }

  const activeCount = await countActiveLinkedProducts(category._id, childCount);
  if (activeCount > 0) {
    throw new AppError(
      `Cannot delete category with ${activeCount} active product(s) — reassign products first`,
      400,
    );
  }

  const inactiveCount = await countLinkedProducts(category._id, childCount, { activeOnly: false });
  if (inactiveCount > activeCount) {
    throw new AppError(
      `Cannot delete category with ${inactiveCount - activeCount} inactive linked product(s) — reassign or remove them first`,
      400,
    );
  }
}

export const deleteCategory = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) throw new AppError('Category not found', 404);

  await assertCategoryCanDelete(category);

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
  if (query.rootsOnly === 'true') {
    filter.parentCategory = null;
  } else if (query.level === '1') {
    filter.level = 1;
    filter.parentCategory = null;
  } else if (query.level === '2' || query.level === '3' || query.level === '4') {
    filter.level = Number(query.level);
  }
  if (query.parentCategory) {
    filter.parentCategory = query.parentCategory;
  }
  if (query.q) {
    const rx = { $regex: query.q, $options: 'i' };
    filter.$or = [{ nameAr: rx }, { nameEn: rx }, { slug: rx }];
  }
  return filter;
}

export const getAdminCategories = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, 500);
  const filter = buildAdminCategoryFilter(req.query);
  const sort = parseSort(req.query, ADMIN_CATEGORY_SORT, 'sortOrder');

  const [categories, total] = await Promise.all([
    Category.find(filter)
      .populate({
        path: 'parentCategory',
        select: 'nameAr nameEn slug parentCategory',
        populate: { path: 'parentCategory', select: 'nameAr nameEn slug' },
      })
      .sort(sort)
      .skip(skip)
      .limit(limit),
    Category.countDocuments(filter),
  ]);

  const enriched = await attachAdminCategoryMeta(categories);

  res.json({
    success: true,
    data: enriched.map(({ cat, childCount, isLeaf, productCount, activeProductCount }) => ({
      ...formatCategory(cat),
      childCount,
      isLeaf,
      productCount,
      activeProductCount,
    })),
    pagination: paginationMeta(page, limit, total),
  });
});

export const bulkAdminCategories = asyncHandler(async (req, res) => {
  const { ids, action } = req.body;
  if (!Array.isArray(ids) || !ids.length) {
    throw new AppError('ids array is required', 400);
  }

  if (action === 'activate') {
    await Category.updateMany({ _id: { $in: ids } }, { isActive: true });
  } else if (action === 'deactivate') {
    const categories = await Category.find({ _id: { $in: ids } });
    for (const category of categories) {
      await assertCategoryCanDeactivate(category);
    }
    await Category.updateMany({ _id: { $in: ids } }, { isActive: false });
  } else if (action === 'delete') {
    const categories = await Category.find({ _id: { $in: ids } });
    for (const category of categories) {
      await assertCategoryCanDelete(category);
    }
    await Category.deleteMany({ _id: { $in: ids } });
  } else {
    throw new AppError('Invalid action', 400);
  }

  res.json({ success: true, affected: ids.length });
});

export const reorderAdminCategories = asyncHandler(async (req, res) => {
  const { parentCategory, order, move } = req.body;

  if (move?.id) {
    const category = await Category.findById(move.id);
    if (!category) throw new AppError('Category not found', 404);

    const nextParent = move.parentCategory || null;
    const currentParent = category.parentCategory ? String(category.parentCategory) : null;
    const nextParentStr = nextParent ? String(nextParent) : null;

    if (currentParent !== nextParentStr) {
      await assertCategoryParentConsistency({
        categoryId: category._id,
        parentId: nextParent,
        requestedLevel: null,
      });
      if (nextParent) await assertValidParent(nextParent);
      category.parentCategory = nextParent;
      await category.save();
      const touched = await rebuildDescendantPaths(category._id);
      await refreshProductCategoryPaths([category._id, ...touched]);
    }

    const siblings = await Category.find({
      parentCategory: nextParent,
      _id: { $ne: category._id },
    }).sort({ sortOrder: 1, nameEn: 1 });

    let orderedIds;
    if (move.beforeId) {
      const idx = siblings.findIndex((s) => String(s._id) === String(move.beforeId));
      const insertAt = idx === -1 ? siblings.length : idx;
      orderedIds = [
        ...siblings.slice(0, insertAt).map((s) => s._id),
        category._id,
        ...siblings.slice(insertAt).map((s) => s._id),
      ];
    } else if (move.afterId) {
      const idx = siblings.findIndex((s) => String(s._id) === String(move.afterId));
      const insertAt = idx === -1 ? siblings.length : idx + 1;
      orderedIds = [
        ...siblings.slice(0, insertAt).map((s) => s._id),
        category._id,
        ...siblings.slice(insertAt).map((s) => s._id),
      ];
    } else {
      orderedIds = [...siblings.map((s) => s._id), category._id];
    }

    await Promise.all(
      orderedIds.map((cid, index) => Category.updateOne(
        { _id: cid },
        { sortOrder: (index + 1) * 10 },
      )),
    );

    return res.json({ success: true });
  }

  if (!Array.isArray(order) || !order.length) {
    throw new AppError('order must be a non-empty array', 400);
  }

  const parentId = parentCategory || null;
  const categories = await Category.find({ _id: { $in: order } });

  if (categories.length !== order.length) {
    throw new AppError('One or more categories were not found', 400);
  }

  for (const cat of categories) {
    const catParent = cat.parentCategory ? String(cat.parentCategory) : null;
    const expectedParent = parentId ? String(parentId) : null;
    if (catParent !== expectedParent) {
      throw new AppError('All categories must share the same parent to reorder', 400);
    }
  }

  await Promise.all(
    order.map((id, index) => Category.updateOne(
      { _id: id },
      { sortOrder: (index + 1) * 10 },
    )),
  );

  res.json({ success: true });
});

export const reassignCategoryProducts = asyncHandler(async (req, res) => {
  const source = await Category.findById(req.params.id);
  if (!source) throw new AppError('Category not found', 404);

  const targetFields = await resolveProductCategoryFields({
    mainCategory: req.body.mainCategory,
    subCategory: req.body.subCategory,
    category: req.body.category,
  });

  const affected = await reassignActiveProductsFromCategory(source._id, targetFields);
  res.json({ success: true, affected });
});
