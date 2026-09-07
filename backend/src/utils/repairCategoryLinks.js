import Category from '../models/Category.js';
import Product from '../models/Product.js';
import { getRootCategoryId, getCategoryChainFromId } from './categoryTree.js';
import { resolveProductCategoryFields } from './productCategorySync.js';

export const PRODUCT_CATEGORY_ISSUES = {
  MISSING_LEAF: 'missing_leaf',
  ORPHANED_REF: 'orphaned_ref',
  FIELDS_OUT_OF_SYNC: 'fields_out_of_sync',
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
 * Resolve a category ref to an active leaf for repair.
 * Descends through non-leaf nodes; for inactive leaves, picks another active leaf under the same parent.
 */
export async function resolveRepairLeafId(categoryId, categoryCache = new Map()) {
  let currentId = normalizeId(categoryId);
  if (!currentId) return { leafId: null, reason: 'missing' };

  let cat = await getCachedCategory(currentId, categoryCache);
  if (!cat) return { leafId: null, reason: 'orphaned' };

  const activeChildCount = await Category.countDocuments({ parentCategory: cat._id, isActive: true });
  if (activeChildCount > 0) {
    const leafId = await findFirstActiveLeaf(cat._id);
    return {
      leafId,
      reason: leafId ? 'non_leaf' : 'non_leaf_no_active_children',
      repairedFrom: cat._id,
    };
  }

  if (!cat.isActive) {
    if (cat.parentCategory) {
      const siblingLeaf = await findFirstActiveLeaf(cat.parentCategory);
      if (siblingLeaf && String(siblingLeaf) !== String(cat._id)) {
        return { leafId: siblingLeaf, reason: 'inactive_category', repairedFrom: cat._id };
      }
    }
    return { leafId: null, reason: 'inactive_category', repairedFrom: cat._id };
  }

  return { leafId: cat._id, reason: null };
}

export async function diagnoseProductCategory(product, categoryCache = new Map()) {
  const issues = [];
  const mainId = normalizeId(product.mainCategory);
  const subId = normalizeId(product.subCategory);
  const categoryId = normalizeId(product.category);

  if (!subId && !categoryId) {
    issues.push({
      code: PRODUCT_CATEGORY_ISSUES.MISSING_LEAF,
      message: 'Product has no category or subCategory',
    });
    return { issues, healthy: false, repairable: false };
  }

  if (subId && categoryId && subId !== categoryId) {
    issues.push({
      code: PRODUCT_CATEGORY_ISSUES.FIELDS_OUT_OF_SYNC,
      message: 'category and subCategory point to different categories',
      details: { subCategory: subId, category: categoryId },
    });
  }

  const primaryLeafRef = subId || categoryId;
  const alternateRef = subId && categoryId && subId !== categoryId
    ? (primaryLeafRef === subId ? categoryId : subId)
    : null;

  let leafCat = await getCachedCategory(primaryLeafRef, categoryCache);
  if (!leafCat && alternateRef) {
    leafCat = await getCachedCategory(alternateRef, categoryCache);
    if (leafCat) {
      issues.push({
        code: PRODUCT_CATEGORY_ISSUES.ORPHANED_REF,
        message: 'Primary category reference is missing — alternate reference exists',
        details: { orphaned: primaryLeafRef, alternate: alternateRef },
      });
    }
  } else if (!leafCat) {
    issues.push({
      code: PRODUCT_CATEGORY_ISSUES.ORPHANED_REF,
      message: 'Category reference does not exist',
      details: { orphaned: primaryLeafRef },
    });
    return { issues, healthy: false, repairable: false };
  }

  const activeChildCount = await Category.countDocuments({ parentCategory: leafCat._id, isActive: true });
  if (activeChildCount > 0) {
    issues.push({
      code: PRODUCT_CATEGORY_ISSUES.NON_LEAF,
      message: 'Product is assigned to a parent category, not a leaf',
      details: { categoryId: String(leafCat._id), slug: leafCat.slug },
    });
  }

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

  const repairable = await (async () => {
    if (issues.some((issue) => issue.code === PRODUCT_CATEGORY_ISSUES.MISSING_LEAF)) {
      return false;
    }
    if (issues.some((issue) => issue.code === PRODUCT_CATEGORY_ISSUES.ORPHANED_REF) && !alternateRef) {
      return false;
    }
    let candidate = subId || categoryId;
    if (!leafCat && alternateRef) candidate = alternateRef;
    const resolved = await resolveRepairLeafId(candidate, categoryCache);
    return Boolean(resolved.leafId);
  })();

  return {
    issues,
    healthy: false,
    repairable,
  };
}

async function buildProductIssueRow(product, diagnosis, categoryCache) {
  const leafRef = normalizeId(product.subCategory) || normalizeId(product.category);
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
    subCategory: normalizeId(product.subCategory),
    category: normalizeId(product.category),
    categoryPathEn,
    categoryPathAr,
    issues: diagnosis.issues,
    repairable: diagnosis.repairable,
  };
}

export async function scanProductCategoryIntegrity({ sampleLimit = 50 } = {}) {
  const products = await Product.find({})
    .select('slug nameEn nameAr isActive mainCategory subCategory category')
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

  const subId = normalizeId(product.subCategory);
  const categoryId = normalizeId(product.category);
  let candidateRef = subId || categoryId;

  const primaryCat = await getCachedCategory(candidateRef, categoryCache);
  if (!primaryCat && subId && categoryId && subId !== categoryId) {
    candidateRef = subId === candidateRef ? categoryId : subId;
  }

  const { leafId, reason, repairedFrom } = await resolveRepairLeafId(candidateRef, categoryCache);
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
    subCategory: leafId,
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
      subCategory: String(fields.subCategory),
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
  let cursor = Product.find(query).select('slug mainCategory subCategory category');
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
  for (const cat of categories) {
    let expectedLevel = 1;
    if (cat.parentCategory) {
      const parent = await Category.findById(cat.parentCategory).select('level');
      expectedLevel = Math.min((parent?.level || 1) + 1, 4);
    }
    if (cat.level !== expectedLevel) {
      if (!dryRun) {
        cat.level = expectedLevel;
        await cat.save({ validateBeforeSave: false });
      }
      categoriesFixed += 1;
    }
  }

  const products = await Product.find({}).select('slug mainCategory subCategory category');
  let productsFixed = 0;
  let productsWouldFix = 0;
  let productsUnrepairable = 0;
  let productsOk = 0;

  for (const product of products) {
    try {
      const fields = await resolveProductCategoryFields({
        mainCategory: product.mainCategory,
        subCategory: product.subCategory || product.category,
        category: product.category,
      });
      const changed = ['mainCategory', 'subCategory', 'category'].some(
        (key) => String(product[key] || '') !== String(fields[key] || ''),
      );
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
