/**
 * /:lang/sell-with-us — server-rendered seller recruitment landing page + application form.
 */
import SellWithUsPage from '../pages/SellWithUsPage';
import { apiGetSafe } from '../server/api.server';
import { PUBLIC_PAGE_CACHE } from '../server/site.server';
import { buildMeta, getRootData, homeLabel, metaLang, pickLang, storeName } from '../seo/meta';
import { breadcrumbJsonLd } from '../seo/jsonLd';

export default SellWithUsPage;

export async function loader() {
  // Not cached: admins expect commission / payout changes to show on the next reload.
  const body = await apiGetSafe('/sellers/config');
  return { config: body?.data || null };
}

export const headers = () => ({ 'Cache-Control': PUBLIC_PAGE_CACHE });

export function meta({ matches, location }) {
  const lang = metaLang(location);
  const { settings, siteUrl } = getRootData(matches) || {};
  const store = storeName(settings, lang);
  const title = pickLang(lang, 'بِع معنا', 'Sell with us');
  return buildMeta({
    matches,
    location,
    path: '/sell-with-us',
    title,
    description: lang === 'en'
      ? `Open your store on ${store} for free. Reach thousands of shoppers, we handle payments and delivery, and you pay commission only when you sell.`
      : `افتح متجرك على ${store} مجاناً. اوصل لآلاف العملاء، ونحن نتولى الدفع والتوصيل، وتدفع عمولة فقط عند البيع.`,
    jsonLd: [breadcrumbJsonLd([{ name: homeLabel(lang), path: '/' }, { name: title, path: '/sell-with-us' }], siteUrl, lang)],
  });
}
