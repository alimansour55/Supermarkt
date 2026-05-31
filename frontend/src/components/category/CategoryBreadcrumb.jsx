import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { categoryLabel } from '../../utils/categoryHelpers';

export default function CategoryBreadcrumb({ parentCategory, currentCategory }) {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const Sep = () => (
    <ChevronRight className={`h-4 w-4 shrink-0 text-text-muted ${isAr ? 'rotate-180' : ''}`} aria-hidden />
  );

  return (
    <nav className="mb-4 flex flex-wrap items-center gap-1 text-sm text-text-muted" aria-label="Breadcrumb">
      <Link to="/" className="hover:text-primary-600">
        {isAr ? 'الرئيسية' : 'Home'}
      </Link>
      <Sep />
      <Link to="/categories" className="hover:text-primary-600">
        {isAr ? 'الأقسام' : 'Categories'}
      </Link>
      {parentCategory && (
        <>
          <Sep />
          <Link to={`/categories/${parentCategory.slug}`} className="hover:text-primary-600">
            {categoryLabel(parentCategory, isAr)}
          </Link>
        </>
      )}
      {currentCategory && (
        <>
          <Sep />
          <span className="font-medium text-text">{categoryLabel(currentCategory, isAr)}</span>
        </>
      )}
    </nav>
  );
}
