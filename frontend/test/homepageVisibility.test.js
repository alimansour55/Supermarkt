import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  audienceMatches,
  inDailyWindow,
  isDarkColor,
  sectionDevices,
  sectionScheduleStatus,
  sectionShellProps,
  sectionVisibleTo,
  storeClock,
  viewerKind,
  zoneMatches,
} from '../src/utils/homepageVisibility.js';

const cairo = (iso, offset = '+02:00') => new Date(`${iso}${offset}`);

test('store clock and daily windows match the backend rules', () => {
  assert.deepEqual(storeClock(new Date('2026-07-16T07:30:00Z')), { weekday: 4, minutes: 630 });
  const lateNight = { timeFrom: '22:00', timeTo: '02:00', days: [4] };
  assert.equal(inDailyWindow(lateNight, cairo('2026-01-15T23:00:00')), true);
  assert.equal(inDailyWindow(lateNight, cairo('2026-01-16T01:00:00')), true);
  assert.equal(inDailyWindow(lateNight, cairo('2026-01-16T03:00:00')), false);
  assert.equal(sectionScheduleStatus({ endsAt: '2026-01-01T00:00:00Z' }, new Date('2026-02-01')), 'ended');
  assert.equal(sectionScheduleStatus({ startsAt: '2027-01-01T00:00:00Z' }, new Date('2026-02-01')), 'scheduled');
});

test('viewer kinds and audiences', () => {
  assert.equal(viewerKind(null), 'guest');
  assert.equal(viewerKind({ role: 'customer' }), 'customer');
  assert.equal(viewerKind({ hasOrdered: false }), 'new');
  assert.equal(viewerKind({ hasOrdered: true }), 'returning');

  assert.equal(audienceMatches('all', 'guest'), true);
  assert.equal(audienceMatches('guests', 'guest'), true);
  assert.equal(audienceMatches('guests', 'new'), false);
  assert.equal(audienceMatches('customers', 'returning'), true);
  assert.equal(audienceMatches('customers', 'guest'), false);
  assert.equal(audienceMatches('new_customers', 'new'), true);
  // Order history not known yet: neither new nor returning.
  assert.equal(audienceMatches('new_customers', 'customer'), false);
  assert.equal(audienceMatches('returning_customers', 'customer'), false);
  assert.equal(audienceMatches('returning_customers', 'returning'), true);
});

test('zones: empty means everywhere, otherwise the visitor zone must be listed', () => {
  assert.equal(zoneMatches([], null), true);
  assert.equal(zoneMatches(undefined, 'a'), true);
  assert.equal(zoneMatches(['a', 'b'], 'b'), true);
  assert.equal(zoneMatches(['a'], 'c'), false);
  assert.equal(zoneMatches(['a'], null), false);
});

test('before hydration everyone is a guest with no zone and no clock check', () => {
  const guestsOnly = { visibility: { audience: 'guests' } };
  const customersOnly = { visibility: { audience: 'customers' } };
  const zoned = { visibility: { zones: ['z1'] } };
  const ended = { visibility: { endsAt: '2020-01-01T00:00:00Z' } };
  const ssr = {};
  assert.equal(sectionVisibleTo(guestsOnly, ssr), true);
  assert.equal(sectionVisibleTo(customersOnly, ssr), false);
  assert.equal(sectionVisibleTo(zoned, ssr), false);
  assert.equal(sectionVisibleTo(ended, ssr), true, 'the server already filtered by time');
  assert.equal(sectionVisibleTo(ended, { now: new Date() }), false, 'a stale cached page drops it after hydration');
  assert.equal(sectionVisibleTo(zoned, { zoneId: 'z1' }), true);
  assert.equal(sectionVisibleTo(customersOnly, { viewer: 'returning' }), true);
});

test('device rule falls back to the old mobile flag', () => {
  assert.equal(sectionDevices({ showOnMobile: false }), 'desktop');
  assert.equal(sectionDevices({ showOnMobile: false, visibility: { devices: 'all' } }), 'desktop');
  assert.equal(sectionDevices({ visibility: { devices: 'mobile' } }), 'mobile');
  assert.equal(sectionDevices({}), 'all');
});

test('shell: no wrapper unless something needs one', () => {
  assert.equal(sectionShellProps({}), null);
  assert.equal(sectionShellProps({ appearance: { background: 'custom' } }), null, 'custom without a colour is ignored');

  const mobile = sectionShellProps({ visibility: { devices: 'mobile' } });
  assert.equal(mobile.outer.className, 'contents md:hidden', 'display: contents keeps sticky bars working');
  assert.equal(mobile.box, null);

  const styled = sectionShellProps({
    showOnMobile: false,
    appearance: { background: 'image', backgroundImage: 'https://x.test/a.jpg', overlay: 'strong', width: 'contained', spaceAbove: 'lg', anchor: 'deals' },
  });
  assert.equal(styled.outer.id, 'deals');
  assert.match(styled.outer.className, /hidden md:block/);
  assert.match(styled.outer.className, /mt-12/);
  assert.equal(styled.contained, true);
  assert.match(styled.box.className, /rounded-3xl/);
  assert.equal(styled.box.style.backgroundImage, 'url("https://x.test/a.jpg")');
  assert.equal(styled.overlay, 'bg-white/85');

  const tinted = sectionShellProps({ appearance: { background: 'brand' } });
  assert.match(tinted.box.className, /bg-primary-50/);
  assert.equal(tinted.contained, false);
});

test('dark colour warning', () => {
  assert.equal(isDarkColor('#111111'), true);
  assert.equal(isDarkColor('#1d4ed8'), true);
  assert.equal(isDarkColor('#fef3c7'), false);
  assert.equal(isDarkColor('#fff'), false);
  assert.equal(isDarkColor('nope'), false);
});

test('anchors are cleaned the same way the server cleans them', async () => {
  const { normalizeAnchor } = await import('../src/utils/homepageVisibility.js');
  assert.equal(normalizeAnchor('QA Test Block!'), 'qa-test-block');
  assert.equal(normalizeAnchor('عروض رمضان'), 'عروض-رمضان');
  assert.equal(sectionShellProps({ appearance: { anchor: 'Hello There' } }).outer.id, 'hello-there');
});
