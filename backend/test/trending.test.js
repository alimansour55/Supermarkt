import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  foldTrendRows,
  pickLabels,
  pinStatus,
  resolveTrendingConfig,
  normalizeSearchSettings,
  migrateSearchSettings,
  TRENDING_SETTINGS_VERSION,
} from '../src/services/trending.service.js';

test('foldTrendRows merges Arabic spelling variants and drops too-short terms', () => {
  const terms = foldTrendRows([
    { _id: 'أكوافينا', query: 'أكوافينا', sessions: 3, conversions: 1, score: 2 },
    { _id: 'اكوافينا', query: 'اكوافينا', sessions: 4, conversions: 0, score: 3 },
    { _id: 'بي', query: 'بي', sessions: 50, conversions: 5, score: 40 },
    { _id: '...', query: '...', sessions: 9, conversions: 0, score: 9 },
  ]);
  assert.equal(terms.length, 1);
  assert.equal(terms[0].key, 'اكوافينا');
  assert.equal(terms[0].sessions, 7);
  assert.equal(terms[0].conversions, 1);
  assert.equal(terms[0].variants.length, 2);
});

test('foldTrendRows ranks by recency score with a conversion boost', () => {
  const [first, second] = foldTrendRows([
    { _id: 'rice', query: 'rice', sessions: 10, conversions: 0, score: 5 },
    { _id: 'sugar', query: 'sugar', sessions: 10, conversions: 10, score: 4 },
  ]);
  // sugar: 4 × 1.5 = 6 beats rice: 5 × 1 = 5
  assert.equal(first.key, 'sugar');
  assert.equal(second.key, 'rice');
});

test('pickLabels takes the most-searched Arabic and Latin spellings', () => {
  const labels = pickLabels([
    { text: 'aquafina', weight: 2 },
    { text: 'اكوافينا', weight: 5 },
    { text: 'أكوافينا', weight: 1 },
  ]);
  assert.deepEqual(labels, { query: 'اكوافينا', labelAr: 'اكوافينا', labelEn: 'Aquafina' });
  assert.deepEqual(pickLabels([{ text: 'fine baby', weight: 1 }]), {
    query: 'fine baby',
    labelAr: 'fine baby',
    labelEn: 'Fine Baby',
  });
});

test('pinStatus honours the active flag and the campaign window', () => {
  const now = new Date('2026-10-13T12:00:00Z');
  assert.equal(pinStatus({ isActive: true }, now), 'live');
  assert.equal(pinStatus({ isActive: false }, now), 'inactive');
  assert.equal(pinStatus({ startsAt: '2026-10-14T00:00:00Z' }, now), 'scheduled');
  assert.equal(pinStatus({ endsAt: '2026-10-13T11:59:59Z' }, now), 'expired');
  assert.equal(pinStatus({ startsAt: '2026-10-01', endsAt: '2026-10-20' }, now), 'live');
});

test('resolveTrendingConfig clamps values and folds term lists', () => {
  const config = resolveTrendingConfig({
    displayLimit: 50,
    maxPinned: 99,
    minSessions: 0,
    requireConversion: 'false',
    autoBlocklist: ['  TEST ', 'test', 'إختبار'],
  });
  assert.equal(config.displayLimit, 20);
  assert.equal(config.maxPinned, 20);
  assert.equal(config.minSessions, 1);
  assert.equal(config.requireConversion, false);
  assert.equal(config.dedupeByProduct, true);
  assert.deepEqual(config.autoBlocklist, ['test', 'اختبار']);
});

test('normalizeSearchSettings cleans pins and drops a window that ends before it starts', () => {
  const out = normalizeSearchSettings({
    trendingMode: 'hybrid',
    trendingSearches: [
      { query: '', labelAr: '' },
      { labelAr: 'عروض رمضان', startsAt: '2026-03-01', endsAt: '2026-02-01', productId: 'nope' },
    ],
  });
  assert.equal(out.trendingMode, 'smart');
  assert.equal(out.trendingSearches.length, 1);
  assert.equal(out.trendingSearches[0].query, 'عروض رمضان');
  assert.equal(out.trendingSearches[0].productId, null);
  assert.equal(out.trendingSearches[0].endsAt, null);
  assert.equal(out.trendingVersion, TRENDING_SETTINGS_VERSION);
});

test('migrateSearchSettings moves v1 stores to smart and removes the old seed chips', () => {
  const migrated = migrateSearchSettings({
    trendingMode: 'manual',
    trendingSearches: [
      { query: 'milk', labelAr: 'لبن', labelEn: 'milk' },
      { query: 'اكوافينا', labelAr: 'اكوافينا', labelEn: 'Aquafina' },
    ],
    trendingConfig: { displayLimit: 6, requireConversion: false, autoMinCount: 9 },
  });
  assert.equal(migrated.trendingMode, 'smart');
  assert.deepEqual(migrated.trendingSearches.map((pin) => pin.query), ['اكوافينا']);
  assert.equal(migrated.trendingConfig.displayLimit, 6);
  assert.equal(migrated.trendingConfig.requireConversion, true);
  assert.equal(migrateSearchSettings(migrated), null);
  assert.equal(migrateSearchSettings({ trendingMode: 'auto' }).trendingMode, 'auto');
});
