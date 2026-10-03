import { chromium } from '@playwright/test';
const base = process.argv[2] || 'http://localhost:5173';
const urls = ['/', '/products/sabon', '/category/diapers', '/category/diapers/molfix', '/brands', '/faq', '/about', '/contact', '/products', '/offers', '/today-deals', '/categories', '/subcategories', '/cart', '/nope-404'];
const browser = await chromium.launch({ channel: 'chrome' });
for (const confirmed of [false, true]) {
  const ctx = await browser.newContext({ locale: 'ar-EG' });
  if (confirmed) await ctx.addInitScript(() => { localStorage.setItem('marketplus_location_confirmed', 'true'); localStorage.setItem('marketplus_lang', '"ar"'); });
  for (const u of urls) {
    const page = await ctx.newPage();
    const errs = [];
    page.on('console', (m) => { if (m.type() === 'error' && /ydrat|did not match|Minified React error #4(18|19|21|23|25)/.test(m.text())) errs.push(m.text().split('\n')[0]); });
    page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message.split('\n')[0]));
    await page.goto(base + u, { waitUntil: 'networkidle', timeout: 30000 }).catch((e) => errs.push('GOTO ' + e.message));
    await page.waitForTimeout(500);
    console.log(confirmed ? 'C' : '-', u.padEnd(26), errs.length ? errs.join(' | ').slice(0, 300) : 'ok');
    await page.close();
  }
  await ctx.close();
}
await browser.close();
