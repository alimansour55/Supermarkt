import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { CATEGORIES } from '../../data/mockData';

export default function CategoriesDropdown() {
  const { language } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative hidden md:block">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 transition-colors"
      >
        <Menu className="h-4 w-4 shrink-0" aria-hidden />
        <span className="hidden sm:inline">{language === 'ar' ? 'كل الأقسام' : 'All Categories'}</span>
      </button>

      {open && (
        <div className="absolute start-0 top-full z-50 mt-2 w-[320px] rounded-2xl border border-border bg-white p-4 shadow-2xl sm:w-[480px]">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-bold text-text">{language === 'ar' ? 'تصفح الأقسام' : 'Browse Categories'}</h3>
            <Link to="/categories" onClick={() => setOpen(false)} className="text-sm font-semibold text-primary-600">
              {language === 'ar' ? 'عرض الكل' : 'View All'}
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {CATEGORIES.map((cat) => (
              <Link
                key={cat.slug}
                to={`/categories/${cat.slug}`}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-xl p-2.5 text-sm font-medium text-text hover:bg-primary-50 transition-colors"
              >
                <span className="text-xl">{cat.icon}</span>
                <span className="line-clamp-2">{language === 'ar' ? cat.nameAr : cat.nameEn}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
