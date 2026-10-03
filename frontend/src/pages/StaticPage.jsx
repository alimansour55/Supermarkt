import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
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

function setPageMeta({ title, description }) {
  if (title) document.title = title;

  let meta = document.querySelector('meta[name="description"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'description');
    document.head.appendChild(meta);
  }
  if (description) meta.setAttribute('content', description);
}

export default function StaticPage() {
  const { pathname } = useLocation();
  const { language } = useLanguage();
  const { settings } = useStoreSettings();
  const slug = PATH_TO_SLUG[pathname];
  const isAr = language === 'ar';
  const [page, setPage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
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
  }, [slug]);

  useEffect(() => {
    if (!page) return;
    const pageTitle = isAr ? page.titleAr : page.titleEn;
    const seoTitleOverride = isAr ? page.seoTitleAr : page.seoTitleEn;
    const storeName = isAr ? settings?.storeNameAr : settings?.storeNameEn;
    const seoTitle = seoTitleOverride || (storeName ? `${pageTitle} — ${storeName}` : pageTitle);
    const seoDescription = isAr ? page.seoDescriptionAr : page.seoDescriptionEn;
    setPageMeta({ title: seoTitle, description: seoDescription });

    // Leaving this static page: restore the site-wide default title/description
    // (store name, or the admin's custom SEO override) so it doesn't linger on other routes.
    return () => {
      const defaultTitle = (isAr ? settings?.seo?.defaultTitleAr : settings?.seo?.defaultTitleEn) || storeName;
      const defaultDescription = isAr ? settings?.seo?.defaultDescriptionAr : settings?.seo?.defaultDescriptionEn;
      setPageMeta({ title: defaultTitle, description: defaultDescription });
    };
  }, [
    page,
    isAr,
    settings?.storeNameAr,
    settings?.storeNameEn,
    settings?.seo?.defaultTitleAr,
    settings?.seo?.defaultTitleEn,
    settings?.seo?.defaultDescriptionAr,
    settings?.seo?.defaultDescriptionEn,
  ]);

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
