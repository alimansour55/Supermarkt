import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useStoreSettings } from '../../context/StoreSettingsContext';
import { useCategories } from '../../context/CategoriesContext';
import { buildStoreNavItems } from '../../utils/navBarConfig';
import { prefetchMegaBlocks, prefetchOffersMega } from '../../utils/megaMenuCache';
import { useHoverMenu } from '../../hooks/useHoverMenu';
import CategoryMegaMenuPanel from './CategoryMegaMenuPanel';
import OffersMegaMenuPanel from './OffersMegaMenuPanel';

export default function NavMenu() {
  const { language } = useLanguage();
  const { pathname } = useLocation();
  const { settings } = useStoreSettings();
  const { rootCategories, categories, getChildren } = useCategories();
  const isAr = language === 'ar';
  const [open, setOpen] = useState(false);
  const [megaScope, setMegaScope] = useState('all');
  const [activeCategory, setActiveCategory] = useState(null);
  const { cancelClose, scheduleClose, markOpen } = useHoverMenu({ closeDelay: 450 });

  const navItems = useMemo(
    () => buildStoreNavItems(settings?.navigation, categories, getChildren),
    [settings?.navigation, categories, getChildren],
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

  const pillClass = (isActive, isOpen, highlight, offersOpen = false) => {
    if (offersOpen) {
      return 'flex items-center gap-1 whitespace-nowrap rounded-full bg-gradient-to-r from-red-600 to-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-sm';
    }
    if (isOpen) {
      return 'flex items-center gap-1 whitespace-nowrap rounded-full bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm';
    }
    if (isActive) {
      return 'flex items-center gap-1 whitespace-nowrap rounded-full bg-primary-50 px-4 py-2 text-sm font-semibold text-primary-800';
    }
    if (highlight) {
      return 'flex items-center gap-1 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50';
    }
    return 'flex items-center gap-1 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium text-text transition-colors hover:bg-surface';
  };

  const menuSlugs = megaScope === 'all' ? allRootSlugs : (activeCategory ? [activeCategory] : []);

  return (
    <nav
      className="relative hidden border-t border-border/50 bg-white md:block"
      onMouseLeave={handleLeave}
    >
      <div className="container-app">
        <ul className="flex items-center gap-2 overflow-x-auto py-2.5 scrollbar-thin">
          {navItems.map((item) => {
            const label = isAr ? item.labelAr : item.labelEn;
            const isActive = pathname === item.to || (item.to !== '/' && pathname.startsWith(item.to));
            const isOpen = open && (
              (item.type === 'home' && megaScope === 'all')
              || (item.type === 'category' && megaScope === 'single' && activeCategory === item.slug)
            );
            const isOffersOpen = open && megaScope === 'offers' && item.isOffers;

            if (item.type === 'home') {
              return (
                <li
                  key={item.id}
                  className="shrink-0"
                  onMouseEnter={() => {
                    prefetchMegaBlocks(allRootSlugs, categories, getChildren, isAr);
                    openMega('all', defaultRoot);
                  }}
                >
                  <button
                    type="button"
                    className={pillClass(isActive, isOpen, false)}
                    aria-expanded={isOpen}
                    onFocus={() => openMega('all', defaultRoot)}
                  >
                    <span>{label}</span>
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                </li>
              );
            }

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
                    className={pillClass(isActive, isOpen, false)}
                    aria-expanded={isOpen}
                    onFocus={() => openMega('single', item.slug)}
                  >
                    <span>{label}</span>
                  </button>
                </li>
              );
            }

            if (item.type === 'category') {
              return (
                <li key={item.id} className="shrink-0">
                  <Link to={item.to} className={pillClass(isActive, false, false)}>
                    {label}
                  </Link>
                </li>
              );
            }

            if (item.isOffers && !item.isExternal) {
              return (
                <li
                  key={item.id}
                  className="shrink-0"
                  onMouseEnter={openOffersMega}
                >
                  <button
                    type="button"
                    className={pillClass(isActive, false, item.highlight, isOffersOpen)}
                    aria-expanded={isOffersOpen}
                    onFocus={openOffersMega}
                  >
                    <span>{label}</span>
                  </button>
                </li>
              );
            }

            if (item.isExternal) {
              return (
                <li key={item.id} className="shrink-0">
                  <a
                    href={item.to}
                    className={pillClass(isActive, false, item.highlight)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {label}
                  </a>
                </li>
              );
            }

            return (
              <li key={item.id} className="shrink-0">
                <Link to={item.to} className={pillClass(isActive, false, item.highlight)}>
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      {open && megaScope === 'offers' && (
        <div
          className="absolute inset-x-0 top-full z-50 pt-2"
          onMouseEnter={cancelClose}
          onMouseLeave={handleLeave}
        >
          <div className="mega-menu-panel overflow-hidden border border-border/80 bg-white shadow-[0_24px_48px_-12px_rgba(15,23,42,0.18)]">
            <OffersMegaMenuPanel onNavigate={closeMega} />
          </div>
        </div>
      )}

      {open && activeCategory && menuSlugs.length > 0 && megaScope !== 'offers' && (
        <div
          className="absolute inset-x-0 top-full z-50 pt-2"
          onMouseEnter={cancelClose}
          onMouseLeave={handleLeave}
        >
          <div className="mega-menu-panel border border-border/80 bg-white shadow-[0_24px_48px_-12px_rgba(15,23,42,0.18)]">
            <CategoryMegaMenuPanel
              activeCategorySlug={activeCategory}
              menuCategorySlugs={menuSlugs}
              scope={megaScope}
              onHoverCategory={setActiveCategory}
              onNavigate={closeMega}
            />
          </div>
        </div>
      )}
    </nav>
  );
}
