import { Link, useLocation } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { getStaticPage } from '../data/staticPages';

const PATH_TO_SLUG = {
  '/contact': 'contact',
  '/faq': 'faq',
  '/about': 'about',
  '/privacy': 'privacy',
  '/terms': 'terms',
  '/returns': 'returns',
  '/careers': 'careers',
};

export default function StaticPage() {
  const { pathname } = useLocation();
  const { language } = useLanguage();
  const slug = PATH_TO_SLUG[pathname];
  const page = slug ? getStaticPage(slug) : null;
  const isAr = language === 'ar';

  if (!page) {
    return (
      <div className="container-app py-20 text-center">
        <p className="text-xl text-text-muted">{isAr ? 'الصفحة غير موجودة' : 'Page not found'}</p>
        <Link to="/" className="mt-4 inline-block text-primary-600">{isAr ? 'الرئيسية' : 'Home'}</Link>
      </div>
    );
  }

  return (
    <div className="container-app py-8 max-w-3xl">
      <h1 className="mb-8 text-2xl font-bold md:text-3xl">{isAr ? page.titleAr : page.titleEn}</h1>
      <div className="space-y-8">
        {page.sections.map((section, i) => (
          <section key={i} className="rounded-2xl border border-border bg-white p-6">
            {section.headingAr && (
              <h2 className="mb-3 text-lg font-semibold">{isAr ? section.headingAr : section.headingEn}</h2>
            )}
            <p className="whitespace-pre-line text-text leading-relaxed">
              {isAr ? section.bodyAr : section.bodyEn}
            </p>
          </section>
        ))}
      </div>
    </div>
  );
}
