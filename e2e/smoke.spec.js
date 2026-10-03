import { test, expect, firstProduct, firstCategory } from './fixtures.js';

test.describe('storefront', () => {
  test('home page renders header and content', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('header').first()).toBeVisible();
    await expect(page.locator('main')).not.toBeEmpty();
    expect(page.pageErrors).toEqual([]);
  });

  test('product page shows the product name', async ({ page, request }) => {
    const product = await firstProduct(request);
    await page.goto(`/products/${product.slug}`);
    const name = product.nameAr || product.name;
    await expect(page.getByRole('heading', { level: 1 })).toContainText(name);
    expect(page.pageErrors).toEqual([]);
  });

  test('add to cart from the product page', async ({ page, request }) => {
    const product = await firstProduct(request);
    test.skip(Number(product.stock ?? 1) <= 0, 'first product is out of stock');
    await page.goto(`/products/${product.slug}`);
    await page.getByRole('button', { name: /أضف للسلة|أضف إلى السلة|Add to cart/i }).first().click();
    await expect.poll(async () => page.evaluate(() => {
      try {
        const raw = localStorage.getItem('marketplus_cart');
        const parsed = raw ? JSON.parse(raw) : null;
        const items = Array.isArray(parsed) ? parsed : parsed?.items;
        return Array.isArray(items) ? items.length : 0;
      } catch {
        return 0;
      }
    })).toBeGreaterThan(0);
    expect(page.pageErrors).toEqual([]);
  });

  test('category page renders', async ({ page, request }) => {
    const category = await firstCategory(request);
    await page.goto(`/categories/${category.slug}`);
    await expect(page.locator('main')).not.toBeEmpty();
    expect(page.pageErrors).toEqual([]);
  });

  test('static content page renders', async ({ page }) => {
    await page.goto('/about');
    await expect(page.locator('main')).not.toBeEmpty();
    expect(page.pageErrors).toEqual([]);
  });

  test('cart page renders', async ({ page }) => {
    await page.goto('/cart');
    await expect(page.locator('main')).not.toBeEmpty();
    expect(page.pageErrors).toEqual([]);
  });

  test('unknown route shows the not-found page', async ({ page }) => {
    await page.goto('/this-page-does-not-exist-123');
    await expect(page.getByText(/404|غير موجودة|not found/i).first()).toBeVisible();
  });
});

test.describe('admin & driver', () => {
  test('admin login page renders a password field', async ({ page }) => {
    await page.goto('/admin/login');
    await expect(page.locator('input[type="password"]')).toBeVisible();
    expect(page.pageErrors).toEqual([]);
  });

  test('driver login page renders a password field', async ({ page }) => {
    await page.goto('/driver/login');
    await expect(page.locator('input[type="password"]')).toBeVisible();
    expect(page.pageErrors).toEqual([]);
  });
});
