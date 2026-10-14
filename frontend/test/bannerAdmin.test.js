import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  bannerStatus,
  bannerToForm,
  bannerWarnings,
  countByStatus,
  formIsDirty,
  groupByPlacement,
  sortBanners,
  storeInputToDate,
  toStoreInput,
  validateBannerForm,
} from '../src/admin/utils/bannerAdmin.js';
import { bannerVisibleTo, filterBannersForViewer } from '../src/utils/bannerAudience.js';

const NOW = new Date('2026-05-10T12:00:00Z').getTime();
const DAY = 24 * 60 * 60 * 1000;

test('status: ended beats paused, scheduled shows start time, live shows end time', () => {
  assert.equal(bannerStatus({ isActive: false, endsAt: new Date(NOW - DAY) }, NOW).key, 'ended');
  assert.equal(bannerStatus({ isActive: false }, NOW).key, 'paused');
  const scheduled = bannerStatus({ isActive: true, startsAt: new Date(NOW + DAY) }, NOW);
  assert.equal(scheduled.key, 'scheduled');
  assert.equal(scheduled.at, NOW + DAY);
  assert.deepEqual(bannerStatus({ isActive: true }, NOW), { key: 'live', at: null });
});

test('countByStatus tallies every bucket', () => {
  const counts = countByStatus([
    { isActive: true },
    { isActive: false },
    { isActive: true, startsAt: new Date(NOW + DAY) },
    { isActive: true, endsAt: new Date(NOW - DAY) },
  ], NOW);
  assert.deepEqual(counts, { live: 1, scheduled: 1, paused: 1, ended: 1 });
});

test('form date fields are Cairo time and survive a round trip (summer DST)', () => {
  const iso = '2026-07-01T09:15:00.000Z'; // 12:15 in Cairo (UTC+3)
  assert.equal(toStoreInput(iso), '2026-07-01T12:15');
  assert.equal(storeInputToDate('2026-07-01T12:15').toISOString(), iso);
  assert.equal(storeInputToDate('2026-01-01T12:15').toISOString(), '2026-01-01T10:15:00.000Z');
  assert.equal(toStoreInput(null), '');
  assert.equal(storeInputToDate(''), null);
});

test('sort order matches the storefront: priority, then sortOrder, then newest', () => {
  const sorted = sortBanners([
    { id: 'a', priority: 0, sortOrder: 2 },
    { id: 'b', priority: 5, sortOrder: 9 },
    { id: 'c', priority: 0, sortOrder: 1 },
  ]);
  assert.deepEqual(sorted.map((b) => b.id), ['b', 'c', 'a']);
  const groups = groupByPlacement([{ id: 1, placement: 'promo' }, { id: 2, placement: 'weird' }]);
  assert.equal(groups.promo.length, 1);
  assert.equal(groups.hero.length, 1);
});

test('warnings flag broken images, missing phone image, wrong-language titles and unseen placements', () => {
  const banner = {
    placement: 'hero', titleAr: 'Offers', titleEn: 'عروض', isActive: true, desktopImage: 'x.jpg', usedIn: [],
  };
  const warnings = bannerWarnings(banner, { placementSections: { hero: [] }, brokenImage: true, now: NOW });
  assert.deepEqual(warnings.sort(), ['arabicTitle', 'englishTitle', 'image', 'mobile', 'notShown'].sort());

  const healthy = bannerWarnings(
    { ...banner, titleAr: 'عروض', titleEn: 'Offers', mobileImage: 'm.jpg' },
    { placementSections: { hero: [{ isActive: true }] }, now: NOW },
  );
  assert.deepEqual(healthy, []);
});

test('promo banners are never flagged as unseen (the Offers page always shows them)', () => {
  const w = bannerWarnings(
    { placement: 'promo', titleAr: 'عروض', titleEn: 'Offers', isActive: true, image: 'x' },
    { placementSections: { promo: [] }, now: NOW },
  );
  assert.ok(!w.includes('notShown'));
});

test('ending soon is flagged within two days', () => {
  const w = bannerWarnings(
    { placement: 'promo', titleAr: 'عروض', titleEn: 'Offers', isActive: true, image: 'x', endsAt: new Date(NOW + DAY) },
    { now: NOW },
  );
  assert.ok(w.includes('endingSoon'));
});

test('form validation and dirty tracking', () => {
  const form = bannerToForm({});
  assert.deepEqual(validateBannerForm(form).sort(), ['image', 'title']);
  assert.deepEqual(validateBannerForm({ ...form, titleEn: 'Hi', desktopImage: 'x' }), []);
  assert.deepEqual(validateBannerForm({ ...form, titleEn: 'Hi' }, { desktopImage: {} }), []);
  assert.ok(validateBannerForm({
    ...form, titleEn: 'Hi', desktopImage: 'x', startsAt: '2026-05-02T00:00', endsAt: '2026-05-01T00:00',
  }).includes('dates'));

  assert.equal(formIsDirty(form, form), false);
  assert.equal(formIsDirty({ ...form, titleAr: 'x' }, form), true);
  assert.equal(formIsDirty(form, form, { mobileImage: {} }), true);
});

test('storefront audience filter', () => {
  const list = [
    { id: 1, targetAudience: 'all' },
    { id: 2, targetAudience: 'guests' },
    { id: 3, targetAudience: 'customers' },
    { id: 4, targetAudience: 'staff' },
    { id: 5 },
  ];
  assert.deepEqual(filterBannersForViewer(list, 'guests').map((b) => b.id), [1, 2, 5]);
  assert.deepEqual(filterBannersForViewer(list, 'customers').map((b) => b.id), [1, 3, 5]);
  assert.deepEqual(filterBannersForViewer(list, 'staff').map((b) => b.id), [1, 3, 4, 5]);
  assert.deepEqual(filterBannersForViewer(list, 'guests', 2).map((b) => b.id), [1, 2]);
  assert.equal(bannerVisibleTo({ targetAudience: 'staff' }, 'guests'), false);
});
