/**
 * schema.org structured data builders (rendered as <script type="application/ld+json">).
 * Paths are logical app paths; URLs are localized to `lang`.
 * Validate with https://search.google.com/test/rich-results
 */
import { absoluteImage, pageUrl, pickLang, plainText, storeName } from './meta';

const SCHEMA = 'https://schema.org';

export function organizationJsonLd(settings, siteUrl, lang) {
  const social = settings?.socialLinks || {};
  const sameAs = [social.facebook, social.instagram, social.x, social.youtube, settings?.whatsappUrl]
    .filter((url) => typeof url === 'string' && /^https?:\/\//i.test(url));
  const address = pickLang(lang, settings?.defaultLocationAr, settings?.defaultLocationEn);
  const home = pageUrl(siteUrl, lang, '/');

  return {
    '@context': SCHEMA,
    '@type': 'GroceryStore',
    '@id': `${pageUrl(siteUrl, 'ar', '/')}#store`,
    name: storeName(settings, lang),
    url: home,
    logo: absoluteImage(siteUrl, settings?.logoUrl) || undefined,
    image: absoluteImage(siteUrl, settings?.seo?.ogImageUrl || settings?.logoUrl) || undefined,
    telephone: settings?.supportPhone || undefined,
    email: settings?.supportEmail || undefined,
    address: address ? { '@type': 'PostalAddress', streetAddress: address, addressCountry: 'EG' } : undefined,
    currenciesAccepted: settings?.currency || 'EGP',
    sameAs: sameAs.length ? sameAs : undefined,
  };
}

export function websiteJsonLd(settings, siteUrl, lang) {
  return {
    '@context': SCHEMA,
    '@type': 'WebSite',
    '@id': `${pageUrl(siteUrl, lang, '/')}#website`,
    name: storeName(settings, lang),
    url: pageUrl(siteUrl, lang, '/'),
    inLanguage: lang === 'en' ? 'en' : 'ar',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${pageUrl(siteUrl, lang, '/search/results')}?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

/** @param {{ name: string, path: string }[]} items — home first, logical paths */
export function breadcrumbJsonLd(items, siteUrl, lang) {
  const list = items.filter((item) => item?.name);
  if (list.length < 2) return null;
  return {
    '@context': SCHEMA,
    '@type': 'BreadcrumbList',
    itemListElement: list.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: pageUrl(siteUrl, lang, item.path),
    })),
  };
}

function productImages(product, siteUrl) {
  const raw = Array.isArray(product?.images) && product.images.length ? product.images : [product?.image];
  const types = product?.mediaTypes || [];
  return raw
    .filter((_, index) => types[index] !== 'video')
    .map((src) => absoluteImage(siteUrl, src))
    .filter(Boolean);
}

function availability(inStock) {
  return inStock ? `${SCHEMA}/InStock` : `${SCHEMA}/OutOfStock`;
}

export function productJsonLd(product, { siteUrl, settings, lang, path }) {
  if (!product) return null;
  const url = pageUrl(siteUrl, lang, path);
  const currency = settings?.currency || 'EGP';
  const name = pickLang(lang, product.nameAr || product.name, product.nameEn);
  const description = plainText(
    pickLang(lang, product.descriptionAr || product.description, product.descriptionEn),
    5000,
  );
  const brand = pickLang(lang, product.brandAr || product.brand, product.brandEn || product.brand);
  const images = productImages(product, siteUrl);
  const seller = { '@type': 'Organization', name: storeName(settings, lang) };

  const variantPrices = (product.variants || [])
    .filter((variant) => variant?.isActive !== false && Number(variant?.price) > 0)
    .map((variant) => Number(variant.price));

  const offers = variantPrices.length > 1
    ? {
      '@type': 'AggregateOffer',
      url,
      priceCurrency: currency,
      lowPrice: Math.min(...variantPrices),
      highPrice: Math.max(...variantPrices),
      offerCount: variantPrices.length,
      availability: availability(product.inStock),
      seller,
    }
    : {
      '@type': 'Offer',
      url,
      priceCurrency: currency,
      price: Number(product.price) || 0,
      availability: availability(product.inStock),
      itemCondition: `${SCHEMA}/NewCondition`,
      seller,
    };

  const barcode = String(product.barcode || '').trim();
  const reviewCount = Number(product.reviewCount) || 0;
  const rating = Number(product.rating) || 0;

  return {
    '@context': SCHEMA,
    '@type': 'Product',
    '@id': `${url}#product`,
    name,
    description: description || undefined,
    sku: product.sku || undefined,
    gtin: /^\d{8,14}$/.test(barcode) ? barcode : undefined,
    image: images.length ? images : undefined,
    brand: brand ? { '@type': 'Brand', name: brand } : undefined,
    category: product.categorySlug || undefined,
    offers,
    aggregateRating: reviewCount > 0 && rating > 0
      ? { '@type': 'AggregateRating', ratingValue: rating, reviewCount, bestRating: 5, worstRating: 1 }
      : undefined,
  };
}

/** ItemList of product URLs for category / listing pages. */
export function productListJsonLd(products, { siteUrl, name, lang }) {
  const list = (products || []).filter((product) => product?.slug).slice(0, 30);
  if (!list.length) return null;
  return {
    '@context': SCHEMA,
    '@type': 'ItemList',
    name: name || undefined,
    numberOfItems: list.length,
    itemListElement: list.map((product, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: pageUrl(siteUrl, lang, `/products/${product.slug}`),
    })),
  };
}

/** ItemList of named links (e.g. categories). @param {{ name: string, path: string }[]} items */
export function linkListJsonLd(items, { siteUrl, name, lang }) {
  const list = (items || []).filter((item) => item?.name && item?.path);
  if (!list.length) return null;
  return {
    '@context': SCHEMA,
    '@type': 'ItemList',
    name: name || undefined,
    itemListElement: list.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      url: pageUrl(siteUrl, lang, item.path),
    })),
  };
}
