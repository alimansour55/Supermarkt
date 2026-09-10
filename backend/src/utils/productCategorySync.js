import mongoose from 'mongoose';
import Category from '../models/Category.js';
import { AppError } from './AppError.js';
import {
  assertProductCategoryAssignment,
  getRootCategoryId,
  getCategoryChainFromId,
  getCategoryPathIds,
  getCanonicalSlugPath,
  parseSlugPathParam,
  resolveCategoryChainBySlugs,
} from './categoryTree.js';
import { productCategoryError } from '../constants/productCategoryErrors.js';

const isObjectId = (value) => mongoose.Types.ObjectId.isValid(value)
  && String(new mongoose.Types.ObjectId(value)) === String(value);

export async function resolveCategoryRef(categoryRef) {
  if (!categoryRef) return null;
  if (typeof categoryRef === 'object' && categoryRef._id) return categoryRef._id;
  if (isObjectId(categoryRef)) return categoryRef;
  const category = await Category.findOne({ slug: categoryRef });
  return category?._id || null;
}

/**
 * Resolve and validate a product's category link.
 *
 * The product's editable link is a single category at any depth (`category`).
 * `subCategory` mirrors it and `mainCategory` is the root of its chain — both are
 * kept written for backward compatibility. `categoryAncestors` is the ordered
 * root → self path used for fast category product listings.
 */
export async function resolveProductCategoryFields({ mainCategory, subCategory, category }) {
  const targetId = await resolveCategoryRef(subCategory || category);
  if (!targetId) {
    throw new AppError(productCategoryError('required'), 400);
  }

  const pathIds = await getCategoryPathIds(targetId);
  let mainId = mainCategory ? await resolveCategoryRef(mainCategory) : null;
  if (!mainId) {
    mainId = pathIds[0] || await getRootCategoryId(targetId);
  }
  if (!mainId) {
    throw new AppError(productCategoryError('mainUnresolved'), 400);
  }

  await assertProductCategoryAssignment(targetId, mainId);
  return {
    mainCategory: mainId,
    subCategory: targetId,
    category: targetId,
    categoryAncestors: pathIds.length ? pathIds : [targetId],
  };
}

async function assertImportTargetCategory(category, slugLabel) {
  const label = slugLabel || category?.slug || 'unknown';
  if (!category) {
    throw new AppError(`Category not found: "${label}"`, 400);
  }
  if (!category.isActive) {
    throw new AppError(
      `Category "${label}" is inactive — activate it first or choose another.`,
      400,
    );
  }
}

async function resolveLeafCategoryBySlug(slug) {
  const trimmed = String(slug || '').trim();
  if (!trimmed) {
    throw new AppError('categoryPathSlugs or categorySlug is required', 400);
  }
  if (trimmed.includes('/')) {
    const fields = await resolveProductCategoryFieldsFromImport({ categoryPathSlugs: trimmed });
    return Category.findById(fields.subCategory);
  }
  const category = await Category.findOne({ slug: trimmed });
  await assertImportTargetCategory(category, trimmed);
  return category;
}

/**
 * Resolve product category fields from CSV / import row values.
 * Prefers categoryPathSlugs, then leaf categorySlug (with optional mainCategorySlug).
 */
export async function resolveProductCategoryFieldsFromImport(row = {}) {
  const pathValue = row.categoryPathSlugs || row.categoryPath;
  if (pathValue?.trim()) {
    const slugs = parseSlugPathParam(pathValue);
    if (!slugs.length) {
      throw new AppError('categoryPathSlugs is empty', 400);
    }
    let chain;
    try {
      chain = await resolveCategoryChainBySlugs(slugs);
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError(`Invalid category path "${pathValue}"`, 400);
    }
    const leaf = chain[chain.length - 1];
    await assertImportTargetCategory(leaf, slugs[slugs.length - 1]);
    return resolveProductCategoryFields({
      mainCategory: chain[0]._id,
      subCategory: leaf._id,
      category: leaf._id,
    });
  }

  const leafSlug = String(
    row.subCategorySlug || row.subCategory || row.categorySlug || row.category || '',
  ).trim();
  if (!leafSlug) {
    throw new AppError('categoryPathSlugs or categorySlug is required', 400);
  }

  if (leafSlug.includes('/')) {
    return resolveProductCategoryFieldsFromImport({ categoryPathSlugs: leafSlug });
  }

  const leaf = await resolveLeafCategoryBySlug(leafSlug);
  const mainSlug = String(row.mainCategorySlug || row.mainCategory || '').trim() || null;

  try {
    return await resolveProductCategoryFields({
      mainCategory: mainSlug,
      subCategory: leaf._id,
      category: leaf._id,
    });
  } catch (err) {
    if (err instanceof AppError && err.message.includes('selected main category')) {
      const rootId = await getRootCategoryId(leaf._id);
      const root = rootId ? await Category.findById(rootId).select('slug') : null;
      throw new AppError(
        `mainCategorySlug "${mainSlug}" does not match the root of category "${leafSlug}"${root?.slug ? ` (expected "${root.slug}")` : ''}`,
        400,
      );
    }
    throw err;
  }
}

export async function buildExportCategoryMetaForProduct(product) {
  const leafId = product.subCategory?._id || product.subCategory
    || product.category?._id || product.category;
  if (!leafId) {
    return {
      categorySlug: '',
      mainCategorySlug: '',
      subCategorySlug: '',
      categoryPathSlugs: '',
      categoryPathEn: '',
      categoryPathAr: '',
    };
  }

  const chain = await getCategoryChainFromId(leafId);
  const leaf = chain[chain.length - 1];
  const root = chain[0];

  return {
    categorySlug: leaf?.slug || product.subCategory?.slug || product.category?.slug || '',
    mainCategorySlug: root?.slug || product.mainCategory?.slug || '',
    subCategorySlug: leaf?.slug || product.subCategory?.slug || product.category?.slug || '',
    categoryPathSlugs: getCanonicalSlugPath(chain),
    categoryPathEn: chain.map((c) => c.nameEn).join(' › '),
    categoryPathAr: chain.map((c) => c.nameAr).join(' › '),
  };
}

export async function buildExportCategoryMetaMap(products = []) {
  const cacheByLeaf = new Map();
  const byProductId = new Map();

  for (const product of products) {
    const leafId = product.subCategory?._id || product.subCategory
      || product.category?._id || product.category;
    const key = String(leafId || '');
    if (!key) {
      byProductId.set(String(product._id), await buildExportCategoryMetaForProduct(product));
      continue;
    }
    if (!cacheByLeaf.has(key)) {
      cacheByLeaf.set(key, await buildExportCategoryMetaForProduct(product));
    }
    byProductId.set(String(product._id), cacheByLeaf.get(key));
  }

  return byProductId;
}
