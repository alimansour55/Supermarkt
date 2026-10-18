/**
 * Pure state helpers for the Header & Footer editor (/admin/navigation).
 *
 * Every function takes the editor's `navigation` object and returns a new one —
 * no React, no API — so the preview, the side panel and the undo history all go
 * through the same rules, and the rules are unit-tested (test/navigationEditor.test.js).
 *
 * Shape notes:
 * - The editor always works on a prepared copy (`prepareNavigationForEditor`):
 *   toolbar reindexed with every built-in present, menu saved as "customized",
 *   footer columns sorted. Indexes used by selections refer to that copy.
 * - Built-in header items (Cart, Favorites, Account, All Categories) are never
 *   deleted — only hidden — so they can always be shown again.
 */
import {
  DEFAULT_HEADER_TOOLBAR,
  HEADER_BUILTIN_KEYS,
  HEADER_BUILTIN_META,
  moveHeaderToolbarItem,
  normalizeToolbarItem,
  parseHeaderToolbar,
  reindexHeaderToolbar,
  serializeHeaderToolbar,
} from '../../utils/headerToolbarConfig.js';
import {
  DEFAULT_HOME_NAV,
  STORE_NAV_MAX_ITEMS,
  parseNavigationConfig,
  reindexNavSortOrders,
  serializeNavigationForSave,
} from '../../utils/navBarConfig.js';
import { DEFAULT_FOOTER_COLUMNS } from '../../utils/footerConfig.js';
import { normalizeNavHref } from './navigationHelpers.js';

const clone = (value) => JSON.parse(JSON.stringify(value));

export const DEFAULT_MENU_LINK = {
  labelAr: 'العروض',
  labelEn: 'Offers',
  href: '/offers',
  highlight: true,
  sortOrder: 1,
  isActive: true,
  isExternal: false,
  showOnMobile: true,
};

/* ------------------------------------------------------------------ *
 * Load / save
 * ------------------------------------------------------------------ */

function cleanHref(href) {
  const trimmed = String(href ?? '').trim();
  return trimmed ? normalizeNavHref(trimmed) : '';
}

function sortByOrder(list = []) {
  return list
    .map((item, index) => ({ item, index }))
    .sort((a, b) => ((a.item.sortOrder ?? a.index) - (b.item.sortOrder ?? b.index)) || a.index - b.index)
    .map(({ item }) => item);
}

/** Toolbar in reading order, with any missing built-in appended as hidden. */
export function editorToolbar(navigation = {}) {
  const items = reindexHeaderToolbar(parseHeaderToolbar(navigation));
  const present = new Set(items.map((item) => item.itemKey));
  const missing = HEADER_BUILTIN_KEYS
    .filter((key) => !present.has(key))
    .map((key) => {
      const preset = DEFAULT_HEADER_TOOLBAR.find((d) => d.itemKey === key);
      return normalizeToolbarItem({ ...preset, sortOrder: 99, isActive: false });
    });
  return missing.length ? reindexHeaderToolbar([...items, ...missing]) : items;
}

/**
 * Normalize stored navigation into the shape the editor works on. Idempotent —
 * used on load, for the dirty check, and to build the save payload.
 */
export function prepareNavigationForEditor(raw = {}) {
  const nav = serializeNavigationForSave(raw || {});
  const columns = Array.isArray(raw?.footerColumns) && raw.footerColumns.length
    ? raw.footerColumns
    : clone(DEFAULT_FOOTER_COLUMNS);

  return {
    ...nav,
    menuCustomized: true,
    headerLinks: nav.headerLinks.map((link) => ({ ...link, href: cleanHref(link.href) })),
    headerToolbar: serializeHeaderToolbar(editorToolbar(nav)),
    footerColumns: sortByOrder(columns).map((col, colIndex) => ({
      ...col,
      titleAr: col.titleAr || '',
      titleEn: col.titleEn || '',
      sortOrder: colIndex,
      links: sortByOrder(col.links || []).map((link, linkIndex) => ({
        ...link,
        href: cleanHref(link.href),
        sortOrder: linkIndex,
      })),
    })),
    footer: { ...(raw?.footer || {}) },
  };
}

/* ------------------------------------------------------------------ *
 * Header toolbar
 * ------------------------------------------------------------------ */

function withToolbar(navigation, items) {
  return { ...navigation, headerToolbar: serializeHeaderToolbar(items) };
}

export function updateToolbarItem(navigation, index, patch) {
  const items = editorToolbar(navigation);
  if (!items[index]) return navigation;
  return withToolbar(navigation, items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
}

export function moveToolbarItem(navigation, index, dir) {
  return withToolbar(navigation, moveHeaderToolbarItem(editorToolbar(navigation), index, dir));
}

/** Drag-and-drop: put item `from` where item `to` is (taking its zone). */
export function reorderToolbarItem(navigation, from, to) {
  const items = editorToolbar(navigation);
  if (from === to || !items[from] || !items[to]) return navigation;
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, { ...moved, zone: items[to].zone });
  return withToolbar(navigation, renumberToolbar(next));
}

function renumberToolbar(list) {
  const counters = { start: 0, end: 0 };
  return list.map((item) => {
    const sortOrder = counters[item.zone];
    counters[item.zone] += 1;
    return { ...item, sortOrder };
  });
}

/** Returns { navigation, removed } — built-ins are hidden instead of removed. */
export function removeToolbarItem(navigation, index) {
  const items = editorToolbar(navigation);
  const item = items[index];
  if (!item) return { navigation, removed: null };
  if (HEADER_BUILTIN_KEYS.includes(item.itemKey)) {
    return { navigation: updateToolbarItem(navigation, index, { isActive: false }), removed: null };
  }
  return {
    navigation: withToolbar(navigation, items.filter((_, i) => i !== index)),
    removed: { kind: 'toolbar', item },
  };
}

/** Add a built-in (or show it again if it is hidden). Returns { navigation, index }. */
export function showBuiltinToolbarItem(navigation, key, zone = 'end') {
  const items = editorToolbar(navigation);
  const index = items.findIndex((item) => item.itemKey === key);
  if (index >= 0) {
    const next = updateToolbarItem(navigation, index, { isActive: true });
    return { navigation: next, index: editorToolbar(next).findIndex((item) => item.itemKey === key) };
  }
  const meta = HEADER_BUILTIN_META[key];
  return appendToolbarItem(navigation, normalizeToolbarItem({
    itemKey: key, zone, isActive: true, showLabel: true, labelAr: meta?.labelAr, labelEn: meta?.labelEn,
  }));
}

/** Append an item at the end of its zone. Returns { navigation, index }. */
export function appendToolbarItem(navigation, item) {
  const items = editorToolbar(navigation);
  const zone = item.zone === 'start' ? 'start' : 'end';
  const appended = { ...item, zone, sortOrder: items.filter((i) => i.zone === zone).length };
  const next = reindexHeaderToolbar([...items, appended]);
  return { navigation: withToolbar(navigation, next), index: next.indexOf(appended) };
}

export function allCategoriesIndex(navigation) {
  return editorToolbar(navigation).findIndex((item) => item.itemKey === 'categories');
}

/* ------------------------------------------------------------------ *
 * Category menu row (Home + links + categories)
 * ------------------------------------------------------------------ */

/** Rows in display order; keys are `home`, `link-<index>`, `cat-<slug>`. */
export function buildOrderedNavRows(navigation) {
  const { homeNav, headerLinks, navCategories } = parseNavigationConfig(navigation);
  const rows = [
    { key: 'home', type: 'home', sortOrder: homeNav.sortOrder ?? 0, data: homeNav },
    ...headerLinks.map((link, index) => ({
      key: `link-${index}`, type: 'link', sortOrder: link.sortOrder ?? index + 1, data: link, index,
    })),
    ...navCategories.map((item, index) => ({
      key: `cat-${item.categorySlug}`, type: 'category', sortOrder: item.sortOrder ?? index + 20, data: item, index,
    })),
  ];
  return rows.sort((a, b) => a.sortOrder - b.sortOrder);
}

function menuParts(navigation) {
  return {
    homeNav: { ...DEFAULT_HOME_NAV, ...(navigation.homeNav || {}) },
    headerLinks: (navigation.headerLinks || []).map((l) => ({ ...l })),
    navCategories: (navigation.navCategories || []).map((c) => ({ ...c })),
  };
}

function commitMenu(navigation, homeNav, headerLinks, navCategories) {
  const reindexed = reindexNavSortOrders(homeNav, headerLinks, navCategories);
  return {
    ...navigation,
    menuCustomized: true,
    showCategoryLinks: false,
    homeNav: reindexed.homeNav,
    headerLinks: reindexed.headerLinks,
    navCategories: reindexed.navCategories,
  };
}

/** Patch the row's stored item (home / link / category). */
export function updateMenuRow(navigation, rowKey, patch) {
  const { homeNav, headerLinks, navCategories } = menuParts(navigation);
  if (rowKey === 'home') return commitMenu(navigation, { ...homeNav, ...patch }, headerLinks, navCategories);
  if (rowKey.startsWith('link-')) {
    const index = Number(rowKey.slice(5));
    if (!headerLinks[index]) return navigation;
    headerLinks[index] = { ...headerLinks[index], ...patch };
    return commitMenu(navigation, homeNav, headerLinks, navCategories);
  }
  if (rowKey.startsWith('cat-')) {
    const slug = rowKey.slice(4);
    const index = navCategories.findIndex((c) => c.categorySlug === slug);
    if (index < 0) return navigation;
    navCategories[index] = { ...navCategories[index], ...patch };
    return commitMenu(navigation, homeNav, headerLinks, navCategories);
  }
  return navigation;
}

export function getMenuRowItem(navigation, rowKey) {
  const { homeNav, headerLinks, navCategories } = menuParts(navigation);
  if (rowKey === 'home') return homeNav;
  if (rowKey.startsWith('link-')) return headerLinks[Number(rowKey.slice(5))] || null;
  if (rowKey.startsWith('cat-')) return navCategories.find((c) => c.categorySlug === rowKey.slice(4)) || null;
  return null;
}

function applyRowOrder(navigation, order) {
  const { homeNav, headerLinks, navCategories } = menuParts(navigation);
  order.forEach((row, sortOrder) => {
    if (row.type === 'home') homeNav.sortOrder = sortOrder;
    if (row.type === 'link') headerLinks[row.index].sortOrder = sortOrder;
    if (row.type === 'category') navCategories[row.index].sortOrder = sortOrder;
  });
  return commitMenu(navigation, homeNav, headerLinks, navCategories);
}

export function moveMenuRow(navigation, rowKey, dir) {
  const rows = buildOrderedNavRows(navigation);
  const idx = rows.findIndex((r) => r.key === rowKey);
  const target = idx + dir;
  if (idx < 0 || target < 0 || target >= rows.length) return navigation;
  const order = [...rows];
  [order[idx], order[target]] = [order[target], order[idx]];
  return applyRowOrder(navigation, order);
}

/** Drag-and-drop: put row `fromKey` where row `toKey` is. */
export function reorderMenuRow(navigation, fromKey, toKey) {
  const rows = buildOrderedNavRows(navigation);
  const from = rows.findIndex((r) => r.key === fromKey);
  const to = rows.findIndex((r) => r.key === toKey);
  if (from < 0 || to < 0 || from === to) return navigation;
  const order = [...rows];
  const [moved] = order.splice(from, 1);
  order.splice(to, 0, moved);
  return applyRowOrder(navigation, order);
}

/** Returns { navigation, removed }. Home cannot be removed (only hidden). */
export function removeMenuRow(navigation, rowKey) {
  const { homeNav, headerLinks, navCategories } = menuParts(navigation);
  if (rowKey.startsWith('link-')) {
    const index = Number(rowKey.slice(5));
    const item = headerLinks[index];
    if (!item) return { navigation, removed: null };
    return {
      navigation: commitMenu(navigation, homeNav, headerLinks.filter((_, i) => i !== index), navCategories),
      removed: { kind: 'menu-link', item },
    };
  }
  if (rowKey.startsWith('cat-')) {
    const slug = rowKey.slice(4);
    const item = navCategories.find((c) => c.categorySlug === slug);
    if (!item) return { navigation, removed: null };
    return {
      navigation: commitMenu(navigation, homeNav, headerLinks, navCategories.filter((c) => c.categorySlug !== slug)),
      removed: { kind: 'menu-category', item },
    };
  }
  return { navigation, removed: null };
}

function nextMenuOrder(navigation) {
  const rows = buildOrderedNavRows(navigation);
  return rows.length ? Math.max(...rows.map((r) => r.sortOrder ?? 0)) + 1 : 0;
}

/** Append a link at the end of the menu. Returns { navigation, rowKey }. */
export function addMenuLink(navigation, link = {}) {
  const { homeNav, headerLinks, navCategories } = menuParts(navigation);
  headerLinks.push({
    labelAr: '', labelEn: '', href: '', highlight: false, isActive: true, isExternal: false, showOnMobile: true,
    ...link,
    sortOrder: nextMenuOrder(navigation),
  });
  return {
    navigation: commitMenu(navigation, homeNav, headerLinks, navCategories),
    rowKey: `link-${headerLinks.length - 1}`,
  };
}

/** Append a category at the end of the menu (no-op if already there). */
export function addMenuCategory(navigation, slug, extra = {}) {
  const { homeNav, headerLinks, navCategories } = menuParts(navigation);
  if (!slug || navCategories.some((c) => c.categorySlug === slug)) {
    return { navigation, rowKey: slug ? `cat-${slug}` : null };
  }
  navCategories.push({
    categorySlug: slug, labelAr: '', labelEn: '', isActive: true, showOnMobile: true,
    ...extra,
    sortOrder: nextMenuOrder(navigation),
  });
  return { navigation: commitMenu(navigation, homeNav, headerLinks, navCategories), rowKey: `cat-${slug}` };
}

/* ------------------------------------------------------------------ *
 * Footer columns & links
 * ------------------------------------------------------------------ */

function withColumns(navigation, columns) {
  return {
    ...navigation,
    footerColumns: columns.map((col, colIndex) => ({
      ...col,
      sortOrder: colIndex,
      links: (col.links || []).map((link, linkIndex) => ({ ...link, sortOrder: linkIndex })),
    })),
  };
}

const columnsOf = (navigation) => (navigation.footerColumns || []).map((c) => ({ ...c, links: [...(c.links || [])] }));

export function updateFooterColumn(navigation, colIndex, patch) {
  const cols = columnsOf(navigation);
  if (!cols[colIndex]) return navigation;
  cols[colIndex] = { ...cols[colIndex], ...patch };
  return withColumns(navigation, cols);
}

export function updateFooterLink(navigation, colIndex, linkIndex, patch) {
  const cols = columnsOf(navigation);
  const link = cols[colIndex]?.links[linkIndex];
  if (!link) return navigation;
  cols[colIndex].links[linkIndex] = { ...link, ...patch };
  return withColumns(navigation, cols);
}

export function addFooterColumn(navigation) {
  const cols = columnsOf(navigation);
  cols.push({ titleAr: '', titleEn: '', links: [] });
  return { navigation: withColumns(navigation, cols), colIndex: cols.length - 1 };
}

export function addFooterLink(navigation, colIndex, link = {}) {
  const cols = columnsOf(navigation);
  if (!cols[colIndex]) return { navigation, linkIndex: -1 };
  cols[colIndex].links.push({ labelAr: '', labelEn: '', href: '', isExternal: false, isActive: true, ...link });
  return { navigation: withColumns(navigation, cols), linkIndex: cols[colIndex].links.length - 1 };
}

/** Returns { navigation, removed }. The last column stays (the store would fall back to defaults). */
export function removeFooterColumn(navigation, colIndex) {
  const cols = columnsOf(navigation);
  if (cols.length <= 1 || !cols[colIndex]) return { navigation, removed: null };
  const [column] = cols.splice(colIndex, 1);
  return { navigation: withColumns(navigation, cols), removed: { kind: 'footer-column', item: column, colIndex } };
}

export function removeFooterLink(navigation, colIndex, linkIndex) {
  const cols = columnsOf(navigation);
  const link = cols[colIndex]?.links[linkIndex];
  if (!link) return { navigation, removed: null };
  cols[colIndex].links.splice(linkIndex, 1);
  return {
    navigation: withColumns(navigation, cols),
    removed: { kind: 'footer-link', item: link, colIndex, columnTitle: cols[colIndex].titleEn || cols[colIndex].titleAr },
  };
}

export function moveFooterColumn(navigation, colIndex, dir) {
  const cols = columnsOf(navigation);
  const target = colIndex + dir;
  if (!cols[colIndex] || target < 0 || target >= cols.length) return navigation;
  [cols[colIndex], cols[target]] = [cols[target], cols[colIndex]];
  return withColumns(navigation, cols);
}

/** Move a link up/down; past the top/bottom it hops into the neighbouring column. */
export function moveFooterLink(navigation, colIndex, linkIndex, dir) {
  const cols = columnsOf(navigation);
  const links = cols[colIndex]?.links;
  if (!links?.[linkIndex]) return { navigation, colIndex, linkIndex };
  const target = linkIndex + dir;
  if (target >= 0 && target < links.length) {
    [links[linkIndex], links[target]] = [links[target], links[linkIndex]];
    return { navigation: withColumns(navigation, cols), colIndex, linkIndex: target };
  }
  const nextCol = colIndex + dir;
  if (!cols[nextCol]) return { navigation, colIndex, linkIndex };
  const [link] = links.splice(linkIndex, 1);
  if (dir > 0) cols[nextCol].links.unshift(link);
  else cols[nextCol].links.push(link);
  return {
    navigation: withColumns(navigation, cols),
    colIndex: nextCol,
    linkIndex: dir > 0 ? 0 : cols[nextCol].links.length - 1,
  };
}

/** Drag-and-drop a link onto another link (any column). */
export function reorderFooterLink(navigation, from, to) {
  const cols = columnsOf(navigation);
  const link = cols[from.colIndex]?.links[from.linkIndex];
  if (!link || !cols[to.colIndex]) return navigation;
  if (from.colIndex === to.colIndex && from.linkIndex === to.linkIndex) return navigation;
  cols[from.colIndex].links.splice(from.linkIndex, 1);
  const insertAt = Math.min(to.linkIndex, cols[to.colIndex].links.length);
  cols[to.colIndex].links.splice(insertAt, 0, link);
  return withColumns(navigation, cols);
}

/* ------------------------------------------------------------------ *
 * Footer extras — payment icons & legal links
 * ------------------------------------------------------------------ */

/**
 * Toggle one payment icon. Unticking the last one hides the strip instead of
 * leaving an empty list (which the store reads as "use the defaults").
 */
export function togglePaymentMethod(navigation, method, defaults) {
  const footer = navigation.footer || {};
  const shown = footer.showPayment !== false;
  const current = footer.paymentMethods?.length ? footer.paymentMethods : (shown ? defaults : []);
  const next = current.includes(method) ? current.filter((m) => m !== method) : [...current, method];
  // Ticking the first icon back on also shows the strip; otherwise keep the admin's switch.
  const showPayment = next.length === 0 ? false : (current.length === 0 ? true : shown);
  return { ...navigation, footer: { ...footer, paymentMethods: next, showPayment } };
}

/** Replace legal links; removing the last one hides the legal strip. */
export function setLegalLinks(navigation, links) {
  const footer = navigation.footer || {};
  const wasEmpty = !(footer.legalLinks || []).length;
  // Removing the last link hides the strip; adding the first one back shows it.
  const showLegal = links.length === 0 ? false : (wasEmpty && footer.showLegal === false ? true : footer.showLegal !== false);
  return { ...navigation, footer: { ...footer, legalLinks: links, showLegal } };
}

/* ------------------------------------------------------------------ *
 * Hidden items & recently removed
 * ------------------------------------------------------------------ */

const FOOTER_SECTION_META = {
  showBackToTop: { labelAr: 'زر العودة للأعلى', labelEn: 'Back-to-top button', zone: 'footer-backtop' },
  showSocial: { labelAr: 'أيقونات التواصل', labelEn: 'Social icons', zone: 'footer-social' },
  showContact: { labelAr: 'بيانات التواصل', labelEn: 'Contact info', zone: 'footer-contact' },
  showApps: { labelAr: 'روابط التطبيق', labelEn: 'App badges', zone: 'footer-apps' },
  showPayment: { labelAr: 'وسائل الدفع', labelEn: 'Payment icons', zone: 'footer-payment' },
  showLegal: { labelAr: 'الروابط القانونية', labelEn: 'Legal links', zone: 'footer-legal' },
};

function labelOf(item, fallbackAr, fallbackEn) {
  return {
    labelAr: item?.labelAr || item?.labelEn || fallbackAr,
    labelEn: item?.labelEn || item?.labelAr || fallbackEn,
  };
}

/**
 * Everything that is switched off, grouped by section, each with a pure
 * `restore(navigation) → navigation`.
 * `categoryName(slug)` → { ar, en } labels menu categories by their store name.
 */
export function listHiddenEntries(navigation, categoryName = () => null) {
  const entries = [];

  editorToolbar(navigation).forEach((item, index) => {
    const builtin = HEADER_BUILTIN_KEYS.includes(item.itemKey);
    const meta = builtin ? HEADER_BUILTIN_META[item.itemKey] : null;
    const label = builtin ? { labelAr: meta.labelAr, labelEn: meta.labelEn } : labelOf(item, 'رابط', 'Link');
    const section = item.itemKey === 'categories' ? 'menu' : 'header';
    if (item.isActive === false) {
      entries.push({
        id: `toolbar-${item.itemKey}-${index}`, section, ...label, reason: 'hidden',
        restore: (nav) => updateToolbarItem(nav, index, { isActive: true }),
      });
    } else if (!builtin && item.showOnMobile === false) {
      entries.push({
        id: `toolbar-mobile-${index}`, section, ...label, reason: 'mobile',
        restore: (nav) => updateToolbarItem(nav, index, { showOnMobile: true }),
      });
    }
  });

  buildOrderedNavRows(navigation).forEach((row) => {
    let label;
    if (row.type === 'home') label = labelOf(row.data, 'الرئيسية', 'Home');
    else if (row.type === 'category') {
      const name = categoryName(row.data.categorySlug);
      label = {
        labelAr: row.data.labelAr || name?.ar || row.data.categorySlug,
        labelEn: row.data.labelEn || name?.en || row.data.categorySlug,
      };
    } else label = labelOf(row.data, 'رابط', 'Link');

    if (row.data.isActive === false) {
      entries.push({
        id: `menu-${row.key}`, section: 'menu', ...label, reason: 'hidden',
        restore: (nav) => updateMenuRow(nav, row.key, { isActive: true }),
      });
    } else if (row.data.showOnMobile === false) {
      entries.push({
        id: `menu-mobile-${row.key}`, section: 'menu', ...label, reason: 'mobile',
        restore: (nav) => updateMenuRow(nav, row.key, { showOnMobile: true }),
      });
    }
  });

  (navigation.footerColumns || []).forEach((col, colIndex) => {
    (col.links || []).forEach((link, linkIndex) => {
      if (link.isActive === false) {
        entries.push({
          id: `footer-link-${colIndex}-${linkIndex}`, section: 'footer', ...labelOf(link, 'رابط', 'Link'), reason: 'hidden',
          restore: (nav) => updateFooterLink(nav, colIndex, linkIndex, { isActive: true }),
        });
      }
    });
  });

  const footer = navigation.footer || {};
  Object.entries(FOOTER_SECTION_META).forEach(([key, meta]) => {
    if (footer[key] === false) {
      entries.push({
        id: `footer-${key}`, section: 'footer', labelAr: meta.labelAr, labelEn: meta.labelEn, reason: 'hidden',
        restore: (nav) => ({ ...nav, footer: { ...(nav.footer || {}), [key]: true } }),
      });
    }
  });

  return entries;
}

/** Put back something removed this session (see the `removed` results above). */
export function restoreRemoved(navigation, removed) {
  if (!removed) return navigation;
  switch (removed.kind) {
    case 'toolbar':
      return appendToolbarItem(navigation, removed.item).navigation;
    case 'menu-link':
      return addMenuLink(navigation, removed.item).navigation;
    case 'menu-category':
      return addMenuCategory(navigation, removed.item.categorySlug, removed.item).navigation;
    case 'footer-column': {
      const cols = columnsOf(navigation);
      cols.splice(Math.min(removed.colIndex ?? cols.length, cols.length), 0, removed.item);
      return withColumns(navigation, cols);
    }
    case 'footer-link': {
      const cols = columnsOf(navigation);
      if (!cols.length) return navigation;
      const col = cols[removed.colIndex] ? removed.colIndex : cols.length - 1;
      cols[col].links.push(removed.item);
      return withColumns(navigation, cols);
    }
    default:
      return navigation;
  }
}

export function describeRemoved(removed) {
  const item = removed?.item || {};
  switch (removed?.kind) {
    case 'toolbar': return { ...labelOf(item, 'رابط هيدر', 'Header link'), section: 'header' };
    case 'menu-link': return { ...labelOf(item, 'رابط قائمة', 'Menu link'), section: 'menu' };
    case 'menu-category': return {
      labelAr: item.labelAr || item.categorySlug, labelEn: item.labelEn || item.categorySlug, section: 'menu',
    };
    case 'footer-column': return {
      labelAr: item.titleAr || item.titleEn || 'عمود', labelEn: item.titleEn || item.titleAr || 'Column', section: 'footer',
    };
    case 'footer-link': return { ...labelOf(item, 'رابط فوتر', 'Footer link'), section: 'footer' };
    default: return { labelAr: '', labelEn: '', section: 'header' };
  }
}

/* ------------------------------------------------------------------ *
 * Reset to defaults
 * ------------------------------------------------------------------ */

export const RESETTABLE_SECTIONS = ['announcement', 'header', 'menu', 'footer'];

export function resetNavigationSection(navigation, section) {
  switch (section) {
    case 'announcement':
      return {
        ...navigation, announcementAr: '', announcementEn: '', showDeliveryStrip: true, showFreeDeliveryNote: true,
      };
    case 'header':
      return {
        ...navigation,
        topBarServiceLabelAr: '',
        topBarServiceLabelEn: '',
        topBarServiceHref: '',
        headerToolbar: serializeHeaderToolbar(DEFAULT_HEADER_TOOLBAR.map((item, i) => normalizeToolbarItem(item, i))),
      };
    case 'menu':
      return commitMenu(navigation, { ...DEFAULT_HOME_NAV }, [{ ...DEFAULT_MENU_LINK }], []);
    case 'footer':
      return withColumns({ ...navigation, footer: {} }, clone(DEFAULT_FOOTER_COLUMNS));
    default:
      return navigation;
  }
}

/* ------------------------------------------------------------------ *
 * Validation
 * ------------------------------------------------------------------ */

const hasLabel = (item) => Boolean(String(item?.labelAr || '').trim() || String(item?.labelEn || '').trim());

/** Why a URL can't be saved, or null. */
export function hrefProblem(href) {
  const value = String(href ?? '').trim();
  if (!value) return 'empty';
  if (/\s/.test(value)) return 'spaces';
  if (/^(https?:)?\/\//i.test(value) || /^(mailto|tel):/i.test(value)) return null;
  if (/^(www\.)|^[a-z0-9-]+\.[a-z]{2,}(\/|$)/i.test(value.replace(/^\//, ''))) return 'missing-protocol';
  return null;
}

const HREF_MESSAGES = {
  empty: ['أدخل الرابط', 'Add a link address'],
  spaces: ['الرابط لا يجب أن يحتوي على مسافات', 'The link address can’t contain spaces'],
  'missing-protocol': ['روابط المواقع الخارجية تبدأ بـ https://', 'Website links must start with https://'],
};

/**
 * Problems that block saving (`level: 'error'`) or are worth knowing
 * (`level: 'warning'`). Each carries the selection that opens the item.
 */
export function validateNavigation(navigation) {
  const issues = [];
  const push = (level, selection, where, [ar, en]) => issues.push({
    level, selection, messageAr: `${where.ar}: ${ar}`, messageEn: `${where.en}: ${en}`,
  });
  const checkHref = (href, selection, where) => {
    const problem = hrefProblem(href);
    if (problem) push('error', selection, where, HREF_MESSAGES[problem]);
  };

  editorToolbar(navigation).forEach((item, index) => {
    if (item.itemKey !== 'link') return;
    const where = { ar: `رابط الهيدر «${item.labelAr || item.labelEn || index + 1}»`, en: `Header link “${item.labelEn || item.labelAr || index + 1}”` };
    const selection = { zone: 'toolbar', index };
    if (!hasLabel(item)) push('error', selection, where, ['أضف اسماً للرابط', 'Give it a name']);
    checkHref(item.href, selection, where);
  });

  buildOrderedNavRows(navigation).forEach((row) => {
    if (row.type !== 'link') return;
    const link = (navigation.headerLinks || [])[row.index] || row.data;
    const where = { ar: `رابط القائمة «${link.labelAr || link.labelEn || row.index + 1}»`, en: `Menu link “${link.labelEn || link.labelAr || row.index + 1}”` };
    const selection = { zone: 'nav', rowKey: row.key };
    if (!hasLabel(link)) push('error', selection, where, ['أضف اسماً للرابط', 'Give it a name']);
    checkHref(link.href, selection, where);
  });

  const visibleMenu = buildOrderedNavRows(navigation)
    .filter((row) => row.type !== 'home' && row.data.isActive !== false);
  if (visibleMenu.length > STORE_NAV_MAX_ITEMS) {
    issues.push({
      level: 'warning',
      selection: null,
      messageAr: `القائمة بها ${visibleMenu.length} عناصر — يظهر أول ${STORE_NAV_MAX_ITEMS} فقط على سطح المكتب`,
      messageEn: `The menu has ${visibleMenu.length} items — only the first ${STORE_NAV_MAX_ITEMS} fit on desktop`,
    });
  }

  (navigation.footerColumns || []).forEach((col, colIndex) => {
    const colWhere = { ar: `عمود الفوتر ${colIndex + 1}`, en: `Footer column ${colIndex + 1}` };
    if (!String(col.titleAr || '').trim() && !String(col.titleEn || '').trim()) {
      push('error', { zone: 'footer-col', colIndex }, colWhere, ['أضف عنواناً للعمود', 'Give it a title']);
    }
    if (!(col.links || []).some((link) => link.isActive !== false)) {
      push('warning', { zone: 'footer-col', colIndex }, colWhere, ['لا توجد روابط ظاهرة — لن يظهر العمود في المتجر', 'Has no visible links, so the store won’t show it']);
    }
    (col.links || []).forEach((link, linkIndex) => {
      const where = { ar: `رابط الفوتر «${link.labelAr || link.labelEn || linkIndex + 1}»`, en: `Footer link “${link.labelEn || link.labelAr || linkIndex + 1}”` };
      const selection = { zone: 'footer-link', colIndex, linkIndex };
      if (!hasLabel(link)) push('error', selection, where, ['أضف اسماً للرابط', 'Give it a name']);
      checkHref(link.href, selection, where);
    });
  });

  (navigation.footer?.legalLinks || []).forEach((link, i) => {
    const where = { ar: `الرابط القانوني ${i + 1}`, en: `Legal link ${i + 1}` };
    if (!hasLabel(link)) push('error', { zone: 'footer-legal' }, where, ['أضف اسماً للرابط', 'Give it a name']);
    checkHref(link.href, { zone: 'footer-legal' }, where);
  });

  return issues;
}
