import test from 'node:test';
import assert from 'node:assert/strict';
import {
  countSectionsByType, normalizeSearchText, sectionMatchesSearch, SECTION_SEARCH_WORDS,
} from '../src/admin/utils/sectionLibrarySearch.js';

const hero = {
  value: 'hero_slider',
  labelAr: 'عرض الصور الرئيسي',
  labelEn: 'Main slideshow',
  descriptionAr: 'صور كبيرة تتبدّل أعلى الصفحة، ولكل صورة رابطها.',
  descriptionEn: 'Large pictures that change at the top of the page.',
};
const top = { labelAr: 'أعلى الصفحة', labelEn: 'Top of the page' };

test('normalizeSearchText folds Arabic letter variants and marks', () => {
  assert.equal(normalizeSearchText('الأقسامُ'), 'الاقسام');
  assert.equal(normalizeSearchText('إعلان'), 'اعلان');
  assert.equal(normalizeSearchText('مكتبة'), 'مكتبه');
  assert.equal(normalizeSearchText('  Hero—Slider '), 'hero slider');
});

test('finds a section by its name, old words, English and spelling variants', () => {
  assert.ok(sectionMatchesSearch(hero, top, 'سلايدر'));
  assert.ok(sectionMatchesSearch(hero, top, 'slider'));
  assert.ok(sectionMatchesSearch(hero, top, 'الصور'));
  assert.ok(sectionMatchesSearch(hero, top, 'بانر رئيسي'));
  assert.ok(sectionMatchesSearch(hero, top, 'أعلى'));
  assert.ok(sectionMatchesSearch(hero, top, ''));
  assert.equal(sectionMatchesSearch(hero, top, 'واتساب'), false);
});

test('every word list belongs to a real section type name', () => {
  for (const key of Object.keys(SECTION_SEARCH_WORDS)) assert.match(key, /^[a-z_]+$/);
});

test('countSectionsByType counts per type', () => {
  assert.deepEqual(countSectionsByType([{ type: 'hero_slider' }, { type: 'hero_slider' }, { type: 'seo_text' }, {}]), {
    hero_slider: 2,
    seo_text: 1,
  });
});
