import mongoose from 'mongoose';

const isObjectId = (value) => mongoose.Types.ObjectId.isValid(value)
  && String(new mongoose.Types.ObjectId(value)) === String(value);

/** Raw category ref on a section document (survives failed populate). */
export function resolveSectionCategoryRef(section) {
  if (!section) return null;
  if (section.categoryId) return section.categoryId;

  const populated = section.category;
  if (populated && typeof populated === 'object' && populated._id && populated.slug) {
    return populated._id;
  }

  const raw = typeof section.get === 'function' ? section.get('category') : section.category;
  if (!raw) return null;
  if (typeof raw === 'object' && raw._id) return raw._id;
  if (isObjectId(raw)) return raw;
  return null;
}

/** Attach categoryId, category summary, and categoryIssue for admin API responses. */
export function attachSectionCategoryMeta(section, data) {
  const refId = resolveSectionCategoryRef(section);
  if (!refId) {
    data.categoryId = null;
    data.category = null;
    data.categoryIssue = null;
    return data;
  }

  data.categoryId = String(refId);
  const cat = section.category;
  const isPopulated = cat && typeof cat === 'object' && cat.slug;

  if (isPopulated) {
    data.category = {
      _id: cat._id,
      slug: cat.slug,
      nameAr: cat.nameAr,
      nameEn: cat.nameEn,
      isActive: cat.isActive !== false,
    };
    data.categoryIssue = cat.isActive === false ? 'inactive' : null;
  } else {
    data.category = null;
    data.categoryIssue = 'missing';
  }

  return data;
}
