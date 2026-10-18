/** Homepage block settings — pure normalizers in utils/homepageBlocks.js. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanProductIds,
  normalizeBlockConfig,
  normalizeWhatsappNumber,
  parseYoutubeId,
  priceRangeLink,
  reviewerDisplayName,
  safeUrl,
} from '../src/utils/homepageBlocks.js';

test('YouTube ids come out of every common link shape', () => {
  const id = 'dQw4w9WgXcQ';
  for (const input of [
    id,
    `https://www.youtube.com/watch?v=${id}&t=10`,
    `https://youtu.be/${id}?si=abc`,
    `https://m.youtube.com/shorts/${id}`,
    `https://www.youtube-nocookie.com/embed/${id}`,
    `youtube.com/watch?v=${id}`,
  ]) {
    assert.equal(parseYoutubeId(input), id, input);
  }
  assert.equal(parseYoutubeId('https://vimeo.com/12345'), '');
  assert.equal(parseYoutubeId('not a video'), '');
});

test('links are http(s) or site paths only', () => {
  assert.equal(safeUrl('/offers'), '/offers');
  assert.equal(safeUrl('https://cdn.test/v.mp4'), 'https://cdn.test/v.mp4');
  assert.equal(safeUrl('javascript:alert(1)'), '');
  assert.equal(safeUrl('//evil.test/x'), '');
  assert.equal(safeUrl('/maps', { allowPath: false }), '');
});

test('countdown end is read as Cairo wall clock, through summer time', () => {
  const winter = normalizeBlockConfig('countdown_banner', { endsAt: '2026-12-31T23:59' });
  assert.equal(winter.endsAt.toISOString(), '2026-12-31T21:59:00.000Z');
  const summer = normalizeBlockConfig('countdown_banner', { endsAt: '2026-07-01T12:00' });
  assert.equal(summer.endsAt.toISOString(), '2026-07-01T09:00:00.000Z');
  assert.equal(normalizeBlockConfig('countdown_banner', {}).endsAt, null);
  assert.throws(() => normalizeBlockConfig('countdown_banner', { endsAt: 'soon' }), /invalid end date/);
});

test('video keeps one source and a YouTube link becomes an id', () => {
  const yt = normalizeBlockConfig('video_banner', { videoUrl: 'https://youtu.be/dQw4w9WgXcQ', aspect: '9:16' });
  assert.equal(yt.youtubeId, 'dQw4w9WgXcQ');
  assert.equal(yt.videoUrl, '');
  assert.equal(yt.aspect, '16:9');
  const mp4 = normalizeBlockConfig('video_banner', { videoUrl: 'https://cdn.test/a.mp4', autoplayDesktop: 'false' });
  assert.equal(mp4.videoUrl, 'https://cdn.test/a.mp4');
  assert.equal(mp4.autoplayDesktop, false);
});

test('fields a type does not use are reset to defaults', () => {
  const cfg = normalizeBlockConfig('price_ranges', {
    endsAt: '2026-12-31T23:59',
    whatsappNumber: '01012345678',
    priceRanges: [{ max: 50 }],
  });
  assert.equal(cfg.endsAt, null);
  assert.equal(cfg.whatsappNumber, '');
  assert.equal(cfg.priceRanges.length, 1);
  // Unknown types get plain defaults and no throw.
  assert.equal(normalizeBlockConfig('rich_text_block', { endsAt: 'bad' }).endsAt, null);
});

test('price tiles: swapped bounds, empty rows dropped, filter links', () => {
  const { priceRanges } = normalizeBlockConfig('price_ranges', {
    priceRanges: [
      { max: '50', labelEn: 'Under 50' },
      { min: 200, max: 100 },
      { labelEn: 'nothing' },
      { min: 500 },
    ],
  });
  assert.deepEqual(priceRanges.map((r) => [r.min, r.max]), [[null, 50], [100, 200], [500, null]]);
  assert.equal(priceRangeLink(priceRanges[0]), '/products?maxPrice=50');
  assert.equal(priceRangeLink(priceRanges[1]), '/products?minPrice=100&maxPrice=200');
  assert.equal(priceRangeLink(priceRanges[2]), '/products?minPrice=500');
});

test('tabs need a label, keep known sorts, cap at six', () => {
  const { tabs } = normalizeBlockConfig('tabbed_products', {
    tabs: [
      { labelEn: 'Best', sort: 'best-selling' },
      { labelAr: 'جديد', sort: 'weird', category: 'not-an-id' },
      { sort: 'newest' },
      ...Array.from({ length: 8 }, (_, i) => ({ labelEn: `T${i}`, offers: 'true' })),
    ],
  });
  assert.equal(tabs.length, 6);
  assert.equal(tabs[1].sort, 'best-selling');
  assert.equal(tabs[1].category, null);
  assert.equal(tabs[2].offers, true);
});

test('branches: opening hours need both ends, unsafe map links dropped', () => {
  const { branches } = normalizeBlockConfig('store_branches', {
    branches: [
      { nameEn: 'Maadi', opensAt: '09:00', closesAt: '23:00', mapUrl: 'https://maps.google.com/?q=1', days: [0, 1, 1, 9] },
      { nameEn: 'Zamalek', opensAt: '09:00', mapUrl: 'javascript:x' },
      { addressEn: 'no name' },
    ],
  });
  assert.equal(branches.length, 2);
  assert.deepEqual(branches[0].days, [0, 1]);
  assert.equal(branches[1].opensAt, '');
  assert.equal(branches[1].mapUrl, '');
});

test('WhatsApp numbers become international digits', () => {
  assert.equal(normalizeWhatsappNumber('010 1234 5678'), '201012345678');
  assert.equal(normalizeWhatsappNumber('+20 101 234 5678'), '201012345678');
  assert.equal(normalizeWhatsappNumber('0020 1012345678'), '201012345678');
  assert.equal(normalizeWhatsappNumber(''), '');
});

test('reviewer names are shortened and product ids cleaned', () => {
  assert.equal(reviewerDisplayName('Ahmed Hassan Ali'), 'Ahmed A.');
  assert.equal(reviewerDisplayName('منى'), 'منى');
  assert.equal(reviewerDisplayName(''), '');
  const id = '507f1f77bcf86cd799439011';
  assert.deepEqual(cleanProductIds([id, id, 'x', null]), [id]);
});

test('coupon card keeps a clean upper-case code and a known style', () => {
  const cfg = normalizeBlockConfig('coupon_card', { couponCode: ' save 20 ', couponStyle: 'neon' });
  assert.equal(cfg.couponCode, 'SAVE20');
  assert.equal(cfg.couponStyle, 'ticket');
  // Other types never carry a coupon code.
  assert.equal(normalizeBlockConfig('spacer', { couponCode: 'X' }).couponCode, '');
});

test('occasion tiles need a title, get safe links and a known colour, max 8', () => {
  const cfg = normalizeBlockConfig('occasion_tiles', {
    tiles: [
      { titleAr: 'رمضان', link: '/products?tag=ramadan', icon: 'moon', accent: 'amber' },
      { titleEn: 'BBQ', link: 'javascript:alert(1)', accent: 'neon' },
      { link: '/x' },
      ...Array.from({ length: 10 }, (_, i) => ({ titleEn: `T${i}` })),
    ],
  });
  assert.equal(cfg.tiles.length, 8);
  assert.deepEqual(
    { title: cfg.tiles[0].titleAr, link: cfg.tiles[0].link, icon: cfg.tiles[0].icon, accent: cfg.tiles[0].accent },
    { title: 'رمضان', link: '/products?tag=ramadan', icon: 'moon', accent: 'amber' },
  );
  assert.equal(cfg.tiles[1].link, '/products');
  assert.equal(cfg.tiles[1].accent, 'primary');
});

test('spacer size and line', () => {
  assert.deepEqual(
    (({ spacerSize, showLine }) => ({ spacerSize, showLine }))(normalizeBlockConfig('spacer', { spacerSize: 'xl', showLine: 'true' })),
    { spacerSize: 'xl', showLine: true },
  );
  assert.equal(normalizeBlockConfig('spacer', { spacerSize: 'huge' }).spacerSize, 'md');
});
