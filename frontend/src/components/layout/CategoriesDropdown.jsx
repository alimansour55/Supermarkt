import { useCallback, useEffect, useRef, useState } from 'react';
import { LayoutGrid } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useCategories } from '../../context/CategoriesContext';
import { prefetchMegaBlocks } from '../../utils/megaMenuCache';
import CategoryMegaMenuPanel from './CategoryMegaMenuPanel';

export default function CategoriesDropdown({ showLabel = true }) {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const { rootCategories, categories, getChildren } = useCategories();
  const [open, setOpen] = useState(false);
  const [activeRoot, setActiveRoot] = useState(null);
  const ref = useRef(null);

  const defaultRoot = rootCategories[0]?.slug || null;

  const closeMenu = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!categories.length) return;
    prefetchMegaBlocks(rootCategories.map((c) => c.slug), categories, getChildren, isAr);
  }, [categories, rootCategories, getChildren, isAr]);

  useEffect(() => {
    if (open && !activeRoot && defaultRoot) {
      setActiveRoot(defaultRoot);
    }
  }, [open, activeRoot, defaultRoot]);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const toggle = () => {
    setOpen((v) => !v);
    if (!open && defaultRoot) setActiveRoot(defaultRoot);
  };

  return (
    <div ref={ref} className="relative hidden md:block">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors ${
          open
            ? 'border-primary-600 bg-primary-600 text-white'
            : 'border-border bg-white text-text hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700'
        }`}
      >
        <LayoutGrid className="h-4 w-4 shrink-0" aria-hidden />
        <span className={showLabel ? 'hidden sm:inline' : 'sr-only'}>{isAr ? 'كل الأقسام' : 'All Categories'}</span>
      </button>

      {open && (
        <div className="absolute start-0 top-full z-50 mt-2 w-[min(1080px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border bg-white shadow-2xl">
          <CategoryMegaMenuPanel
            activeCategorySlug={activeRoot || defaultRoot}
            menuCategorySlugs={rootCategories.map((cat) => cat.slug)}
            onHoverCategory={setActiveRoot}
            onNavigate={closeMenu}
          />
        </div>
      )}
    </div>
  );
}
