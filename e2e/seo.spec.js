/**
 * Server-rendered HTML checks — what search engines see before any JavaScript runs.
 * Run against the SSR server (dev or `npm start`), not the static Capacitor build.
 */
import { test, expect, firstProduct, firstCategory } from './fixtures.js';

async function html(request, path, options = {}) {
  const res = await request.get(path, { maxRedirects: 0, ...options });
  return { res, body: await res.text() };
}

function jsonLdBlocks(body) {
  return [...body.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .map((match) => JSON.parse(match[1]));
}

function metaContent(body, attr, name) {
  const re = new RegExp(`<meta[^>]*${attr}="${name}"[^>]*content="([^"]*)"`, 'i');
  return body.match(re)?.[1] ?? null;
}

test.describe('SEO: server-rendered HTML', () => {
  test('product page has content, canonical, hreflang and Product structured data', async ({ request }) => {
    const product = await firstProduct(request);
    const { res, body } = await html(request, `/ar/products/${product.slug}`);
    expect(res.status()).toBe(200);

    const name = product.nameAr || product.name;
    expect(body).toContain('<html lang="ar" dir="rtl"');
    expect(body).toContain('<h1');
    expect(body).toContain(name);
    expect(body).toMatch(new RegExp(`<link rel="canonical" href="[^"]*/ar/products/${product.slug}"`));
    expect(body).toMatch(new RegExp(`hreflang="en" href="[^"]*/en/products/${product.slug}"`, 'i'));
    expect(body).toMatch(/hreflang="x-default"/i);
    expect(metaContent(body, 'name', 'robots')).toContain('index');
    expect(metaContent(body, 'property', 'og:title')).toContain(name);

    const blocks = jsonLdBlocks(body);
    const types = blocks.map((block) => block['@type']);
    expect(types).toContain('Product');
    expect(types).toContain('BreadcrumbList');
    const productLd = blocks.find((block) => block['@type'] === 'Product');
    expect(productLd.offers.price ?? productLd.offers.lowPrice).toBeGreaterThan(0);
    expect(productLd.offers.url).toContain('/ar/products/');
  });

  test('private fields never reach the page', async ({ request }) => {
    const product = await firstProduct(request);
    const { body } = await html(request, `/ar/products/${product.slug}`);
    expect(body).not.toContain('wholesalePrice');
    expect(body).not.toContain('stockHistory');
    expect(body).not.toContain('partnerRevenue');
  });

  test('unknown product returns 404 and noindex', async ({ request }) => {
    const { res, body } = await html(request, '/ar/products/this-product-does-not-exist-xyz');
    expect(res.status()).toBe(404);
    expect(metaContent(body, 'name', 'robots')).toContain('noindex');
  });

  test('unknown URL returns 404', async ({ request }) => {
    const { res } = await html(request, '/ar/this-page-does-not-exist-123');
    expect(res.status()).toBe(404);
  });

  test('home page has a heading and store structured data', async ({ request }) => {
    const { res, body } = await html(request, '/ar');
    expect(res.status()).toBe(200);
    expect(body).toMatch(/<h1[^>]*>[^<]+<\/h1>/);
    const types = jsonLdBlocks(body).map((block) => block['@type']);
    expect(types).toContain('WebSite');
    expect(types).toContain('GroceryStore');
  });

  test('category page renders its name and breadcrumb', async ({ request }) => {
    const category = await firstCategory(request);
    const pathRes = await request.get(`/api/categories/path/${category.slug}`);
    const { slugPath } = await pathRes.json();
    const { res, body } = await html(request, `/ar/category/${slugPath}`);
    expect(res.status()).toBe(200);
    expect(body).toContain(category.nameAr || category.name);
    expect(jsonLdBlocks(body).map((block) => block['@type'])).toContain('BreadcrumbList');
  });

  test('legacy /categories/:slug permanently redirects', async ({ request }) => {
    const category = await firstCategory(request);
    const res = await request.get(`/ar/categories/${category.slug}`, { maxRedirects: 0 });
    expect(res.status()).toBe(301);
    expect(res.headers().location).toMatch(/\/ar\/category\//);
  });

  test('filtered listings are noindex, plain listings are indexable', async ({ request }) => {
    const plain = await html(request, '/ar/products');
    expect(metaContent(plain.body, 'name', 'robots')).toContain('index, follow');
    const filtered = await html(request, '/ar/products?sort=price-asc');
    expect(metaContent(filtered.body, 'name', 'robots')).toContain('noindex');
  });

  for (const path of ['/ar/cart', '/ar/checkout', '/ar/login', '/en/orders', '/admin/login', '/driver/login', '/ar/search/results?q=x']) {
    test(`private page ${path} is noindex`, async ({ request }) => {
      const { body } = await html(request, path);
      expect(metaContent(body, 'name', 'robots')).toContain('noindex');
    });
  }

  test('English pages are left-to-right with an English canonical', async ({ request }) => {
    const { res, body } = await html(request, '/en/faq');
    expect(res.status()).toBe(200);
    expect(body).toContain('<html lang="en" dir="ltr"');
    expect(body).toMatch(/<link rel="canonical" href="[^"]*\/en\/faq"/);
  });
});

test.describe('SEO: language URLs and redirects', () => {
  test('/ redirects to the Arabic home page', async ({ request }) => {
    const res = await request.get('/', { maxRedirects: 0 });
    expect([301, 302]).toContain(res.status());
    expect(res.headers().location).toMatch(/\/ar$/);
  });

  test('old unprefixed URLs permanently redirect to /ar and keep the query', async ({ request }) => {
    const product = await firstProduct(request);
    const res = await request.get(`/products/${product.slug}?ref=old`, { maxRedirects: 0 });
    expect(res.status()).toBe(301);
    expect(res.headers().location).toMatch(new RegExp(`/ar/products/${product.slug}\\?ref=old$`));
  });

  test('admin and driver URLs are not localized', async ({ request }) => {
    for (const path of ['/admin/login', '/driver/login']) {
      const res = await request.get(path, { maxRedirects: 0 });
      expect(res.status(), path).toBe(200);
    }
  });

  test('internal links in server HTML carry the language prefix', async ({ request }) => {
    const { body } = await html(request, '/en/products');
    const hrefs = [...body.matchAll(/<a [^>]*href="(\/[^"]*)"/g)].map((match) => match[1]);
    expect(hrefs.length).toBeGreaterThan(5);
    const unprefixed = hrefs.filter((href) => !/^\/(en|ar)(\/|$|\?)/.test(href));
    expect(unprefixed).toEqual([]);
  });
});

test.describe('SEO: crawler files', () => {
  test('robots.txt blocks private areas and links the sitemap', async ({ request }) => {
    const res = await request.get('/robots.txt');
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toContain('Disallow: /admin');
    expect(body).toContain('Disallow: /*/checkout');
    expect(body).toMatch(/Sitemap: https?:\/\/\S+\/sitemap\.xml/);
  });

  test('sitemap index lists page, category and product sitemaps', async ({ request }) => {
    const res = await request.get('/sitemap.xml');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('xml');
    const body = await res.text();
    expect(body).toContain('<sitemapindex');
    expect(body).toContain('/sitemaps/pages.xml');
    expect(body).toContain('/sitemaps/products-1.xml');
  });

  test('product sitemap lists both languages with hreflang alternates', async ({ request }) => {
    const product = await firstProduct(request);
    const body = await (await request.get('/sitemaps/products-1.xml')).text();
    expect(body).toMatch(new RegExp(`<loc>[^<]*/ar/products/${product.slug}</loc>`));
    expect(body).toMatch(new RegExp(`<loc>[^<]*/en/products/${product.slug}</loc>`));
    expect(body).toContain('hreflang="x-default"');
  });
});
