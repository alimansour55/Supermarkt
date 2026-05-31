import { Link } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { categoryLabel } from '../../utils/categoryHelpers';

/**
 * Subcategory navigation: "All {parent}" + child chips, or siblings when on a child category.
 */
export default function SubcategoryChips({
  currentSlug,
  parentCategory,
  subcategories,
}) {
  const { language } = useLanguage();
  const isAr = language === 'ar';

  const chips = [];

  if (parentCategory) {
    chips.push({
      slug: parentCategory.slug,
      label: isAr ? `كل ${categoryLabel(parentCategory, true)}` : `All ${categoryLabel(parentCategory, false)}`,
      icon: parentCategory.icon,
    });
    subcategories.forEach((sub) => {
      chips.push({ slug: sub.slug, label: categoryLabel(sub, isAr), icon: sub.icon });
    });
  } else if (subcategories.length > 0) {
    chips.push({
      slug: currentSlug,
      label: isAr ? 'الكل' : 'All',
      icon: null,
    });
    subcategories.forEach((sub) => {
      chips.push({ slug: sub.slug, label: categoryLabel(sub, isAr), icon: sub.icon });
    });
  }

  if (chips.length <= 1) return null;

  return (
    <div className="mb-6 flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
      {chips.map((chip) => {
        const active = chip.slug === currentSlug;
        return (
          <Link
            key={chip.slug}
            to={`/categories/${chip.slug}`}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              active
                ? 'bg-primary-600 text-white shadow-sm'
                : 'border border-border bg-white text-text hover:bg-primary-50'
            }`}
          >
            {chip.icon && <span className="text-base">{chip.icon}</span>}
            {chip.label}
          </Link>
        );
      })}
    </div>
  );
}
