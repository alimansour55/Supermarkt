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
  test('product page has content, canonical and Product structured data', async ({ request }) => {
    const product = await firstProduct(request);
    const { res, body } = await html(request, `/products/${product.slug}`);
    expect(res.status()).toBe(200);

    const name = product.nameAr || product.name;
    expect(body).toContain(`<h1`);
    expect(body).toContain(name);
    expect(body).toMatch(new RegExp(`<link rel="canonical" href="[^"]*/products/${product.slug}"`));
    expect(metaContent(body, 'name', 'robots')).toContain('index');
    expect(metaContent(body, 'property', 'og:title')).toContain(name);

    const types = jsonLdBlocks(body).map((block) => block['@type']);
    expect(types).toContain('Product');
    expect(types).toContain('BreadcrumbList');
    const productLd = jsonLdBlocks(body).find((block) => block['@type'] === 'Product');
    expect(productLd.offers.price ?? productLd.offers.lowPrice).toBeGreaterThan(0);
  });

  test('private fields never reach the page', async ({ request }) => {
    const product = await firstProduct(request);
    const { body } = await html(request, `/products/${product.slug}`);
    expect(body).not.toContain('wholesalePrice');
    expect(body).not.toContain('stockHistory');
    expect(body).not.toContain('partnerRevenue');
  });

  test('unknown product returns 404 and noindex', async ({ request }) => {
    const { res, body } = await html(request, '/products/this-product-does-not-exist-xyz');
    expect(res.status()).toBe(404);
    expect(metaContent(body, 'name', 'robots')).toContain('noindex');
  });

  test('unknown URL returns 404', async ({ request }) => {
    const { res } = await html(request, '/this-page-does-not-exist-123');
    expect(res.status()).toBe(404);
  });

  test('home page has a heading and store structured data', async ({ request }) => {
    const { res, body } = await html(request, '/');
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
    const { res, body } = await html(request, `/category/${slugPath}`);
    expect(res.status()).toBe(200);
    expect(body).toContain(category.nameAr || category.name);
    expect(jsonLdBlocks(body).map((block) => block['@type'])).toContain('BreadcrumbList');
  });

  test('legacy /categories/:slug permanently redirects', async ({ request }) => {
    const category = await firstCategory(request);
    const res = await request.get(`/categories/${category.slug}`, { maxRedirects: 0 });
    expect(res.status()).toBe(301);
    expect(res.headers().location).toMatch(/\/category\//);
  });

  test('filtered listings are noindex, plain listings are indexable', async ({ request }) => {
    const plain = await html(request, '/products');
    expect(metaContent(plain.body, 'name', 'robots')).toContain('index, follow');
    const filtered = await html(request, '/products?sort=price-asc');
    expect(metaContent(filtered.body, 'name', 'robots')).toContain('noindex');
  });

  for (const path of ['/cart', '/checkout', '/login', '/orders', '/admin/login', '/driver/login', '/search/results?q=x']) {
    test(`private page ${path} is noindex`, async ({ request }) => {
      const { body } = await html(request, path);
      expect(metaContent(body, 'name', 'robots')).toContain('noindex');
    });
  }
});
