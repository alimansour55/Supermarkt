import crypto from 'node:crypto';
import mongoose from 'mongoose';
import SellerCategory from '../models/SellerCategory.js';
import { slugify } from '../utils/slugify.js';

export const MAX_SELLER_CATEGORIES = 200;
/** Store sections one product may sit in. */
export const MAX_CATEGORIES_PER_PRODUCT = 10;

const isId = (v) => mongoose.Types.ObjectId.isValid(String(v ?? ''));

export async function uniqueSellerCategorySlug(sellerId, nameEn, excludeId = null) {
  const base = slugify(nameEn) || `section-${crypto.randomBytes(3).toString('hex')}`;
  let slug = base;
  let n = 2;
  // eslint-disable-next-line no-await-in-loop
  while (await SellerCategory.exists({ seller: sellerId, slug, ...(excludeId ? { _id: { $ne: excludeId } } : {}) })) {
    slug = `${base}-${n}`;
    n += 1;
  }
  return slug;
}

/** Keep only ids of sections this seller owns (dedupes, preserves order). */
export async function ownSellerCategoryIds(sellerId, ids) {
  const wanted = [...new Set((Array.isArray(ids) ? ids : []).map(String).filter(isId))].slice(0, MAX_CATEGORIES_PER_PRODUCT);
  if (!wanted.length) return [];
  const found = await SellerCategory.find({ seller: sellerId, _id: { $in: wanted } }).select('_id').lean();
  const owned = new Set(found.map((c) => String(c._id)));
  return wanted.filter((id) => owned.has(id)).map((id) => new mongoose.Types.ObjectId(id));
}

/**
 * A section and its children — filtering by a parent section shows the products of its
 * sub-sections too. `ref` is an id or a slug. Returns null when the section doesn't exist.
 */
export async function sellerCategoryWithChildren(sellerId, ref, { activeOnly = false } = {}) {
  const key = String(ref ?? '').trim().toLowerCase();
  if (!key) return null;
  const base = { seller: sellerId, ...(activeOnly ? { isActive: true } : {}) };
  const category = await SellerCategory.findOne({ ...base, ...(isId(key) ? { _id: key } : { slug: key }) }).select('_id').lean();
  if (!category) return null;
  const children = await SellerCategory.find({ ...base, parent: category._id }).select('_id').lean();
  return [category._id, ...children.map((c) => c._id)];
}

/**
 * CSV import: resolve "Honey|Gift boxes" (Arabic or English names, or slugs) to section ids,
 * creating any section the seller doesn't have yet.
 */
export async function resolveSellerCategoryNames(sellerId, raw) {
  const names = String(raw || '').split('|').map((s) => s.trim()).filter(Boolean).slice(0, MAX_CATEGORIES_PER_PRODUCT);
  if (!names.length) return [];
  const existing = await SellerCategory.find({ seller: sellerId }).select('_id slug nameAr nameEn').lean();
  const byKey = new Map();
  for (const c of existing) {
    [c.slug, c.nameAr, c.nameEn].filter(Boolean).forEach((k) => byKey.set(String(k).trim().toLowerCase(), c._id));
  }
  const ids = [];
  for (const name of names) {
    let id = byKey.get(name.toLowerCase());
    if (!id) {
      if (existing.length + ids.length >= MAX_SELLER_CATEGORIES) break;
      // eslint-disable-next-line no-await-in-loop
      const created = await SellerCategory.create({
        seller: sellerId,
        nameAr: name,
        nameEn: name,
        // eslint-disable-next-line no-await-in-loop
        slug: await uniqueSellerCategorySlug(sellerId, name),
        sortOrder: existing.length + ids.length,
      });
      id = created._id;
      byKey.set(name.toLowerCase(), id);
    }
    if (!ids.some((x) => String(x) === String(id))) ids.push(id);
  }
  return ids;
}

export function formatSellerCategory(c, counts = {}) {
  return {
    _id: c._id,
    nameAr: c.nameAr,
    nameEn: c.nameEn,
    slug: c.slug,
    parent: c.parent || null,
    sortOrder: c.sortOrder || 0,
    isActive: c.isActive !== false,
    productCount: counts.total?.get(String(c._id)) || 0,
    liveCount: counts.live?.get(String(c._id)) || 0,
  };
}

/** Parents first (by sortOrder), each followed by its children — the order every list uses. */
export function orderSellerCategories(list) {
  const bySort = (a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) || String(a.nameEn).localeCompare(String(b.nameEn));
  const roots = list.filter((c) => !c.parent).sort(bySort);
  const out = [];
  for (const root of roots) {
    out.push(root);
    out.push(...list.filter((c) => c.parent && String(c.parent) === String(root._id)).sort(bySort));
  }
  // Orphans (parent deleted/hidden) still show, at the end.
  const seen = new Set(out.map((c) => String(c._id)));
  out.push(...list.filter((c) => !seen.has(String(c._id))).sort(bySort));
  return out;
}
