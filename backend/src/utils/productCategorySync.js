import mongoose from 'mongoose';
import Category from '../models/Category.js';
import { AppError } from './AppError.js';
import {
  assertProductCategoryAssignment,
  getRootCategoryId,
  getCategoryChainFromId,
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
 * Resolve and validate product category fields so mainCategory, subCategory, and category
 * always reference the same leaf category and its root main category.
 */
export async function resolveProductCategoryFields({ mainCategory, subCategory, category }) {
  const subId = await resolveCategoryRef(subCategory || category);
  if (!subId) {
    throw new AppError(productCategoryError('required'), 400);
  }

  let mainId = mainCategory ? await resolveCategoryRef(mainCategory) : null;
  if (!mainId) {
    mainId = await getRootCategoryId(subId);
  }
  if (!mainId) {
    throw new AppError(productCategoryError('mainUnresolved'), 400);
  }

  await assertProductCategoryAssignment(subId, mainId);
  return { mainCategory: mainId, subCategory: subId, category: subId };
}

async function assertImportLeafCategory(category, slugLabel) {
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
  const childCount = await Category.countDocuments({ parentCategory: category._id });
  if (childCount > 0) {
    throw new AppError(
      `Category "${label}" has subcategories — set categoryPathSlugs to the full path ending at the deepest subcategory.`,
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
  await assertImportLeafCategory(category, trimmed);
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
    await assertImportLeafCategory(leaf, slugs[slugs.length - 1]);
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
