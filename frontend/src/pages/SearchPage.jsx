import { useLanguage } from '../context/LanguageContext';
import { Link } from 'react-router-dom';
import { getCategoryLabel, useCategories } from '../context/CategoriesContext';

export default function SearchPage() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const { rootCategories } = useCategories();

  return (
    <div className="container-app py-6 pb-4">
      <p className="mb-3 text-sm font-semibold text-text-muted">
        {isAr ? 'تصفح حسب القسم' : 'Browse by category'}
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {rootCategories.map((cat) => (
          <Link
            key={cat.slug || cat._id}
            to={`/category/${cat.slug}`}
            className="flex items-center gap-3 rounded-2xl border border-border bg-white p-4 shadow-sm active:scale-[0.98] transition-transform"
          >
            <span className="text-2xl">{cat.icon || '🛒'}</span>
            <span className="text-sm font-semibold">{getCategoryLabel(cat, isAr)}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
