import {
  Apple, ChevronDown, Clock, Globe, LayoutGrid, Mail, MapPin, Menu, Phone, Play, Search, ShoppingBag, Tag,
} from 'lucide-react';
import { APP_NAME, APP_NAME_EN } from '../../../utils/constants';
import {
  HEADER_BUILTIN_META,
  HEADER_BUILTIN_KEYS,
  parseHeaderToolbar,
} from '../../../utils/headerToolbarConfig';
import { parseNavigationConfig } from '../../../utils/navBarConfig';
import ToolbarIcon, { TOOLBAR_PILL_CLASS, TOOLBAR_PLAIN_CLASS } from '../../../components/layout/ToolbarIcon';
import { SOCIAL_PATHS, PAYMENT_META } from '../../../components/layout/regions/socialPaths';
import {
  DEFAULT_FOOTER_LEGAL_LINKS,
  DEFAULT_FOOTER_PAYMENT_METHODS,
  footerSectionEnabled,
} from '../../../utils/footerConfig';
import NavigationEditableZone, { AddChipButton, InsertNavSlot } from './NavigationEditableZone';

const BUILTIN_ICON_KEYS = { categories: 'categories', favorites: 'favorites', account: 'account', cart: 'cart' };

function toolbarLabel(item, isAr) {
  if (HEADER_BUILTIN_KEYS.includes(item.itemKey)) {
    const meta = HEADER_BUILTIN_META[item.itemKey];
    return isAr ? meta.labelAr : meta.labelEn;
  }
  return isAr ? (item.labelAr || item.labelEn || 'Link') : (item.labelEn || item.labelAr || 'Link');
}

function isSelected(selection, target) {
  if (!selection || selection.zone !== target.zone) return false;
  return Object.keys(target).every((key) => key === 'zone' || selection[key] === target[key]);
}

function BrandGlyph({ path, className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden focusable="false">
      <path d={path} />
    </svg>
  );
}

/* ------------------------------------------------------------------ *
 * Header mirror — matches Header.jsx (3 tiers desktop, 2 rows mobile)
 * ------------------------------------------------------------------ */

function PreviewToolbarItem({ item, isAr }) {
  const iconKey = HEADER_BUILTIN_KEYS.includes(item.itemKey) ? BUILTIN_ICON_KEYS[item.itemKey] : item.icon;
  const pill = item.itemKey === 'link' && item.variant === 'pill';
  const className = pill ? TOOLBAR_PILL_CLASS : TOOLBAR_PLAIN_CLASS;
  const showLabel = item.showLabel !== false;
  return (
    <span className={`${className} pointer-events-none`}>
      <ToolbarIcon icon={iconKey} itemKey={item.itemKey === 'link' ? 'link' : item.itemKey} className="h-5 w-5 shrink-0" />
      {showLabel && <span className={pill ? '' : 'hidden lg:inline'}>{toolbarLabel(item, isAr)}</span>}
      {(item.itemKey === 'cart' || item.itemKey === 'favorites') && (
        <span className="absolute -top-1 -start-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger-500 px-0.5 text-[9px] font-bold text-white">2</span>
      )}
    </span>
  );
}

function Wordmark({ storeSettings, isAr, compact = false }) {
  const storeName = isAr ? (storeSettings?.storeNameAr || APP_NAME) : (storeSettings?.storeNameEn || APP_NAME_EN);
  if (storeSettings?.logoUrl) {
    return <img src={storeSettings.logoUrl} alt={storeName} className={`w-auto object-contain ${compact ? 'h-9' : 'h-11'}`} />;
  }
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <span className={`flex shrink-0 items-center justify-center rounded-2xl bg-primary-600 text-white shadow-sm ${compact ? 'h-9 w-9' : 'h-11 w-11'}`}>
        <ShoppingBag className={compact ? 'h-5 w-5' : 'h-6 w-6'} aria-hidden />
      </span>
      <span className={`min-w-0 truncate font-black tracking-tight text-primary-700 ${compact ? 'text-lg' : 'text-[26px]'}`}>
        {storeName}
      </span>
    </span>
  );
}

function PreviewHeader({
  navigation, storeSettings, isAr, isMobile, selection, onSelect,
  toolbarItems, orderedNavRows, navRowLabel,
  onInsertToolbar, onInsertNav,
  onToolbarMove, onToolbarToggleActive, onToolbarDelete,
  onNavMove, onNavToggleActive, onNavToggleMobile, onNavDelete,
}) {
  const startItems = toolbarItems.filter((i) => i.zone === 'start' && i.isActive !== false);
  const endItems = toolbarItems.filter((i) => i.zone === 'end' && i.isActive !== false);
  const serviceAr = navigation.topBarServiceLabelAr || 'خدمة العملاء';
  const serviceEn = navigation.topBarServiceLabelEn || 'Customer service';

  const toolbarZone = (items, zone, keyPrefix) => items.map((item) => {
    const globalIndex = toolbarItems.indexOf(item);
    return (
      <NavigationEditableZone
        key={`${keyPrefix}-${globalIndex}`}
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
  });

  const searchField = (
    <div className="pointer-events-none flex items-center gap-2 rounded-field border border-border bg-surface px-3.5 py-2.5 text-sm text-text-muted">
      <Search className="h-4 w-4 shrink-0" />
      <span>{isAr ? 'ابحث عن منتج أو قسم…' : 'Search products or categories…'}</span>
    </div>
  );

  if (isMobile) {
    return (
      <div id="nav-section-header">
        {/* Mobile row 1 */}
        <div className="border-b border-border px-3 py-2.5">
          <div className="flex items-center gap-1.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-field text-primary-700"><Menu className="h-6 w-6" /></span>
            <div className="min-w-0 flex-1">
              <NavigationEditableZone
                isAr={isAr}
                label={isAr ? 'الشعار' : 'Logo'}
                selected={isSelected(selection, { zone: 'logo' })}
                onEdit={() => onSelect({ zone: 'logo' })}
                canDelete={false}
                className="inline-block"
              >
                <Wordmark storeSettings={storeSettings} isAr={isAr} compact />
              </NavigationEditableZone>
            </div>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-field text-text-muted"><MapPin className="h-5 w-5" /></span>
          </div>
          <div className="mt-2.5">{searchField}</div>
        </div>
        {/* Mobile: toolbar chips (shown in the drawer on the real store, previewed here for editing) */}
        <div id="nav-section-menu" className="border-b border-border bg-slate-50/70 px-3 py-2.5">
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
            {isAr ? 'أزرار / روابط القائمة' : 'Menu actions & links'}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {[...startItems, ...endItems].map((item) => {
              const globalIndex = toolbarItems.indexOf(item);
              return (
                <NavigationEditableZone
                  key={`m-tb-${globalIndex}`}
                  isAr={isAr}
                  label={toolbarLabel(item, isAr)}
                  selected={isSelected(selection, { zone: 'toolbar', index: globalIndex })}
                  inactive={item.isActive === false}
                  onEdit={() => onSelect({ zone: 'toolbar', index: globalIndex })}
                  onDelete={!HEADER_BUILTIN_KEYS.includes(item.itemKey) ? () => onToolbarDelete?.(globalIndex) : undefined}
                  onToggleActive={() => onToolbarToggleActive?.(globalIndex)}
                  canDelete={!HEADER_BUILTIN_KEYS.includes(item.itemKey)}
                  className="inline-block"
                >
                  <PreviewToolbarItem item={item} isAr={isAr} />
                </NavigationEditableZone>
              );
            })}
            <AddChipButton onClick={() => onInsertToolbar('end')} label={isAr ? 'إضافة' : 'Add'} />
          </div>
          <div className="mt-3 space-y-1">
            {orderedNavRows.filter((r) => r.data?.showOnMobile !== false).map((row) => {
              const realIndex = orderedNavRows.findIndex((r) => r.key === row.key);
              return (
                <NavigationEditableZone
                  key={row.key}
                  isAr={isAr}
                  label={navRowLabel(row)}
                  selected={isSelected(selection, { zone: 'nav', rowKey: row.key })}
                  inactive={row.data?.isActive === false}
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
                    <span>{navRowLabel(row)}</span>
                    <ChevronDown className="h-4 w-4 -rotate-90 text-text-muted rtl:rotate-90" />
                  </div>
                </NavigationEditableZone>
              );
            })}
            <button type="button" onClick={onInsertNav} className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-primary-200 bg-primary-50/50 py-2 text-xs font-bold text-primary-700 hover:bg-primary-50">
              + {isAr ? 'إضافة عنصر قائمة' : 'Add menu item'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="nav-section-header">
      {/* Tier 1 — utility bar */}
      <NavigationEditableZone
        isAr={isAr}
        label={isAr ? 'الشريط العلوي' : 'Top bar'}
        selected={isSelected(selection, { zone: 'topbar' })}
        onEdit={() => onSelect({ zone: 'topbar' })}
        canDelete={false}
        className="mx-1 mt-1 block"
      >
        <div className="flex items-center justify-between rounded-lg bg-primary-800 px-4 py-1.5 text-[11px] text-white/85">
          <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{isAr ? 'التوصيل إلى: القاهرة' : 'Deliver to: Cairo'}</span>
          <span className="flex items-center gap-3">
            <span>{isAr ? serviceAr : serviceEn}</span>
            <span className="h-3 w-px bg-white/25" />
            <span className="flex items-center gap-1"><Globe className="h-3.5 w-3.5" />{isAr ? 'English' : 'العربية'}</span>
          </span>
        </div>
      </NavigationEditableZone>

      {/* Tier 2 — main header: search | logo | actions */}
      <div className="border-b border-border px-4 py-3.5">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div className="flex min-w-0 items-center gap-1 justify-self-start">
            <div className="w-full max-w-[240px]">{searchField}</div>
            {toolbarZone(startItems, 'start', 'tb-s')}
            <AddChipButton onClick={() => onInsertToolbar('start')} label={isAr ? 'إضافة' : 'Add'} />
          </div>
          <div className="justify-self-center px-2">
            <NavigationEditableZone
              isAr={isAr}
              label={isAr ? 'الشعار' : 'Logo'}
              selected={isSelected(selection, { zone: 'logo' })}
              onEdit={() => onSelect({ zone: 'logo' })}
              canDelete={false}
              className="inline-block"
            >
              <Wordmark storeSettings={storeSettings} isAr={isAr} />
            </NavigationEditableZone>
          </div>
          <div className="flex min-w-0 items-center justify-self-end gap-0.5">
            {toolbarZone(endItems, 'end', 'tb-e')}
            <AddChipButton onClick={() => onInsertToolbar('end')} label={isAr ? 'إضافة' : 'Add'} />
          </div>
        </div>
      </div>

      {/* Tier 3 — category nav */}
      <div id="nav-section-menu" className="border-b border-border px-4">
        <div className="flex flex-wrap items-center justify-center gap-x-1 gap-y-0.5 py-1">
          <span className="inline-flex items-center gap-1.5 px-3 py-3 text-[15px] font-bold text-primary-700">
            <LayoutGrid className="h-[18px] w-[18px]" />
            {isAr ? 'كل الأقسام' : 'All Categories'}
            <ChevronDown className="h-3.5 w-3.5" />
          </span>
          {orderedNavRows.map((row, rowIndex) => {
            const label = navRowLabel(row);
            const isOffers = row.type === 'link' && row.data?.highlight;
            return (
              <div key={row.key} className="flex items-center">
                {rowIndex > 0 && <InsertNavSlot isAr={isAr} onInsert={onInsertNav} label="+" />}
                <NavigationEditableZone
                  isAr={isAr}
                  label={label}
                  selected={isSelected(selection, { zone: 'nav', rowKey: row.key })}
                  inactive={row.data?.isActive === false}
                  showMobileToggle
                  hiddenOnMobile={row.data?.showOnMobile === false}
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
                  <span className={[
                    'inline-flex items-center gap-1.5 px-3 py-3 text-[15px] pointer-events-none',
                    isOffers ? 'font-bold text-danger-500' : 'font-medium text-primary-700',
                  ].join(' ')}>
                    {isOffers && <Tag className="h-[15px] w-[15px]" />}
                    {label}
                    {(row.type === 'home' || row.type === 'category') && <ChevronDown className="h-3.5 w-3.5 text-text-muted" />}
                  </span>
                </NavigationEditableZone>
              </div>
            );
          })}
          <AddChipButton onClick={onInsertNav} label={isAr ? 'رابط' : 'Link'} />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Delivery / announcement strip — matches DeliverySlotStrip.jsx
 * ------------------------------------------------------------------ */

function PreviewDeliveryStrip({ navigation, isAr, selection, onSelect }) {
  const announcement = isAr ? navigation.announcementAr : navigation.announcementEn;
  const text = announcement
    || (isAr ? 'التوصيل متاح لمنطقتك · مجاني فوق ٥٠٠ ج.م' : 'Delivery available in your area · Free over 500 EGP');
  return (
    <NavigationEditableZone
      isAr={isAr}
      label={isAr ? 'شريط الإعلان / التوصيل' : 'Announcement / delivery strip'}
      selected={isSelected(selection, { zone: 'announcement' })}
      onEdit={() => onSelect({ zone: 'announcement' })}
      canDelete={false}
      className="mx-1 my-1 block"
    >
      <div className="flex items-center justify-center gap-2 rounded-lg border-y border-primary-100 bg-primary-50 px-4 py-1.5 text-center text-[12px] font-medium text-primary-800">
        <span className="truncate">{text}</span>
      </div>
    </NavigationEditableZone>
  );
}

/* ------------------------------------------------------------------ *
 * Footer mirror — matches Footer.jsx (branded rounded primary panel)
 * ------------------------------------------------------------------ */

function FooterEditable({ isAr, label, zone, selection, onSelect, children, className = '' }) {
  return (
    <NavigationEditableZone
      isAr={isAr}
      label={label}
      selected={isSelected(selection, { zone })}
      onEdit={() => onSelect({ zone })}
      canDelete={false}
      className={className}
    >
      {children}
    </NavigationEditableZone>
  );
}

function PreviewFooter({
  navigation, storeSettings, isAr, isMobile, selection, onSelect,
  footerColumns, onFooterColDelete, onAddFooterLink, onFooterLinkDelete, onInsertFooterColumn,
}) {
  const storeName = isAr ? (storeSettings?.storeNameAr || APP_NAME) : (storeSettings?.storeNameEn || APP_NAME_EN);
  const storeSubtitle = isAr ? (storeSettings?.storeNameEn || APP_NAME_EN) : (storeSettings?.storeNameAr || APP_NAME);
  const tagline = isAr
    ? (storeSettings?.taglineAr || 'تسوق احتياجاتك اليومية بسهولة وسرعة')
    : (storeSettings?.taglineEn || 'Shop everyday essentials quickly and easily');
  const socialEntries = Object.entries(storeSettings?.socialLinks || {}).filter(([, href]) => href);
  const appStore = storeSettings?.appLinks?.appStore;
  const googlePlay = storeSettings?.appLinks?.googlePlay;
  const legalLinks = navigation.footer?.legalLinks?.length ? navigation.footer.legalLinks : DEFAULT_FOOTER_LEGAL_LINKS;
  const paymentMethods = navigation.footer?.paymentMethods?.length ? navigation.footer.paymentMethods : DEFAULT_FOOTER_PAYMENT_METHODS;
  const on = (section) => footerSectionEnabled(navigation.footer, section);

  return (
    <div id="nav-section-footer" className="p-1">
      <div className="relative overflow-hidden rounded-2xl bg-primary-600 px-4 py-6 text-white">
        {on('backToTop') && (
          <div className="flex justify-center pb-5">
            <FooterEditable isAr={isAr} label={isAr ? 'زر العودة للأعلى' : 'Back to top'} zone="footer-backtop" selection={selection} onSelect={onSelect} className="inline-block">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-5 py-2 text-xs font-semibold ring-1 ring-white/20">
                <ChevronDown className="h-3.5 w-3.5 rotate-180" />
                {isAr ? 'العودة إلى الأعلى' : 'Back to top'}
              </span>
            </FooterEditable>
          </div>
        )}

        <div className={`grid gap-6 ${isMobile ? 'grid-cols-1' : 'grid-cols-12'}`}>
          {/* brand + socials */}
          <div className={isMobile ? '' : 'col-span-4'}>
            <FooterEditable isAr={isAr} label={isAr ? 'العلامة والشعار النصي' : 'Brand & tagline'} zone="footer-brand" selection={selection} onSelect={onSelect} className="block">
              <div className="flex items-center gap-2 text-[11px] font-medium text-white/70">
                <span className="h-1.5 w-1.5 rounded-full bg-white/80" />{storeSubtitle}
              </div>
              <h4 className="mt-2 max-w-xs text-lg font-extrabold leading-snug">{tagline}</h4>
            </FooterEditable>
            {on('social') && (
              <FooterEditable isAr={isAr} label={isAr ? 'أيقونات التواصل' : 'Social icons'} zone="footer-social" selection={selection} onSelect={onSelect} className="mt-4 block">
                <div className="flex flex-wrap gap-2">
                  {(socialEntries.length ? socialEntries : [['facebook', '#'], ['instagram', '#']]).map(([key]) => (
                    <span key={key} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/15">
                      <BrandGlyph path={SOCIAL_PATHS[key] || SOCIAL_PATHS.linkedin} className="h-4 w-4" />
                    </span>
                  ))}
                </div>
                {!socialEntries.length && (
                  <p className="mt-1.5 text-[10px] text-white/60">{isAr ? 'أضف الروابط لإظهارها' : 'Add links to show these'}</p>
                )}
              </FooterEditable>
            )}
          </div>

          {/* link columns */}
          <div className={isMobile ? '' : 'col-span-5'}>
            <div className="grid gap-6 sm:grid-cols-2">
              {footerColumns.map((column, colIndex) => (
                <div key={colIndex}>
                  <NavigationEditableZone
                    isAr={isAr}
                    label={isAr ? 'عمود' : 'Column'}
                    selected={isSelected(selection, { zone: 'footer-col', colIndex })}
                    onEdit={() => onSelect({ zone: 'footer-col', colIndex })}
                    onDelete={footerColumns.length > 1 ? () => onFooterColDelete?.(colIndex) : undefined}
                    canDelete={footerColumns.length > 1}
                    className="mb-2 block"
                  >
                    <h5 className="text-xs font-bold uppercase tracking-wide text-white/60">
                      {isAr ? (column.titleAr || column.titleEn || 'عمود') : (column.titleEn || column.titleAr || 'Column')}
                    </h5>
                  </NavigationEditableZone>
                  <ul className="space-y-1.5">
                    {(column.links || []).map((link, linkIndex) => {
                      const label = isAr ? (link.labelAr || link.labelEn) : (link.labelEn || link.labelAr);
                      return (
                        <li key={linkIndex}>
                          <NavigationEditableZone
                            isAr={isAr}
                            label={label || 'Link'}
                            selected={isSelected(selection, { zone: 'footer-link', colIndex, linkIndex })}
                            inactive={link.isActive === false}
                            onEdit={() => onSelect({ zone: 'footer-link', colIndex, linkIndex })}
                            onDelete={(column.links || []).length > 1 ? () => onFooterLinkDelete?.(colIndex, linkIndex) : undefined}
                            canDelete={(column.links || []).length > 1}
                            className="block"
                          >
                            <span className="pointer-events-none block py-0.5 text-sm text-white/80">{label || (isAr ? 'رابط' : 'Link')}</span>
                          </NavigationEditableZone>
                        </li>
                      );
                    })}
                  </ul>
                  <div className="mt-1.5">
                    <AddChipButton onClick={() => onAddFooterLink?.(colIndex)} label={isAr ? 'رابط' : 'Link'} />
                  </div>
                </div>
              ))}
            </div>
            <button type="button" onClick={onInsertFooterColumn} className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/30 py-2 text-xs font-bold text-white/70 hover:bg-white/5">
              + {isAr ? 'عمود فوتر' : 'Footer column'}
            </button>
          </div>

          {/* contact + apps */}
          <div className={isMobile ? '' : 'col-span-3'}>
            {on('contact') && (
              <FooterEditable isAr={isAr} label={isAr ? 'بيانات التواصل' : 'Contact info'} zone="footer-contact" selection={selection} onSelect={onSelect} className="block">
                <h5 className="text-xs font-bold uppercase tracking-wide text-white/60">{isAr ? 'تواصل معنا' : 'Get in touch'}</h5>
                <ul className="mt-3 space-y-2 text-sm text-white/80">
                  <li className="flex items-center gap-2"><Phone className="h-4 w-4 text-white/50" /><span dir="ltr">{storeSettings?.supportPhone || '16XXX'}</span></li>
                  <li className="flex items-center gap-2"><Mail className="h-4 w-4 text-white/50" />{storeSettings?.supportEmail || 'support@marketplus.com'}</li>
                  <li className="flex items-center gap-2"><Clock className="h-4 w-4 text-white/50" />{isAr ? 'دعم 24/7' : '24/7 Support'}</li>
                </ul>
              </FooterEditable>
            )}
            {on('apps') && (appStore || googlePlay || true) && (
              <FooterEditable isAr={isAr} label={isAr ? 'روابط التطبيق' : 'App badges'} zone="footer-apps" selection={selection} onSelect={onSelect} className="mt-4 block">
                <p className="text-xs font-bold uppercase tracking-wide text-white/60">{isAr ? 'حمّل التطبيق' : 'Get the app'}</p>
                <div className="mt-2 flex flex-col gap-2">
                  <span className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold ring-1 ring-white/15"><Apple className="h-4 w-4" />App Store</span>
                  <span className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold ring-1 ring-white/15"><Play className="h-4 w-4" />Google Play</span>
                </div>
                {!(appStore || googlePlay) && <p className="mt-1.5 text-[10px] text-white/60">{isAr ? 'أضف الروابط لإظهارها' : 'Add links to show these'}</p>}
              </FooterEditable>
            )}
          </div>
        </div>

        {/* bottom bar */}
        <div className="mt-8 flex flex-col gap-4 border-t border-white/10 pt-6 sm:flex-row-reverse sm:items-center sm:justify-between">
          {on('payment') && (
            <FooterEditable isAr={isAr} label={isAr ? 'وسائل الدفع' : 'Payment icons'} zone="footer-payment" selection={selection} onSelect={onSelect} className="inline-block">
              <span className="flex flex-wrap items-center gap-1.5">
                {paymentMethods.map((m) => (
                  <span key={m} className="flex h-7 items-center rounded-md bg-white px-2 text-[10px] font-black uppercase tracking-tight text-slate-800">
                    {(PAYMENT_META[m] || { labelEn: m }).labelEn}
                  </span>
                ))}
              </span>
            </FooterEditable>
          )}
          {on('legal') && (
            <FooterEditable isAr={isAr} label={isAr ? 'روابط قانونية' : 'Legal links'} zone="footer-legal" selection={selection} onSelect={onSelect} className="inline-block">
              <nav className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/70">
                {legalLinks.map((link, i) => (
                  <span key={i}>{isAr ? (link.labelAr || link.labelEn) : (link.labelEn || link.labelAr)}</span>
                ))}
              </nav>
            </FooterEditable>
          )}
          <p className="text-xs text-white/60">© {new Date().getFullYear()} {storeName}</p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

export default function NavigationStorefrontPreview({
  navigation, storeSettings, categories, isAr, viewMode, selection, onSelect,
  toolbarItems, orderedNavRows,
  onInsertToolbar, onInsertNav, onInsertFooterColumn,
  onToolbarMove, onToolbarToggleActive, onToolbarDelete,
  onNavMove, onNavToggleActive, onNavToggleMobile, onNavDelete,
  onFooterColDelete, onAddFooterLink, onFooterLinkDelete,
}) {
  const isMobile = viewMode === 'mobile';

  const footerColumns = (navigation.footerColumns || [])
    .slice()
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

  const navRowLabel = (row) => {
    if (row.type === 'home') return isAr ? (row.data.labelAr || 'الرئيسية') : (row.data.labelEn || 'Home');
    if (row.type === 'link') return isAr ? (row.data.labelAr || row.data.labelEn) : (row.data.labelEn || row.data.labelAr);
    const cat = categories.find((c) => c.slug === row.data.categorySlug);
    const fallback = cat ? (isAr ? cat.nameAr || cat.name : cat.nameEn || cat.name) : row.data.categorySlug;
    return isAr ? (row.data.labelAr || fallback) : (row.data.labelEn || fallback);
  };

  return (
    <div className="overflow-hidden bg-white">
      <PreviewHeader
        navigation={navigation}
        storeSettings={storeSettings}
        isAr={isAr}
        isMobile={isMobile}
        selection={selection}
        onSelect={onSelect}
        toolbarItems={toolbarItems}
        orderedNavRows={orderedNavRows}
        navRowLabel={navRowLabel}
        onInsertToolbar={onInsertToolbar}
        onInsertNav={onInsertNav}
        onToolbarMove={onToolbarMove}
        onToolbarToggleActive={onToolbarToggleActive}
        onToolbarDelete={onToolbarDelete}
        onNavMove={onNavMove}
        onNavToggleActive={onNavToggleActive}
        onNavToggleMobile={onNavToggleMobile}
        onNavDelete={onNavDelete}
      />

      {!isMobile && (
        <div id="nav-section-announcement">
          <PreviewDeliveryStrip navigation={navigation} isAr={isAr} selection={selection} onSelect={onSelect} />
        </div>
      )}

      <div className="pointer-events-none bg-[#f8faf9] px-4 py-10 text-center">
        <p className="text-xs font-medium text-slate-400">{isAr ? 'محتوى الصفحة (معاينة فقط)' : 'Page content (preview only)'}</p>
        <div className="mx-auto mt-4 grid max-w-md grid-cols-3 gap-2 opacity-40">
          {[1, 2, 3].map((i) => <div key={i} className="aspect-square rounded-xl bg-slate-200" />)}
        </div>
      </div>

      <PreviewFooter
        navigation={navigation}
        storeSettings={storeSettings}
        isAr={isAr}
        isMobile={isMobile}
        selection={selection}
        onSelect={onSelect}
        footerColumns={footerColumns}
        onFooterColDelete={onFooterColDelete}
        onAddFooterLink={onAddFooterLink}
        onFooterLinkDelete={onFooterLinkDelete}
        onInsertFooterColumn={onInsertFooterColumn}
      />
    </div>
  );
}

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

export function getToolbarItems(navigation) {
  return parseHeaderToolbar(navigation);
}
