import { Link } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
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

  return (
    <article className="mb-8 break-inside-avoid">
      <Link
        to={href}
        onClick={onNavigate}
        className="mb-2.5 block text-sm font-bold leading-snug text-text transition-colors hover:text-primary-700"
      >
        {label}
      </Link>

      {items.length > 0 ? (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.key}>
              <Link
                to={item.href}
                onClick={onNavigate}
                className={`block text-sm leading-snug transition-colors hover:text-primary-700 ${
                  item.type === 'product' ? 'text-text' : item.muted ? 'text-text-muted/80' : 'text-text-muted'
                }`}
              >
                {item.type === 'product' ? `• ${item.label}` : item.label}
              </Link>
            </li>
          ))}
        </ul>
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
        <aside className="w-52 shrink-0 overflow-y-auto border-e border-border bg-surface/30 py-1">
          {menuCategories.map((cat) => {
            const isActive = cat.slug === activeCategory?.slug;
            return (
              <button
                key={cat.slug || cat._id}
                type="button"
                onMouseEnter={() => handleSidebarHover(cat.slug)}
                onFocus={() => handleSidebarHover(cat.slug)}
                className={`block w-full px-4 py-3 text-start text-sm transition-colors ${
                  isActive
                    ? 'border-s-[3px] border-primary-600 bg-white font-semibold text-text'
                    : 'border-s-[3px] border-transparent text-text-muted hover:bg-white/90 hover:text-text'
                }`}
              >
                {getCategoryLabel(cat, isAr)}
              </button>
            );
          })}
        </aside>
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border/60 px-6 py-3.5">
          <h3 className="text-base font-bold text-text">
            {activeCategory ? getCategoryLabel(activeCategory, isAr) : (isAr ? 'تصفح الأقسام' : 'Browse categories')}
          </h3>
          {activeCategory && (
            <Link
              to={categoryHref}
              onClick={onNavigate}
              className="shrink-0 text-sm font-medium text-primary-700 hover:underline"
            >
              {isAr ? 'عرض الكل' : 'View all'}
            </Link>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {blocks.length > 0 ? (
            <div className="columns-2 gap-x-10 sm:columns-3 lg:columns-4 xl:columns-5">
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
                className="mt-4 text-sm font-semibold text-primary-700 hover:underline"
              >
                {isAr ? 'فتح القسم' : 'Open department'}
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
