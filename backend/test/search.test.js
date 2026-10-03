import { test } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { normalizeSearchText } from '../src/utils/arabicNormalize.js';
import { buildSynonymMap, SEARCH_SYNONYM_GROUPS } from '../src/constants/searchSynonyms.js';
import { toSearchDocument } from '../src/services/searchIndex.service.js';

test('normalizeSearchText folds Arabic letter variants', () => {
  assert.equal(normalizeSearchText('أريال'), normalizeSearchText('اريال'));
  assert.equal(normalizeSearchText('إسكندرية'), 'اسكندريه');
  assert.equal(normalizeSearchText('جهينة'), normalizeSearchText('جهينه'));
  assert.equal(normalizeSearchText('بيبسى'), normalizeSearchText('بيبسي'));
  assert.equal(normalizeSearchText('مُؤَسَّسَة'), 'موسسه');
});

test('normalizeSearchText strips tatweel, maps Arabic-Indic digits, lower-cases Latin', () => {
  assert.equal(normalizeSearchText('حلـــيب'), 'حليب');
  assert.equal(normalizeSearchText('١.٥ لتر'), '1.5 لتر');
  assert.equal(normalizeSearchText('  Ariel   GEL '), 'ariel gel');
  assert.equal(normalizeSearchText(null), '');
});

test('synonym words are stored pre-normalized', () => {
  for (const group of SEARCH_SYNONYM_GROUPS) {
    for (const word of group) assert.equal(normalizeSearchText(word), word, `"${word}" is not normalized`);
  }
});

test('buildSynonymMap links every word of a group both ways', () => {
  const map = buildSynonymMap([['milk', 'حليب', 'لبن']]);
  assert.deepEqual(map.milk.sort(), ['حليب', 'لبن'].sort());
  assert.ok(map['لبن'].includes('milk'));
  assert.ok(!map.milk.includes('milk'));
});

test('toSearchDocument builds a normalized, category-aware document', () => {
  const main = new mongoose.Types.ObjectId();
  const sub = new mongoose.Types.ObjectId();
  const doc = toSearchDocument({
    _id: new mongoose.Types.ObjectId(),
    nameAr: 'أريال جل غسيل',
    nameEn: 'Ariel Gel',
    brand: 'Ariel',
    brandAr: 'أريال',
    brandEn: 'ariel',
    searchKeywordsAr: ['منظف'],
    searchKeywordsEn: ['Detergent'],
    sku: 'AR-1',
    barcode: '622',
    categoryAncestors: [main, sub],
    isActive: true,
    soldCount: 12,
  }, new Map([
    [String(main), { nameAr: 'منظفات', nameEn: 'Cleaning' }],
    [String(sub), { nameAr: 'غسيل الملابس', nameEn: 'Laundry' }],
  ]));

  assert.equal(doc.nameAr, 'اريال جل غسيل');
  assert.equal(doc.brand, 'ariel اريال');
  assert.equal(doc.keywords, 'منظف detergent');
  assert.equal(doc.category, 'منظفات cleaning غسيل الملابس laundry');
  assert.equal(doc.codes, 'AR-1 622');
  assert.equal(doc.soldCount, 12);
  assert.equal(doc.rating, 0);
  assert.equal(doc.isActive, true);
});
