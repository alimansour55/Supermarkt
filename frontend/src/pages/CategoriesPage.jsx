import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { fetchCategories } from '../services/productApi';
import { useAsyncData } from '../hooks/useAsyncData';
import Loader from '../components/ui/Loader';

export default function CategoriesPage() {
  const { t, language } = useLanguage();
  const { data: categories, loading } = useAsyncData(fetchCategories, []);

  return (
    <div className="container-app py-10">
      <h1 className="mb-2 text-3xl font-bold text-text">{t.nav.categories}</h1>
      <p className="mb-8 text-text-muted">
        {language === 'ar' ? 'تصفح جميع أقسام المتجر' : 'Browse all store departments'}
      </p>
      {loading ? (
        <div className="flex justify-center py-20"><Loader size="lg" /></div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {(categories || []).map((cat) => (
            <Link
              key={cat.slug}
              to={`/categories/${cat.slug}`}
              className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md"
            >
              <span className={`flex h-16 w-16 items-center justify-center rounded-2xl text-3xl ${cat.color || 'bg-primary-50'}`}>{cat.icon}</span>
              <span className="text-center text-sm font-semibold">{language === 'ar' ? (cat.nameAr || cat.name) : cat.nameEn}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
