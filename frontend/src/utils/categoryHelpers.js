/** Resolve parent category object from API or mock shape. */
export function getParentCategory(category, allCategories = []) {
  if (category?.parentCategory?.slug) return category.parentCategory;
  if (typeof category?.parentCategory === 'string') {
    return allCategories.find((c) => c._id === category.parentCategory) || null;
  }
  if (category?.parentSlug) {
    return allCategories.find((c) => c.slug === category.parentSlug) || null;
  }
  return null;
}

export function getParentSlug(category) {
  if (!category) return null;
  if (category.parentSlug) return category.parentSlug;
  if (category.parentCategory?.slug) return category.parentCategory.slug;
  return null;
}

export function isRootCategory(category) {
  return category?.level === 1 || (!category?.parentCategory && category?.level !== 2);
}

export function isSubCategory(category) {
  return !isRootCategory(category);
}

export function isLeafCategory(category, allCategories = []) {
  if (!category) return false;
  const hasChildren = allCategories.some((c) => {
    const pid = c.parentCategory?._id || c.parentCategory;
    return pid && String(pid) === String(category._id);
  });
  return !hasChildren;
}

/** Top-level categories shown in nav, shop-by-category, and all-categories menus. */
export function getRootCategories(allCategories = []) {
  return allCategories.filter(isRootCategory);
}

/** Direct child categories under a parent slug or id. */
export function getChildCategories(allCategories = [], parentRef) {
  if (!parentRef) return [];
  const parent = allCategories.find(
    (c) => c.slug === parentRef || String(c._id) === String(parentRef),
  );
  const parentSlug = parent?.slug || (typeof parentRef === 'string' && !/^[a-f0-9]{24}$/i.test(parentRef) ? parentRef : null);
  const parentId = parent?._id || (typeof parentRef === 'string' && /^[a-f0-9]{24}$/i.test(parentRef) ? parentRef : null);

  return allCategories.filter((c) => {
    if (c.isActive === false) return false;
    const pid = c.parentCategory?._id || c.parentCategory;
    if (parentId && pid && String(pid) === String(parentId)) return true;
    return parentSlug ? getParentSlug(c) === parentSlug : false;
  });
}

/** Categories where products can be assigned (no children). */
export function getLeafCategories(allCategories = [], allCats = allCategories) {
  return allCategories.filter((c) => isLeafCategory(c, allCats));
}

export function buildCategoryTree(allCategories = []) {
  const byParent = new Map();
  allCategories.forEach((c) => {
    const pid = c.parentCategory?._id || c.parentCategory || 'root';
    const key = String(pid);
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(c);
  });

  const build = (parentKey) => (byParent.get(parentKey) || [])
    .slice()
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
    .map((cat) => ({
      ...cat,
      children: build(String(cat._id)),
    }));

  return build('root');
}

/** Child categories for chips (API subcategories or mock parentSlug). */
export function getSubcategories(category, allCategories = [], apiSubcategories = []) {
  if (apiSubcategories?.length) return apiSubcategories;
  if (category?.subcategories?.length) return category.subcategories;
  if (category?.children?.length) return category.children;
  return getChildCategories(allCategories, category?.slug);
}

export function categoryLabel(cat, isAr) {
  if (!cat) return '';
  return isAr ? (cat.nameAr || cat.name) : (cat.nameEn || cat.name);
}

function flattenTreeNodes(nodes, parentMeta = null, rootMeta = null, pathAr = [], pathEn = [], acc = []) {
  nodes.forEach((node) => {
    const { children, ...rest } = node;
    const root = rootMeta || { slug: rest.slug, nameAr: rest.nameAr, nameEn: rest.nameEn };
    const isRootLevel = !rootMeta;
    const nextPathAr = isRootLevel ? [] : [...pathAr, rest.nameAr || rest.name].filter(Boolean);
    const nextPathEn = isRootLevel ? [] : [...pathEn, rest.nameEn].filter(Boolean);
    const depth = isRootLevel ? 0 : nextPathAr.length;

    acc.push({
      ...rest,
      parentSlug: isRootLevel ? (getParentSlug(node) || null) : (parentMeta?.slug || getParentSlug(node)),
      parentNameAr: parentMeta?.nameAr || parentMeta?.name,
      parentNameEn: parentMeta?.nameEn,
      parentIcon: parentMeta?.icon,
      parentColor: parentMeta?.color,
      rootSlug: root.slug,
      depth,
      pathLabelAr: depth > 0 ? nextPathAr.join(' › ') : '',
      pathLabelEn: depth > 0 ? nextPathEn.join(' › ') : '',
    });

    if (children?.length) {
      flattenTreeNodes(
        children,
        { ...rest, slug: rest.slug },
        root,
        nextPathAr,
        nextPathEn,
        acc,
      );
    }
  });
  return acc;
}

/** Flatten nested API tree (all levels) for lookups and mega-menu. */
export function flattenCategoryTree(tree = []) {
  return flattenTreeNodes(Array.isArray(tree) ? tree : []);
}

/** Flat list of nested subcategories with parent metadata (excludes main/root departments). */
export function getAllSubcategories(categoryTree = [], allCategories = []) {
  if (categoryTree?.length) {
    return flattenTreeNodes(categoryTree).filter((sub) => sub.depth > 0);
  }
  return getLeafCategories(allCategories).map((sub) => {
    const parent = getParentCategory(sub, allCategories);
    const chain = buildCategorySlugChain(sub, allCategories);
    return {
      ...sub,
      parentSlug: parent?.slug || getParentSlug(sub),
      parentNameAr: parent?.nameAr || parent?.name,
      parentNameEn: parent?.nameEn,
      parentIcon: parent?.icon,
      parentColor: parent?.color,
      rootSlug: chain[0] || null,
    };
  });
}

/** Root (level-1) slug for any category node. */
export function getRootSlugForCategory(category, allCategories = []) {
  if (!category?.slug) return null;
  const chain = buildCategorySlugChain(category, allCategories);
  return chain[0] || category.slug;
}

/** Whether a category belongs under a given main department slug. */
export function isUnderRootCategory(category, rootSlug, allCategories = []) {
  if (!rootSlug) return true;
  return getRootSlugForCategory(category, allCategories) === rootSlug;
}

/** All nested descendants under a main department (for filters and browse lists). */
export function getDescendantsUnderRoot(allCategories = [], rootSlug) {
  const root = allCategories.find((c) => c.slug === rootSlug);
  if (!root) return [];

  const byParentId = new Map();
  allCategories.forEach((c) => {
    if (c.isActive === false) return;
    const pid = c.parentCategory?._id || c.parentCategory;
    if (!pid) return;
    const key = String(pid);
    if (!byParentId.has(key)) byParentId.set(key, []);
    byParentId.get(key).push(c);
  });

  const bySlug = new Map(allCategories.map((c) => [c.slug, c]));
  const result = [];

  const walk = (cat) => {
    const chain = buildCategorySlugChain(cat, allCategories);
    const depth = chain.length - 1;
    const pathSlugs = chain.slice(1);
    result.push({
      ...cat,
      parentSlug: getParentSlug(cat),
      rootSlug: chain[0],
      depth,
      pathLabelAr: pathSlugs.map((s) => bySlug.get(s)?.nameAr || bySlug.get(s)?.name).filter(Boolean).join(' › '),
      pathLabelEn: pathSlugs.map((s) => bySlug.get(s)?.nameEn).filter(Boolean).join(' › '),
    });
    (byParentId.get(String(cat._id)) || [])
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || (a.nameEn || '').localeCompare(b.nameEn || ''))
      .forEach(walk);
  };

  (byParentId.get(String(root._id)) || [])
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || (a.nameEn || '').localeCompare(b.nameEn || ''))
    .forEach(walk);

  return result;
}

/** Label for filter rows — shows full path for nested categories. */
export function filterSubcategoryLabel(sub, isAr) {
  if (isAr && sub.pathLabelAr) return sub.pathLabelAr;
  if (!isAr && sub.pathLabelEn) return sub.pathLabelEn;
  return categoryLabel(sub, isAr);
}

/** Build slug chain from flat category list (root → … → node). */
export function buildCategorySlugChain(category, allCategories = []) {
  if (!category?.slug) return [];
  const bySlug = new Map(allCategories.map((c) => [c.slug, c]));
  const chain = [category.slug];
  let parentSlug = getParentSlug(category);
  while (parentSlug) {
    chain.unshift(parentSlug);
    const parent = bySlug.get(parentSlug);
    parentSlug = parent ? getParentSlug(parent) : null;
  }
  return chain;
}

/** Build storefront URL from slug chain, e.g. ["grocery","dairy"] → /category/grocery/dairy */
export function buildCategoryPath(slugsOrChain) {
  if (!slugsOrChain) return '/categories';
  if (typeof slugsOrChain === 'string') {
    const trimmed = slugsOrChain.replace(/^\/+|\/+$/g, '');
    return trimmed ? `/category/${trimmed}` : '/categories';
  }
  const slugs = slugsOrChain.map((item) => (typeof item === 'string' ? item : item?.slug)).filter(Boolean);
  return slugs.length ? `/category/${slugs.join('/')}` : '/categories';
}

/** Storefront URL for a category node. Prefer pathPrefix or full chain from flat list. */
export function categoryHref(category, parentSlug = null, pathPrefix = null, allCategories = []) {
  if (!category?.slug) return '/categories';
  if (pathPrefix) return buildCategoryPath(`${pathPrefix}/${category.slug}`.replace(/^\/+/, ''));
  if (allCategories?.length) {
    return buildCategoryPath(buildCategorySlugChain(category, allCategories));
  }
  const parent = parentSlug || getParentSlug(category);
  if (parent) return buildCategoryPath([parent, category.slug]);
  return buildCategoryPath(category.slug);
}

export function childrenOf(allCategories, parentId) {
  if (!parentId) return [];
  return allCategories.filter((c) => {
    const pid = c.parentCategory?._id || c.parentCategory;
    return pid && String(pid) === String(parentId);
  });
}

export function categoryHasChildren(allCategories, categoryId) {
  if (!categoryId) return false;
  return childrenOf(allCategories, categoryId).length > 0;
}

/** Resolve the leaf category id from admin level picks (deepest selection without children). */
export function resolveProductCategoryLeaf(allCategories = [], { level1 = '', level2 = '', level3 = '', level4 = '' } = {}) {
  const chain = [level1, level2, level3, level4].filter(Boolean);
  if (!chain.length) {
    return { leafId: '', status: 'empty', pendingLevel: 1 };
  }

  const deepest = chain[chain.length - 1];
  if (categoryHasChildren(allCategories, deepest)) {
    return {
      leafId: '',
      status: 'needs-deeper',
      pendingLevel: chain.length + 1,
      deepestId: deepest,
    };
  }

  return {
    leafId: deepest,
    status: 'ok',
    pendingLevel: null,
    deepestId: deepest,
  };
}

export function buildCategorySelectionFromLeaf(categories, leafId) {
  const chain = [];
  let current = categories.find((c) => String(c._id) === String(leafId));
  while (current) {
    chain.unshift(current);
    const pid = current.parentCategory?._id || current.parentCategory;
    current = pid ? categories.find((c) => String(c._id) === String(pid)) : null;
  }
  return {
    level1: chain[0]?._id || '',
    level2: chain[1]?._id || '',
    level3: chain[2]?._id || '',
    level4: chain[3]?._id || '',
    leafId: chain[chain.length - 1]?._id || '',
  };
}

export const CATEGORY_LEVEL_LABELS = {
  1: { en: 'Main category', ar: 'قسم رئيسي' },
  2: { en: 'Category', ar: 'قسم' },
  3: { en: 'Sub category', ar: 'قسم فرعي' },
  4: { en: 'Sub-sub category', ar: 'قسم فرعي فرعي' },
};

export function categoryRoleMeta(category) {
  const childCount = category?.childCount ?? 0;
  const isLeaf = category?.isLeaf ?? childCount === 0;
  return { isLeaf, canHoldProducts: isLeaf, isGroup: !isLeaf, childCount };
}

export function categoryRoleLabel(category, isAr) {
  const { isLeaf } = categoryRoleMeta(category);
  if (isLeaf) {
    return isAr ? 'قسم منتجات' : 'Products';
  }
  return isAr ? 'مجموعة فقط' : 'Group only';
}

export function categoryLevelLabel(level, isAr) {
  const labels = CATEGORY_LEVEL_LABELS[level] || CATEGORY_LEVEL_LABELS[1];
  return isAr ? labels.ar : labels.en;
}

/** Ancestor breadcrumb for a category (main › category › …), excluding the node itself. */
export function getCategoryAncestorPath(category, allCategories = [], isAr) {
  if (!category?._id) return '';
  const tree = buildCategoryTree(allCategories);
  const flat = flattenCategoryTree(tree);
  const row = flat.find((c) => String(c._id) === String(category._id));
  if (!row) return '';
  return isAr ? (row.pathLabelAr || '') : (row.pathLabelEn || row.pathLabelAr || '');
}

/** Full breadcrumb including the category itself. */
export function getCategoryFullPath(category, allCategories = [], isAr) {
  const ancestors = getCategoryAncestorPath(category, allCategories, isAr);
  const self = categoryLabel(category, isAr);
  return ancestors ? `${ancestors} › ${self}` : self;
}

/** Full breadcrumb chain from root to node (e.g. Baby Care > Diapers > Pampers). */
export function getCategoryBreadcrumb(category, allCategories = [], isAr, separator = ' > ') {
  if (!category?._id) return '';
  const chain = [];
  let current = category;
  const guard = new Set();
  while (current && !guard.has(String(current._id))) {
    guard.add(String(current._id));
    chain.unshift(current);
    const pid = current.parentCategory?._id || current.parentCategory;
    current = pid ? allCategories.find((c) => String(c._id) === String(pid)) : null;
  }
  return chain.map((c) => categoryLabel(c, isAr)).join(separator);
}

/** Breadcrumb label for parent picker options (main › category › …). */
export function parentSelectLabel(category, isAr) {
  const name = categoryLabel(category, isAr);
  const parent = category?.parentCategory;
  if (!parent || typeof parent !== 'object' || !parent._id) return name;

  const parentName = categoryLabel(parent, isAr);
  const grandparent = parent.parentCategory;
  if (grandparent && typeof grandparent === 'object' && grandparent._id) {
    return `${categoryLabel(grandparent, isAr)} › ${parentName} › ${name}`;
  }
  return `${parentName} › ${name}`;
}

export function buildCategoryActionWarning(category, action, isAr) {
  const name = categoryLabel(category, isAr);
  const { childCount } = categoryRoleMeta(category);
  const activeProductCount = category?.activeProductCount ?? category?.productCount ?? 0;
  const lines = [isAr ? `«${name}»` : `"${name}"`];

  if (activeProductCount > 0) {
    lines.push(
      isAr
        ? `${activeProductCount} منتج نشط — يجب نقله أولاً.`
        : `${activeProductCount} active product(s) — must be reassigned first.`,
    );
  }
  if (childCount > 0) {
    lines.push(
      isAr
        ? `يحتوي على ${childCount} قسم فرعي.`
        : `Has ${childCount} sub-categorie(s).`,
    );
  }

  if (action === 'delete') {
    if (activeProductCount > 0) {
      lines.push(
        isAr
          ? 'استخدم «نقل المنتجات» قبل الحذف.'
          : 'Use “Move products” before deleting.',
      );
    } else if (childCount > 0) {
      lines.push(
        isAr
          ? 'أزل الأقسام الفرعية أولاً.'
          : 'Remove subcategories first.',
      );
    } else {
      lines.push(isAr ? 'سيتم حذف القسم نهائياً.' : 'This category will be deleted permanently.');
    }
  } else if (action === 'deactivate') {
    if (activeProductCount > 0) {
      lines.push(
        isAr
          ? 'استخدم «نقل المنتجات» قبل التعطيل.'
          : 'Use “Move products” before deactivating.',
      );
    } else {
      lines.push(isAr ? 'لن يظهر القسم في المتجر.' : 'This category will be hidden from the storefront.');
    }
  }

  return lines.join(' ');
}

export function categoryHasActiveProducts(category) {
  return (category?.activeProductCount ?? 0) > 0;
}

const BULK_BLOCK_REASONS = {
  active_products: {
    en: 'Has active products — reassign first',
    ar: 'منتجات نشطة — انقلها أولاً',
  },
  inactive_products: {
    en: 'Has inactive linked products — reassign or remove first',
    ar: 'منتجات معطلة مرتبطة — انقلها أو احذفها أولاً',
  },
  has_children: {
    en: 'Has subcategories — remove children first',
    ar: 'له أقسام فرعية — أزلها أولاً',
  },
  already_inactive: {
    en: 'Already inactive — will be skipped',
    ar: 'معطل مسبقاً — سيُتخطى',
  },
  already_active: {
    en: 'Already active — will be skipped',
    ar: 'نشط مسبقاً — سيُتخطى',
  },
};

export function bulkBlockReasonLabel(reason, isAr) {
  if (!reason) return '';
  return BULK_BLOCK_REASONS[reason]?.[isAr ? 'ar' : 'en'] || reason;
}

/** Why a category cannot be included in a bulk action (null = allowed). */
export function getCategoryBulkBlockReason(category, action) {
  if (!category) return 'not_found';
  const active = category.activeProductCount ?? 0;
  const total = category.productCount ?? 0;
  const children = category.childCount ?? 0;

  if (action === 'activate') {
    if (category.isActive !== false) return 'already_active';
    return null;
  }

  if (action === 'deactivate') {
    if (category.isActive === false) return 'already_inactive';
    if (active > 0) return 'active_products';
    return null;
  }

  if (action === 'delete') {
    if (children > 0) return 'has_children';
    if (active > 0) return 'active_products';
    if (total > active) return 'inactive_products';
    return null;
  }

  return null;
}

export function buildBulkCategoryImpact(categories, action, isAr) {
  const rows = (categories || []).map((category) => {
    const blockReason = getCategoryBulkBlockReason(category, action);
    const isSkip = blockReason === 'already_active' || blockReason === 'already_inactive';
    return { category, blockReason, isSkip };
  });

  const eligible = rows
    .filter((row) => !row.blockReason)
    .map((row) => row.category);
  const skipped = rows
    .filter((row) => row.isSkip)
    .map((row) => ({ category: row.category, reason: row.blockReason }));
  const blocked = rows
    .filter((row) => row.blockReason && !row.isSkip)
    .map((row) => ({ category: row.category, reason: row.blockReason }));

  const activeProducts = categories.reduce((sum, c) => sum + (c.activeProductCount ?? 0), 0);
  const linkedProducts = categories.reduce((sum, c) => sum + (c.productCount ?? 0), 0);
  const withChildren = categories.filter((c) => (c.childCount ?? 0) > 0).length;
  const withActiveProducts = categories.filter(categoryHasActiveProducts).length;

  const actionTitles = {
    activate: { en: 'Activate', ar: 'تفعيل' },
    deactivate: { en: 'Deactivate', ar: 'تعطيل' },
    delete: { en: 'Delete', ar: 'حذف' },
  };

  return {
    action,
    actionTitle: actionTitles[action]?.[isAr ? 'ar' : 'en'] || action,
    total: categories.length,
    eligible,
    eligibleIds: eligible.map((c) => c._id),
    skipped,
    blocked,
    canProceed: eligible.length > 0,
    totals: { activeProducts, linkedProducts, withChildren, withActiveProducts },
    summaryLines: buildBulkImpactSummaryLines({
      action,
      isAr,
      total: categories.length,
      eligibleCount: eligible.length,
      skippedCount: skipped.length,
      blockedCount: blocked.length,
      totals: { activeProducts, linkedProducts, withChildren, withActiveProducts },
    }),
  };
}

function buildBulkImpactSummaryLines({
  action,
  isAr,
  total,
  eligibleCount,
  skippedCount,
  blockedCount,
  totals,
}) {
  const lines = [];
  lines.push(
    isAr
      ? `${total} قسم محدد`
      : `${total} categor${total === 1 ? 'y' : 'ies'} selected`,
  );

  if (totals.activeProducts > 0) {
    lines.push(
      isAr
        ? `${totals.activeProducts} منتج نشط مرتبط`
        : `${totals.activeProducts} active product(s) linked`,
    );
  }
  if (totals.withChildren > 0) {
    lines.push(
      isAr
        ? `${totals.withChildren} قسم له أقسام فرعية`
        : `${totals.withChildren} with subcategories`,
    );
  }

  if (eligibleCount > 0) {
    lines.push(
      isAr
        ? `${eligibleCount} جاهز للتطبيق`
        : `${eligibleCount} can proceed`,
    );
  }
  if (skippedCount > 0) {
    lines.push(
      isAr
        ? `${skippedCount} سيُتخطى (لا تغيير مطلوب)`
        : `${skippedCount} will be skipped (no change needed)`,
    );
  }
  if (blockedCount > 0) {
    lines.push(
      isAr
        ? `${blockedCount} محظور — لن يُطبَّق`
        : `${blockedCount} blocked — will not apply`,
    );
  }

  if (action === 'activate' && eligibleCount > 0) {
    lines.push(
      isAr
        ? 'الأقسام المفعّلة ستظهر في المتجر.'
        : 'Activated categories will appear on the storefront.',
    );
  }

  return lines;
}
