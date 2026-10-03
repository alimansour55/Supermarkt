import { Link } from '../../app/router';
import { ChevronRight } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { buildCategoryPath, categoryLabel } from '../../utils/categoryHelpers';

export default function CategoryBreadcrumb({ chain = [], parentCategory, currentCategory }) {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const Sep = () => (
    <ChevronRight className={`h-4 w-4 shrink-0 text-text-muted ${isAr ? 'rotate-180' : ''}`} aria-hidden />
  );

  const items = chain.length
    ? chain
    : [
      ...(parentCategory ? [parentCategory] : []),
      ...(currentCategory && (!parentCategory || parentCategory.slug !== currentCategory.slug) ? [currentCategory] : []),
    ];

  return (
    <nav className="mb-4 flex flex-wrap items-center gap-1 text-sm text-text-muted" aria-label="Breadcrumb">
      <Link to="/" className="hover:text-primary-600">
        {isAr ? 'الرئيسية' : 'Home'}
      </Link>
      <Sep />
      <Link to="/categories" className="hover:text-primary-600">
        {isAr ? 'الأقسام' : 'Categories'}
      </Link>
      {items.map((cat, index) => {
        const isLast = index === items.length - 1;
        const path = buildCategoryPath(items.slice(0, index + 1).map((c) => c.slug));
        return (
          <span key={cat.slug || index} className="flex items-center gap-1">
            <Sep />
            {isLast ? (
              <span className="font-medium text-text">{categoryLabel(cat, isAr)}</span>
            ) : (
              <Link to={path} className="hover:text-primary-600">
                {categoryLabel(cat, isAr)}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
