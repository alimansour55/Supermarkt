import Brand from '../models/Brand.js';
import Category from '../models/Category.js';
import Product from '../models/Product.js';
import { slugify } from './slugify.js';
import { DEFAULT_BRANDS } from '../constants/defaultBrands.js';
import {
  buildBrandProductFilterFromAliases,
  collectBrandAliases,
  isLatinBrandName,
} from './brandProductFilter.js';

const GENERIC_BRANDS = new Set(['marketplus', 'generic', '']);

function normalizeKey(value) {
  return String(value || '').trim().toLowerCase();
}

function buildBrandLookup(brands) {
  const lookup = new Map();
  for (const brand of brands) {
    const row = brand.toObject ? brand.toObject() : brand;
    const keys = [row.queryValue, row.nameEn, row.nameAr, row.slug].filter(Boolean);
    for (const key of keys) {
      lookup.set(normalizeKey(key), row);
    }
  }
  return lookup;
}

function matchBrandValue(value, lookup) {
  const key = normalizeKey(value);
  if (!key) return null;
  return lookup.get(key) || null;
}

function inferBrandFromName(product, lookup) {
  const nameEn = normalizeKey(product.nameEn);
  const nameAr = String(product.nameAr || '').trim();

  let best = null;
  let bestLen = 0;

  for (const brand of lookup.values()) {
    const en = normalizeKey(brand.nameEn);
    const ar = String(brand.nameAr || '').trim();
    const query = normalizeKey(brand.queryValue);

    if (en && nameEn.includes(en) && en.length > bestLen) {
      best = brand;
      bestLen = en.length;
    } else if (query && nameEn.includes(query) && query.length > bestLen) {
      best = brand;
      bestLen = query.length;
    } else if (ar && nameAr.includes(ar) && ar.length > bestLen) {
      best = brand;
      bestLen = ar.length;
    }
  }

  return best;
}

async function ensureBrandRecord(nameEn, nameAr, existingSlugs) {
  const filterValue = String(nameEn || nameAr || '').trim();
  if (!filterValue) return null;

  const existing = await Brand.findOne({ queryValue: filterValue });
  if (existing) return existing;

  let slug = slugify(nameEn) || slugify(filterValue);
  if (!slug) {
    slug = `brand-${filterValue.toLowerCase().replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '')}`;
  }
  if (!slug) {
    slug = `brand-${Date.now()}`;
  }
  let attempt = slug;
  let i = 1;
  while (existingSlugs.has(attempt)) {
    attempt = `${slug}-${i}`;
    i += 1;
  }
  existingSlugs.add(attempt);

  return Brand.create({
    nameAr: nameAr || filterValue,
    nameEn: nameEn || filterValue,
    slug: attempt,
    queryValue: filterValue,
    emoji: '🏷️',
    isActive: true,
    sortOrder: 200,
  });
}

async function ensureDefaultBrandsSeeded() {
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

async function ensureBrandsFromProducts() {
  await ensureDefaultBrandsSeeded();

  const distinct = await Product.distinct('brand', { brand: { $nin: [null, ''] } });
  const distinctEn = await Product.distinct('brandEn', { brandEn: { $nin: [null, ''] } });
  const values = [...new Set([...distinct, ...distinctEn].map((v) => String(v).trim()).filter(Boolean))];

  const existingBrands = await Brand.find().select('slug queryValue nameEn nameAr');
  const existingSet = new Set();
  for (const b of existingBrands) {
    [b.queryValue, b.nameEn, b.nameAr].filter(Boolean).forEach((v) => existingSet.add(v));
  }
  const existingSlugs = new Set(existingBrands.map((b) => b.slug));

  let created = 0;
  for (const name of values) {
    if (existingSet.has(name)) continue;
    await ensureBrandRecord(name, name, existingSlugs);
    existingSet.add(name);
    created += 1;
  }

  return created;
}

function resolveTargetBrand(product, subCategory, lookup) {
  const directCandidates = [
    product.brand,
    product.brandEn,
    product.brandAr,
    subCategory?.nameEn,
    subCategory?.nameAr,
  ];

  for (const candidate of directCandidates) {
    const match = matchBrandValue(candidate, lookup);
    if (match) return { brand: match, reason: 'direct' };
  }

  const inferred = inferBrandFromName(product, lookup);
  if (inferred) return { brand: inferred, reason: 'name' };

  const current = normalizeKey(product.brand);
  if (current && !GENERIC_BRANDS.has(current)) {
    const loose = lookup.get(current);
    if (loose) return { brand: loose, reason: 'normalize' };
  }

  return null;
}

function needsBrandUpdate(product, target) {
  const queryValue = target.queryValue;
  return product.brand !== queryValue
    || (target.nameAr && product.brandAr !== target.nameAr)
    || (target.nameEn && product.brandEn !== target.nameEn);
}

/** Arabic / duplicate query values merged into canonical Latin brand rows. */
const KNOWN_MERGE_TARGETS = {
  مولفيكس: 'Molfix',
  ديتول: 'Dettol',
  'Nestlé': 'Nestle',
};

/** Merge Arabic-only duplicate brand rows into the canonical Latin brand. */
async function mergeDuplicateBrandRecords({ dryRun = false } = {}) {
  const brands = await Brand.find().lean();
  const byQuery = new Map(brands.map((b) => [b.queryValue, b]));
  const latinByKey = new Map();
  for (const brand of brands) {
    if (!isLatinBrandName(brand.queryValue)) continue;
    latinByKey.set(normalizeKey(brand.queryValue), brand);
    if (brand.nameEn) latinByKey.set(normalizeKey(brand.nameEn), brand);
  }

  let merged = 0;
  let deleted = 0;
  const samples = [];

  for (const source of brands) {
    const knownQuery = KNOWN_MERGE_TARGETS[source.queryValue];
    if (!knownQuery && isLatinBrandName(source.queryValue)) continue;

    const target = knownQuery
      ? byQuery.get(knownQuery)
      : (
        latinByKey.get(normalizeKey(source.nameAr))
        || latinByKey.get(normalizeKey(source.nameEn))
        || brands.find((b) =>
          b._id !== source._id
          && isLatinBrandName(b.queryValue)
          && (
            normalizeKey(b.nameAr) === normalizeKey(source.nameAr)
            || normalizeKey(b.nameEn) === normalizeKey(source.nameEn)
          ),
        )
      );

    if (!target || String(target._id) === String(source._id)) continue;

    const clause = buildBrandProductFilterFromAliases(collectBrandAliases(source));
    if (!clause) continue;

    if (!dryRun) {
      await Product.updateMany(clause, {
        $set: {
          brand: target.queryValue,
          brandAr: target.nameAr || source.nameAr || '',
          brandEn: target.nameEn || target.queryValue,
        },
      });
      await Brand.deleteOne({ _id: source._id });

      if (!target.nameAr && source.nameAr) {
        await Brand.updateOne({ _id: target._id }, { $set: { nameAr: source.nameAr } });
      }
    }

    merged += 1;
    deleted += 1;
    if (samples.length < 10) {
      samples.push({ from: source.queryValue, to: target.queryValue });
    }
  }

  if (!dryRun) {
    for (const brand of await Brand.find().lean()) {
      const fixes = {};
      if (brand.queryValue === 'Molfix' && brand.nameAr === 'Molfix') fixes.nameAr = 'مولفيكس';
      if (brand.queryValue === 'Dettol' && brand.nameAr === 'Dettol') fixes.nameAr = 'ديتول';
      if (Object.keys(fixes).length) {
        await Brand.updateOne({ _id: brand._id }, { $set: fixes });
      }
    }
  }

  return { merged, deleted, samples };
}

/**
 * Align Product.brand with Brand.queryValue so storefront brand pages work.
 */
export async function repairProductBrands({ dryRun = false } = {}) {
  let mergeResult = await mergeDuplicateBrandRecords({ dryRun });
  const brandsCreated = await ensureBrandsFromProducts();
  const mergeAfter = await mergeDuplicateBrandRecords({ dryRun });
  mergeResult = {
    merged: mergeResult.merged + mergeAfter.merged,
    deleted: mergeResult.deleted + mergeAfter.deleted,
    samples: [...mergeResult.samples, ...mergeAfter.samples].slice(0, 10),
  };
  const brands = await Brand.find({ isActive: { $ne: false } }).lean();
  const lookup = buildBrandLookup(brands);

  const subCategoryIds = [...new Set(
    (await Product.find({ subCategory: { $ne: null } }).distinct('subCategory'))
      .map(String),
  )];
  const subCategories = subCategoryIds.length
    ? await Category.find({ _id: { $in: subCategoryIds } }).select('nameAr nameEn slug level').lean()
    : [];
  const subCategoryMap = new Map(subCategories.map((c) => [String(c._id), c]));

  const products = await Product.find().select(
    'slug nameAr nameEn brand brandAr brandEn subCategory',
  ).lean();

  let fixed = 0;
  let alreadyOk = 0;
  let unrepairable = 0;
  const samples = [];

  for (const product of products) {
    const subCategory = subCategoryMap.get(String(product.subCategory)) || null;
    const resolved = resolveTargetBrand(product, subCategory, lookup);

    if (!resolved) {
      if (!product.brand || GENERIC_BRANDS.has(normalizeKey(product.brand))) {
        unrepairable += 1;
        if (samples.length < 15) {
          samples.push({ slug: product.slug, issue: 'no_match' });
        }
      } else {
        alreadyOk += 1;
      }
      continue;
    }

    const { brand: target, reason } = resolved;
    if (!needsBrandUpdate(product, target)) {
      alreadyOk += 1;
      continue;
    }

    if (!dryRun) {
      await Product.updateOne(
        { _id: product._id },
        {
          $set: {
            brand: target.queryValue,
            brandAr: target.nameAr || product.brandAr || '',
            brandEn: target.nameEn || product.brandEn || target.queryValue,
          },
        },
      );
    }

    fixed += 1;
    if (samples.length < 15) {
      samples.push({
        slug: product.slug,
        from: product.brand,
        to: target.queryValue,
        reason,
      });
    }
  }

  return {
    brandsCreated,
    brandsMerged: mergeResult.merged,
    brandsDeleted: mergeResult.deleted,
    mergeSamples: mergeResult.samples,
    productsFixed: fixed,
    productsWouldFix: dryRun ? fixed : 0,
    productsOk: alreadyOk,
    productsUnrepairable: unrepairable,
    samples,
  };
}
