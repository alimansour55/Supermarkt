import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addFooterColumn,
  addFooterLink,
  addMenuCategory,
  addMenuLink,
  buildOrderedNavRows,
  editorToolbar,
  listHiddenEntries,
  moveFooterLink,
  moveMenuRow,
  moveToolbarItem,
  prepareNavigationForEditor,
  removeFooterColumn,
  removeFooterLink,
  removeMenuRow,
  removeToolbarItem,
  reorderFooterLink,
  reorderMenuRow,
  reorderToolbarItem,
  resetNavigationSection,
  restoreRemoved,
  setLegalLinks,
  showBuiltinToolbarItem,
  togglePaymentMethod,
  updateMenuRow,
  updateToolbarItem,
  validateNavigation,
} from '../src/admin/utils/navigationEditor.js';
import {
  canMoveHeaderToolbarItem,
  getHeaderToolbarByZone,
  getMobileToolbarLinks,
  isAllCategoriesEnabled,
  moveHeaderToolbarItem,
} from '../src/utils/headerToolbarConfig.js';
import { parseNavigationConfig } from '../src/utils/navBarConfig.js';

const keys = (nav) => editorToolbar(nav).map((i) => `${i.zone}:${i.itemKey}${i.itemKey === 'link' ? `(${i.labelEn})` : ''}`);
const fresh = () => prepareNavigationForEditor({});
const customLink = (labelEn, zone = 'start') => ({
  itemKey: 'link', labelAr: labelEn, labelEn, href: '/x', zone, isActive: true,
});

test('prepare fills defaults: all built-ins, default menu, default footer', () => {
  const nav = fresh();
  assert.deepEqual(keys(nav), ['start:categories', 'end:favorites', 'end:account', 'end:cart']);
  assert.equal(nav.menuCustomized, true);
  assert.deepEqual(nav.headerLinks.map((l) => l.href), ['/offers']);
  assert.equal(nav.footerColumns.length, 2);
  assert.deepEqual(prepareNavigationForEditor(nav), nav, 'idempotent');
});

test('prepare re-adds a built-in missing from stored data as hidden', () => {
  const nav = prepareNavigationForEditor({
    headerToolbar: [{ itemKey: 'favorites', zone: 'end', sortOrder: 0 }],
  });
  const cart = editorToolbar(nav).find((i) => i.itemKey === 'cart');
  assert.equal(cart.isActive, false);
});

test('hiding Cart then adding it back works (the reported bug)', () => {
  let nav = fresh();
  const cartIndex = editorToolbar(nav).findIndex((i) => i.itemKey === 'cart');
  const { navigation: hidden, removed } = removeToolbarItem(nav, cartIndex);
  assert.equal(removed, null, 'built-ins are hidden, not deleted');
  assert.equal(editorToolbar(hidden).find((i) => i.itemKey === 'cart').isActive, false);

  const entry = listHiddenEntries(hidden).find((e) => e.labelEn === 'Cart');
  assert.ok(entry, 'cart is listed as hidden');
  nav = entry.restore(hidden);
  assert.equal(editorToolbar(nav).find((i) => i.itemKey === 'cart').isActive, true);

  const viaAdd = showBuiltinToolbarItem(hidden, 'cart');
  assert.equal(editorToolbar(viaAdd.navigation)[viaAdd.index].itemKey, 'cart');
  assert.equal(editorToolbar(viaAdd.navigation)[viaAdd.index].isActive, true);
});

test('toolbar arrows actually move items, and cross zones at the edge', () => {
  let nav = fresh();
  // [start:categories, end:favorites, end:account, end:cart]
  nav = moveToolbarItem(nav, 3, -1);
  assert.deepEqual(keys(nav), ['start:categories', 'end:favorites', 'end:cart', 'end:account']);
  nav = moveToolbarItem(nav, 1, -1); // first of end → last of start
  assert.deepEqual(keys(nav), ['start:categories', 'start:favorites', 'end:cart', 'end:account']);
  nav = moveToolbarItem(nav, 1, 1); // last of start → first of end
  assert.deepEqual(keys(nav), ['start:categories', 'end:favorites', 'end:cart', 'end:account']);
  assert.deepEqual(moveToolbarItem(nav, 0, -1), nav, 'no-op at the very start');
});

test('canMoveHeaderToolbarItem matches moveHeaderToolbarItem', () => {
  const items = editorToolbar(fresh());
  items.forEach((_, index) => [-1, 1].forEach((dir) => {
    const moved = moveHeaderToolbarItem(items, index, dir);
    const changed = JSON.stringify(moved) !== JSON.stringify(items);
    assert.equal(canMoveHeaderToolbarItem(items, index, dir), changed, `index ${index} dir ${dir}`);
  }));
});

test('drag-reorder toolbar adopts the target zone', () => {
  const nav = reorderToolbarItem(fresh(), 3, 0);
  assert.deepEqual(keys(nav), ['start:cart', 'start:categories', 'end:favorites', 'end:account']);
});

test('custom toolbar links can be deleted and restored', () => {
  let nav = fresh();
  nav = { ...nav, headerToolbar: [...nav.headerToolbar, customLink('Deals')] };
  const index = editorToolbar(nav).findIndex((i) => i.labelEn === 'Deals');
  const { navigation, removed } = removeToolbarItem(nav, index);
  assert.ok(!editorToolbar(navigation).some((i) => i.labelEn === 'Deals'));
  const restored = restoreRemoved(navigation, removed);
  assert.ok(editorToolbar(restored).some((i) => i.labelEn === 'Deals'));
});

test('store header: categories lives in the menu row, start zone renders, mobile links filter', () => {
  let nav = fresh();
  nav = { ...nav, headerToolbar: [...nav.headerToolbar, customLink('Deals'), { ...customLink('Desk'), showOnMobile: false }] };
  const zones = getHeaderToolbarByZone(nav);
  assert.ok(!zones.start.some((i) => i.itemKey === 'categories'));
  assert.deepEqual(zones.start.map((i) => i.labelEn), ['Deals', 'Desk']);
  assert.deepEqual(getMobileToolbarLinks(nav).map((i) => i.labelEn), ['Deals']);
  assert.equal(isAllCategoriesEnabled(nav), true);
  const off = updateToolbarItem(nav, editorToolbar(nav).findIndex((i) => i.itemKey === 'categories'), { isActive: false });
  assert.equal(isAllCategoriesEnabled(off), false);
});

test('menu: emptying it stays empty once customized', () => {
  let nav = fresh();
  nav = removeMenuRow(nav, 'link-0').navigation;
  const parsed = parseNavigationConfig(nav);
  assert.equal(parsed.headerLinks.length, 0, 'Offers does not come back');
  assert.equal(parseNavigationConfig({}).headerLinks.length, 1, 'never-saved store still gets Offers');
});

test('menu: a link pointing at "/" or with an empty URL is kept', () => {
  let nav = fresh();
  const { navigation, rowKey } = addMenuLink(nav, { labelEn: 'Root', href: '' });
  nav = updateMenuRow(navigation, rowKey, { href: '/' });
  assert.equal(parseNavigationConfig(nav).headerLinks.length, 2);
});

test('menu: move, drag, add, remove and restore', () => {
  let nav = fresh();
  nav = addMenuCategory(nav, 'dairy').navigation;
  assert.deepEqual(buildOrderedNavRows(nav).map((r) => r.key), ['home', 'link-0', 'cat-dairy']);
  nav = moveMenuRow(nav, 'cat-dairy', -1);
  assert.deepEqual(buildOrderedNavRows(nav).map((r) => r.key), ['home', 'cat-dairy', 'link-0']);
  nav = reorderMenuRow(nav, 'link-0', 'home');
  assert.deepEqual(buildOrderedNavRows(nav).map((r) => r.key), ['link-0', 'home', 'cat-dairy']);
  assert.equal(addMenuCategory(nav, 'dairy').navigation, nav, 'no duplicate categories');

  const { navigation, removed } = removeMenuRow(nav, 'cat-dairy');
  assert.deepEqual(buildOrderedNavRows(navigation).map((r) => r.key), ['link-0', 'home']);
  nav = restoreRemoved(navigation, removed);
  assert.ok(buildOrderedNavRows(nav).some((r) => r.key === 'cat-dairy'));
  assert.equal(removeMenuRow(nav, 'home').removed, null, 'home is never removed');
});

test('hidden entries cover menu (hidden + phone-only) and footer sections', () => {
  let nav = fresh();
  nav = updateMenuRow(nav, 'home', { isActive: false });
  nav = updateMenuRow(nav, 'link-0', { showOnMobile: false });
  nav = { ...nav, footer: { showSocial: false } };
  const entries = listHiddenEntries(nav);
  assert.deepEqual(entries.map((e) => `${e.section}:${e.reason}:${e.labelEn}`), [
    'menu:hidden:Home', 'menu:mobile:Offers', 'footer:hidden:Social icons',
  ]);
  const all = entries.reduce((acc, e) => e.restore(acc), nav);
  assert.equal(listHiddenEntries(all).length, 0);
});

test('footer: columns and links move, hop columns, drag, and restore', () => {
  let nav = fresh();
  const first = nav.footerColumns[0].links.map((l) => l.labelEn);
  let moved = moveFooterLink(nav, 0, first.length - 1, 1);
  assert.deepEqual([moved.colIndex, moved.linkIndex], [1, 0]);
  assert.equal(moved.navigation.footerColumns[1].links[0].labelEn, first.at(-1));

  nav = reorderFooterLink(nav, { colIndex: 1, linkIndex: 0 }, { colIndex: 0, linkIndex: 0 });
  assert.equal(nav.footerColumns[0].links.length, first.length + 1);

  const added = addFooterColumn(nav);
  assert.equal(added.navigation.footerColumns[added.colIndex].links.length, 0, 'no blank link row');
  const withLink = addFooterLink(added.navigation, added.colIndex, { labelEn: 'New' });
  assert.equal(withLink.linkIndex, 0);

  const { navigation, removed } = removeFooterLink(nav, 0, 0);
  assert.equal(navigation.footerColumns[0].links.length, first.length);
  assert.equal(restoreRemoved(navigation, removed).footerColumns[0].links.length, first.length + 1);

  const single = { ...nav, footerColumns: [nav.footerColumns[0]] };
  assert.equal(removeFooterColumn(single, 0).removed, null, 'last column stays');
});

test('payment icons: unticking the last one hides the strip instead of resetting', () => {
  const defaults = ['visa', 'mastercard'];
  let nav = fresh();
  nav = togglePaymentMethod(nav, 'visa', defaults);
  assert.deepEqual(nav.footer.paymentMethods, ['mastercard']);
  nav = togglePaymentMethod(nav, 'mastercard', defaults);
  assert.deepEqual(nav.footer.paymentMethods, []);
  assert.equal(nav.footer.showPayment, false);
  nav = togglePaymentMethod(nav, 'fawry', defaults);
  assert.deepEqual(nav.footer.paymentMethods, ['fawry']);
  assert.equal(nav.footer.showPayment, true);
});

test('legal links: removing the last hides the strip, adding one shows it', () => {
  let nav = setLegalLinks(fresh(), []);
  assert.equal(nav.footer.showLegal, false);
  nav = setLegalLinks(nav, [{ labelEn: 'Terms', href: '/terms' }]);
  assert.equal(nav.footer.showLegal, true);
  const manual = setLegalLinks({ ...nav, footer: { ...nav.footer, showLegal: false } }, [{ labelEn: 'T', href: '/t' }, { labelEn: 'P', href: '/p' }]);
  assert.equal(manual.footer.showLegal, false, 'editing keeps a manual hide');
});

test('reset sections restore defaults', () => {
  let nav = fresh();
  nav = removeMenuRow(nav, 'link-0').navigation;
  nav = moveToolbarItem(nav, 3, -1);
  nav = { ...nav, footerColumns: [nav.footerColumns[0]], announcementAr: 'x' };
  const fresh0 = fresh();
  assert.deepEqual(keys(resetNavigationSection(nav, 'header')), keys(fresh0));
  assert.deepEqual(buildOrderedNavRows(resetNavigationSection(nav, 'menu')).map((r) => r.key), ['home', 'link-0']);
  assert.equal(resetNavigationSection(nav, 'footer').footerColumns.length, 2);
  assert.equal(resetNavigationSection(nav, 'announcement').announcementAr, '');
});

test('validation: blank names, empty and bare-domain URLs block saving', () => {
  assert.deepEqual(validateNavigation(fresh()).filter((i) => i.level === 'error'), []);
  let nav = fresh();
  nav = addMenuLink(nav, { labelEn: '', labelAr: '', href: '' }).navigation;
  nav = addFooterLink(nav, 0, { labelEn: 'Site', href: 'www.example.com' }).navigation;
  nav = addFooterColumn(nav).navigation;
  const issues = validateNavigation(nav);
  const errors = issues.filter((i) => i.level === 'error').map((i) => i.messageEn);
  assert.ok(errors.some((m) => m.startsWith('Menu link') && m.endsWith('Give it a name')));
  assert.ok(errors.some((m) => m.startsWith('Menu link') && m.endsWith('Add a link address')));
  assert.ok(errors.some((m) => m.includes('https://')));
  assert.ok(errors.some((m) => m.startsWith('Footer column 3') && m.endsWith('Give it a title')));
  assert.ok(issues.some((i) => i.level === 'warning' && i.messageEn.startsWith('Footer column 3')));
  const menuError = issues.find((i) => i.messageEn.startsWith('Menu link'));
  assert.equal(menuError.selection.zone, 'nav');
});
