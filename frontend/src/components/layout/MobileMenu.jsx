import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { X, Truck } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useLocation } from '../../context/LocationContext';
import { CATEGORIES } from '../../data/mockData';
export default function MobileMenu({ open, onClose }) {
  const { language, toggleLanguage } = useLanguage();
  const { locations, location, setLocationId } = useLocation();
  const isAr = language === 'ar';

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const navLinks = [
    { to: '/', labelAr: 'الرئيسية', labelEn: 'Home' },
    { to: '/offers', labelAr: 'العروض', labelEn: 'Offers', highlight: true },
    { to: '/categories', labelAr: 'كل الأقسام', labelEn: 'All Categories' },
    { to: '/products', labelAr: 'كل المنتجات', labelEn: 'All Products' },
  ];

  return (
    <div className="fixed inset-0 z-[90] md:hidden" role="dialog" aria-modal="true">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-label={isAr ? 'إغلاق' : 'Close'}
      />
      <div className="absolute inset-0 flex flex-col bg-white">
        <div className="flex items-center justify-between border-b border-border px-4 py-4">
          <h2 className="text-lg font-bold">{isAr ? 'القائمة' : 'Menu'}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-xl hover:bg-surface"
            aria-label={isAr ? 'إغلاق' : 'Close'}
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="mb-4 flex items-center gap-2 rounded-xl bg-primary-50 px-3 py-2.5 text-sm text-primary-800">
            <Truck className="h-4 w-4 shrink-0" />
            {isAr ? 'توصيل خلال ساعتين · مجاني فوق 500 ج.م' : '2h delivery · Free over 500 EGP'}
          </div>

          <div className="mb-6">
            <p className="mb-2 text-xs font-semibold text-text-muted uppercase">
              {isAr ? 'منطقة التوصيل' : 'Delivery area'}
            </p>
            <div className="space-y-1">
              {locations.map((loc) => (
                <button
                  key={loc.id}
                  type="button"
                  onClick={() => setLocationId(loc.id)}
                  className={`w-full rounded-xl px-4 py-3 text-start text-sm font-medium ${
                    location.id === loc.id ? 'bg-primary-50 text-primary-700' : 'text-text hover:bg-surface'
                  }`}
                >
                  {isAr ? loc.nameAr : loc.nameEn}
                </button>
              ))}
            </div>
          </div>

          <nav className="space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={onClose}
                className={`block rounded-xl px-4 py-3.5 text-base font-semibold ${
                  link.highlight ? 'text-accent-600' : 'text-text hover:bg-surface'
                }`}
              >
                {isAr ? link.labelAr : link.labelEn}
              </Link>
            ))}
          </nav>

          <h3 className="mb-3 mt-8 text-xs font-semibold text-text-muted uppercase">
            {isAr ? 'الأقسام' : 'Categories'}
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {CATEGORIES.map((cat) => (
              <Link
                key={cat.slug}
                to={`/categories/${cat.slug}`}
                onClick={onClose}
                className="flex items-center gap-2 rounded-xl border border-border p-3 text-sm font-medium hover:bg-primary-50"
              >
                <span className="text-xl">{cat.icon}</span>
                <span className="line-clamp-2">{isAr ? cat.nameAr : cat.nameEn}</span>
              </Link>
            ))}
          </div>
        </div>

        <div className="border-t border-border p-4 safe-bottom">
          <button
            type="button"
            onClick={toggleLanguage}
            className="w-full rounded-xl border border-border py-3 text-sm font-semibold"
          >
            {isAr ? 'English' : 'العربية'}
          </button>
        </div>
      </div>
    </div>
  );
}
