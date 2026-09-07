import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Columns3, Megaphone, Menu, Monitor, PanelRight, Save, Smartphone } from 'lucide-react';
import Button from '../../../components/ui/Button';
import { adminApi } from '../../adminApi';
import {
  HEADER_BUILTIN_KEYS,
  reindexHeaderToolbar,
  serializeHeaderToolbar,
} from '../../../utils/headerToolbarConfig';
import { parseNavigationConfig, reindexNavSortOrders } from '../../../utils/navBarConfig';
import NavigationStorefrontPreview, { buildOrderedNavRows, getToolbarItems } from './NavigationStorefrontPreview';
import NavigationEditPanel from './NavigationEditPanel';

const SECTIONS = [
  { id: 'nav-section-announcement', icon: Megaphone, labelAr: 'الإعلان', labelEn: 'Announcement' },
  { id: 'nav-section-header', icon: PanelRight, labelAr: 'الهيدر', labelEn: 'Header' },
  { id: 'nav-section-menu', icon: Menu, labelAr: 'القائمة', labelEn: 'Menu' },
  { id: 'nav-section-footer', icon: Columns3, labelAr: 'الفوتر', labelEn: 'Footer' },
];

export default function NavigationVisualBuilder({
  navigation,
  onChange,
  storeSettings,
  isAr,
  saving,
  isDirty,
  onSave,
  onApplyContentPage,
}) {
  const [viewMode, setViewMode] = useState('desktop');
  const [selection, setSelection] = useState(null);
  const [categories, setCategories] = useState([]);
  const previewRef = useRef(null);

  useEffect(() => {
    adminApi.getCategories({ limit: 500, page: 1 })
      .then(({ data }) => setCategories(data.data || []))
      .catch(() => setCategories([]));
  }, []);

  const toolbarItems = useMemo(() => getToolbarItems(navigation), [navigation]);
  const orderedNavRows = useMemo(() => buildOrderedNavRows(navigation), [navigation]);

  const scrollToSection = (sectionId) => {
    previewRef.current?.querySelector(`#${sectionId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const commitToolbar = useCallback((nextItems) => {
    onChange({
      ...navigation,
      headerToolbar: serializeHeaderToolbar(reindexHeaderToolbar(nextItems)),
    });
  }, [navigation, onChange]);

  const commitNav = useCallback((nextHome, nextLinks, nextCats) => {
    const reindexed = reindexNavSortOrders(nextHome, nextLinks, nextCats);
    onChange({
      ...navigation,
      homeNav: reindexed.homeNav,
      headerLinks: reindexed.headerLinks,
      navCategories: reindexed.navCategories,
      showCategoryLinks: false,
    });
  }, [navigation, onChange]);

  const handleDeleteForRow = useCallback((rowKey) => {
    const { homeNav, headerLinks, navCategories } = parseNavigationConfig(navigation);
    if (rowKey === 'home') return;
    if (rowKey.startsWith('link-')) {
      const index = parseInt(rowKey.replace('link-', ''), 10);
      commitNav(homeNav, headerLinks.filter((_, i) => i !== index), navCategories);
    } else if (rowKey.startsWith('cat-')) {
      const slug = rowKey.replace('cat-', '');
      commitNav(homeNav, headerLinks, navCategories.filter((c) => c.categorySlug !== slug));
    }
    setSelection(null);
  }, [navigation, commitNav]);

  const handleDelete = useCallback(() => {
    if (!selection) return;
    const { zone } = selection;

    if (zone === 'toolbar') {
      const items = [...toolbarItems];
      const item = items[selection.index];
      if (HEADER_BUILTIN_KEYS.includes(item?.itemKey)) return;
      commitToolbar(items.filter((_, i) => i !== selection.index));
      setSelection(null);
      return;
    }

    if (zone === 'nav') {
      const { homeNav, headerLinks, navCategories } = parseNavigationConfig(navigation);
      const { rowKey } = selection;
      if (rowKey === 'home') return;
      if (rowKey.startsWith('link-')) {
        const index = parseInt(rowKey.replace('link-', ''), 10);
        commitNav(homeNav, headerLinks.filter((_, i) => i !== index), navCategories);
      } else if (rowKey.startsWith('cat-')) {
        const slug = rowKey.replace('cat-', '');
        commitNav(homeNav, headerLinks, navCategories.filter((c) => c.categorySlug !== slug));
      }
      setSelection(null);
      return;
    }

    if (zone === 'footer-col') {
      const cols = navigation.footerColumns.filter((_, i) => i !== selection.colIndex);
      onChange({ ...navigation, footerColumns: cols.length ? cols : navigation.footerColumns });
      setSelection(null);
      return;
    }

    if (zone === 'footer-link') {
      const cols = [...navigation.footerColumns];
      const col = { ...cols[selection.colIndex] };
      col.links = col.links.filter((_, i) => i !== selection.linkIndex);
      cols[selection.colIndex] = col;
      onChange({ ...navigation, footerColumns: cols });
      setSelection(null);
    }
  }, [selection, toolbarItems, navigation, onChange, commitToolbar, commitNav]);

  const moveToolbar = (index, dir) => {
    const items = [...toolbarItems];
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    [items[index], items[target]] = [items[target], items[index]];
    commitToolbar(items);
  };

  const toggleToolbarActive = (index) => {
    const items = toolbarItems.map((item, i) => (
      i === index ? { ...item, isActive: item.isActive === false } : item
    ));
    commitToolbar(items);
  };

  const moveNavRow = (rowKey, dir) => {
    const { homeNav, headerLinks, navCategories } = parseNavigationConfig(navigation);
    const rows = buildOrderedNavRows(navigation);
    const idx = rows.findIndex((r) => r.key === rowKey);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= rows.length) return;
    const order = [...rows];
    [order[idx], order[target]] = [order[target], order[idx]];

    const nextHome = { ...homeNav };
    const nextLinks = headerLinks.map((l) => ({ ...l }));
    const nextCats = navCategories.map((c) => ({ ...c }));

    order.forEach((row, sortOrder) => {
      if (row.type === 'home') nextHome.sortOrder = sortOrder;
      if (row.type === 'link') nextLinks[row.index].sortOrder = sortOrder;
      if (row.type === 'category') nextCats[row.index].sortOrder = sortOrder;
    });

    commitNav(nextHome, nextLinks, nextCats);
  };

  const toggleNavActive = (rowKey) => {
    const { homeNav, headerLinks, navCategories } = parseNavigationConfig(navigation);
    if (rowKey === 'home') {
      commitNav({ ...homeNav, isActive: homeNav.isActive === false }, headerLinks, navCategories);
      return;
    }
    if (rowKey.startsWith('link-')) {
      const index = parseInt(rowKey.replace('link-', ''), 10);
      const next = headerLinks.map((l, i) => (i === index ? { ...l, isActive: l.isActive === false } : l));
      commitNav(homeNav, next, navCategories);
      return;
    }
    if (rowKey.startsWith('cat-')) {
      const slug = rowKey.replace('cat-', '');
      const next = navCategories.map((c) => (
        c.categorySlug === slug ? { ...c, isActive: c.isActive === false } : c
      ));
      commitNav(homeNav, headerLinks, next);
    }
  };

  const toggleNavMobile = (rowKey) => {
    const { homeNav, headerLinks, navCategories } = parseNavigationConfig(navigation);
    if (rowKey === 'home') {
      commitNav({ ...homeNav, showOnMobile: homeNav.showOnMobile === false }, headerLinks, navCategories);
      return;
    }
    if (rowKey.startsWith('link-')) {
      const index = parseInt(rowKey.replace('link-', ''), 10);
      const next = headerLinks.map((l, i) => (i === index ? { ...l, showOnMobile: l.showOnMobile === false } : l));
      commitNav(homeNav, next, navCategories);
      return;
    }
    if (rowKey.startsWith('cat-')) {
      const slug = rowKey.replace('cat-', '');
      const next = navCategories.map((c) => (
        c.categorySlug === slug ? { ...c, showOnMobile: c.showOnMobile === false } : c
      ));
      commitNav(homeNav, headerLinks, next);
    }
  };

  const emptyFooterLink = () => ({
    labelAr: '',
    labelEn: '',
    href: '/',
    sortOrder: 0,
    isExternal: false,
    isActive: true,
  });

  const addFooterLink = (colIndex) => {
    const cols = [...(navigation.footerColumns || [])];
    const links = [...(cols[colIndex]?.links || []), emptyFooterLink()];
    cols[colIndex] = { ...cols[colIndex], links };
    onChange({ ...navigation, footerColumns: cols });
    setSelection({ zone: 'footer-link', colIndex, linkIndex: links.length - 1 });
  };

  const emptyColumn = () => ({
    titleAr: '',
    titleEn: '',
    sortOrder: navigation.footerColumns?.length || 0,
    links: [{ labelAr: '', labelEn: '', href: '/', sortOrder: 0, isExternal: false, isActive: true }],
  });

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
      {/* Sticky builder toolbar */}
      <div className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-white/95 px-4 py-3 backdrop-blur-sm">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl border border-border bg-slate-50 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('desktop')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                viewMode === 'desktop' ? 'bg-white text-primary-700 shadow-sm' : 'text-text-muted hover:text-text'
              }`}
            >
              <Monitor className="h-3.5 w-3.5" />
              {isAr ? 'سطح المكتب' : 'Desktop'}
            </button>
            <button
              type="button"
              onClick={() => setViewMode('mobile')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                viewMode === 'mobile' ? 'bg-white text-primary-700 shadow-sm' : 'text-text-muted hover:text-text'
              }`}
            >
              <Smartphone className="h-3.5 w-3.5" />
              {isAr ? 'موبايل' : 'Mobile'}
            </button>
          </div>

          <div className="hidden h-6 w-px bg-border sm:block" />

          <div className="hidden flex-wrap gap-1 sm:flex">
            {SECTIONS.map(({ id, icon: Icon, labelAr, labelEn }) => (
              <button
                key={id}
                type="button"
                onClick={() => scrollToSection(id)}
                className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-text-muted transition hover:bg-slate-100 hover:text-text"
              >
                <Icon className="h-3.5 w-3.5" />
                {isAr ? labelAr : labelEn}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isDirty && (
            <span className="hidden rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800 sm:inline">
              {isAr ? 'تغييرات غير محفوظة' : 'Unsaved changes'}
            </span>
          )}
          <Button type="button" size="sm" onClick={onSave} disabled={saving || !isDirty}>
            <Save className="h-4 w-4" />
            {saving ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'حفظ' : 'Save')}
          </Button>
        </div>
      </div>

      <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_360px]">
        {/* Preview column */}
        <div className="min-w-0 border-b border-border bg-slate-100/60 p-4 xl:border-b-0 xl:border-e">
          <p className="mb-3 text-center text-[11px] font-medium text-text-muted">
            {viewMode === 'mobile'
              ? (isAr ? 'معاينة الموبايل — العناصر المخفية على الموبايل لا تظهر' : 'Mobile preview — items hidden on mobile are omitted')
              : (isAr ? 'معاينة سطح المكتب — العناصر المخفية تظهر باهتة' : 'Desktop preview — hidden items shown dimmed')}
          </p>
          <div className="flex justify-center">
            <div
              ref={previewRef}
              className={[
                'max-h-[calc(100vh-12rem)] w-full overflow-y-auto rounded-2xl border border-slate-300 bg-white shadow-lg transition-all',
                viewMode === 'mobile' ? 'max-w-[390px]' : 'max-w-5xl',
              ].join(' ')}
            >
              <NavigationStorefrontPreview
                navigation={navigation}
                storeSettings={storeSettings}
                categories={categories}
                isAr={isAr}
                viewMode={viewMode}
                selection={selection}
                toolbarItems={toolbarItems}
                orderedNavRows={orderedNavRows}
                onSelect={setSelection}
                onInsertToolbar={(toolbarZone) => setSelection({ zone: 'toolbar-add', toolbarZone })}
                onInsertNav={() => setSelection({ zone: 'nav-add' })}
                onInsertFooterColumn={() => {
                  onChange({
                    ...navigation,
                    footerColumns: [...(navigation.footerColumns || []), emptyColumn()],
                  });
                }}
                onToolbarMove={moveToolbar}
                onToolbarToggleActive={toggleToolbarActive}
                onToolbarDelete={(index) => {
                  const items = toolbarItems.filter((_, i) => i !== index);
                  commitToolbar(items);
                  if (selection?.zone === 'toolbar' && selection.index === index) setSelection(null);
                }}
                onNavMove={moveNavRow}
                onNavToggleActive={toggleNavActive}
                onNavToggleMobile={toggleNavMobile}
                onNavDelete={handleDeleteForRow}
                onFooterColDelete={(colIndex) => {
                  if ((navigation.footerColumns || []).length <= 1) return;
                  const cols = navigation.footerColumns.filter((_, i) => i !== colIndex);
                  onChange({ ...navigation, footerColumns: cols });
                  setSelection(null);
                }}
                onAddFooterLink={addFooterLink}
                onFooterLinkDelete={(colIndex, linkIndex) => {
                  const cols = [...navigation.footerColumns];
                  const links = cols[colIndex].links.filter((_, i) => i !== linkIndex);
                  cols[colIndex] = { ...cols[colIndex], links: links.length ? links : [emptyFooterLink()] };
                  onChange({ ...navigation, footerColumns: cols });
                  setSelection(null);
                }}
              />
            </div>
          </div>
        </div>

        {/* Edit panel column — always visible on desktop */}
        <div className="relative min-h-[280px] bg-slate-50/50 xl:min-h-[calc(100vh-12rem)]">
          {selection !== null && (
            <button
              type="button"
              className="fixed inset-0 z-40 bg-black/25 xl:hidden"
              onClick={() => setSelection(null)}
              aria-label={isAr ? 'إغلاق' : 'Close'}
            />
          )}
          <aside className={[
            'xl:sticky xl:top-[57px] xl:max-h-[calc(100vh-12rem)]',
            selection !== null
              ? 'fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-hidden rounded-t-2xl border border-border bg-white shadow-2xl xl:static xl:rounded-none xl:border-0 xl:shadow-none'
              : 'h-full',
          ].join(' ')}>
            <NavigationEditPanel
              selection={selection}
              navigation={navigation}
              categories={categories}
              isAr={isAr}
              onChange={onChange}
              onClose={() => setSelection(null)}
              onDelete={handleDelete}
              onApplyContentPage={onApplyContentPage}
            />
          </aside>
        </div>
      </div>
    </div>
  );
}
