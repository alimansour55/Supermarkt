import { Link } from '../../app/router';
import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { getCategoryLabel, useCategories } from '../../context/CategoriesContext';
import { buildCategoryPath, buildCategorySlugChain } from '../../utils/categoryHelpers';
import {
  getCachedMegaBlocks,
  loadMegaBlocks,
  prefetchMegaBlocks,
} from '../../utils/megaMenuCache';

function CategoryBlock({ block, isAr, onNavigate }) {
  const { category, href, items } = block;
  const label = getCategoryLabel(category, isAr);
  const subCategories = items.filter((item) => item.type !== 'product');
  const products = items.filter((item) => item.type === 'product');
  const showViewAll = items.length > 4;

  return (
    <article className="mb-7 break-inside-avoid">
      <Link
        to={href}
        onClick={onNavigate}
        className="group/head mb-2.5 flex items-center gap-2 text-sm font-bold leading-snug text-text transition-colors hover:text-primary-700"
      >
        <span className="h-3.5 w-1 shrink-0 rounded-full bg-primary-500 transition-colors group-hover/head:bg-primary-600" />
        <span className="min-w-0 truncate">{label}</span>
      </Link>

      {items.length > 0 ? (
        <>
          <ul className="space-y-0.5">
            {subCategories.map((item) => (
              <li key={item.key}>
                <Link
                  to={item.href}
                  onClick={onNavigate}
                  className="-mx-2 flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-text-muted transition-colors hover:bg-primary-50 hover:text-primary-800"
                >
                  <span className="min-w-0 truncate">{item.label}</span>
                </Link>
              </li>
            ))}
            {products.map((item) => (
              <li key={item.key}>
                <Link
                  to={item.href}
                  onClick={onNavigate}
                  className="-mx-2 flex items-center gap-2 rounded-lg px-2 py-1 text-[13px] text-text-muted/90 transition-colors hover:bg-surface hover:text-text"
                >
                  <span className="h-1 w-1 shrink-0 rounded-full bg-current opacity-40" />
                  <span className="min-w-0 truncate">{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>

          {showViewAll && (
            <Link
              to={href}
              onClick={onNavigate}
              className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary-600 transition-colors hover:text-primary-700"
            >
              {isAr ? 'عرض الكل' : 'View all'}
              <ChevronLeft className="h-3.5 w-3.5 rtl:rotate-180" />
            </Link>
          )}
        </>
      ) : (
        <Link
          to={href}
          onClick={onNavigate}
          className="text-sm text-text-muted transition-colors hover:text-primary-700"
        >
          {isAr ? 'تصفح القسم' : 'Browse section'}
        </Link>
      )}
    </article>
  );
}

export default function CategoryMegaMenuPanel({
  activeCategorySlug,
  activeRootSlug,
  menuCategorySlugs = [],
  scope = 'all',
  onHoverCategory,
  onHoverRoot,
  onNavigate,
  showInitialLoading = false,
}) {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const { rootCategories, getChildren, categories, loading } = useCategories();

  const resolvedSlug = activeCategorySlug || activeRootSlug;
  const onHover = onHoverCategory || onHoverRoot;

  const findBySlug = (slug) => categories.find((cat) => cat.slug === slug) || null;

  const menuCategories = useMemo(() => {
    if (menuCategorySlugs.length) {
      return menuCategorySlugs.map(findBySlug).filter(Boolean);
    }
    return rootCategories;
  }, [menuCategorySlugs, categories, rootCategories]);

  const activeCategory = findBySlug(resolvedSlug)
    || menuCategories[0]
    || rootCategories[0]
    || null;

  const categoryHref = activeCategory
    ? buildCategoryPath(buildCategorySlugChain(activeCategory, categories))
    : '/categories';

  const showSidebar = scope === 'all' && menuCategories.length > 1;

  const [blocks, setBlocks] = useState(() => (
    activeCategory?.slug ? (getCachedMegaBlocks(activeCategory.slug, isAr, categories) || []) : []
  ));

  useEffect(() => {
    if (!activeCategory?.slug) {
      setBlocks([]);
      return undefined;
    }

    const cached = getCachedMegaBlocks(activeCategory.slug, isAr, categories);
    if (cached) {
      setBlocks(cached);
      return undefined;
    }

    let active = true;
    loadMegaBlocks(activeCategory, categories, getChildren, isAr)
      .then((nextBlocks) => {
        if (active) setBlocks(nextBlocks);
      })
      .catch(() => {
        if (active) setBlocks([]);
      });

    return () => { active = false; };
  }, [activeCategory?.slug, categories, getChildren, isAr]);

  const handleSidebarHover = (slug) => {
    onHover?.(slug);
    prefetchMegaBlocks([slug], categories, getChildren, isAr);
  };

  const initialLoading = showInitialLoading && loading && !categories.length;

  if (initialLoading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  if (!menuCategories.length && !activeCategory) {
    return (
      <p className="py-12 text-center text-sm text-text-muted">
        {isAr ? 'لا توجد أقسام بعد' : 'No categories yet'}
      </p>
    );
  }

  return (
    <div className="flex min-h-[320px] max-h-[min(72vh,560px)] overflow-hidden bg-white">
      {showSidebar && (
        <aside className="w-60 shrink-0 overflow-y-auto border-e border-border bg-surface/40 p-2">
          <p className="px-3 pb-1.5 pt-2 text-[11px] font-bold uppercase tracking-wide text-text-muted">
            {isAr ? 'الأقسام' : 'Departments'}
          </p>
          {menuCategories.map((cat) => {
            const isActive = cat.slug === activeCategory?.slug;
            return (
              <button
                key={cat.slug || cat._id}
                type="button"
                onMouseEnter={() => handleSidebarHover(cat.slug)}
                onFocus={() => handleSidebarHover(cat.slug)}
                className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start text-sm transition-colors ${
                  isActive
                    ? 'bg-white font-semibold text-primary-800 shadow-sm ring-1 ring-black/[0.04]'
                    : 'text-text-muted hover:bg-white/70 hover:text-text'
                }`}
              >
                <span className="min-w-0 flex-1 truncate">{getCategoryLabel(cat, isAr)}</span>
                <ChevronLeft
                  className={`h-4 w-4 shrink-0 transition-opacity rtl:rotate-180 ${
                    isActive ? 'text-primary-600 opacity-100' : 'opacity-0 group-hover:opacity-50'
                  }`}
                />
              </button>
            );
          })}
        </aside>
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border/60 px-6 py-3.5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-[15px] font-bold text-text">
                {activeCategory ? getCategoryLabel(activeCategory, isAr) : (isAr ? 'تصفح الأقسام' : 'Browse categories')}
              </h3>
              <p className="truncate text-xs text-text-muted">
                {isAr ? 'كل المنتجات والأقسام الفرعية' : 'All products & subcategories'}
              </p>
            </div>
          </div>
          {activeCategory && (
            <Link
              to={categoryHref}
              onClick={onNavigate}
              className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary-50 px-4 py-2 text-sm font-semibold text-primary-700 transition-colors hover:bg-primary-100"
            >
              {isAr ? 'عرض الكل' : 'View all'}
              <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
            </Link>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {blocks.length > 0 ? (
            <div className="columns-2 gap-x-8 sm:columns-3 lg:columns-4 xl:columns-5">
              {blocks.map((block) => (
                <CategoryBlock
                  key={block.category.slug || block.category._id}
                  block={block}
                  isAr={isAr}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          ) : (
            <div className="flex min-h-[220px] flex-col items-center justify-center text-center">
              <p className="text-sm text-text-muted">
                {isAr ? 'لا توجد منتجات في هذا القسم حالياً.' : 'No products in this department yet.'}
              </p>
              <Link
                to={categoryHref}
                onClick={onNavigate}
                className="mt-4 inline-flex items-center gap-1 rounded-full bg-primary-50 px-4 py-2 text-sm font-semibold text-primary-700 transition-colors hover:bg-primary-100"
              >
                {isAr ? 'فتح القسم' : 'Open department'}
                <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
