import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  audiencesForViewer,
  bannerIsLiveNow,
  fillBilingual,
  parseBannerScheduleInstant,
  pickForAllViewers,
  viewerAudience,
} from '../src/utils/bannerRules.js';

test('admin schedule times are Cairo wall clock, DST-aware', () => {
  // Winter: Cairo is UTC+2.
  assert.equal(parseBannerScheduleInstant('2026-01-15T10:00').toISOString(), '2026-01-15T08:00:00.000Z');
  // Summer (DST): Cairo is UTC+3 — a hardcoded +02:00 would be an hour off.
  assert.equal(parseBannerScheduleInstant('2026-07-15T10:00').toISOString(), '2026-07-15T07:00:00.000Z');
});

test('schedule parsing: empty clears, zoned values pass through, garbage is flagged', () => {
  assert.equal(parseBannerScheduleInstant(''), null);
  assert.equal(parseBannerScheduleInstant(null), null);
  assert.equal(parseBannerScheduleInstant('2026-03-01T12:00:00.000Z').toISOString(), '2026-03-01T12:00:00.000Z');
  const date = new Date('2026-03-01T12:00:00Z');
  assert.equal(parseBannerScheduleInstant(date), date);
  assert.equal(parseBannerScheduleInstant('not a date'), undefined);
});

test('a banner round-trips through the admin form without shifting', () => {
  // The admin form shows Cairo time; saving that value must give back the same instant.
  const stored = new Date('2026-08-20T18:30:00.000Z');
  const cairo = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(stored).replace(' ', 'T');
  assert.equal(parseBannerScheduleInstant(cairo).toISOString(), stored.toISOString());
});

test('bannerIsLiveNow respects active flag and schedule window', () => {
  const now = new Date('2026-05-01T12:00:00Z');
  assert.equal(bannerIsLiveNow({ isActive: true }, now), true);
  assert.equal(bannerIsLiveNow({ isActive: false }, now), false);
  assert.equal(bannerIsLiveNow({ isActive: true, startsAt: '2026-05-02T00:00:00Z' }, now), false);
  assert.equal(bannerIsLiveNow({ isActive: true, endsAt: '2026-04-30T00:00:00Z' }, now), false);
  assert.equal(bannerIsLiveNow({ isActive: true, startsAt: '2026-04-01', endsAt: '2026-06-01' }, now), true);
  assert.equal(bannerIsLiveNow(null, now), false);
});

test('viewer audience comes from the signed-in user', () => {
  assert.equal(viewerAudience(null), 'guests');
  assert.equal(viewerAudience({ role: 'customer' }), 'customers');
  assert.equal(viewerAudience({ role: 'admin' }), 'staff');
  assert.deepEqual(audiencesForViewer('guests'), ['all', 'guests']);
  assert.deepEqual(audiencesForViewer('customers'), ['all', 'customers']);
  assert.ok(audiencesForViewer('staff').includes('staff'));
  assert.ok(!audiencesForViewer('guests').includes('staff'));
});

test('pickForAllViewers keeps enough banners for guests and customers', () => {
  const list = [
    { id: 1, targetAudience: 'guests' },
    { id: 2, targetAudience: 'guests' },
    { id: 3, targetAudience: 'guests' },
    { id: 4, targetAudience: 'all' },
    { id: 5, targetAudience: 'customers' },
    { id: 6, targetAudience: 'all' },
  ];
  const picked = pickForAllViewers(list, 2).map((b) => b.id);
  // Guests get 1,2; customers get 4,5 — banner 3 and 6 are not needed by anyone.
  assert.deepEqual(picked, [1, 2, 4, 5]);
  assert.equal(pickForAllViewers(list, null).length, list.length);
});

test('pickForAllViewers treats missing audience (manual slides) as everyone', () => {
  const picked = pickForAllViewers([{ id: 'a' }, { id: 'b' }, { id: 'c' }], 2);
  assert.deepEqual(picked.map((b) => b.id), ['a', 'b']);
});

test('fillBilingual copies the one language the admin typed', () => {
  assert.deepEqual(fillBilingual('عروض', ''), { ar: 'عروض', en: 'عروض' });
  assert.deepEqual(fillBilingual('', ' Offers '), { ar: 'Offers', en: 'Offers' });
  assert.deepEqual(fillBilingual('عروض', 'Offers'), { ar: 'عروض', en: 'Offers' });
  assert.deepEqual(fillBilingual(undefined, undefined), { ar: '', en: '' });
});
