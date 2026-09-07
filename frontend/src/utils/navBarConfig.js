import { parseHeaderToolbar, serializeHeaderToolbar } from './headerToolbarConfig';
import { buildCategoryPath, buildCategorySlugChain } from './categoryHelpers';

export const DEFAULT_HOME_NAV = {
  labelAr: 'الرئيسية',
  labelEn: 'Home',
  sortOrder: 0,
  isActive: true,
  showOnMobile: true,
};

function normalizeHref(href) {
  const raw = String(href || '/').trim();
  if (!raw || raw === '/') return '/';
  return raw.startsWith('/') ? raw.replace(/\/+$/, '') || '/' : `/${raw.replace(/\/+$/, '')}`;
}

function isHomeHref(href) {
  return normalizeHref(href) === '/';
}

function isOffersHref(href) {
  return normalizeHref(href) === '/offers';
}

/** Split stored navigation into home, plain links, and custom nav categories. */
export function parseNavigationConfig(navigation = {}) {
  const rawLinks = (navigation.headerLinks || []).map((link, index) => ({
    ...link,
    href: normalizeHref(link.href),
    sortOrder: link.sortOrder ?? index + 1,
  }));

  const homeFromLinks = rawLinks.find((link) => isHomeHref(link.href));

  const homeNav = {
    ...DEFAULT_HOME_NAV,
    ...(navigation.homeNav || {}),
    labelAr: navigation.homeNav?.labelAr || homeFromLinks?.labelAr || DEFAULT_HOME_NAV.labelAr,
    labelEn: navigation.homeNav?.labelEn || homeFromLinks?.labelEn || DEFAULT_HOME_NAV.labelEn,
    sortOrder: navigation.homeNav?.sortOrder ?? homeFromLinks?.sortOrder ?? 0,
    isActive: navigation.homeNav?.isActive !== false && homeFromLinks?.isActive !== false,
    showOnMobile: navigation.homeNav?.showOnMobile !== false && homeFromLinks?.showOnMobile !== false,
  };

  const headerLinks = rawLinks.filter((link) => !isHomeHref(link.href));

  if (!headerLinks.length && !navigation.navCategories?.length) {
    headerLinks.push({
      labelAr: 'العروض',
      labelEn: 'Offers',
      href: '/offers',
      highlight: true,
      sortOrder: 1,
      isActive: true,
      isExternal: false,
      showOnMobile: true,
    });
  }

  const navCategories = (navigation.navCategories || [])
    .map((item, index) => ({
      categorySlug: String(item.categorySlug || '').trim(),
      labelAr: item.labelAr || '',
      labelEn: item.labelEn || '',
      sortOrder: item.sortOrder ?? index + 10,
      isActive: item.isActive !== false,
      showOnMobile: item.showOnMobile !== false,
    }))
    .filter((item) => item.categorySlug);

  return { homeNav, headerLinks, navCategories };
}

/** Build ordered storefront nav items for desktop + mobile. */
export function buildStoreNavItems(navigation = {}, categories = [], getChildren = () => []) {
  const { homeNav, headerLinks, navCategories } = parseNavigationConfig(navigation);
  const findCategory = (slug) => categories.find((cat) => cat.slug === slug) || null;

  const items = [];

  if (homeNav.isActive !== false) {
    items.push({
      id: 'home',
      type: 'home',
      sortOrder: homeNav.sortOrder ?? 0,
      labelAr: homeNav.labelAr || DEFAULT_HOME_NAV.labelAr,
      labelEn: homeNav.labelEn || DEFAULT_HOME_NAV.labelEn,
      to: '/',
      megaScope: 'all',
      showOnMobile: homeNav.showOnMobile !== false,
    });
  }

  headerLinks
    .filter((link) => link.isActive !== false)
    .forEach((link, index) => {
      items.push({
        id: `link-${index}-${link.href}`,
        type: 'link',
        sortOrder: link.sortOrder ?? index + 1,
        labelAr: link.labelAr || '',
        labelEn: link.labelEn || '',
        to: link.href || '/offers',
        highlight: link.highlight,
        isExternal: link.isExternal,
        isOffers: isOffersHref(link.href),
        megaScope: null,
        showOnMobile: link.showOnMobile !== false,
      });
    });

  navCategories
    .filter((item) => item.isActive !== false)
    .forEach((item, index) => {
      const cat = findCategory(item.categorySlug);
      const href = cat
        ? buildCategoryPath(buildCategorySlugChain(cat, categories))
        : buildCategoryPath(item.categorySlug);
      const hasChildren = getChildren(item.categorySlug).length > 0;

      items.push({
        id: `category-${item.categorySlug}`,
        type: 'category',
        sortOrder: item.sortOrder ?? index + 20,
        slug: item.categorySlug,
        labelAr: item.labelAr || cat?.nameAr || cat?.name || item.categorySlug,
        labelEn: item.labelEn || cat?.nameEn || cat?.name || item.categorySlug,
        to: href,
        hasChildren,
        hasMegaMenu: true,
        megaScope: 'single',
        showOnMobile: item.showOnMobile !== false,
      });
    });

  return items.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
}

/** Mobile menu / app — hide items admin marked desktop-only. */
export function filterNavItemsForMobile(items = []) {
  return items.filter((item) => item.showOnMobile !== false);
}

/** Re-index sortOrder after admin reorder. */
export function reindexNavSortOrders(homeNav, headerLinks, navCategories) {
  const merged = [
    { kind: 'home', sortOrder: homeNav.sortOrder ?? 0 },
    ...headerLinks.map((link, i) => ({ kind: 'link', index: i, sortOrder: link.sortOrder ?? i + 1 })),
    ...navCategories.map((item, i) => ({ kind: 'category', index: i, sortOrder: item.sortOrder ?? i + 20 })),
  ].sort((a, b) => a.sortOrder - b.sortOrder);

  const nextHome = { ...homeNav };
  const nextLinks = headerLinks.map((link) => ({ ...link }));
  const nextCategories = navCategories.map((item) => ({ ...item }));

  merged.forEach((entry, order) => {
    if (entry.kind === 'home') nextHome.sortOrder = order;
    if (entry.kind === 'link') nextLinks[entry.index].sortOrder = order;
    if (entry.kind === 'category') nextCategories[entry.index].sortOrder = order;
  });

  return {
    homeNav: nextHome,
    headerLinks: nextLinks,
    navCategories: nextCategories,
  };
}

export function serializeNavigationForSave(navigation = {}) {
  const parsed = parseNavigationConfig(navigation);
  const reindexed = reindexNavSortOrders(
    parsed.homeNav,
    parsed.headerLinks,
    parsed.navCategories,
  );

  return {
    ...navigation,
    announcementAr: navigation.announcementAr || '',
    announcementEn: navigation.announcementEn || '',
    homeNav: reindexed.homeNav,
    headerLinks: reindexed.headerLinks,
    navCategories: reindexed.navCategories,
    showCategoryLinks: false,
    headerToolbar: serializeHeaderToolbar(parseHeaderToolbar(navigation)),
  };
}

export { normalizeHref, isHomeHref };
