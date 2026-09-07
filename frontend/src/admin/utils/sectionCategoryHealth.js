/**
 * Resolve homepage section category link health for admin warnings.
 */
export function resolveSectionCategoryHealth({
  categoryId = '',
  category = null,
  categoryIssue = null,
  categories = [],
} = {}) {
  const id = String(categoryId || category?._id || category || '').trim();
  if (!id) return { status: 'none' };

  if (categoryIssue === 'missing') {
    return { status: 'missing', categoryId: id };
  }
  if (categoryIssue === 'inactive') {
    return { status: 'inactive', categoryId: id, category };
  }

  const fromList = categories.find((c) => String(c._id) === id);
  const resolved = category?.slug ? category : fromList;

  if (!resolved) {
    return { status: 'missing', categoryId: id };
  }
  if (resolved.isActive === false) {
    return { status: 'inactive', categoryId: id, category: resolved };
  }
  return { status: 'ok', categoryId: id, category: resolved };
}

export function sectionCategoryWarningCopy(health, isAr) {
  if (!health || health.status === 'none' || health.status === 'ok') return null;

  if (health.status === 'missing') {
    return {
      tone: 'danger',
      titleAr: 'قسم محذوف أو غير موجود',
      titleEn: 'Category deleted or missing',
      bodyAr: `القسم المرتبط (${health.categoryId}) لم يعد موجوداً — لن يظهر أي منتج حتى تختار قسماً جديداً.`,
      bodyEn: `The linked category (${health.categoryId}) no longer exists — no products will show until you pick a new category.`,
    };
  }

  if (health.status === 'inactive') {
    const name = isAr
      ? (health.category?.nameAr || health.category?.nameEn || health.categoryId)
      : (health.category?.nameEn || health.category?.nameAr || health.categoryId);
    return {
      tone: 'warning',
      titleAr: 'قسم غير نشط',
      titleEn: 'Category inactive',
      bodyAr: `«${name}» معطّل — مخفي من المتجر ولن يجلب منتجات للقسم.`,
      bodyEn: `"${name}" is inactive — hidden on the storefront and will not supply products to this section.`,
    };
  }

  return null;
}

export function sectionUsesCategoryLink(section) {
  if (!section) return false;
  if (section.categoryIssue) return true;
  if (section.categoryId && !section.category) return true;
  return Boolean(section.category?._id || section.category);
}
