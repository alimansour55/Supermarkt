/**
 * /:lang/category/* — department/sub-department pages. Parents list their children;
 * leaf categories list products (filters/sort/page via query string).
 */
import { data, redirect } from 'react-router';
import CategoryBrowsePage from '../pages/CategoryBrowsePage';
import { apiGet, apiGetSafe } from '../server/api.server';
import { PUBLIC_PAGE_CACHE } from '../server/site.server';
import {
  buildMeta,
  getRootData,
  homeLabel,
  listingSeo,
  metaLang,
  pickLang,
  storeName,
} from '../seo/meta';
import { breadcrumbJsonLd, linkListJsonLd, productListJsonLd } from '../seo/jsonLd';
import { localizedPath, requestLang } from '../i18n/routing';
import { buildCategoryPath } from '../utils/categoryHelpers';
import {
  categoryFiltersFromSearch,
  cleanSlugPath,
  normalizeCategoryBrowse,
  paramsKey,
} from '../utils/listingParams';

export default CategoryBrowsePage;

const encodePath = (slugPath) => slugPath.split('/').map(encodeURIComponent).join('/');

export async function loader({ params, request }) {
  const slugPath = cleanSlugPath(params['*']);
  if (!slugPath) throw redirect(localizedPath(requestLang(request), '/categories'), 301);

  let body;
  try {
    body = await apiGet(`/categories/browse/${encodePath(slugPath)}`);
  } catch (error) {
    console.error(`[ssr] category ${slugPath}: ${error.message}`);
    return data({ slugPath, browse: null }, { headers: { 'Cache-Control': 'no-store' } });
  }
  if (!body?.category) {
    return data({ slugPath, browse: null, notFound: true }, { status: 404 });
  }

  const browse = normalizeCategoryBrowse(body);
  const canonical = cleanSlugPath(browse.redirectTo || browse.canonicalSlugPath || browse.slugPath);
  if (canonical && canonical !== slugPath) {
    const url = new URL(request.url);
    throw redirect(`${localizedPath(requestLang(request), buildCategoryPath(canonical))}${url.search}`, 301);
  }

  if (!browse.isLeaf) return { slugPath, browse, products: null, productsKey: null };

  const filters = categoryFiltersFromSearch(new URL(request.url).searchParams);
  const productsBody = await apiGetSafe(`/products/category-path/${encodePath(slugPath)}`, { params: filters });
  if (!productsBody) return { slugPath, browse, products: null, productsKey: null };

  if (productsBody.chain?.length) browse.chain = productsBody.chain;
  return {
    slugPath,
    browse,
    products: {
      products: productsBody.data || [],
      pagination: productsBody.pagination || null,
      subcategories: productsBody.subcategories || [],
    },
    productsKey: `${slugPath}|${paramsKey(filters)}`,
  };
}

export function headers({ loaderHeaders }) {
  return { 'Cache-Control': loaderHeaders.get('Cache-Control') || PUBLIC_PAGE_CACHE };
}

// Filters/sort/page are fetched by the page itself; only a new category needs the loader.
export const shouldRevalidate = ({ currentUrl, nextUrl }) => currentUrl.pathname !== nextUrl.pathname;

function categoryDescription({ lang, name, store, isLeaf, total, childNames }) {
  if (lang === 'en') {
    return isLeaf
      ? `Shop ${name} online at ${store}${total ? ` — ${total} products` : ''} at great prices with fast delivery.`
      : `Shop ${name}${childNames ? `: ${childNames}` : ''} and more at ${store} with fast delivery.`;
  }
  return isLeaf
    ? `تسوق ${name} أونلاين من ${store}${total ? ` — ${total} منتج` : ''} بأفضل الأسعار مع توصيل سريع.`
    : `تسوق قسم ${name}${childNames ? `: ${childNames}` : ''} وأكثر من ${store} مع توصيل سريع.`;
}

export function meta({ data: loaderData, matches, location }) {
  const lang = metaLang(location);
  const browse = loaderData?.browse;
  const { path, page, noindex } = listingSeo(location);

  if (!browse?.category) {
    return buildMeta({
      matches,
      location,
      path,
      noindex: true,
      title: loaderData?.notFound ? pickLang(lang, 'القسم غير موجود', 'Category not found') : undefined,
    });
  }

  const { settings, siteUrl } = getRootData(matches) || {};
  const category = browse.category;
  const name = pickLang(lang, category.nameAr || category.name, category.nameEn);
  const childNames = (browse.children || [])
    .slice(0, 5)
    .map((child) => pickLang(lang, child.nameAr || child.name, child.nameEn))
    .filter(Boolean)
    .join(lang === 'en' ? ', ' : '، ');
  const description = pickLang(lang, category.descriptionAr || category.description, category.descriptionEn)
    || categoryDescription({
      lang,
      name,
      store: storeName(settings, lang),
      isLeaf: browse.isLeaf,
      total: loaderData.products?.pagination?.total,
      childNames,
    });

  const chain = browse.chain?.length ? browse.chain : [category];
  const crumbs = [
    { name: homeLabel(lang), path: '/' },
    { name: pickLang(lang, 'الأقسام', 'Categories'), path: '/categories' },
    ...chain.map((cat, index) => ({
      name: pickLang(lang, cat.nameAr || cat.name, cat.nameEn),
      path: buildCategoryPath(chain.slice(0, index + 1).map((c) => c.slug).join('/')),
    })),
  ];

  const childLinks = (browse.children || []).map((child) => ({
    name: pickLang(lang, child.nameAr || child.name, child.nameEn),
    path: buildCategoryPath(`${loaderData.slugPath}/${child.slug}`),
  }));

  return buildMeta({
    matches,
    location,
    path,
    title: page > 1 ? `${name} - ${pickLang(lang, 'صفحة', 'Page')} ${page}` : name,
    description,
    image: category.image,
    noindex,
    jsonLd: [
      breadcrumbJsonLd(crumbs, siteUrl, lang),
      browse.isLeaf
        ? productListJsonLd(loaderData.products?.products, { siteUrl, name, lang })
        : linkListJsonLd(childLinks, { siteUrl, name, lang }),
    ],
  });
}
