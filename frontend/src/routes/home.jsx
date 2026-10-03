/**
 * / — server-rendered home page (CMS sections) with Organization + WebSite structured data.
 */
import HomePage from '../pages/HomePage';
import { apiGetSafe } from '../server/api.server';
import { PUBLIC_PAGE_CACHE } from '../server/site.server';
import { buildMeta, defaultSeo, getRootData } from '../seo/meta';
import { organizationJsonLd, websiteJsonLd } from '../seo/jsonLd';

export default HomePage;

export async function loader() {
  const body = await apiGetSafe('/homepage-sections', { cached: true, ttlMs: 60_000 });
  return { sections: Array.isArray(body?.data) ? body.data : null };
}

export const headers = () => ({ 'Cache-Control': PUBLIC_PAGE_CACHE });

export function meta({ matches }) {
  const lang = 'ar';
  const { settings, siteUrl } = getRootData(matches) || {};
  const defaults = defaultSeo(settings, lang);
  return buildMeta({
    matches,
    lang,
    path: '/',
    title: defaults.title,
    description: defaults.description,
    jsonLd: [organizationJsonLd(settings, siteUrl, lang), websiteJsonLd(settings, siteUrl, lang)],
  });
}
