import { test, expect } from './fixtures.js';

/**
 * Seller Center journey in a real browser: a new seller signs in, creates a store section,
 * adds a product in the editor, staff approve it, the product appears on the public store
 * page, the seller edits stock in Manage inventory, plans a promotion, then signs out.
 * Orders, shipping and payouts are covered by the API tests (backend/test/marketplace.*).
 *
 * Needs the app running and a seeded admin (E2E_ADMIN_USERNAME / E2E_ADMIN_PASSWORD,
 * dev seed defaults superadmin / admin123).
 */
const ADMIN = {
  username: process.env.E2E_ADMIN_USERNAME || 'superadmin',
  password: process.env.E2E_ADMIN_PASSWORD || 'admin123',
};

test.describe.configure({ mode: 'serial' });

test('seller journey: sign in → section → product → approval → storefront → inventory → promotion', async ({ page, request }) => {
  test.setTimeout(150_000);
  const stamp = Date.now();
  const email = `e2e-seller-${stamp}@sellers.test`;
  const password = 'E2eSeller2026';
  const productName = { ar: `عسل اختبار ${stamp}`, en: `E2E Honey ${stamp}` };

  // ── Setup through the API: apply, then staff approve the store ──
  const apply = await request.post('/api/sellers/apply', {
    data: {
      nameAr: `متجر اختبار ${stamp}`, nameEn: `E2E Store ${stamp}`, contactName: 'E2E Seller', email,
      phone: `+2010${String(stamp).slice(-8)}`, password, city: 'Cairo', acceptTerms: true,
    },
  });
  expect(apply.ok(), await apply.text()).toBeTruthy();
  const { seller } = await apply.json();

  const adminLogin = await request.post('/api/auth/admin-login', { data: ADMIN });
  expect(adminLogin.ok(), 'admin login failed — set E2E_ADMIN_USERNAME / E2E_ADMIN_PASSWORD').toBeTruthy();
  const adminHeaders = { Authorization: `Bearer ${(await adminLogin.json()).token}` };
  const activate = await request.post(`/api/admin/marketplace/sellers/${seller._id}/status`, { data: { status: 'active' }, headers: adminHeaders });
  expect(activate.ok(), await activate.text()).toBeTruthy();

  // ── Sign in through the Seller Center login page ──
  await page.goto('/seller-center/login');
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('form button[type="submit"]').click();
  await expect(page).toHaveURL(/\/seller-center$/);
  const menu = page.getByRole('complementary');
  await expect(menu).toBeVisible();

  // ── Create a store section ──
  await page.goto('/seller-center/categories');
  await page.getByPlaceholder('الاسم بالإنجليزية').fill('E2E Section');
  await page.getByRole('button', { name: 'إضافة' }).click();
  await expect(page.locator('main li p', { hasText: 'E2E Section' }).first()).toBeVisible();

  // ── Add a product in the editor (draft) ──
  await page.goto('/seller-center/products/new');
  const textboxes = page.locator('main input:not([type])');
  await textboxes.nth(0).fill(productName.ar);
  await textboxes.nth(1).fill(productName.en);
  await page.getByRole('button', { name: 'السعر والمخزون' }).click();
  const numbers = page.locator('main input[type="number"]');
  await numbers.nth(0).fill('150');
  await numbers.nth(2).fill('12');
  await page.getByRole('button', { name: 'الأقسام' }).first().click();
  await page.getByRole('button', { name: 'E2E Section' }).click();
  await page.getByRole('button', { name: 'حفظ كمسودة' }).click();
  await expect(page).toHaveURL(/\/seller-center\/products$/);
  await expect(page.getByText(productName.ar).first()).toBeVisible();

  // ── Submit, and staff approve it into a marketplace category ──
  const token = await page.evaluate(() => JSON.parse(localStorage.getItem('marketplus_token') || localStorage.getItem('token') || 'null'));
  const sellerHeaders = { Authorization: `Bearer ${token}` };
  const mine = await (await request.get('/api/seller/products', { headers: sellerHeaders })).json();
  const product = mine.data.find((p) => p.nameEn === productName.en);
  expect(product).toBeTruthy();
  expect((await request.post(`/api/seller/products/${product._id}/submit`, { headers: sellerHeaders })).ok()).toBeTruthy();

  const categories = (await (await request.get('/api/categories')).json()).data;
  const leaf = categories.find((c) => c.isActive !== false && !categories.some((x) => String(x.parentCategory?._id || x.parentCategory) === String(c._id)));
  const approve = await request.post(`/api/admin/marketplace/listings/${product._id}/approve`, { data: { category: leaf._id }, headers: adminHeaders });
  expect(approve.ok(), await approve.text()).toBeTruthy();

  // ── Customers see it on the store page, filterable by the section ──
  await page.goto(`/ar/sellers/${seller.slug}`);
  await expect(page.getByText(productName.ar).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /E2E Section/ }).first()).toBeVisible();

  // ── Manage inventory: change stock and save all ──
  await page.goto('/seller-center/inventory');
  const row = page.locator('tr', { hasText: productName.ar });
  await row.getByLabel('المخزون').fill('30');
  await page.getByRole('button', { name: 'حفظ كل التغييرات' }).click();
  await expect(page.getByText('غير محفوظة')).toHaveCount(0);
  await expect(row.getByLabel('المخزون')).toHaveValue('30');

  // ── Plan a promotion (goes to staff for approval) ──
  await page.goto('/seller-center/promotions');
  await page.getByRole('button', { name: 'عرض جديد' }).click();
  await page.getByPlaceholder('مثال: خصم رمضان').fill('E2E sale');
  await page.getByRole('button', { name: 'إرسال للموافقة' }).click();
  await expect(page.getByText('بانتظار الموافقة').first()).toBeVisible();

  // ── Keyboard shortcut help, then sign out ──
  await page.keyboard.press('?');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /E2E Seller/ }).click();
  await page.getByRole('button', { name: 'تسجيل الخروج' }).click();
  await expect(page).toHaveURL(/\/seller-center\/login/);

  expect(page.pageErrors).toEqual([]);
});

test('forgot-password screen never reveals whether an email exists', async ({ page }) => {
  await page.goto('/seller-center/login');
  await page.getByRole('button', { name: 'نسيت كلمة المرور؟' }).click();
  await page.locator('input[type="email"]').fill(`nobody-${Date.now()}@sellers.test`);
  await page.getByRole('button', { name: 'أرسل رابط إعادة التعيين' }).click();
  await expect(page.getByText('إذا كان هذا البريد مسجلاً كبائع')).toBeVisible();
});
