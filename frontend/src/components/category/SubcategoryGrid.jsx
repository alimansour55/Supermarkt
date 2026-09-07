import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { buildCategoryPath, categoryLabel } from '../../utils/categoryHelpers';
import CategoryImage from './CategoryImage';

/**
 * Grid of child categories at any depth level.
 */
export default function SubcategoryGrid({ subcategories, parentName, pathPrefix = null, mainSlug = null }) {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const prefix = pathPrefix || mainSlug || '';

  if (!subcategories?.length) {
    return (
      <div className="mb-8 rounded-2xl border border-dashed border-border bg-surface px-6 py-16 text-center">
        <p className="text-lg font-semibold text-text">
          {isAr ? 'لا توجد أقسام فرعية بعد' : 'No subcategories yet'}
        </p>
        <p className="mt-2 text-sm text-text-muted">
          {isAr
            ? 'سيتم عرض الأقسام الفرعية هنا عند إضافتها من لوحة التحكم'
            : 'Subcategories will appear here once added from the admin panel'}
        </p>
      </div>
    );
  }

  return (
    <div className="mb-8">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-text">
          {isAr ? `اختر من ${parentName}` : `Choose from ${parentName}`}
        </h2>
        <span className="text-sm text-text-muted">
          {subcategories.length} {isAr ? 'قسم' : 'categories'}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {subcategories.map((sub) => {
          const href = prefix
            ? buildCategoryPath(`${prefix}/${sub.slug}`)
            : buildCategoryPath(sub.slug);
          return (
          <Link
            key={sub.slug}
            to={href}
            className="group flex flex-col items-center gap-3 rounded-2xl border border-border bg-white p-5 shadow-sm transition-all hover:-translate-y-1 hover:border-primary-200 hover:shadow-md"
          >
            <CategoryImage
              category={sub}
              size="md"
              alt={categoryLabel(sub, isAr)}
              className="transition-transform group-hover:scale-105"
            />
            <span className="line-clamp-2 text-center text-sm font-semibold text-text">
              {categoryLabel(sub, isAr)}
            </span>
            {sub.productCount != null && (
              <span className="text-xs text-text-muted">
                {sub.productCount} {isAr ? 'منتج' : 'products'}
              </span>
            )}
            <span className="flex items-center gap-1 text-xs font-semibold text-primary-600 opacity-0 transition-opacity group-hover:opacity-100">
              {isAr ? 'متابعة' : 'Browse'}
              <ChevronLeft className={`h-3 w-3 ${isAr ? '' : 'rotate-180'}`} />
            </span>
          </Link>
          );
        })}
      </div>
    </div>
  );
}
