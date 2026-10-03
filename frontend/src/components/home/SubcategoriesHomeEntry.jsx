import { Link } from '../../app/router';
import { ChevronLeft, LayoutGrid } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useCategories } from '../../context/CategoriesContext';
import { getAllSubcategories, categoryLabel } from '../../utils/categoryHelpers';
import CategoryImage from '../category/CategoryImage';

export default function SubcategoriesHomeEntry({
  titleAr,
  titleEn,
  subtitleAr,
  subtitleEn,
  link = '/subcategories',
}) {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const { categoryTree, categories, loading } = useCategories();

  const preview = getAllSubcategories(categoryTree, categories).slice(0, 8);

  if (loading || !preview.length) return null;

  const total = getAllSubcategories(categoryTree, categories).length;
  const title = isAr ? (titleAr || 'تصفّح الأقسام الفرعية') : (titleEn || 'Browse all subcategories');
  const subtitle = isAr
    ? (subtitleAr || `كل العلامات والأنواع في مكان واحد — ${total} قسم فرعي`)
    : (subtitleEn || `All brands and types in one place — ${total} subcategories`);

  return (
    <section className="container-app py-4">
      <Link
        to={link}
        className="group flex flex-col gap-4 rounded-2xl border border-primary-200 bg-gradient-to-br from-primary-50 via-white to-emerald-50 p-5 shadow-sm transition-all hover:border-primary-300 hover:shadow-md sm:flex-row sm:items-center sm:justify-between sm:p-6"
      >
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-600 text-white shadow-sm">
            <LayoutGrid className="h-6 w-6" aria-hidden />
          </span>
          <div>
            <h2 className="text-lg font-bold text-text md:text-xl">{title}</h2>
            <p className="mt-1 text-sm text-text-muted">{subtitle}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:max-w-[50%] sm:justify-end">
          {preview.map((sub) => (
            <span
              key={`${sub.parentSlug}-${sub.slug}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-2.5 py-1 text-xs font-semibold text-text shadow-sm"
            >
              <CategoryImage category={sub} size="xs" className="!h-6 !w-6 !rounded-full" />
              <span className="max-w-[88px] truncate">{categoryLabel(sub, isAr)}</span>
            </span>
          ))}
          <span className="inline-flex items-center gap-1 rounded-full bg-primary-600 px-4 py-2 text-sm font-bold text-white transition-colors group-hover:bg-primary-700">
            {isAr ? 'عرض الكل' : 'View all'}
            <ChevronLeft className={`h-4 w-4 ${isAr ? '' : 'rotate-180'}`} aria-hidden />
          </span>
        </div>
      </Link>
    </section>
  );
}
