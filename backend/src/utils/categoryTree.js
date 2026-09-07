import mongoose from 'mongoose';
import Category from '../models/Category.js';
import { AppError } from './AppError.js';
import { productCategoryError } from '../constants/productCategoryErrors.js';
import { slugify } from './slugify.js';

export const CATEGORY_MAX_LEVEL = 4;
export const CATEGORY_LEVEL = { MAIN: 1, CATEGORY: 2, SUB: 3, SUB_SUB: 4 };

/** Express 5 `{*slugPath}` wildcards arrive as string[] — normalize to slug segments. */
export function parseSlugPathParam(slugPathParam) {
  if (Array.isArray(slugPathParam)) {
    return slugPathParam.map((s) => String(s).trim()).filter(Boolean);
  }
  return String(slugPathParam || '')
    .replace(/^\/+|\/+$/g, '')
    .split('/')
    .filter(Boolean);
}

export function getCategoryLevel(category) {
  if (category?.level) return category.level;
  return category?.parentCategory ? CATEGORY_LEVEL.CATEGORY : CATEGORY_LEVEL.MAIN;
}

export async function assertValidParent(parentId) {
  if (!parentId) return null;
  const parent = await Category.findById(parentId);
  if (!parent) throw new AppError('Parent category not found', 400);
  const parentLevel = getCategoryLevel(parent);
  if (parentLevel >= CATEGORY_MAX_LEVEL) {
    throw new AppError('Maximum category depth reached — cannot add another sub level', 400);
  }
  return parent;
}

export async function getAllDescendantIds(categoryId) {
  const children = await Category.find({ parentCategory: categoryId }).select('_id');
  const ids = [];
  for (const child of children) {
    ids.push(child._id);
    ids.push(...await getAllDescendantIds(child._id));
  }
  return ids;
}

export async function assertCategorySlugAvailable(slug, excludeCategoryId = null) {
  const normalized = slugify(String(slug || '').trim());
  if (!normalized) throw new AppError('Category slug is invalid', 400);
  const filter = { slug: normalized };
  if (excludeCategoryId) filter._id = { $ne: excludeCategoryId };
  const existing = await Category.findOne(filter);
  if (existing) {
    throw new AppError(`Category slug "${normalized}" is already in use`, 400);
  }
  return normalized;
}

export async function assertCategoryParentConsistency({
  categoryId = null,
  parentId = null,
  requestedLevel = null,
} = {}) {
  const hasParent = Boolean(parentId);

  if (!hasParent) {
    if (requestedLevel != null && requestedLevel !== '' && Number(requestedLevel) > 1) {
      throw new AppError('Parent category is required for nested categories', 400);
    }
    return null;
  }

  if (categoryId && String(parentId) === String(categoryId)) {
    throw new AppError('A category cannot be its own parent', 400);
  }

  const parent = await assertValidParent(parentId);

  if (categoryId) {
    const descendants = await getAllDescendantIds(categoryId);
    if (descendants.some((id) => String(id) === String(parentId))) {
      throw new AppError('Cannot move a category under one of its own subcategories', 400);
    }
  }

  const parentLevel = getCategoryLevel(parent);
  const expectedLevel = parentLevel + 1;
  if (requestedLevel != null && requestedLevel !== '' && Number(requestedLevel) !== expectedLevel) {
    throw new AppError(
      `Invalid parent for this level — "${parent.nameEn}" is level ${parentLevel}, so this category must be level ${expectedLevel}`,
      400,
    );
  }

  return parent;
}

export async function assertNoChildren(categoryId) {
  const childCount = await Category.countDocuments({ parentCategory: categoryId });
  if (childCount > 0) {
    throw new AppError('Cannot change parent while this category has subcategories', 400);
  }
}

export async function getActiveChildren(parentId) {
  return Category.find({ parentCategory: parentId, isActive: true }).sort({ sortOrder: 1, nameEn: 1 });
}

/** All active descendants (depth-first), excluding the parent itself. */
export async function getActiveDescendantsFlat(parentId) {
  const children = await getActiveChildren(parentId);
  const result = [];
  for (const child of children) {
    result.push(child);
    result.push(...await getActiveDescendantsFlat(child._id));
  }
  return result;
}

export async function getDescendantCategoryIds(categoryId) {
  const direct = await Category.find({ parentCategory: categoryId, isActive: true }).select('_id');
  const ids = [];
  for (const child of direct) {
    ids.push(child._id);
    ids.push(...await getDescendantCategoryIds(child._id));
  }
  return ids;
}

export async function getLeafDescendantIds(categoryId) {
  const children = await Category.find({ parentCategory: categoryId, isActive: true }).select('_id');
  if (!children.length) return [categoryId];
  const leaves = [];
  for (const child of children) {
    leaves.push(...await getLeafDescendantIds(child._id));
  }
  return leaves;
}

export async function resolveCategoryProductFilter(categoryRef) {
  if (!categoryRef) return null;

  let category;
  if (typeof categoryRef === 'object' && categoryRef._id) {
    category = categoryRef;
  } else {
    category = await Category.findOne(
      isObjectId(categoryRef)
        ? { _id: categoryRef, isActive: true }
        : { slug: categoryRef, isActive: true },
    ).select('_id parentCategory level');
  }
  if (!category) return null;

  const leafIds = await getLeafDescendantIds(category._id);
  if (leafIds.length === 1 && String(leafIds[0]) === String(category._id)) {
    return category._id;
  }
  return { $in: leafIds };
}

export async function getRootCategoryId(categoryId) {
  let current = await Category.findById(categoryId).select('parentCategory');
  if (!current) return null;
  while (current.parentCategory) {
    current = await Category.findById(current.parentCategory).select('parentCategory');
    if (!current) break;
  }
  return current?._id || null;
}

export async function getCategoryChainFromId(categoryId) {
  const chain = [];
  let current = await Category.findById(categoryId);
  while (current) {
    chain.unshift(current);
    if (!current.parentCategory) break;
    current = await Category.findById(current.parentCategory);
  }
  return chain;
}

async function resolveStrictCategoryChain(slugs) {
  const chain = [];
  let parentId = null;

  for (const slug of slugs) {
    const query = { slug, isActive: true };
    query.parentCategory = parentId || null;
    const cat = await Category.findOne(query);
    if (!cat) return null;
    chain.push(cat);
    parentId = cat._id;
  }

  return chain;
}

/**
 * Resolve URL slug segments to a category chain.
 * Falls back to lookup by the last slug (unique) when the path omits intermediate levels.
 */
export async function resolveCategoryChainBySlugs(slugs) {
  if (!Array.isArray(slugs) || !slugs.length) {
    throw new AppError('Category path is required', 400);
  }

  const strict = await resolveStrictCategoryChain(slugs);
  if (strict) return strict;

  const lastSlug = slugs[slugs.length - 1];
  const cat = await Category.findOne({ slug: lastSlug, isActive: true });
  if (!cat) throw new AppError(`Category not found: ${lastSlug}`, 404);

  return getCategoryChainFromId(cat._id);
}

export function getCanonicalSlugPath(chain) {
  return chain.map((c) => c.slug).join('/');
}

export async function buildCategorySlugPath(categoryId) {
  const chain = await getCategoryChainFromId(categoryId);
  return getCanonicalSlugPath(chain);
}

const isObjectId = (value) => mongoose.Types.ObjectId.isValid(value)
  && String(new mongoose.Types.ObjectId(value)) === String(value);

async function resolveActiveCategoryRef(categoryRef) {
  if (!categoryRef) return null;
  if (typeof categoryRef === 'object' && categoryRef._id) return categoryRef._id;
  if (isObjectId(categoryRef)) {
    const cat = await Category.findOne({ _id: categoryRef, isActive: true }).select('_id');
    return cat?._id || null;
  }
  const cat = await Category.findOne({ slug: categoryRef, isActive: true }).select('_id');
  return cat?._id || null;
}

/** Build a Product.find clause for one or more category refs (id or slug). */
export async function buildCategoryRefsProductFilter(categoryRefs = []) {
  const refs = (Array.isArray(categoryRefs) ? categoryRefs : [categoryRefs]).filter(Boolean);
  if (!refs.length) return null;

  const groups = [];
  for (const ref of refs) {
    const temp = {};
    const id = typeof ref === 'object' && ref._id ? ref._id : ref;
    await applyProductCategoryQueryToFilter(temp, { category: id });
    const clause = temp.$and?.find((entry) => entry.$or);
    if (clause) groups.push(clause);
  }

  if (!groups.length) return null;
  return groups.length === 1 ? groups[0] : { $or: groups };
}

/** Merge storefront-aligned category matching into an existing Product.find filter. */
export async function mergeCategoryIntoProductFilter(filter, categoryRef) {
  if (!categoryRef) return filter;
  const clause = await buildCategoryRefsProductFilter([categoryRef]);
  if (!clause) return filter;
  filter.$and = [...(filter.$and || []), clause];
  return filter;
}

/** Storefront-aligned category filter — expands to leaf descendants via resolveCategoryProductFilter. */
export async function applyProductCategoryQueryToFilter(filter, query) {
  const { category, mainCategory, subCategory } = query;

  if (subCategory) {
    const categoryFilter = await resolveCategoryProductFilter(subCategory);
    if (categoryFilter) {
      filter.$and = [
        ...(filter.$and || []),
        { $or: [{ subCategory: categoryFilter }, { category: categoryFilter }] },
      ];
    }
  } else if (mainCategory) {
    const mainId = await resolveActiveCategoryRef(mainCategory);
    const childFilter = await resolveCategoryProductFilter(mainCategory);
    if (mainId) {
      const orClause = [{ mainCategory: mainId }];
      if (childFilter) {
        orClause.push({ subCategory: childFilter }, { category: childFilter });
      }
      filter.$and = [...(filter.$and || []), { $or: orClause }];
    }
  } else if (category) {
    const categoryFilter = await resolveCategoryProductFilter(category);
    if (categoryFilter) {
      filter.$and = [
        ...(filter.$and || []),
        { $or: [{ category: categoryFilter }, { subCategory: categoryFilter }] },
      ];
    }
  }

  return filter;
}

export async function buildProductCategoryPathMeta(leafCategoryId, product = {}) {
  if (!leafCategoryId) {
    return {
      categoryPathAr: '',
      categoryPathEn: '',
      categoryPathSlugs: '',
      categoryIntegrityOk: false,
    };
  }

  const chain = await getCategoryChainFromId(leafCategoryId);
  if (!chain.length) {
    return {
      categoryPathAr: '',
      categoryPathEn: '',
      categoryPathSlugs: '',
      categoryIntegrityOk: false,
    };
  }

  const rootId = chain[0]._id;
  const leafId = chain[chain.length - 1]._id;
  const productMain = product.mainCategory?._id || product.mainCategory;
  const productSub = product.subCategory?._id || product.subCategory
    || product.category?._id || product.category;

  return {
    categoryPathAr: chain.map((c) => c.nameAr).join(' › '),
    categoryPathEn: chain.map((c) => c.nameEn).join(' › '),
    categoryPathSlugs: chain.map((c) => c.slug).join('/'),
    categoryIntegrityOk: String(productMain) === String(rootId)
      && String(productSub) === String(leafId),
  };
}

export async function assertProductCategoryAssignment(leafCategoryId, mainCategoryId) {
  const leaf = await Category.findById(leafCategoryId);
  if (!leaf) throw new AppError(productCategoryError('notFound'), 400);
  if (!leaf.isActive) {
    throw new AppError(productCategoryError('inactive'), 400);
  }

  const childCount = await Category.countDocuments({ parentCategory: leaf._id });
  if (childCount > 0) {
    const isMain = !leaf.parentCategory && (leaf.level === 1 || leaf.level == null);
    throw new AppError(
      isMain ? productCategoryError('hasChildrenMain') : productCategoryError('hasChildren'),
      400,
    );
  }

  const rootId = await getRootCategoryId(leaf._id);
  if (!rootId || String(rootId) !== String(mainCategoryId)) {
    throw new AppError(productCategoryError('mainMismatch'), 400);
  }
  return leaf;
}

/** @deprecated use assertProductCategoryAssignment */
export async function assertSubBelongsToMain(subCategoryId, mainCategoryId) {
  return assertProductCategoryAssignment(subCategoryId, mainCategoryId);
}

async function countProductsForCategory(categoryId) {
  const { default: Product } = await import('../models/Product.js');
  const filter = await resolveCategoryProductFilter(categoryId);
  if (!filter) return 0;
  const categoryClause = typeof filter === 'object' && filter.$in
    ? { $or: [{ category: filter }, { subCategory: filter }] }
    : { $or: [{ category: filter }, { subCategory: filter }] };
  return Product.countDocuments({ isActive: true, ...categoryClause });
}

export async function attachProductCounts(categories) {
  return Promise.all(
    categories.map(async (sub) => ({
      sub,
      productCount: await countProductsForCategory(sub._id),
    })),
  );
}

/** Leaf ids for admin counts — includes inactive subcategories. */
export async function getAdminLeafDescendantIds(categoryId) {
  const children = await Category.find({ parentCategory: categoryId }).select('_id');
  if (!children.length) return [categoryId];
  const leaves = [];
  for (const child of children) {
    leaves.push(...await getAdminLeafDescendantIds(child._id));
  }
  return leaves;
}

/** All products linked to a category (direct leaf links or descendants). */
export async function countLinkedProducts(categoryId, childCount = null, { activeOnly = false } = {}) {
  const { default: Product } = await import('../models/Product.js');
  const hasChildren = childCount != null
    ? childCount > 0
    : (await Category.countDocuments({ parentCategory: categoryId })) > 0;

  const statusFilter = activeOnly ? { isActive: true } : {};

  if (!hasChildren) {
    return Product.countDocuments({
      ...statusFilter,
      $or: [
        { category: categoryId },
        { subCategory: categoryId },
        { mainCategory: categoryId },
      ],
    });
  }

  const leafIds = await getAdminLeafDescendantIds(categoryId);
  return Product.countDocuments({
    ...statusFilter,
    $or: [
      { category: { $in: leafIds } },
      { subCategory: { $in: leafIds } },
    ],
  });
}

export async function countActiveLinkedProducts(categoryId, childCount = null) {
  return countLinkedProducts(categoryId, childCount, { activeOnly: true });
}

export async function reassignActiveProductsFromCategory(sourceCategoryId, targetFields) {
  const { default: Product } = await import('../models/Product.js');
  const leafIds = await getAdminLeafDescendantIds(sourceCategoryId);
  const filter = {
    isActive: true,
    $or: [
      { category: { $in: leafIds } },
      { subCategory: { $in: leafIds } },
    ],
  };
  const result = await Product.updateMany(filter, { $set: targetFields });
  return result.modifiedCount;
}

export async function attachAdminCategoryMeta(categories) {
  if (!categories.length) return [];

  const ids = categories.map((c) => c._id);
  const childAgg = await Category.aggregate([
    { $match: { parentCategory: { $in: ids } } },
    { $group: { _id: '$parentCategory', count: { $sum: 1 } } },
  ]);
  const childCountByParent = new Map(childAgg.map((row) => [String(row._id), row.count]));

  return Promise.all(
    categories.map(async (cat) => {
      const childCount = childCountByParent.get(String(cat._id)) || 0;
      const productCount = await countLinkedProducts(cat._id, childCount);
      const activeProductCount = await countActiveLinkedProducts(cat._id, childCount);
      return {
        cat,
        childCount,
        isLeaf: childCount === 0,
        productCount,
        activeProductCount,
      };
    }),
  );
}

export function buildNestedCategoryTree(categories, parentId = null) {
  return categories
    .filter((cat) => {
      const pid = cat.parentCategory?._id || cat.parentCategory || null;
      return String(pid || null) === String(parentId || null);
    })
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) || String(a.nameEn).localeCompare(String(b.nameEn)))
    .map((cat) => ({
      category: cat,
      children: buildNestedCategoryTree(categories, cat._id),
    }));
}
