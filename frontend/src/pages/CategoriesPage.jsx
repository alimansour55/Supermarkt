import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { getCategoryLabel, useCategories } from '../context/CategoriesContext';
import { CategoryGridSkeleton } from '../components/ui/Skeleton';
import CategoryImage from '../components/category/CategoryImage';

export default function CategoriesPage() {
  const { t, language } = useLanguage();
  const isAr = language === 'ar';
  const { rootCategories, loading } = useCategories();

  return (
    <div className="container-app py-10">
      <h1 className="mb-2 text-3xl font-bold text-text">{t.nav.categories}</h1>
      <p className="mb-8 text-text-muted">
        {isAr ? 'اختر القسم الرئيسي ثم القسم الفرعي لعرض المنتجات' : 'Pick a main category, then a subcategory to browse products'}
      </p>
      {loading ? (
        <CategoryGridSkeleton count={12} />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {rootCategories.map((cat) => (
            <Link
              key={cat.slug}
              to={`/category/${cat.slug}`}
              className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md"
            >
              <CategoryImage category={cat} size="md" alt={getCategoryLabel(cat, isAr)} />
              <span className="text-center text-sm font-semibold">{getCategoryLabel(cat, isAr)}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
