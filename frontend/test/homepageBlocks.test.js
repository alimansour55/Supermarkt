import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  branchOpenNow,
  priceRangeHref,
  priceRangeLabel,
  whatsappHref,
  youtubeEmbedSrc,
} from '../src/utils/homepageBlocks.js';
import {
  blockConfigFromForm,
  blockConfigToForm,
  blockContentSummary,
  blockDefaultsFor,
} from '../src/admin/utils/homepageBlockUtils.js';

test('price tiles read "Under 50 EGP" when the admin left the label empty', () => {
  assert.equal(priceRangeLabel({ max: 50 }, false), 'Under 50 EGP');
  assert.equal(priceRangeLabel({ max: 50 }, true), 'أقل من 50 EGP');
  assert.equal(priceRangeLabel({ min: 50, max: 100 }, true), '50 – 100 EGP');
  assert.equal(priceRangeLabel({ min: 250 }, false), 'Over 250 EGP');
  assert.equal(priceRangeLabel({ max: 50, labelAr: 'اقتصادي' }, true), 'اقتصادي');
  assert.equal(priceRangeHref({ max: 50 }), '/products?maxPrice=50');
  assert.equal(priceRangeHref({ min: '50', max: '100' }), '/products?minPrice=50&maxPrice=100');
  assert.equal(priceRangeHref({ min: 0, max: 20, link: '/x' }), '/x');
});

test('"Open now" follows Cairo time, including windows past midnight', () => {
  // 2026-07-01 is a Wednesday; Cairo is UTC+3 in summer.
  const at = (hhmm) => new Date(`2026-07-01T${hhmm}:00+03:00`);
  const day = { opensAt: '09:00', closesAt: '23:00', days: [] };
  assert.equal(branchOpenNow(day, at('10:00')), true);
  assert.equal(branchOpenNow(day, at('23:30')), false);
  const late = { opensAt: '18:00', closesAt: '02:00', days: [] };
  assert.equal(branchOpenNow(late, at('01:00')), true);
  assert.equal(branchOpenNow({ ...day, days: [5] }, at('10:00')), false, 'Fridays only');
  assert.equal(branchOpenNow({ opensAt: '', closesAt: '' }, at('10:00')), null);
});

test('WhatsApp and YouTube links', () => {
  assert.equal(whatsappHref('201012345678', 'مرحبا'), `https://wa.me/201012345678?text=${encodeURIComponent('مرحبا')}`);
  assert.equal(whatsappHref(''), '');
  assert.match(youtubeEmbedSrc('dQw4w9WgXcQ', { autoplay: true }), /youtube-nocookie\.com\/embed\/dQw4w9WgXcQ\?.*mute=1/);
  assert.equal(youtubeEmbedSrc('bad id'), '');
});

test('blockConfig round-trips through the admin form', () => {
  const stored = {
    endsAt: '2026-12-31T21:59:00.000Z',
    tabs: [{ labelEn: 'Best', category: { _id: 'c1' } }],
    branches: [{ nameEn: 'Maadi', days: [1] }],
    priceRanges: [{ min: null, max: 50 }],
  };
  const form = blockConfigToForm(stored);
  assert.equal(form.endsAt, '2026-12-31T23:59', 'shown as Cairo wall clock');
  assert.equal(form.tabs[0].category, 'c1');
  assert.equal(form.branches[0].phone, '');
  const payload = blockConfigFromForm({ ...form, priceRanges: [{ min: '', max: '50' }] });
  assert.deepEqual(payload.priceRanges[0], { min: null, max: 50 });
  assert.equal(payload.endsAt, '2026-12-31T23:59');
  assert.equal(blockDefaultsFor('tabbed_products').tabs.length, 3);
  assert.equal(blockDefaultsFor('price_ranges').priceRanges.length, 4);
});

test('content status lines flag what is missing', () => {
  const now = new Date('2026-10-15T10:00:00Z');
  assert.equal(blockContentSummary({ type: 'countdown_banner', blockConfig: {} }, false, now).tone, 'error');
  assert.equal(blockContentSummary({ type: 'countdown_banner', blockConfig: { endsAt: '2026-10-14T00:00:00Z' } }, false, now).tone, 'warn');
  assert.match(blockContentSummary({ type: 'countdown_banner', blockConfig: { endsAt: '2026-10-20T10:00:00Z' } }, false, now).text, /5 days/);
  assert.equal(blockContentSummary({ type: 'video_banner', blockConfig: {} }, false).tone, 'error');
  assert.equal(blockContentSummary({ type: 'signup_block', blockConfig: { signupMode: 'whatsapp' } }, false).tone, 'error');
  assert.equal(blockContentSummary({ type: 'tabbed_products', blockConfig: { tabs: [{}] }, productTabs: [{ products: [] }] }, false).tone, 'warn');
  assert.equal(blockContentSummary({ type: 'recently_viewed', blockConfig: {} }, false).tone, 'muted');
  assert.equal(blockContentSummary({ type: 'rich_text_block' }, false), null);
});
