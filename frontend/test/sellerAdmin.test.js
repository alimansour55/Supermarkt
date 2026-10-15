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
