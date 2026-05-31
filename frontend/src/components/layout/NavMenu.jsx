import { Link, useLocation } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { CATEGORIES } from '../../data/mockData';

export default function NavMenu() {
  const { language } = useLanguage();
  const { pathname } = useLocation();

  const links = [
    { to: '/', labelAr: 'الرئيسية', labelEn: 'Home' },
    { to: '/offers', labelAr: 'العروض', labelEn: 'Offers', highlight: true },
    ...CATEGORIES.slice(0, 6).map((cat) => ({
      to: `/categories/${cat.slug}`,
      labelAr: cat.nameAr,
      labelEn: cat.nameEn,
    })),
  ];

  return (
    <nav className="border-t border-border/60 bg-white">
      <div className="container-app">
        <ul className="flex items-center gap-1 overflow-x-auto py-2 scrollbar-thin">
          {links.map((link) => {
            const isActive = pathname === link.to || (link.to !== '/' && pathname.startsWith(link.to));
            return (
              <li key={link.to} className="shrink-0">
                <Link
                  to={link.to}
                  className={`block whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-primary-50 text-primary-700'
                      : link.highlight
                        ? 'text-accent-600 hover:bg-amber-50'
                        : 'text-text hover:bg-surface'
                  }`}
                >
                  {language === 'ar' ? link.labelAr : link.labelEn}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
