import { ChevronDown, Globe, MapPin, Menu, Search, ShoppingBag } from 'lucide-react';
import { APP_NAME, APP_NAME_EN } from '../../../utils/constants';
import {
  HEADER_BUILTIN_META,
  HEADER_BUILTIN_KEYS,
  parseHeaderToolbar,
} from '../../../utils/headerToolbarConfig';
import { buildStoreNavItems, parseNavigationConfig } from '../../../utils/navBarConfig';
import { getToolbarIconComponent } from '../../../components/layout/ToolbarIcon';
import { TOOLBAR_PILL_CLASS, TOOLBAR_PLAIN_CLASS } from '../../../components/layout/ToolbarIcon';
import NavigationEditableZone, { AddChipButton, InsertNavSlot } from './NavigationEditableZone';

const BUILTIN_ICON_KEYS = {
  categories: 'categories',
  favorites: 'favorites',
  account: 'account',
  cart: 'cart',
};

function toolbarLabel(item, isAr) {
  if (HEADER_BUILTIN_KEYS.includes(item.itemKey)) {
    const meta = HEADER_BUILTIN_META[item.itemKey];
    return isAr ? meta.labelAr : meta.labelEn;
  }
  return isAr ? (item.labelAr || item.labelEn || 'Link') : (item.labelEn || item.labelAr || 'Link');
}

function PreviewToolbarItem({ item, isAr }) {
  const Icon = getToolbarIconComponent(
    HEADER_BUILTIN_KEYS.includes(item.itemKey) ? BUILTIN_ICON_KEYS[item.itemKey] : item.icon,
    item.itemKey,
  );
  const pill = item.itemKey === 'link' && item.variant === 'pill';
  const className = pill ? TOOLBAR_PILL_CLASS : TOOLBAR_PLAIN_CLASS;
  const showLabel = item.showLabel !== false;

  return (
    <span className={`${className} pointer-events-none`}>
      <Icon className="h-5 w-5 shrink-0" />
      {showLabel && (
        <span className={pill ? '' : 'hidden lg:inline'}>{toolbarLabel(item, isAr)}</span>
      )}
      {(item.itemKey === 'cart' || item.itemKey === 'favorites') && (
        <span className="absolute -top-1 -start-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-500 px-0.5 text-[9px] font-bold text-white">
          2
        </span>
      )}
    </span>
  );
}

function StoreLogo({ storeSettings, isAr }) {
  const storeName = isAr
    ? (storeSettings?.storeNameAr || APP_NAME)
    : (storeSettings?.storeNameEn || APP_NAME_EN);
  const storeSubtitle = isAr
    ? (storeSettings?.storeNameEn || APP_NAME_EN)
    : (storeSettings?.storeNameAr || APP_NAME);

  return (
    <div className="flex shrink-0 items-center gap-2 pointer-events-none">
      {storeSettings?.logoUrl ? (
        <img src={storeSettings.logoUrl} alt="" className="h-10 w-10 rounded-xl object-contain md:h-11 md:w-11" />
      ) : (
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-600 text-white shadow-md md:h-11 md:w-11">
          <ShoppingBag className="h-5 w-5" />
        </span>
      )}
      <div className="leading-tight">
        <span className="block text-sm font-bold text-primary-700 md:text-lg">{storeName}</span>
        <span className="hidden text-[10px] text-text-muted md:block">{storeSubtitle}</span>
      </div>
    </div>
  );
}

function isSelected(selection, target) {
  if (!selection || selection.zone !== target.zone) return false;
  return Object.keys(target).every((key) => key === 'zone' || selection[key] === target[key]);
}

export default function NavigationStorefrontPreview({
  navigation,
  storeSettings,
  categories,
  isAr,
  viewMode,
  selection,
  onSelect,
  toolbarItems,
  orderedNavRows,
  onInsertToolbar,
  onInsertNav,
  onInsertFooterColumn,
  onToolbarMove,
  onToolbarToggleActive,
  onToolbarDelete,
  onNavMove,
  onNavToggleActive,
  onNavToggleMobile,
  onNavDelete,
  onFooterColDelete,
  onAddFooterLink,
  onFooterLinkDelete,
}) {
  const isMobile = viewMode === 'mobile';
  const freeThreshold = storeSettings?.freeDeliveryThreshold ?? 500;
  const announcement = isAr ? navigation.announcementAr : navigation.announcementEn;
  const deliveryText = announcement || (isAr
    ? `توصيل سريع · مجاني فوق ${freeThreshold} ج.م`
    : `Fast delivery · Free over ${freeThreshold} EGP`);

  const getChildren = (slug) => categories.filter((c) => c.parentSlug === slug || c.parent === slug);
  const navItems = buildStoreNavItems(navigation, categories, getChildren);

  const startItems = toolbarItems.filter((i) => i.zone === 'start' && i.isActive !== false);
  const endItems = toolbarItems.filter((i) => i.zone === 'end' && i.isActive !== false);

  const footerColumns = (navigation.footerColumns || [])
    .slice()
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

  const navRowLabel = (row) => {
    if (row.type === 'home') {
      return isAr ? (row.data.labelAr || 'الرئيسية') : (row.data.labelEn || 'Home');
    }
    if (row.type === 'link') {
      return isAr ? (row.data.labelAr || row.data.labelEn) : (row.data.labelEn || row.data.labelAr);
    }
    const cat = categories.find((c) => c.slug === row.data.categorySlug);
    const fallback = cat ? (isAr ? cat.nameAr || cat.name : cat.nameEn || cat.name) : row.data.categorySlug;
    return isAr ? (row.data.labelAr || fallback) : (row.data.labelEn || fallback);
  };

  return (
    <div className="overflow-hidden bg-white">
      {/* Announcement */}
      <div id="nav-section-announcement">
      <NavigationEditableZone
        isAr={isAr}
        label={isAr ? 'شريط الإعلان' : 'Announcement'}
        selected={isSelected(selection, { zone: 'announcement' })}
        onEdit={() => onSelect({ zone: 'announcement' })}
        canDelete={false}
        className="mx-1 mt-1"
      >
        {isMobile ? (
          <div className="border-b border-primary-100 bg-primary-50 px-4 py-1.5">
            <p className="truncate text-center text-[11px] font-medium text-primary-800">{deliveryText}</p>
          </div>
        ) : (
          <div className="bg-primary-700 text-white">
            <div className="flex items-center justify-between px-4 py-2 text-xs">
              <span className="truncate">{deliveryText}</span>
              <div className="flex shrink-0 items-center gap-2 opacity-80">
                <MapPin className="h-3.5 w-3.5" />
                <span>{isAr ? 'الموقع' : 'Location'}</span>
                <Globe className="h-3.5 w-3.5 ms-2" />
                <span>{isAr ? 'English' : 'العربية'}</span>
              </div>
            </div>
          </div>
        )}
      </NavigationEditableZone>
      </div>

      {/* Header row */}
      <div id="nav-section-header" className="border-b border-border px-3 py-2.5 md:px-4 md:py-3">
        {isMobile ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface">
                <Menu className="h-5 w-5 text-text" />
              </span>
              <div className="min-w-0 flex-1">
                <StoreLogo storeSettings={storeSettings} isAr={isAr} />
              </div>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface">
                <MapPin className="h-5 w-5 text-text-muted" />
              </span>
            </div>
            <div className="pointer-events-none flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-text-muted">
              <Search className="h-4 w-4 shrink-0" />
              <span>{isAr ? 'ابحث عن منتج...' : 'Search products...'}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[...startItems, ...endItems].map((item) => {
                const globalIndex = toolbarItems.indexOf(item);
                const inactive = item.isActive === false;
                return (
                  <NavigationEditableZone
                    key={`tb-m-${globalIndex}`}
                    isAr={isAr}
                    label={toolbarLabel(item, isAr)}
                    selected={isSelected(selection, { zone: 'toolbar', index: globalIndex })}
                    inactive={inactive}
                    onEdit={() => onSelect({ zone: 'toolbar', index: globalIndex })}
                    onDelete={!HEADER_BUILTIN_KEYS.includes(item.itemKey) ? () => onToolbarDelete?.(globalIndex) : undefined}
                    onToggleActive={() => onToolbarToggleActive?.(globalIndex)}
                    onMoveUp={() => onToolbarMove?.(globalIndex, -1)}
                    onMoveDown={() => onToolbarMove?.(globalIndex, 1)}
                    canMoveUp={globalIndex > 0}
                    canMoveDown={globalIndex < toolbarItems.length - 1}
                    canDelete={!HEADER_BUILTIN_KEYS.includes(item.itemKey)}
                    className="inline-block"
                  >
                    <PreviewToolbarItem item={item} isAr={isAr} />
                  </NavigationEditableZone>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <StoreLogo storeSettings={storeSettings} isAr={isAr} />
            <div className="flex shrink-0 flex-wrap items-center gap-1">
              {startItems.map((item) => {
                const globalIndex = toolbarItems.indexOf(item);
                return (
                  <NavigationEditableZone
                    key={`tb-s-${globalIndex}`}
                    isAr={isAr}
                    label={toolbarLabel(item, isAr)}
                    selected={isSelected(selection, { zone: 'toolbar', index: globalIndex })}
                    inactive={item.isActive === false}
                    onEdit={() => onSelect({ zone: 'toolbar', index: globalIndex })}
                    onDelete={!HEADER_BUILTIN_KEYS.includes(item.itemKey) ? () => onToolbarDelete?.(globalIndex) : undefined}
                    onToggleActive={() => onToolbarToggleActive?.(globalIndex)}
                    onMoveUp={() => onToolbarMove?.(globalIndex, -1)}
                    onMoveDown={() => onToolbarMove?.(globalIndex, 1)}
                    canMoveUp={globalIndex > 0}
                    canMoveDown={globalIndex < toolbarItems.length - 1}
                    canDelete={!HEADER_BUILTIN_KEYS.includes(item.itemKey)}
                    className="inline-block"
                  >
                    <PreviewToolbarItem item={item} isAr={isAr} />
                  </NavigationEditableZone>
                );
              })}
              <AddChipButton
                isAr={isAr}
                onClick={() => onInsertToolbar('start')}
                label={isAr ? 'إضافة' : 'Add'}
              />
            </div>
            <div className="pointer-events-none min-w-0 flex-1">
              <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-text-muted">
                <Search className="h-4 w-4 shrink-0" />
                <span>{isAr ? 'ابحث عن منتج...' : 'Search products...'}</span>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-1">
              {endItems.map((item) => {
                const globalIndex = toolbarItems.indexOf(item);
                return (
                  <NavigationEditableZone
                    key={`tb-e-${globalIndex}`}
                    isAr={isAr}
                    label={toolbarLabel(item, isAr)}
                    selected={isSelected(selection, { zone: 'toolbar', index: globalIndex })}
                    inactive={item.isActive === false}
                    onEdit={() => onSelect({ zone: 'toolbar', index: globalIndex })}
                    onDelete={!HEADER_BUILTIN_KEYS.includes(item.itemKey) ? () => onToolbarDelete?.(globalIndex) : undefined}
                    onToggleActive={() => onToolbarToggleActive?.(globalIndex)}
                    onMoveUp={() => onToolbarMove?.(globalIndex, -1)}
                    onMoveDown={() => onToolbarMove?.(globalIndex, 1)}
                    canMoveUp={globalIndex > 0}
                    canMoveDown={globalIndex < toolbarItems.length - 1}
                    canDelete={!HEADER_BUILTIN_KEYS.includes(item.itemKey)}
                    className="inline-block"
                  >
                    <PreviewToolbarItem item={item} isAr={isAr} />
                  </NavigationEditableZone>
                );
              })}
              <AddChipButton
                isAr={isAr}
                onClick={() => onInsertToolbar('end')}
                label={isAr ? 'إضافة' : 'Add'}
              />
            </div>
          </div>
        )}
      </div>

      {/* Nav bar */}
      <div id="nav-section-menu" className={`border-b border-border bg-white ${isMobile ? 'px-3 py-2' : 'px-4 py-0'}`}>
        {isMobile ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 p-3">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
              {isAr ? 'قائمة الموبايل (عند فتح ☰)' : 'Mobile menu (when ☰ opened)'}
            </p>
            <div className="space-y-1">
              {orderedNavRows.filter((r) => r.data?.showOnMobile !== false && r.data?.isActive !== false).length === 0 && (
                <p className="py-2 text-center text-xs text-text-muted">
                  {isAr ? 'لا عناصر على الموبايل' : 'No mobile nav items'}
                </p>
              )}
              {orderedNavRows
                .filter((row) => row.data?.showOnMobile !== false)
                .map((row) => {
                  const inactive = row.data?.isActive === false;
                  const label = navRowLabel(row);
                  const realIndex = orderedNavRows.findIndex((r) => r.key === row.key);
                  return (
                    <NavigationEditableZone
                      key={row.key}
                      isAr={isAr}
                      label={label}
                      selected={isSelected(selection, { zone: 'nav', rowKey: row.key })}
                      inactive={inactive}
                      showMobileToggle
                      hiddenOnMobile={row.data?.showOnMobile === false}
                      onEdit={() => onSelect({ zone: 'nav', rowKey: row.key })}
                      onDelete={row.type !== 'home' ? () => onNavDelete?.(row.key) : undefined}
                      onToggleActive={() => onNavToggleActive?.(row.key)}
                      onToggleMobile={() => onNavToggleMobile?.(row.key)}
                      onMoveUp={() => onNavMove?.(row.key, -1)}
                      onMoveDown={() => onNavMove?.(row.key, 1)}
                      canMoveUp={realIndex > 0}
                      canMoveDown={realIndex < orderedNavRows.length - 1}
                      canDelete={row.type !== 'home'}
                      className="block"
                    >
                      <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2.5 text-sm font-medium text-text shadow-sm">
                        <span>{label}</span>
                        <ChevronDown className="h-4 w-4 -rotate-90 text-text-muted rtl:rotate-90" />
                      </div>
                    </NavigationEditableZone>
                  );
                })}
            </div>
            <button
              type="button"
              onClick={onInsertNav}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-primary-200 bg-primary-50/50 py-2.5 text-xs font-bold text-primary-700 hover:bg-primary-50"
            >
              + {isAr ? 'إضافة عنصر قائمة' : 'Add menu item'}
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-0.5 py-1">
            {orderedNavRows.map((row, rowIndex) => {
              const inactive = row.data?.isActive === false;
              const hiddenOnMobile = row.data?.showOnMobile === false;
              const navItem = navItems.find((n) => {
                if (row.type === 'home') return n.type === 'home';
                if (row.type === 'link') return n.type === 'link' && n.to === row.data.href;
                return n.type === 'category' && n.slug === row.data.categorySlug;
              });
              const label = navRowLabel(row);
              const highlight = row.type === 'link' && row.data.highlight;

              return (
                <div key={row.key} className="flex items-center">
                  {rowIndex > 0 && (
                    <InsertNavSlot isAr={isAr} onInsert={onInsertNav} label="+" />
                  )}
                  <NavigationEditableZone
                    isAr={isAr}
                    label={label}
                    selected={isSelected(selection, { zone: 'nav', rowKey: row.key })}
                    inactive={inactive}
                    showMobileToggle
                    hiddenOnMobile={hiddenOnMobile}
                    onEdit={() => onSelect({ zone: 'nav', rowKey: row.key })}
                    onDelete={row.type !== 'home' ? () => onNavDelete?.(row.key) : undefined}
                    onToggleActive={() => onNavToggleActive?.(row.key)}
                    onToggleMobile={() => onNavToggleMobile?.(row.key)}
                    onMoveUp={() => onNavMove?.(row.key, -1)}
                    onMoveDown={() => onNavMove?.(row.key, 1)}
                    canMoveUp={rowIndex > 0}
                    canMoveDown={rowIndex < orderedNavRows.length - 1}
                    canDelete={row.type !== 'home'}
                    className="inline-block"
                  >
                    <span
                      className={[
                        'inline-flex items-center gap-1 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors pointer-events-none',
                        highlight ? 'text-accent-600' : 'text-text hover:bg-surface',
                        inactive ? '' : '',
                      ].join(' ')}
                    >
                      {label}
                      {(row.type === 'home' || row.type === 'category' || navItem?.isOffers) && (
                        <ChevronDown className="h-3.5 w-3.5 text-text-muted" />
                      )}
                    </span>
                  </NavigationEditableZone>
                </div>
              );
            })}
            <AddChipButton
              isAr={isAr}
              onClick={onInsertNav}
              label={isAr ? 'رابط' : 'Link'}
            />
          </div>
        )}
      </div>

      {/* Page placeholder */}
      <div className="pointer-events-none bg-[#f8faf9] px-4 py-10 text-center">
        <p className="text-xs font-medium text-slate-400">
          {isAr ? 'محتوى الصفحة (معاينة فقط)' : 'Page content (preview only)'}
        </p>
        <div className="mx-auto mt-4 grid max-w-md grid-cols-3 gap-2 opacity-40">
          {[1, 2, 3].map((i) => (
            <div key={i} className="aspect-square rounded-xl bg-slate-200" />
          ))}
        </div>
      </div>

      {/* Footer */}
      <div id="nav-section-footer" className="border-t border-slate-700 bg-slate-900 text-slate-300">
        <div className="px-4 py-6">
          <div className={`grid gap-6 ${isMobile ? 'grid-cols-1' : 'grid-cols-2 md:grid-cols-4'}`}>
            {footerColumns.map((column, colIndex) => (
              <div key={colIndex}>
                <NavigationEditableZone
                  isAr={isAr}
                  label={isAr ? 'عمود' : 'Column'}
                  selected={isSelected(selection, { zone: 'footer-col', colIndex })}
                  onEdit={() => onSelect({ zone: 'footer-col', colIndex })}
                  onDelete={footerColumns.length > 1 ? () => onFooterColDelete?.(colIndex) : undefined}
                  canDelete={footerColumns.length > 1}
                  className="mb-3"
                >
                  <h4 className="pointer-events-none text-sm font-bold text-white">
                    {isAr ? (column.titleAr || column.titleEn || 'عمود') : (column.titleEn || column.titleAr || 'Column')}
                  </h4>
                </NavigationEditableZone>
                <ul className="space-y-1.5">
                  {(column.links || []).map((link, linkIndex) => {
                    const inactive = link.isActive === false;
                    const label = isAr ? (link.labelAr || link.labelEn) : (link.labelEn || link.labelAr);
                    return (
                      <li key={linkIndex}>
                        <NavigationEditableZone
                          isAr={isAr}
                          label={label || 'Link'}
                          selected={isSelected(selection, { zone: 'footer-link', colIndex, linkIndex })}
                          inactive={inactive}
                          onEdit={() => onSelect({ zone: 'footer-link', colIndex, linkIndex })}
                          onDelete={(column.links || []).length > 1 ? () => onFooterLinkDelete?.(colIndex, linkIndex) : undefined}
                          canDelete={(column.links || []).length > 1}
                          className="block"
                        >
                          <span className="pointer-events-none block py-0.5 text-sm text-slate-400 hover:text-white">
                            {label || (isAr ? 'رابط' : 'Link')}
                          </span>
                        </NavigationEditableZone>
                      </li>
                    );
                  })}
                </ul>
                <div className="mt-2">
                  <AddChipButton
                    isAr={isAr}
                    onClick={() => onAddFooterLink?.(colIndex)}
                    label={isAr ? 'رابط' : 'Link'}
                  />
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={onInsertFooterColumn}
            className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-600 py-2.5 text-xs font-bold text-slate-400 hover:border-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
          >
            + {isAr ? 'عمود فوتر' : 'Footer column'}
          </button>
        </div>
        <div className="border-t border-slate-800 px-4 py-3 text-center text-[10px] text-slate-500">
          © {new Date().getFullYear()} · {isAr ? 'معاينة الفوتر' : 'Footer preview'}
        </div>
      </div>
    </div>
  );
}

export function buildOrderedNavRows(navigation) {
  const { homeNav, headerLinks, navCategories } = parseNavigationConfig(navigation);
  const rows = [
    { key: 'home', type: 'home', sortOrder: homeNav.sortOrder ?? 0, data: homeNav },
    ...headerLinks.map((link, index) => ({
      key: `link-${index}`,
      type: 'link',
      sortOrder: link.sortOrder ?? index + 1,
      data: link,
      index,
    })),
    ...navCategories.map((item, index) => ({
      key: `cat-${item.categorySlug}`,
      type: 'category',
      sortOrder: item.sortOrder ?? index + 20,
      data: item,
      index,
    })),
  ];
  return rows.sort((a, b) => a.sortOrder - b.sortOrder);
}

export function getToolbarItems(navigation) {
  return parseHeaderToolbar(navigation);
}
