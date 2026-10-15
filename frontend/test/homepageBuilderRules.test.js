import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  copyLanguage,
  daysLabel,
  moveSection,
  pageIssues,
  ruleChips,
  sectionStatus,
  sectionsForPreview,
  sortOrderForInsert,
  stableStringify,
  validateVisibilityForm,
  visibilityFromForm,
  visibilityToForm,
} from '../src/admin/utils/homepageBuilderRules.js';

const now = new Date('2026-05-01T12:00:00Z');
const s = (id, o = {}) => ({ _id: id, type: 'rich_text_block', isActive: true, sortOrder: 10, ...o });

test('status: hidden beats every schedule', () => {
  assert.equal(sectionStatus(s('a', { isActive: false }), now), 'hidden');
  assert.equal(sectionStatus(s('a', { visibility: { startsAt: '2026-06-01T00:00:00Z' } }), now), 'scheduled');
  assert.equal(sectionStatus(s('a'), now), 'live');
});

test('visibility form round-trip keeps Cairo wall clock and the old mobile flag', () => {
  const form = visibilityToForm({ showOnMobile: false, visibility: { startsAt: '2026-07-15T07:00:00.000Z', audience: 'guests' } });
  assert.equal(form.startsAt, '2026-07-15T10:00', 'summer: UTC+3');
  assert.equal(form.devices, 'desktop');
  assert.equal(form.audience, 'guests');
  assert.equal(visibilityFromForm(form).startsAt, '2026-07-15T10:00');
});

test('form validation', () => {
  assert.deepEqual(validateVisibilityForm({ startsAt: '', endsAt: '', timeFrom: '', timeTo: '' }, false), {});
  assert.ok(validateVisibilityForm({ startsAt: '2026-05-02T10:00', endsAt: '2026-05-01T10:00' }, false).endsAt);
  assert.ok(validateVisibilityForm({ timeFrom: '07:00', timeTo: '' }, false).time);
  assert.ok(validateVisibilityForm({ timeFrom: '07:00', timeTo: '07:00' }, false).time);
});

test('rule chips describe the rules in plain words', () => {
  const chips = ruleChips(s('a', {
    visibility: { audience: 'new_customers', devices: 'mobile', zones: ['z1'], days: [5, 6] },
  }), false, { now, zones: [{ id: 'z1', nameEn: 'Helwan' }] });
  const labels = chips.map((c) => c.label);
  assert.ok(labels.includes('Customers with no orders yet'));
  assert.ok(labels.includes('Phones only'));
  assert.ok(labels.includes('Helwan'));
  assert.ok(labels.some((l) => l.includes('Fri & Sat')));
  assert.equal(daysLabel([0, 1, 2, 3, 4], false), 'Sun–Thu');
});

test('page issues: ended-but-on, missing zones, dark colours, duplicate anchors, nothing live', () => {
  const issues = pageIssues([
    s('ended', { visibility: { endsAt: '2026-04-01T00:00:00Z' } }),
    s('zone', { visibility: { zones: ['gone'] } }),
    s('dark', { appearance: { background: 'custom', backgroundColor: '#111111', anchor: 'x' } }),
    s('dup', { appearance: { anchor: 'x' } }),
  ], false, { now, zones: [{ id: 'z1' }] });
  const ids = issues.map((i) => i.sectionId);
  assert.ok(ids.includes('ended'));
  assert.ok(ids.includes('zone'));
  assert.ok(ids.includes('dark'));
  assert.ok(ids.includes('dup'));

  const none = pageIssues([s('off', { isActive: false })], false, { now });
  assert.equal(none[0].level, 'error');
});

test('preview as a visitor', () => {
  const list = [
    s('all'),
    s('hidden', { isActive: false }),
    s('guests', { visibility: { audience: 'guests' } }),
    s('returning', { visibility: { audience: 'returning_customers' } }),
    s('zoned', { visibility: { zones: ['z1'] } }),
    s('later', { visibility: { startsAt: '2026-06-01T00:00:00Z' } }),
  ];
  const ids = (opts) => sectionsForPreview(list, opts).map((x) => x._id);
  assert.deepEqual(ids({ audience: 'any', showHidden: false }), ['all', 'guests', 'returning', 'zoned', 'later']);
  assert.ok(ids({ audience: 'any', showHidden: true }).includes('hidden'));
  assert.deepEqual(ids({ audience: 'guest', at: now }), ['all', 'guests', 'zoned'], 'no zone picked = zone rules ignored');
  assert.deepEqual(ids({ audience: 'guest', zoneId: 'z2', at: now }), ['all', 'guests']);
  assert.deepEqual(ids({ audience: 'returning', zoneId: 'z1', at: now }), ['all', 'returning', 'zoned']);
  assert.ok(ids({ audience: 'guest', at: new Date('2026-07-01T00:00:00Z') }).includes('later'));
});

test('ordering helpers', () => {
  const list = [s('a', { sortOrder: 10 }), s('b', { sortOrder: 20 }), s('c', { sortOrder: 30 })];
  assert.deepEqual(moveSection(list, 0, 2).map((x) => [x._id, x.sortOrder]), [['b', 10], ['c', 20], ['a', 30]]);
  assert.equal(moveSection(list, 1, 1), list);
  assert.equal(sortOrderForInsert(list, 0), 15);
  assert.equal(sortOrderForInsert(list, 2), 40);
  assert.equal(sortOrderForInsert(list, -1), 1);
  assert.equal(sortOrderForInsert([], 0), 10);
});

test('copy language fills blanks only', () => {
  const { form, count } = copyLanguage({
    titleAr: 'عنوان', titleEn: '', subtitleAr: 'وصف', subtitleEn: 'Kept',
    items: [{ titleAr: 'بطاقة', titleEn: '' }],
    seoContent: { bodyAr: 'نص', bodyEn: '' },
  }, 'ar');
  assert.equal(form.titleEn, 'عنوان');
  assert.equal(form.subtitleEn, 'Kept');
  assert.equal(form.items[0].titleEn, 'بطاقة');
  assert.equal(form.seoContent.bodyEn, 'نص');
  assert.equal(count, 3);
});

test('stable stringify ignores key order', () => {
  assert.equal(stableStringify({ a: 1, b: [1, { c: 2, d: 3 }] }), stableStringify({ b: [1, { d: 3, c: 2 }], a: 1 }));
});
