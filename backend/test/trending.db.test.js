/**
 * Trending chips end to end against a throwaway MongoDB database.
 * Skips itself when MongoDB is not reachable.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

const MONGO_BASE = (process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/marketplus').replace(/\/[^/?]*(\?.*)?$/, '');
const TEST_DB_URI = `${MONGO_BASE}/marketplus_trending_test`;
const HOUR = 60 * 60 * 1000;

let mongoose;
let skip = false;
let buildTrending;
let SearchEvent;
let products;

const searchedBy = (query, sessions, { converted = 0, source = 'search', hoursAgo = 1, repeat = 1 } = {}) => {
  const events = [];
  for (let s = 0; s < sessions; s += 1) {
    for (let r = 0; r < repeat; r += 1) {
      events.push({
        query,
        normalizedQuery: query.toLowerCase(),
        resultCount: 3,
        noResults: false,
        sessionId: `${query}-${source}-${s}`,
        source,
        converted: s < converted,
        createdAt: new Date(Date.now() - hoursAgo * HOUR),
      });
    }
  }
  return events;
};

before(async () => {
  mongoose = (await import('mongoose')).default;
  try {
    await mongoose.connect(TEST_DB_URI, { serverSelectionTimeoutMS: 2000 });
  } catch {
    skip = true;
    return;
  }
  await mongoose.connection.dropDatabase();
  ({ buildTrending } = await import('../src/services/trending.service.js'));
  ({ default: SearchEvent } = await import('../src/models/SearchEvent.js'));
  const { default: Product } = await import('../src/models/Product.js');
  const { default: Category } = await import('../src/models/Category.js');
  await Product.syncIndexes();

  const category = await Category.create({ nameAr: 'مشروبات', nameEn: 'Drinks', slug: 'drinks-tr', isActive: true });
  const make = (nameAr, nameEn, stock, soldCount) => Product.create({
    nameAr, nameEn, price: 10, stock, soldCount, category: category._id,
    sku: `SKU-TR-${nameEn}`, slug: `tr-${nameEn.toLowerCase().replace(/\s+/g, '-')}`,
  });
  products = {
    water: await make('مياه اكوافينا', 'Aquafina Water', 10, 5),
    rice: await make('أرز الضحى', 'Al Doha Rice', 0, 50),
    sugar: await make('سكر الأسرة', 'Family Sugar', 5, 1),
    oil: await make('زيت كريستال', 'Crystal Oil', 8, 900),
  };

  await SearchEvent.insertMany([
    // Two spellings of one brand → one chip carrying both labels.
    ...searchedBy('اكوافينا', 3, { converted: 1 }),
    ...searchedBy('aquafina', 2, { converted: 1 }),
    // Out of stock → never a chip.
    ...searchedBy('ارز الضحى', 6, { converted: 2 }),
    // One shopper hammering a term does not make it trend…
    ...searchedBy('سكر الاسره', 1, { converted: 1, repeat: 12 }),
    // …and neither do clicks that came from the chips themselves.
    ...searchedBy('سكر الاسره', 9, { converted: 9, source: 'trending' }),
  ]);
});

after(async () => {
  if (skip) return;
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

const smartSettings = (overrides = {}) => ({
  trendingMode: 'smart',
  trendingSearches: [
    { query: 'عروض رمضان', labelAr: 'عروض رمضان', labelEn: 'Ramadan deals', isActive: true, sortOrder: 0 },
    { query: 'expired', labelAr: 'قديم', labelEn: 'Old', isActive: true, sortOrder: 1, endsAt: new Date(Date.now() - HOUR) },
  ],
  trendingConfig: { displayLimit: 8, maxPinned: 3, minSessions: 3, requireConversion: true },
  ...overrides,
});

test('smart mode: live pin, merged auto chip, then best-sellers fill to four', async (t) => {
  if (skip) return t.skip('MongoDB not reachable');
  const chips = await buildTrending({ searchSettings: smartSettings() });

  assert.deepEqual(chips.map((chip) => chip.kind), ['pinned', 'auto', 'fallback', 'fallback']);
  assert.equal(chips[0].labelEn, 'Ramadan deals');
  assert.equal(chips[1].labelAr, 'اكوافينا');
  assert.equal(chips[1].labelEn, 'Aquafina');
  assert.equal(chips[1].productSlug, null, 'auto chips open search results, not one product');
  assert.equal(chips[2].productSlug, products.oil.slug, 'best seller first');
  assert.ok(!chips.some((chip) => chip.labelEn === 'Old'), 'expired pin hidden');
  assert.ok(!chips.some((chip) => chip.productSlug === products.rice.slug), 'out-of-stock product never shown');
});

test('admin diagnostics explain every skipped term', async (t) => {
  if (skip) return t.skip('MongoDB not reachable');
  const { candidates, chips } = await buildTrending({ searchSettings: smartSettings(), withDiagnostics: true });
  const status = Object.fromEntries(candidates.map((c) => [c.key, c.status]));

  assert.equal(status['اكوافينا'], 'shown');
  assert.equal(status.aquafina, 'merged');
  assert.equal(status['ارز الضحي'], 'no-stock');
  assert.equal(status['سكر الاسره'], 'few-shoppers');
  assert.equal(candidates.find((c) => c.key === 'اكوافينا').sessions, 5);
  assert.equal(chips[1].kind, 'auto');
});

test('blocklist and approval mode keep terms off the storefront', async (t) => {
  if (skip) return t.skip('MongoDB not reachable');
  const blocked = await buildTrending({
    searchSettings: smartSettings({ trendingConfig: { autoBlocklist: ['أكوافينا'], minSessions: 3 } }),
    withDiagnostics: true,
  });
  assert.ok(!blocked.chips.some((chip) => chip.kind === 'auto'));
  assert.equal(blocked.candidates.find((c) => c.key === 'اكوافينا').status, 'hidden');

  const pending = await buildTrending({
    searchSettings: smartSettings({ trendingConfig: { requireApproval: true, minSessions: 3 } }),
    withDiagnostics: true,
  });
  assert.equal(pending.candidates.find((c) => c.key === 'اكوافينا').status, 'pending');

  const approved = await buildTrending({
    searchSettings: smartSettings({ trendingConfig: { requireApproval: true, approvedTerms: ['اكوافينا'], minSessions: 3 } }),
  });
  assert.ok(approved.some((chip) => chip.kind === 'auto' && chip.labelAr === 'اكوافينا'));
});

test('manual mode shows only the live pins', async (t) => {
  if (skip) return t.skip('MongoDB not reachable');
  const chips = await buildTrending({ searchSettings: smartSettings({ trendingMode: 'manual' }) });
  assert.deepEqual(chips.map((chip) => chip.labelEn), ['Ramadan deals']);

  const empty = await buildTrending({ searchSettings: { trendingMode: 'manual', trendingSearches: [] } });
  assert.ok(empty.length > 0 && empty.every((chip) => chip.kind === 'fallback'), 'never an empty row');
});
