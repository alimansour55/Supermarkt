/** Actionable product-category messages for admin (Arabic + English). */
export const PRODUCT_CATEGORY_ERRORS = {
  required: {
    en: 'Choose a product category before saving.',
    ar: 'اختر قسمًا للمنتج قبل الحفظ.',
  },
  notFound: {
    en: 'That category no longer exists — pick another from the list.',
    ar: 'هذا القسم لم يعد موجودًا — اختر قسمًا آخر من القائمة.',
  },
  inactive: {
    en: 'This category is inactive — activate it first or choose another.',
    ar: 'هذا القسم غير نشط — فعّله أولاً أو اختر قسمًا آخر.',
  },
  hasChildrenMain: {
    en: 'Choose a subcategory — products cannot be placed in a main category that has children.',
    ar: 'اختر قسمًا فرعيًا — لا يمكن وضع المنتجات في قسم رئيسي له أقسام فرعية.',
  },
  hasChildren: {
    en: 'Choose a subcategory — products cannot be placed in a category that has children.',
    ar: 'اختر قسمًا فرعيًا — لا يمكن وضع المنتجات في قسم له أقسام فرعية.',
  },
  inactiveWarning: {
    en: 'This category is inactive — customers will not see products here until you activate it.',
    ar: 'هذا القسم غير نشط — لن يرى العملاء المنتجات هنا حتى تفعّله.',
  },
  hasChildrenHint: {
    en: 'This category has subcategories — browse deeper and pick the most specific level.',
    ar: 'هذا القسم له أقسام فرعية — تصفّح لمستوى أعمق واختر أدق قسم.',
  },
  sameAsSource: {
    en: 'Choose a different category than the current one.',
    ar: 'اختر قسمًا مختلفًا عن القسم الحالي.',
  },
  mainMismatch: {
    en: 'The selected category does not belong to this department — pick one under the same main category.',
    ar: 'القسم المختار لا ينتمي لهذا القسم الرئيسي — اختر قسمًا تحت نفس القسم الرئيسي.',
  },
  bulkRequired: {
    en: 'Choose a complete subcategory (deepest level with no children) before applying.',
    ar: 'اختر قسمًا فرعيًا كاملاً (أعمق مستوى بدون أقسام فرعية) قبل التطبيق.',
  },
  reassignRequired: {
    en: 'Choose a leaf subcategory to move products into — products cannot sit on a category that has children.',
    ar: 'اختر قسمًا فرعيًا نهائيًا لنقل المنتجات إليه — لا يمكن وضع المنتجات في قسم له أقسام فرعية.',
  },
  mainUnresolved: {
    en: 'Could not resolve the main department for this category — pick the category again.',
    ar: 'تعذّر تحديد القسم الرئيسي لهذا القسم — اختر القسم مرة أخرى.',
  },
};

/** Map backend English messages (current + legacy) to error keys. */
const API_MESSAGE_TO_KEY = {
  'Choose a product category before saving.': 'required',
  'Product category (leaf subcategory) is required': 'required',
  'That category no longer exists — pick another from the list.': 'notFound',
  'Category not found': 'notFound',
  'This category is inactive — activate it first or choose another.': 'inactive',
  'Cannot assign products to an inactive category — activate the category first': 'inactive',
  'Choose a subcategory — products cannot be placed in a main category that has children.': 'hasChildrenMain',
  'Choose a subcategory — products cannot be placed in a category that has children.': 'hasChildren',
  'Products must be assigned to a leaf category (one with no subcategories)': 'hasChildren',
  'This category has subcategories — choose a deeper subcategory': 'hasChildren',
  'The selected category does not belong to this department — pick one under the same main category.': 'mainMismatch',
  'Category must belong to the selected main category': 'mainMismatch',
  'Could not resolve the main department for this category — pick the category again.': 'mainUnresolved',
  'Main category could not be resolved': 'mainUnresolved',
};

export function productCategoryError(key, isAr) {
  const entry = PRODUCT_CATEGORY_ERRORS[key];
  if (!entry) return '';
  return isAr ? entry.ar : entry.en;
}

/** Localize a category-related API error, or return the original / fallback. */
export function localizeProductCategoryApiError(message, isAr, fallbackKey = 'required') {
  if (!message) return productCategoryError(fallbackKey, isAr);
  const key = API_MESSAGE_TO_KEY[message.trim()];
  if (key) return productCategoryError(key, isAr);
  return message;
}

export function localizeAdminApiError(err, isAr, fallbackEn, fallbackAr) {
  const message = err?.response?.data?.message;
  if (message) {
    const localized = localizeProductCategoryApiError(message, isAr);
    if (localized !== message) return localized;
    return message;
  }
  return isAr ? fallbackAr : fallbackEn;
}
