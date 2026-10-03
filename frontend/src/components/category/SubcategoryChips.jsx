import { Link } from '../../app/router';
import { useLanguage } from '../../context/LanguageContext';
import { buildCategoryPath, categoryLabel } from '../../utils/categoryHelpers';
import CategoryImage from './CategoryImage';

/**
 * Sibling subcategory chips when viewing a leaf category.
 */
export default function SubcategoryChips({
  currentSlug,
  parentCategory,
  subcategories,
  pathPrefix = null,
  mainSlug = null,
}) {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const prefix = pathPrefix || mainSlug || (parentCategory?.slug ? parentCategory.slug : '');

  if (!subcategories?.length) return null;

  return (
    <div className="mb-6 flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
      {subcategories.map((sub) => {
        const active = sub.slug === currentSlug;
        const href = prefix
          ? buildCategoryPath(`${prefix}/${sub.slug}`)
          : buildCategoryPath(sub.slug);
        return (
          <Link
            key={sub.slug}
            to={href}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              active
                ? 'bg-primary-600 text-white shadow-sm'
                : 'border border-border bg-white text-text hover:bg-primary-50'
            }`}
          >
            <CategoryImage category={sub} size="xs" className="!h-6 !w-6 !rounded-full" />
            {categoryLabel(sub, isAr)}
          </Link>
        );
      })}
    </div>
  );
}
