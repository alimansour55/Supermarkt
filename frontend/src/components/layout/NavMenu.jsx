import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from '../../app/router';
import { ChevronDown, LayoutGrid, Tag } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useStoreSettings } from '../../context/StoreSettingsContext';
import { useCategories } from '../../context/CategoriesContext';
import { buildStoreNavItems, clampStoreNavItems } from '../../utils/navBarConfig';
import { prefetchMegaBlocks, prefetchOffersMega } from '../../utils/megaMenuCache';
import { useHoverMenu } from '../../hooks/useHoverMenu';
import CategoryMegaMenuPanel from './CategoryMegaMenuPanel';
import OffersMegaMenuPanel from './OffersMegaMenuPanel';

export default function NavMenu() {
  const { language, t } = useLanguage();
  const { pathname } = useLocation();
  const { settings } = useStoreSettings();
  const { rootCategories, categories, getChildren } = useCategories();
  const isAr = language === 'ar';
  const [open, setOpen] = useState(false);
  const [megaScope, setMegaScope] = useState('all');
  const [activeCategory, setActiveCategory] = useState(null);
  // Short delay — just enough to bridge the gap while moving the pointer from the
  // trigger into the panel below; longer than this reads as a stuck-open menu.
  const { cancelClose, scheduleClose, markOpen } = useHoverMenu({ closeDelay: 120 });

  const navItems = useMemo(
    // Cap the bar so an over-filled admin config can't break the header layout.
    // Home is dropped here — the logo already links to "/", so a text link would duplicate it.
    () => clampStoreNavItems(
      buildStoreNavItems(settings?.navigation, categories, getChildren)
        .filter((item) => item.type !== 'home'),
    ),
    [settings?.navigation, categories, getChildren],
  );

  // Deals / Offers (and any highlighted link) are anchored to the opposite end (HyperOne pattern).
  const primaryNavItems = useMemo(
    () => navItems.filter((item) => !item.isOffers && !item.highlight),
    [navItems],
  );
  const endNavItems = useMemo(
    () => navItems.filter((item) => item.isOffers || item.highlight),
    [navItems],
  );

  const allRootSlugs = useMemo(
    () => rootCategories.map((cat) => cat.slug),
    [rootCategories],
  );

  const defaultRoot = allRootSlugs[0] || null;

  const openMega = useCallback((scope, slug) => {
    if (scope === 'all' && !allRootSlugs.length) return;
    if (scope === 'single' && !slug) return;
    markOpen();
    setOpen(true);
    setMegaScope(scope);
    setActiveCategory(scope === 'all' ? (slug || defaultRoot) : slug);
  }, [markOpen, allRootSlugs.length, defaultRoot]);

  const openOffersMega = useCallback(() => {
    markOpen();
    setOpen(true);
    setMegaScope('offers');
    setActiveCategory(null);
    prefetchOffersMega();
  }, [markOpen]);

  const closeMega = useCallback(() => {
    setOpen(false);
    setActiveCategory(null);
    setMegaScope('all');
  }, []);

  const handleLeave = useCallback(() => {
    scheduleClose(closeMega);
  }, [scheduleClose, closeMega]);

  useEffect(() => {
    closeMega();
  }, [pathname, closeMega]);

  // Scrolling doesn't move the mouse, so the hover-leave timer never fires — the
  // panel would otherwise sit open (stale, over newly-scrolled content) until the
  // user happens to move the pointer. Close it the instant the page scrolls.
  useEffect(() => {
    if (!open) return undefined;
    const handleScroll = () => {
      cancelClose();
      closeMega();
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [open, cancelClose, closeMega]);

  useEffect(() => {
    if (open && !activeCategory && defaultRoot && megaScope === 'all') {
      setActiveCategory(defaultRoot);
    }
  }, [open, activeCategory, defaultRoot, megaScope]);

  const navCategorySlugs = useMemo(
    () => navItems.filter((item) => item.type === 'category' && item.slug).map((item) => item.slug),
    [navItems],
  );

  useEffect(() => {
    if (!categories.length) return;
    prefetchMegaBlocks([...allRootSlugs, ...navCategorySlugs], categories, getChildren, isAr);
    prefetchOffersMega();
  }, [categories, allRootSlugs, navCategorySlugs, getChildren, isAr]);

  // Plain text links — no filled pills. Every item shares the same padding so the
  // spacing between them is uniform across the whole bar.
  const NAV_BASE = 'relative flex items-center gap-1.5 whitespace-nowrap px-4 py-3.5 text-[15px] transition-colors lg:px-[22px]';
  const NAV_UNDERLINE = 'after:absolute after:inset-x-4 after:bottom-0 after:h-[3px] after:rounded-t-full lg:after:inset-x-[22px]';

  const linkClass = (isActive, isMenuOpen) => {
    if (isMenuOpen || isActive) {
      return `${NAV_BASE} ${NAV_UNDERLINE} font-semibold text-primary-800 after:bg-primary-600`;
    }
    return `${NAV_BASE} font-medium text-primary-700 hover:text-primary-900`;
  };

  const offersClass = (isMenuOpen) => {
    if (isMenuOpen) {
      return `${NAV_BASE} ${NAV_UNDERLINE} font-bold text-danger-600 after:bg-danger-500`;
    }
    return `${NAV_BASE} font-bold text-danger-500 hover:text-danger-600`;
  };

  const menuSlugs = megaScope === 'all' ? allRootSlugs : (activeCategory ? [activeCategory] : []);
  const allCategoriesOpen = open && megaScope === 'all';

  const renderNavItem = (item) => {
    const label = isAr ? item.labelAr : item.labelEn;
    const isActive = pathname === item.to || (item.to !== '/' && pathname.startsWith(item.to));
    const isSingleOpen = open && item.type === 'category' && megaScope === 'single' && activeCategory === item.slug;

    if (item.type === 'category' && item.hasMegaMenu) {
      return (
        <li
          key={item.id}
          className="shrink-0"
          onMouseEnter={() => {
            prefetchMegaBlocks([item.slug], categories, getChildren, isAr);
            openMega('single', item.slug);
          }}
        >
          <button
            type="button"
            className={linkClass(isActive, isSingleOpen)}
            aria-expanded={isSingleOpen}
            onFocus={() => openMega('single', item.slug)}
          >
            <span>{label}</span>
          </button>
        </li>
      );
    }

    if (item.isExternal) {
      return (
        <li key={item.id} className="shrink-0">
          <a href={item.to} className={linkClass(isActive, false)} target="_blank" rel="noreferrer">
            {label}
          </a>
        </li>
      );
    }

    return (
      <li key={item.id} className="shrink-0">
        <Link to={item.to} className={linkClass(isActive, false)}>{label}</Link>
      </li>
    );
  };

  const renderEndItem = (item) => {
    const label = isAr ? item.labelAr : item.labelEn;
    const isOffersOpen = open && megaScope === 'offers' && item.isOffers;
    const icon = <Tag className="h-[15px] w-[15px] shrink-0" aria-hidden />;

    if (item.isExternal) {
      return (
        <li key={item.id} className="shrink-0">
          <a href={item.to} className={offersClass(false)} target="_blank" rel="noreferrer">
            {icon}
            <span>{label}</span>
          </a>
        </li>
      );
    }

    if (item.isOffers) {
      return (
        <li key={item.id} className="shrink-0" onMouseEnter={openOffersMega}>
          <button
            type="button"
            className={offersClass(isOffersOpen)}
            aria-expanded={isOffersOpen}
            onFocus={openOffersMega}
          >
            {icon}
            <span>{label}</span>
          </button>
        </li>
      );
    }

    return (
      <li key={item.id} className="shrink-0">
        <Link to={item.to} className={offersClass(false)}>
          {icon}
          <span>{label}</span>
        </Link>
      </li>
    );
  };

  return (
    <nav
      className="relative hidden border-b border-border bg-white md:block"
      onMouseLeave={handleLeave}
    >
      <div className="container-app">
        {/*
          Items sit in one centered group with uniform gaps between them — not
          stretched edge-to-edge. The count is capped upstream (clampStoreNavItems)
          so the row never overflows regardless of the admin config.
        */}
        <ul className="flex items-center justify-center gap-x-1 lg:gap-x-2">
          {/* All Categories — opens the full mega menu */}
          <li
            className="shrink-0"
            onMouseEnter={() => {
              prefetchMegaBlocks(allRootSlugs, categories, getChildren, isAr);
              openMega('all', defaultRoot);
            }}
          >
            <button
              type="button"
              className={`${
                allCategoriesOpen
                  ? `${NAV_BASE} ${NAV_UNDERLINE} font-bold text-primary-800 after:bg-primary-600`
                  : `${NAV_BASE} font-bold text-primary-700 hover:text-primary-900`
              }`}
              aria-expanded={allCategoriesOpen}
              onFocus={() => openMega('all', defaultRoot)}
            >
              <LayoutGrid className="h-[18px] w-[18px] shrink-0" aria-hidden />
              <span>{t.nav.allCategories}</span>
              <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${allCategoriesOpen ? 'rotate-180' : ''}`} aria-hidden />
            </button>
          </li>

          {primaryNavItems.map(renderNavItem)}
          {endNavItems.map(renderEndItem)}
        </ul>
      </div>

      {open && megaScope === 'offers' && (
        <div
          className="absolute inset-x-0 top-full z-50"
          onMouseEnter={cancelClose}
          onMouseLeave={handleLeave}
        >
          <div className="container-app">
            <div className="mega-menu-panel overflow-hidden rounded-b-2xl border border-t-0 border-border bg-white shadow-menu">
              <OffersMegaMenuPanel onNavigate={closeMega} />
            </div>
          </div>
        </div>
      )}

      {open && activeCategory && menuSlugs.length > 0 && megaScope !== 'offers' && (
        <div
          className="absolute inset-x-0 top-full z-50"
          onMouseEnter={cancelClose}
          onMouseLeave={handleLeave}
        >
          <div className="container-app">
            <div className="mega-menu-panel overflow-hidden rounded-b-2xl border border-t-0 border-border bg-white shadow-menu">
              <CategoryMegaMenuPanel
                activeCategorySlug={activeCategory}
                menuCategorySlugs={menuSlugs}
                scope={megaScope}
                onHoverCategory={setActiveCategory}
                onNavigate={closeMega}
              />
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
