import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  sellerLoginUrl,
  sellerSignupUrl,
  sellerInviteMessage,
  sellerChecklist,
  sellersToCsv,
} from '../src/admin/utils/sellerAdmin.js';

test('portal links: login is not language-prefixed, signup is', () => {
  assert.equal(sellerLoginUrl('https://shop.eg/'), 'https://shop.eg/seller-center/login');
  assert.equal(sellerSignupUrl('https://shop.eg', 'en'), 'https://shop.eg/en/sell-with-us');
  assert.equal(sellerSignupUrl('https://shop.eg', 'fr'), 'https://shop.eg/ar/sell-with-us');
});

test('invite message carries both links when a password link exists', () => {
  const msg = sellerInviteMessage({
    storeName: 'Nile Honey',
    email: 'a@b.eg',
    loginUrl: 'https://shop.eg/seller-center/login',
    setupUrl: 'https://shop.eg/seller-center/reset-password/abc',
  });
  assert.match(msg, /reset-password\/abc/);
  assert.match(msg, /seller-center\/login/);
  assert.match(msg, /Nile Honey/);
  const plain = sellerInviteMessage({ loginUrl: 'https://shop.eg/seller-center/login' });
  assert.doesNotMatch(plain, /reset-password|Set your password/);
});

test('checklist marks what is missing before approval', () => {
  const missing = sellerChecklist({ email: 'a@b.eg', phone: '+20', contactName: 'A', documents: [], bank: {}, team: [] });
  assert.deepEqual(missing.map((i) => [i.key, i.done]), [['contact', true], ['documents', false], ['bank', false], ['login', false]]);

  const ready = sellerChecklist({
    email: 'a@b.eg',
    phone: '+20',
    contactName: 'A',
    documents: [{ status: 'accepted' }],
    bank: { iban: '••1234' },
    team: [{ role: 'seller_owner', lastLoginAt: '2026-10-01' }],
  });
  assert.ok(ready.every((i) => i.done));

  const pendingDoc = sellerChecklist({ documents: [{ status: 'accepted' }, { status: 'pending' }] });
  assert.equal(pendingDoc.find((i) => i.key === 'documents').done, false);
});

test('CSV escapes commas/quotes and starts with a BOM for Excel', () => {
  const csv = sellersToCsv([{ nameAr: 'متجر', nameEn: 'Shop, "Best"', status: 'active', products: { live: 3, pending: 1 } }]);
  assert.ok(csv.startsWith('﻿'));
  assert.match(csv, /"Shop, ""Best"""/);
  assert.equal(csv.split('\r\n').length, 2);
});

test('generateTempPassword: readable and always strong', async () => {
  const { generateTempPassword, isStrongSellerPassword } = await import('../src/admin/utils/sellerAdmin.js');
  for (let i = 0; i < 200; i += 1) {
    const p = generateTempPassword();
    assert.equal(p.length, 10);
    assert.ok(isStrongSellerPassword(p), p);
    assert.doesNotMatch(p, /[0O1lI]/);
  }
  assert.equal(generateTempPassword(() => 0), 'aaaaaa2222');
  assert.equal(generateTempPassword(() => 0.9999999), 'ZZZZZZ9999');
});

test('isStrongSellerPassword mirrors the backend rule', async () => {
  const { isStrongSellerPassword } = await import('../src/admin/utils/sellerAdmin.js');
  assert.equal(isStrongSellerPassword('abc12345'), true);
  assert.equal(isStrongSellerPassword('كلمةسر123'), true);
  assert.equal(isStrongSellerPassword('abcdefgh'), false);
  assert.equal(isStrongSellerPassword('1234567'), false);
  assert.equal(isStrongSellerPassword(''), false);
});

test('loginBadges orders problems first', async () => {
  const { loginBadges } = await import('../src/admin/utils/sellerAdmin.js');
  const now = new Date('2026-10-16T10:00:00Z');
  assert.deepEqual(loginBadges({ isActive: false, lockedUntil: '2026-10-16T10:05:00Z', mustChangePassword: true, twoFactorEnabled: true, lastLoginAt: '2026-10-01' }, now), ['off', 'locked', 'temp_password', 'two_factor']);
  assert.deepEqual(loginBadges({ lockedUntil: '2026-10-16T09:00:00Z', lastLoginAt: '2026-10-01' }, now), [], 'expired lock is not shown');
  assert.deepEqual(loginBadges({}, now), ['never']);
});

test('deviceLabel and tempPasswordMessage', async () => {
  const { deviceLabel, tempPasswordMessage } = await import('../src/admin/utils/sellerAdmin.js');
  assert.equal(deviceLabel('Mozilla/5.0 (Windows NT 10.0) Chrome/120 Safari/537'), 'Chrome · Windows');
  assert.equal(deviceLabel('Mozilla/5.0 (iPhone) Version/17 Safari/604'), 'Safari · iOS');
  assert.equal(deviceLabel(''), 'Browser');
  const msg = tempPasswordMessage({ storeName: 'Shop', email: 'a@b.c', password: 'abcdef2345', loginUrl: 'https://x/seller-center/login' });
  assert.match(msg, /abcdef2345/);
  assert.match(msg, /https:\/\/x\/seller-center\/login/);
});
