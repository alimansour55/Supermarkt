import { test as base, expect } from '@playwright/test';

/**
 * Shared fixtures:
 * - skips the delivery-location gate so pages are usable straight away
 * - collects uncaught page errors so every test can assert the page didn't crash
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      try {
        localStorage.setItem('marketplus_location_confirmed', 'true');
      } catch {
        // storage unavailable — the gate will just show
      }
    });
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.pageErrors = errors;
    await use(page);
  },
});

/** First active product from the API, used to drive product-page tests. */
export async function firstProduct(request) {
  const res = await request.get('/api/products?limit=1');
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  const product = body.data?.[0];
  expect(product, 'database needs at least one product (run npm run seed)').toBeTruthy();
  return product;
}

export async function firstCategory(request) {
  const res = await request.get('/api/categories');
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  const category = body.data?.find((c) => c.isActive !== false) || body.data?.[0];
  expect(category, 'database needs at least one category').toBeTruthy();
  return category;
}

export { expect };
