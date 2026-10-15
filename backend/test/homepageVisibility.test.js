import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  inDailyWindow,
  normalizeAnchor,
  normalizeAppearance,
  normalizeVisibility,
  reconcileDevices,
  sectionIsLiveNow,
  sectionScheduleStatus,
  storeClock,
  stripAdminFields,
} from '../src/utils/homepageVisibility.js';

// 2026-01-15 is a Thursday; Cairo is UTC+2 in winter and UTC+3 in summer (DST).
const cairo = (iso, offset = '+02:00') => new Date(`${iso}${offset}`);

test('storeClock reads the Cairo wall clock, including DST', () => {
  assert.deepEqual(storeClock(new Date('2026-01-15T08:30:00Z')), { weekday: 4, minutes: 10 * 60 + 30 });
  // Summer: UTC 07:30 is 10:30 in Cairo, not 09:30.
  assert.deepEqual(storeClock(new Date('2026-07-16T07:30:00Z')), { weekday: 4, minutes: 10 * 60 + 30 });
  // Just after Cairo midnight the weekday has already moved on.
  assert.equal(storeClock(new Date('2026-01-15T22:30:00Z')).weekday, 5);
});

test('schedule dates are store wall clock and validated', () => {
  const v = normalizeVisibility({ startsAt: '2026-07-15T10:00', endsAt: '2026-07-20T22:00' });
  assert.equal(v.startsAt.toISOString(), '2026-07-15T07:00:00.000Z');
  assert.equal(v.endsAt.toISOString(), '2026-07-20T19:00:00.000Z');
  assert.equal(normalizeVisibility({ startsAt: '' }).startsAt, null);
  assert.throws(() => normalizeVisibility({ startsAt: 'nope' }), /invalid date/);
  assert.throws(
    () => normalizeVisibility({ startsAt: '2026-07-15T10:00', endsAt: '2026-07-15T09:00' }),
    /end after it starts/,
  );
});

test('visibility normalizes days, times, audience, devices and zones', () => {
  const v = normalizeVisibility({
    days: [5, '5', 1, 9, -1, 'x'],
    timeFrom: '07:00',
    timeTo: '25:00',
    audience: 'returning_customers',
    devices: 'phone',
    zones: ['a', 'a', ' b ', ''],
  });
  assert.deepEqual(v.days, [1, 5]);
  assert.equal(v.timeFrom, '07:00');
  assert.equal(v.timeTo, '');
  assert.equal(v.audience, 'returning_customers');
  assert.equal(v.devices, 'all');
  assert.deepEqual(v.zones, ['a', 'b']);
  assert.deepEqual(normalizeVisibility({ days: [0, 1, 2, 3, 4, 5, 6] }).days, []);
  assert.equal(normalizeVisibility(undefined).audience, 'all');
});

test('daily time windows, including ones that run past midnight', () => {
  const breakfast = { timeFrom: '07:00', timeTo: '11:00' };
  assert.equal(inDailyWindow(breakfast, cairo('2026-01-15T07:00:00')), true);
  assert.equal(inDailyWindow(breakfast, cairo('2026-01-15T10:59:00')), true);
  assert.equal(inDailyWindow(breakfast, cairo('2026-01-15T11:00:00')), false);
  assert.equal(inDailyWindow(breakfast, cairo('2026-01-15T06:59:00')), false);

  const lateNight = { timeFrom: '22:00', timeTo: '02:00', days: [4] }; // Thursday nights
  assert.equal(inDailyWindow(lateNight, cairo('2026-01-15T23:00:00')), true);
  // 01:00 Friday still belongs to Thursday's window.
  assert.equal(inDailyWindow(lateNight, cairo('2026-01-16T01:00:00')), true);
  assert.equal(inDailyWindow(lateNight, cairo('2026-01-16T23:00:00')), false);
  assert.equal(inDailyWindow(lateNight, cairo('2026-01-15T12:00:00')), false);

  assert.equal(inDailyWindow({ days: [5, 6] }, cairo('2026-01-15T12:00:00')), false);
  assert.equal(inDailyWindow({ days: [4] }, cairo('2026-01-15T12:00:00')), true);
  assert.equal(inDailyWindow({}, cairo('2026-01-15T12:00:00')), true);
  // Only an end time: open from midnight.
  assert.equal(inDailyWindow({ timeTo: '09:00' }, cairo('2026-01-15T08:00:00')), true);
  assert.equal(inDailyWindow({ timeTo: '09:00' }, cairo('2026-01-15T09:30:00')), false);
});

test('schedule status covers before, after and outside hours', () => {
  const now = new Date('2026-05-01T12:00:00Z');
  assert.equal(sectionScheduleStatus({}, now), 'live');
  assert.equal(sectionScheduleStatus({ startsAt: '2026-05-02T00:00:00Z' }, now), 'scheduled');
  assert.equal(sectionScheduleStatus({ endsAt: '2026-04-30T00:00:00Z' }, now), 'ended');
  assert.equal(sectionScheduleStatus({ timeFrom: '20:00', timeTo: '23:00' }, now), 'off_hours');
  assert.equal(sectionIsLiveNow({ isActive: false }, now), false);
  assert.equal(sectionIsLiveNow({ isActive: true }, now), true);
  assert.equal(sectionIsLiveNow({ isActive: true, visibility: { endsAt: '2026-04-01' } }, now), false);
});

test('showOnMobile and devices stay in sync, whichever was sent', () => {
  // Old quick toggle: only showOnMobile sent.
  const hide = reconcileDevices({ showOnMobile: false, visibility: { devices: 'all' } }, { showOnMobile: false });
  assert.equal(hide.visibility.devices, 'desktop');
  assert.equal(hide.showOnMobile, false);
  const show = reconcileDevices({ showOnMobile: true, visibility: { devices: 'desktop' } }, { showOnMobile: true });
  assert.equal(show.visibility.devices, 'all');
  // New form: devices wins and showOnMobile follows.
  const mobileOnly = reconcileDevices(
    { showOnMobile: false, visibility: { devices: 'mobile' } },
    { showOnMobile: false, visibility: { devices: 'mobile' } },
  );
  assert.equal(mobileOnly.showOnMobile, true);
  assert.equal(mobileOnly.visibility.devices, 'mobile');
  // An unrelated edit to an old "hidden on mobile" section keeps it hidden on mobile.
  const legacy = reconcileDevices({ showOnMobile: false, isActive: true, visibility: { devices: 'all' } }, { isActive: true });
  assert.equal(legacy.visibility.devices, 'desktop');
  assert.equal(legacy.showOnMobile, false);
  // ...and an edit to a mobile-only section doesn't widen it.
  const keep = reconcileDevices({ showOnMobile: true, visibility: { devices: 'mobile' } }, { titleEn: 'x' });
  assert.equal(keep.visibility.devices, 'mobile');
});

test('appearance rejects unsafe values and falls back to no background', () => {
  const ok = normalizeAppearance({ background: 'custom', backgroundColor: '#FFEEDD', spaceAbove: 'lg', anchor: 'Ramadan Offers!' });
  assert.equal(ok.background, 'custom');
  assert.equal(ok.backgroundColor, '#ffeedd');
  assert.equal(ok.spaceAbove, 'lg');
  assert.equal(ok.anchor, 'ramadan-offers');
  assert.equal(normalizeAppearance({ background: 'custom', backgroundColor: 'red;}' }).background, 'none');
  assert.equal(normalizeAppearance({ background: 'image', backgroundImage: 'javascript:alert(1)' }).background, 'none');
  assert.equal(normalizeAppearance({ background: 'image', backgroundImage: 'https://x.test/a.jpg)' }).background, 'none');
  assert.equal(normalizeAppearance({ background: 'image', backgroundImage: 'https://x.test/a.jpg' }).background, 'image');
  assert.equal(normalizeAppearance({ width: 'huge' }).width, 'full');
  assert.equal(normalizeAnchor('عروض رمضان'), 'عروض-رمضان');
});

test('admin label and notes never reach the storefront', () => {
  const out = stripAdminFields({ _id: 1, titleEn: 'Hi', adminLabel: 'x', adminNotes: 'secret' });
  assert.deepEqual(out, { _id: 1, titleEn: 'Hi' });
});
