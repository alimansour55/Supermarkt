/**
 * /:lang/about, /faq, /contact, /privacy, /terms, /returns, /careers — CMS content pages.
 */
import { data } from 'react-router';
import StaticPage from '../pages/StaticPage';
import { apiGetSafe } from '../server/api.server';
import { PUBLIC_PAGE_CACHE } from '../server/site.server';
import { buildMeta, getRootData, homeLabel, metaLang, pickLang, plainText } from '../seo/meta';
import { breadcrumbJsonLd, organizationJsonLd } from '../seo/jsonLd';
import { stripLang } from '../i18n/routing';

export default StaticPage;

function slugFromPath(pathname) {
  return stripLang(pathname).replace(/^\/+|\/+$/g, '');
}

export async function loader({ request }) {
  const slug = slugFromPath(new URL(request.url).pathname);
  const body = await apiGetSafe(`/content-pages/${encodeURIComponent(slug)}`, { cached: true, ttlMs: 60_000 });
  if (!body?.data) return data({ page: null, notFound: true }, { status: 404 });
  return { page: body.data };
}

export const headers = () => ({ 'Cache-Control': PUBLIC_PAGE_CACHE });

function faqJsonLd(page, lang) {
  const questions = (page.sections || [])
    .map((section) => ({
      q: pickLang(lang, section.headingAr, section.headingEn),
      a: plainText(pickLang(lang, section.bodyAr, section.bodyEn), 2000),
    }))
    .filter((item) => item.q && item.a);
  if (!questions.length) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: questions.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };
}

export function meta({ data: loaderData, matches, location }) {
  const lang = metaLang(location);
  const path = `/${slugFromPath(location.pathname)}`;
  const page = loaderData?.page;
  if (!page) {
    return buildMeta({
      matches,
      location,
      path,
      title: pickLang(lang, 'الصفحة غير موجودة', 'Page not found'),
      noindex: true,
    });
  }

  const { settings, siteUrl } = getRootData(matches) || {};
  const pageTitle = pickLang(lang, page.titleAr, page.titleEn);
  const title = pickLang(lang, page.seoTitleAr, page.seoTitleEn) || pageTitle;
  const description = pickLang(lang, page.seoDescriptionAr, page.seoDescriptionEn)
    || pickLang(lang, page.sections?.[0]?.bodyAr, page.sections?.[0]?.bodyEn);

  const jsonLd = [
    breadcrumbJsonLd([{ name: homeLabel(lang), path: '/' }, { name: pageTitle, path }], siteUrl, lang),
  ];
  if (page.slug === 'faq') jsonLd.push(faqJsonLd(page, lang));
  if (page.slug === 'contact' || page.slug === 'about') jsonLd.push(organizationJsonLd(settings, siteUrl, lang));

  return buildMeta({ matches, location, path, title, description, jsonLd });
}
