/** Escape special regex characters */
function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isLatinBrandName(value) {
  return /^[A-Za-z0-9]/.test(String(value || '').trim());
}

/** All storefront aliases for a brand row or query string. */
export function collectBrandAliases(brandOrQuery) {
  if (!brandOrQuery) return [];
  if (typeof brandOrQuery === 'string') {
    const trimmed = brandOrQuery.trim();
    return trimmed ? [trimmed] : [];
  }
  return [...new Set(
    [brandOrQuery.queryValue, brandOrQuery.nameEn, brandOrQuery.nameAr]
      .map((v) => String(v || '').trim())
      .filter(Boolean),
  )];
}

/** MongoDB clause matching product brand fields against any alias. */
export function buildBrandProductFilterFromAliases(aliases) {
  const unique = [...new Set(aliases.map((a) => String(a).trim()).filter(Boolean))];
  if (!unique.length) return null;

  const or = [];
  for (const alias of unique) {
    const rx = { $regex: `^${escapeRegex(alias)}$`, $options: 'i' };
    or.push({ brand: rx }, { brandAr: rx }, { brandEn: rx });
  }
  return { $or: or };
}

/** @deprecated prefer buildBrandProductFilterFromAliases / buildBrandProductFilterForQuery */
export function buildBrandProductFilter(queryValue) {
  return buildBrandProductFilterFromAliases(collectBrandAliases(queryValue));
}

export async function resolveBrandsForQuery(Brand, query) {
  const trimmed = String(query || '').trim();
  if (!trimmed) return [];
  const rx = { $regex: `^${escapeRegex(trimmed)}$`, $options: 'i' };
  return Brand.find({
    $or: [{ queryValue: rx }, { nameEn: rx }, { nameAr: rx }, { slug: rx }],
  }).lean();
}

/** Resolve URL ?brand=… to the same product filter used for counts. */
export async function buildBrandProductFilterForQuery(Brand, query) {
  const matched = await resolveBrandsForQuery(Brand, query);
  const aliases = matched.flatMap(collectBrandAliases);
  if (!aliases.length && query) aliases.push(String(query).trim());
  return buildBrandProductFilterFromAliases(aliases);
}

/** Count active products for a brand row — same rules as /products?brand=… */
export async function countActiveProductsForBrand(Product, Brand, brandOrQuery) {
  let clause;
  if (brandOrQuery && typeof brandOrQuery === 'object' && brandOrQuery.queryValue) {
    clause = buildBrandProductFilterFromAliases(collectBrandAliases(brandOrQuery));
  } else {
    clause = await buildBrandProductFilterForQuery(Brand, brandOrQuery);
  }
  if (!clause) return 0;
  return Product.countDocuments({ isActive: true, ...clause });
}

export { isLatinBrandName };
