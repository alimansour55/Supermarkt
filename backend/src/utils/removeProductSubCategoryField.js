import Product from '../models/Product.js';

/**
 * The Product schema no longer declares `subCategory` (superseded by `category`),
 * so schema-aware Mongoose queries silently ignore that field. This migration talks
 * to the raw collection driver directly so it can see and remove the physical field
 * left over on existing documents from before the schema change.
 */
function rawCollection() {
  return Product.collection;
}

/** Pre-flight report: is it safe to drop the stale `subCategory` field? */
export async function scanStaleSubCategoryField() {
  const collection = rawCollection();

  const mismatched = await collection.find({
    subCategory: { $exists: true, $ne: null },
    $expr: { $ne: ['$subCategory', '$category'] },
  }).project({ slug: 1, category: 1, subCategory: 1 }).limit(50).toArray();

  const missingAncestors = await collection.countDocuments({
    category: { $ne: null },
    $or: [{ categoryAncestors: { $exists: false } }, { categoryAncestors: { $size: 0 } }],
  });

  const staleFieldCount = await collection.countDocuments({ subCategory: { $exists: true } });

  return { mismatched, missingAncestors, staleFieldCount };
}

/**
 * Drops the stale `subCategory` field (and its index) from every product.
 * Aborts without writing anything if the pre-flight scan finds mismatches or
 * products missing `categoryAncestors` — run `repairCategoryLinks` first in that case.
 */
export async function removeProductSubCategoryField({ dryRun = false } = {}) {
  const scan = await scanStaleSubCategoryField();

  if (scan.mismatched.length > 0) {
    return { applied: false, reason: 'mismatch', scan };
  }
  if (scan.missingAncestors > 0) {
    return { applied: false, reason: 'missing_ancestors', scan };
  }
  if (dryRun) {
    return { applied: false, dryRun: true, scan };
  }

  const collection = rawCollection();
  const unsetResult = await collection.updateMany({}, { $unset: { subCategory: '' } });

  let indexDropped = false;
  try {
    await collection.dropIndex('subCategory_1');
    indexDropped = true;
  } catch (err) {
    // IndexNotFound — already gone (e.g. a prior run, or never created). Anything else is real.
    if (err.codeName !== 'IndexNotFound' && err.code !== 27) throw err;
  }

  return {
    applied: true,
    scan,
    modifiedCount: unsetResult.modifiedCount,
    indexDropped,
  };
}
