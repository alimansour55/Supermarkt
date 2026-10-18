/** Share & earn link memory — runs with a fake browser storage. */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const store = () => {
  const data = new Map();
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
  };
};
globalThis.localStorage = store();
globalThis.sessionStorage = store();

const {
  readAffiliateRef, saveAffiliateRef, clearAffiliateRef, markRefSeen, withAffiliateRef, isRefCode,
} = await import('../src/utils/affiliateRef.js');

beforeEach(() => {
  globalThis.localStorage = store();
  globalThis.sessionStorage = store();
});

test('remembers the code for the attribution window, then forgets it', () => {
  const now = Date.UTC(2026, 9, 16);
  saveAffiliateRef('mona2026', 7, now);
  assert.equal(readAffiliateRef(now + 6 * 86400000), 'MONA2026');
  assert.equal(readAffiliateRef(now + 8 * 86400000), null);
});

test('last link wins and checkout can clear it', () => {
  saveAffiliateRef('FIRST01', 7);
  saveAffiliateRef('SECOND02', 7);
  assert.equal(readAffiliateRef(), 'SECOND02');
  clearAffiliateRef();
  assert.equal(readAffiliateRef(), null);
});

test('one click per code per session', () => {
  assert.equal(markRefSeen('abcd'), true);
  assert.equal(markRefSeen('ABCD'), false);
  assert.equal(markRefSeen('OTHER1'), true);
});

test('adds ?ref to any store link, keeping its query and hash', () => {
  assert.equal(
    withAffiliateRef('https://shop.test/ar/products/milk?size=1l#reviews', 'mona'),
    'https://shop.test/ar/products/milk?size=1l&ref=MONA#reviews',
  );
  assert.equal(withAffiliateRef('https://shop.test/en?ref=OLD1', 'NEW1'), 'https://shop.test/en?ref=NEW1');
  assert.equal(isRefCode('ab'), false);
  assert.equal(isRefCode('Mona_2026'), true);
});
