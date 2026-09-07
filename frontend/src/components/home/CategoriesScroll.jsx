import { Link } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { getCategoryLabel, useCategories } from '../../context/CategoriesContext';
import CategoryImage from '../category/CategoryImage';
import { normalizeCategoryNavConfig } from '../../utils/categoryNavShared';

const GRID_COLS = {
  3: 'grid-cols-3',
  4: 'grid-cols-3 sm:grid-cols-4',
  5: 'grid-cols-3 sm:grid-cols-5',
  6: 'grid-cols-3 sm:grid-cols-6',
};

export default function CategoriesScroll({
  section = {},
  titleAr = 'تسوق حسب القسم',
  titleEn = 'Shop by Category',
  embedded = false,
  layout: layoutProp,
}) {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const { rootCategories, loading } = useCategories();
  const config = normalizeCategoryNavConfig(section.categoryNavConfig || {});
  const layout = layoutProp || section.layout || config.layout || 'scroll';
  const useGrid = layout === 'grid' || (embedded && rootCategories.length > 0 && rootCategories.length <= 6);
  const gridClass = useGrid
    ? `grid gap-3 ${layout === 'grid' ? (GRID_COLS[config.columns] || GRID_COLS[4]) : 'grid-cols-3 sm:grid-cols-4'} md:gap-4`
    : '';
  const resolvedTitleAr = section.titleAr || titleAr;
  const resolvedTitleEn = section.titleEn || titleEn;
  const viewAllLink = config.viewAllLink || section.link || '/categories';

  const categoryCards = rootCategories.map((cat) => (
    <Link
      key={cat.slug || cat._id}
      to={`/category/${cat.slug}`}
      className={`flex flex-col items-center gap-2 rounded-2xl border border-border bg-white shadow-sm transition-all active:scale-[0.98] hover:border-primary-200 hover:shadow-md ${
        useGrid ? 'min-h-[108px] justify-center px-2 py-4' : 'w-[88px] shrink-0 px-3 py-3 sm:w-[96px]'
      }`}
    >
      <CategoryImage category={cat} size="sm" alt={getCategoryLabel(cat, isAr)} />
      <span className="line-clamp-2 text-center text-[11px] font-semibold leading-tight text-text sm:text-xs">
        {getCategoryLabel(cat, isAr)}
      </span>
    </Link>
  ));

  const list = loading ? (
    <div className={useGrid ? 'grid grid-cols-3 gap-3' : 'flex gap-3 overflow-hidden'}>
      {Array.from({ length: useGrid ? 3 : 6 }).map((_, i) => (
        <div key={i} className={`animate-pulse rounded-2xl bg-slate-200 ${useGrid ? 'h-28' : 'h-28 w-24 shrink-0'}`} />
      ))}
    </div>
  ) : (
    <div
      className={
        useGrid
          ? gridClass || 'grid grid-cols-3 gap-3 sm:grid-cols-4 md:gap-4'
          : 'flex gap-3 overflow-x-auto pb-2 scrollbar-thin [-webkit-overflow-scrolling:touch]'
      }
    >
      {categoryCards}
      {!embedded && !useGrid && config.showViewAll !== false && (
        <Link to={viewAllLink} className="flex w-[88px] shrink-0 flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-border bg-surface px-3 py-3 text-text-muted">
          <span className="text-2xl">→</span>
          <span className="text-center text-[10px] font-bold">{isAr ? 'كل الأقسام' : 'All depts'}</span>
        </Link>
      )}
    </div>
  );

  if (embedded) return list;

  return (
    <section className="container-app py-4">
      {config.showTitle !== false && (
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-text md:text-xl">{isAr ? resolvedTitleAr : resolvedTitleEn}</h2>
          {config.showViewAll !== false && (
            <Link to={viewAllLink} className="shrink-0 text-sm font-semibold text-primary-600 hover:text-primary-700">
              {isAr ? 'كل الأقسام' : 'All departments'}
            </Link>
          )}
        </div>
      )}
      {list}
    </section>
  );
}
