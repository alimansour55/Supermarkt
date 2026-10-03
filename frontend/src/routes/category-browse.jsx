/**
 * /category/* — department/sub-department pages. Parents list their children;
 * leaf categories list products (filters/sort/page via query string).
 */
import { data, redirect } from 'react-router';
import CategoryBrowsePage from '../pages/CategoryBrowsePage';
import { apiGet, apiGetSafe } from '../server/api.server';
import { PUBLIC_PAGE_CACHE } from '../server/site.server';
import { absoluteUrl, buildMeta, getRootData, listingSeo, pickLang, storeName } from '../seo/meta';
import { breadcrumbJsonLd, productListJsonLd } from '../seo/jsonLd';
import { buildCategoryPath } from '../utils/categoryHelpers';
import {
  categoryFiltersFromSearch,
  cleanSlugPath,
  normalizeCategoryBrowse,
  paramsKey,
} from '../utils/listingParams';

export default CategoryBrowsePage;

export async function loader({ params, request }) {
  const slugPath = cleanSlugPath(params['*']);
  if (!slugPath) throw redirect('/categories', 301);

  let body;
  try {
    body = await apiGet(`/categories/browse/${slugPath.split('/').map(encodeURIComponent).join('/')}`);
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
    throw redirect(`${buildCategoryPath(canonical)}${url.search}`, 301);
  }

  if (!browse.isLeaf) return { slugPath, browse, products: null, productsKey: null };

  const filters = categoryFiltersFromSearch(new URL(request.url).searchParams);
  const productsBody = await apiGetSafe(
    `/products/category-path/${slugPath.split('/').map(encodeURIComponent).join('/')}`,
    { params: filters },
  );
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

export function meta({ data: loaderData, matches, location }) {
  const lang = 'ar';
  const browse = loaderData?.browse;
  const { path, page, noindex } = listingSeo(location);

  if (!browse?.category) {
    return buildMeta({
      matches,
      path,
      noindex: true,
      title: loaderData?.notFound ? 'القسم غير موجود' : undefined,
    });
  }

  const { settings, siteUrl } = getRootData(matches) || {};
  const category = browse.category;
  const name = pickLang(lang, category.nameAr || category.name, category.nameEn);
  const childNames = (browse.children || [])
    .slice(0, 5)
    .map((child) => pickLang(lang, child.nameAr || child.name, child.nameEn))
    .filter(Boolean)
    .join('، ');
  const total = loaderData.products?.pagination?.total;
  const description = pickLang(lang, category.descriptionAr || category.description, category.descriptionEn)
    || (browse.isLeaf
      ? `تسوق ${name} أونلاين من ${storeName(settings, lang)}${total ? ` — ${total} منتج` : ''} بأفضل الأسعار مع توصيل سريع.`
      : `تسوق قسم ${name}${childNames ? `: ${childNames}` : ''} وأكثر من ${storeName(settings, lang)} مع توصيل سريع.`);

  const chain = browse.chain?.length ? browse.chain : [category];
  const crumbs = [
    { name: 'الرئيسية', path: '/' },
    { name: 'الأقسام', path: '/categories' },
    ...chain.map((cat, index) => ({
      name: pickLang(lang, cat.nameAr || cat.name, cat.nameEn),
      path: buildCategoryPath(chain.slice(0, index + 1).map((c) => c.slug).join('/')),
    })),
  ];

  const childrenList = !browse.isLeaf && browse.children?.length
    ? {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name,
      itemListElement: browse.children.map((child, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: pickLang(lang, child.nameAr || child.name, child.nameEn),
        url: absoluteUrl(siteUrl, buildCategoryPath(`${loaderData.slugPath}/${child.slug}`)),
      })),
    }
    : null;

  return buildMeta({
    matches,
    lang,
    path,
    title: page > 1 ? `${name} - صفحة ${page}` : name,
    description,
    image: category.image,
    noindex,
    jsonLd: [
      breadcrumbJsonLd(crumbs, siteUrl),
      browse.isLeaf ? productListJsonLd(loaderData.products?.products, { siteUrl, name }) : childrenList,
    ],
  });
}
