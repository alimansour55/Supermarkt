import { useEffect, useState } from 'react';
import { Link, useParams } from '../app/router';
import { useLanguage } from '../context/LanguageContext';
import { fetchSubcategories } from '../services/productApi';
import SubcategoryGrid from '../components/category/SubcategoryGrid';
import CategoryBreadcrumb from '../components/category/CategoryBreadcrumb';
import { categoryLabel } from '../utils/categoryHelpers';
import { CategoryGridSkeleton } from '../components/ui/Skeleton';
import CategoryImage from '../components/category/CategoryImage';

export default function MainCategoryPage() {
  const { mainSlug } = useParams();
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const [main, setMain] = useState(null);
  const [subcategories, setSubcategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setNotFound(false);
    setMain(null);
    setSubcategories([]);

    fetchSubcategories(mainSlug)
      .then((res) => {
        if (!active) return;
        if (!res.main) {
          setNotFound(true);
          return;
        }
        setMain(res.main);
        setSubcategories(res.subcategories || []);
      })
      .catch(() => {
        if (active) setNotFound(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [mainSlug]);

  if (loading) {
    return (
      <div className="container-app py-8">
        <div className="mb-4 h-4 w-48 animate-pulse rounded bg-slate-200" />
        <CategoryGridSkeleton count={6} />
      </div>
    );
  }

  if (notFound || !main) {
    return (
      <div className="container-app py-20 text-center">
        <p className="text-xl text-text-muted">{isAr ? 'القسم غير موجود' : 'Category not found'}</p>
        <Link to="/categories" className="mt-4 inline-block text-primary-600">
          {isAr ? 'عرض الأقسام' : 'View categories'}
        </Link>
      </div>
    );
  }

  const catName = categoryLabel(main, isAr);

  return (
    <div className="container-app py-6 md:py-8">
      <CategoryBreadcrumb currentCategory={main} />

      <div className="mb-6 flex items-center gap-4">
        <CategoryImage category={main} size="lg" alt={catName} />
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">{catName}</h1>
          <p className="text-sm text-text-muted">
            {isAr ? 'اختر العلامة أو النوع لعرض المنتجات' : 'Choose a brand or type to browse products'}
          </p>
        </div>
      </div>

      <SubcategoryGrid
        subcategories={subcategories}
        parentName={catName}
        mainSlug={mainSlug}
      />
    </div>
  );
}
