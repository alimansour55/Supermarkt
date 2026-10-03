import { useEffect, useState } from 'react';
import { Link, useLoaderData, useLocation } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useStoreSettings } from '../context/StoreSettingsContext';
import { fetchContentPage } from '../services/contentPageApi';
import { PageContentSkeleton } from '../components/ui/Skeleton';
import ContactInfoCard from '../components/contact/ContactInfoCard';
import { filterContactPageSections } from '../utils/contactInfo';

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
  const { settings } = useStoreSettings();
  const slug = PATH_TO_SLUG[pathname];
  const isAr = language === 'ar';
  const loaderData = useLoaderData();
  const ssrPage = loaderData?.page?.slug === slug ? loaderData.page : null;
  const [page, setPage] = useState(ssrPage);
  const [loading, setLoading] = useState(!ssrPage);
  const [notFound, setNotFound] = useState(Boolean(loaderData?.notFound));

  useEffect(() => {
    // Already rendered by the server.
    if (ssrPage) return;
    if (!slug) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setLoading(true);
    fetchContentPage(slug)
      .then((data) => {
        if (!data) {
          setNotFound(true);
          setPage(null);
        } else {
          setPage(data);
          setNotFound(false);
        }
      })
      .catch(() => {
        setNotFound(true);
        setPage(null);
      })
      .finally(() => setLoading(false));
  // `ssrPage` is derived from loader data for this slug.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  if (loading) return <PageContentSkeleton />;

  if (notFound || !page) {
    return (
      <div className="container-app py-20 text-center">
        <p className="text-xl text-text-muted">{isAr ? 'الصفحة غير موجودة' : 'Page not found'}</p>
        <Link to="/" className="mt-4 inline-block text-primary-600">{isAr ? 'الرئيسية' : 'Home'}</Link>
      </div>
    );
  }

  const title = isAr ? page.titleAr : page.titleEn;
  const isContactPage = slug === 'contact';
  const sections = filterContactPageSections(
    [...(page.sections || [])].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)),
  );

  return (
    <div className={`container-app py-4 sm:py-8 ${isContactPage ? 'max-w-5xl' : 'max-w-3xl'}`}>
      {!isContactPage && <h1 className="mb-8 text-2xl font-bold md:text-3xl">{title}</h1>}
      <div className="space-y-4 sm:space-y-8">
        {isContactPage && (
          <ContactInfoCard settings={settings} isAr={isAr} />
        )}
        {sections.map((section, i) => (
          <section key={section._id || i} className="rounded-2xl border border-border bg-white p-6">
            {(section.headingAr || section.headingEn) && (
              <h2 className="mb-3 text-lg font-semibold">
                {isAr ? section.headingAr : section.headingEn}
              </h2>
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
