import Category from '../models/Category.js';
import Product from '../models/Product.js';
import { getRootCategoryId, getCategoryChainFromId } from './categoryTree.js';
import { resolveProductCategoryFields } from './productCategorySync.js';

export const PRODUCT_CATEGORY_ISSUES = {
  MISSING_LEAF: 'missing_leaf',
  ORPHANED_REF: 'orphaned_ref',
  WRONG_MAIN: 'wrong_main',
  NON_LEAF: 'non_leaf',
  INACTIVE_CATEGORY: 'inactive_category',
};

function normalizeId(ref) {
  if (!ref) return null;
  if (typeof ref === 'object' && ref._id) return String(ref._id);
  return String(ref);
}

async function getCachedCategory(id, cache) {
  const key = normalizeId(id);
  if (!key) return null;
  if (cache.has(key)) return cache.get(key);
  const cat = await Category.findById(key).lean();
  cache.set(key, cat || null);
  return cat || null;
}

/** First active leaf under parent (depth-first, sortOrder). */
export async function findFirstActiveLeaf(parentId) {
  if (!parentId) return null;
  const children = await Category.find({ parentCategory: parentId, isActive: true })
    .sort({ sortOrder: 1, nameEn: 1 })
    .select('_id')
    .lean();

  for (const child of children) {
    const hasKids = await Category.countDocuments({ parentCategory: child._id, isActive: true });
    if (hasKids === 0) return child._id;
    const deeper = await findFirstActiveLeaf(child._id);
    if (deeper) return deeper;
  }
  return null;
}

/**
 * Resolve a category ref to a valid active target for repair.
 * Any active category (at any depth) is a valid target; for an inactive one,
 * fall back to another active category under the same parent.
 */
export async function resolveRepairLeafId(categoryId, categoryCache = new Map()) {
  const currentId = normalizeId(categoryId);
  if (!currentId) return { leafId: null, reason: 'missing' };

  const cat = await getCachedCategory(currentId, categoryCache);
  if (!cat) return { leafId: null, reason: 'orphaned' };

  if (cat.isActive) {
    return { leafId: cat._id, reason: null };
  }

  if (cat.parentCategory) {
    const siblingLeaf = await findFirstActiveLeaf(cat.parentCategory);
    if (siblingLeaf && String(siblingLeaf) !== String(cat._id)) {
      return { leafId: siblingLeaf, reason: 'inactive_category', repairedFrom: cat._id };
    }
  }
  return { leafId: null, reason: 'inactive_category', repairedFrom: cat._id };
}

export async function diagnoseProductCategory(product, categoryCache = new Map()) {
  const issues = [];
  const mainId = normalizeId(product.mainCategory);
  const categoryId = normalizeId(product.category);

  if (!categoryId) {
    issues.push({
      code: PRODUCT_CATEGORY_ISSUES.MISSING_LEAF,
      message: 'Product has no category',
    });
    return { issues, healthy: false, repairable: false };
  }

  const leafCat = await getCachedCategory(categoryId, categoryCache);
  if (!leafCat) {
    issues.push({
      code: PRODUCT_CATEGORY_ISSUES.ORPHANED_REF,
      message: 'Category reference does not exist',
      details: { orphaned: categoryId },
    });
    return { issues, healthy: false, repairable: false };
  }

  // A product may now be attached to a category at any depth — parent categories
  // are valid targets, so NON_LEAF is no longer flagged as an issue.

  if (!leafCat.isActive) {
    issues.push({
      code: PRODUCT_CATEGORY_ISSUES.INACTIVE_CATEGORY,
      message: 'Product is assigned to an inactive category',
      details: { categoryId: String(leafCat._id), slug: leafCat.slug },
    });
  }

  const rootId = await getRootCategoryId(leafCat._id);
  if (rootId) {
    if (!mainId) {
      issues.push({
        code: PRODUCT_CATEGORY_ISSUES.WRONG_MAIN,
        message: 'mainCategory is missing',
        details: { expectedMain: String(rootId) },
      });
    } else if (mainId !== String(rootId)) {
      issues.push({
        code: PRODUCT_CATEGORY_ISSUES.WRONG_MAIN,
        message: 'mainCategory does not match the root of the assigned category',
        details: { mainCategory: mainId, expectedMain: String(rootId) },
      });
    }
  }

  if (issues.length === 0) {
    return { issues, healthy: true, repairable: false };
  }

  const resolved = await resolveRepairLeafId(categoryId, categoryCache);
  const repairable = Boolean(resolved.leafId);

  return {
    issues,
    healthy: false,
    repairable,
  };
}

async function buildProductIssueRow(product, diagnosis, categoryCache) {
  const leafRef = normalizeId(product.category);
  let categoryPathEn = '';
  let categoryPathAr = '';
  if (leafRef) {
    const chain = await getCategoryChainFromId(leafRef).catch(() => []);
    if (chain.length) {
      categoryPathEn = chain.map((c) => c.nameEn).join(' › ');
      categoryPathAr = chain.map((c) => c.nameAr).join(' › ');
    }
  }

  return {
    productId: product._id,
    slug: product.slug,
    nameEn: product.nameEn,
    nameAr: product.nameAr,
    isActive: product.isActive,
    mainCategory: normalizeId(product.mainCategory),
    category: normalizeId(product.category),
    categoryPathEn,
    categoryPathAr,
    issues: diagnosis.issues,
    repairable: diagnosis.repairable,
  };
}

export async function scanProductCategoryIntegrity({ sampleLimit = 50 } = {}) {
  const products = await Product.find({})
    .select('slug nameEn nameAr isActive mainCategory category')
    .lean();

  const categoryCache = new Map();
  const byIssue = Object.fromEntries(Object.values(PRODUCT_CATEGORY_ISSUES).map((code) => [code, 0]));
  let healthyCount = 0;
  let issueCount = 0;
  let repairableCount = 0;
  let unrepairableCount = 0;
  const samples = [];

  for (const product of products) {
    const diagnosis = await diagnoseProductCategory(product, categoryCache);
    if (diagnosis.healthy) {
      healthyCount += 1;
      continue;
    }

    issueCount += 1;
    if (diagnosis.repairable) repairableCount += 1;
    else unrepairableCount += 1;

    diagnosis.issues.forEach((issue) => {
      byIssue[issue.code] = (byIssue[issue.code] || 0) + 1;
    });

    if (samples.length < sampleLimit) {
      samples.push(await buildProductIssueRow(product, diagnosis, categoryCache));
    }
  }

  return {
    totalProducts: products.length,
    healthyCount,
    issueCount,
    repairableCount,
    unrepairableCount,
    byIssue,
    samples,
  };
}

export async function repairSingleProductCategory(product, { dryRun = false, categoryCache = new Map() } = {}) {
  const diagnosis = await diagnoseProductCategory(product, categoryCache);
  if (diagnosis.healthy) {
    return {
      productId: product._id,
      slug: product.slug,
      status: 'ok',
      issues: [],
    };
  }

  if (!diagnosis.repairable) {
    return {
      productId: product._id,
      slug: product.slug,
      status: 'unrepairable',
      issues: diagnosis.issues,
    };
  }

  const categoryId = normalizeId(product.category);

  const { leafId, reason, repairedFrom } = await resolveRepairLeafId(categoryId, categoryCache);
  if (!leafId) {
    return {
      productId: product._id,
      slug: product.slug,
      status: 'unrepairable',
      issues: diagnosis.issues,
      reason,
    };
  }

  const rootId = await getRootCategoryId(leafId);
  if (!rootId) {
    return {
      productId: product._id,
      slug: product.slug,
      status: 'unrepairable',
      issues: diagnosis.issues,
      reason: 'no_root',
    };
  }

  const fields = {
    mainCategory: rootId,
    category: leafId,
  };

  if (!dryRun) {
    await Product.updateOne({ _id: product._id }, { $set: fields });
  }

  return {
    productId: product._id,
    slug: product.slug,
    status: dryRun ? 'would_fix' : 'fixed',
    issues: diagnosis.issues,
    repairedFrom: repairedFrom ? String(repairedFrom) : undefined,
    reason: reason || undefined,
    fields: {
      mainCategory: String(fields.mainCategory),
      category: String(fields.category),
    },
  };
}

export async function repairProductCategories({
  dryRun = false,
  productIds = null,
  limit = null,
} = {}) {
  const query = productIds?.length ? { _id: { $in: productIds } } : {};
  let cursor = Product.find(query).select('slug mainCategory category');
  if (limit) cursor = cursor.limit(Number(limit));

  const products = await cursor.lean();
  const categoryCache = new Map();

  const summary = {
    dryRun,
    scanned: products.length,
    fixed: 0,
    wouldFix: 0,
    ok: 0,
    unrepairable: 0,
    byIssue: Object.fromEntries(Object.values(PRODUCT_CATEGORY_ISSUES).map((code) => [code, 0])),
    results: [],
  };

  for (const product of products) {
    const result = await repairSingleProductCategory(product, { dryRun, categoryCache });
    summary.results.push(result);

    if (result.status === 'ok') summary.ok += 1;
    else if (result.status === 'fixed') summary.fixed += 1;
    else if (result.status === 'would_fix') summary.wouldFix += 1;
    else summary.unrepairable += 1;

    (result.issues || []).forEach((issue) => {
      summary.byIssue[issue.code] = (summary.byIssue[issue.code] || 0) + 1;
    });
  }

  return summary;
}

/**
 * Ensures category levels and product main/sub links are consistent.
 * Safe to run after seed or on existing databases with legacy data.
 */
export async function repairCategoryLinks({ dryRun = false } = {}) {
  let categoriesFixed = 0;
  const categoryCache = new Map();

  const categories = await Category.find({});
  const catById = new Map(categories.map((c) => [String(c._id), c]));

  const pathFor = (cat) => {
    const ancestors = [];
    const guard = new Set();
    let cursor = cat.parentCategory ? catById.get(String(cat.parentCategory)) : null;
    while (cursor && !guard.has(String(cursor._id))) {
      guard.add(String(cursor._id));
      ancestors.unshift(cursor._id);
      cursor = cursor.parentCategory ? catById.get(String(cursor.parentCategory)) : null;
    }
    return ancestors;
  };

  for (const cat of categories) {
    const ancestors = pathFor(cat);
    const depth = ancestors.length;
    const level = depth + 1;
    const outOfSync = cat.level !== level
      || cat.depth !== depth
      || String((cat.ancestors || []).map(String)) !== String(ancestors.map(String));
    if (outOfSync) {
      if (!dryRun) {
        cat.ancestors = ancestors;
        cat.depth = depth;
        cat.level = level;
        await cat.save({ validateBeforeSave: false });
      }
      categoriesFixed += 1;
    }
  }

  const products = await Product.find({}).select('slug mainCategory category categoryAncestors');
  let productsFixed = 0;
  let productsWouldFix = 0;
  let productsUnrepairable = 0;
  let productsOk = 0;

  for (const product of products) {
    try {
      const fields = await resolveProductCategoryFields({
        mainCategory: product.mainCategory,
        category: product.category,
      });
      const changed = ['mainCategory', 'category'].some(
        (key) => String(product[key] || '') !== String(fields[key] || ''),
      ) || String((product.categoryAncestors || []).map(String))
        !== String((fields.categoryAncestors || []).map(String));
      if (changed) {
        if (!dryRun) {
          await Product.updateOne({ _id: product._id }, { $set: fields });
        }
        productsWouldFix += 1;
        if (!dryRun) productsFixed += 1;
        continue;
      }
      productsOk += 1;
    } catch {
      const result = await repairSingleProductCategory(product, { dryRun, categoryCache });
      if (result.status === 'fixed') productsFixed += 1;
      else if (result.status === 'would_fix') productsWouldFix += 1;
      else if (result.status === 'ok') productsOk += 1;
      else productsUnrepairable += 1;
    }
  }

  return {
    dryRun,
    categoriesFixed,
    productsFixed,
    productsWouldFix,
    productsUnrepairable,
    productsOk,
    productsProcessed: products.length,
  };
}

export async function getProductCategoryChain(leafCategoryId) {
  return getCategoryChainFromId(leafCategoryId);
}
