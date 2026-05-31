import { Link } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { fetchCategories } from '../../services/productApi';
import { useAsyncData } from '../../hooks/useAsyncData';

export default function CategoriesScroll() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const { data: categories, loading } = useAsyncData(fetchCategories, []);

  return (
    <section className="container-app py-4">
      <h2 className="mb-3 text-lg font-bold md:text-xl">
        {isAr ? 'تسوق حسب القسم' : 'Shop by Category'}
      </h2>
      {loading ? (
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-28 w-24 shrink-0 animate-pulse rounded-2xl bg-slate-200" />
          ))}
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
          {(categories || []).map((cat) => (
            <Link
              key={cat.slug}
              to={`/categories/${cat.slug}`}
              className="flex w-[88px] shrink-0 flex-col items-center gap-2 rounded-2xl border border-border bg-white px-3 py-3 shadow-sm transition-all active:scale-[0.98] hover:-translate-y-0.5 hover:shadow-md sm:w-[96px]"
            >
              <span className={`flex h-12 w-12 items-center justify-center rounded-xl text-2xl ${cat.color || 'bg-primary-50'}`}>
                {cat.icon}
              </span>
              <span className="line-clamp-2 text-center text-[11px] font-semibold leading-tight text-text">
                {isAr ? (cat.nameAr || cat.name) : cat.nameEn}
              </span>
            </Link>
          ))}
          <Link
            to="/categories"
            className="flex w-[88px] shrink-0 flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-primary-300 bg-primary-50 px-3 py-3 text-primary-700"
          >
            <span className="text-2xl">→</span>
            <span className="text-center text-[11px] font-bold">{isAr ? 'عرض الكل' : 'View all'}</span>
          </Link>
        </div>
      )}
    </section>
  );
}
