import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatHistoryValue, historyLines, splitDealPayload, describeScheduledChanges, historyFieldLabel, RATE_SOURCES,
} from '../src/admin/utils/sellerDeal.js';

const lookup = { category: (id) => ({ c1: 'Food', c2: 'Home' }[id]), plan: (k) => ({ pro: 'Pro plan' }[k]) };

test('formatHistoryValue: rates, categories, plans, dates, frequencies', () => {
  assert.equal(formatHistoryValue('commissionRate', 7), '7%');
  assert.equal(formatHistoryValue('commissionRate', null), '—');
  assert.equal(formatHistoryValue('categoryCommissions', [{ category: 'c1', rate: 5 }, { category: 'c2', rate: 3 }], { lookup }), 'Food 5%، Home 3%');
  assert.equal(formatHistoryValue('feePlan', 'pro', { lookup }), 'Pro plan');
  assert.equal(formatHistoryValue('feePlan', 'gone', { lookup }), 'gone');
  assert.equal(formatHistoryValue('feeOverrides.payoutFrequency', 'monthly'), 'Monthly');
  assert.equal(formatHistoryValue('feeOverrides.payoutFrequency', 'monthly', { isAr: true }), 'شهرياً');
  assert.equal(formatHistoryValue('feeOverrides.vatExempt', true), 'Yes');
  // Stored as the instant after the last free Cairo day → shows that last day.
  assert.equal(formatHistoryValue('feeOverrides.commissionFreeUntil', '2026-10-31T22:00:00.000Z'), '31 Oct 2026');
});

test('historyLines hides bookkeeping keys and formats login actions as one value', () => {
  const lines = historyLines({
    changes: {
      commissionRate: { from: null, to: 7 },
      note: { from: null, to: 'Q4' },
      via: { from: null, to: 'schedule' },
      'login.password_set': { from: null, to: { user: 'a@b.c', mustChange: true } },
    },
  });
  assert.deepEqual(lines.map((l) => l.key), ['commissionRate', 'login.password_set']);
  assert.equal(lines[0].from, '—');
  assert.equal(lines[0].to, '7%');
  assert.equal(lines[1].single, true);
  assert.equal(lines[1].to, 'a@b.c');
  assert.equal(lines[1].label, 'Set a temporary password');
});

test('splitDealPayload sends only changed deal fields to the schedule', () => {
  const initial = { commissionRate: null, feePlan: '', feeOverrides: { monthlyFee: null }, handlingDays: 2, internalNote: '' };
  const next = { commissionRate: 5, feePlan: '', feeOverrides: { monthlyFee: null }, handlingDays: 3, internalNote: '' };
  assert.deepEqual(splitDealPayload(next, initial), { deal: { commissionRate: 5 }, rest: { handlingDays: 3 } });
  assert.deepEqual(splitDealPayload(initial, initial), { deal: {}, rest: {} });
});

test('describeScheduledChanges lists set values only', () => {
  const lines = describeScheduledChanges({ commissionRate: 5, feeOverrides: { monthlyFee: 300, fixedFeePerItem: null, vatExempt: false } });
  assert.deepEqual(lines, ['Negotiated commission: 5%', 'Monthly fee: 300']);
});

test('every rate source and unknown fields have a label', () => {
  for (const k of ['seller_free', 'rule', 'seller_category', 'seller', 'category', 'plan', 'default']) assert.ok(RATE_SOURCES[k].en);
  assert.equal(historyFieldLabel('somethingNew', false), 'somethingNew');
});

test('bulkDealChanges sends only what was chosen', async () => {
  const { bulkDealChanges, KEEP } = await import('../src/admin/utils/sellerDeal.js');
  const base = { feePlan: KEEP, rateMode: 'keep', rate: '', freeMode: 'keep', freeUntil: '', payoutFrequency: KEEP };
  assert.deepEqual(bulkDealChanges(base), {});
  assert.deepEqual(bulkDealChanges({ ...base, feePlan: '', rateMode: 'clear' }), { feePlan: '', commissionRate: null });
  assert.deepEqual(bulkDealChanges({ ...base, rateMode: 'set', rate: '7.5', payoutFrequency: 'monthly' }), { commissionRate: 7.5, feeOverrides: { payoutFrequency: 'monthly' } });
  // Free through 31 Oct → the instant 1 Nov starts in Cairo (UTC+2 once summer time has ended).
  const free = bulkDealChanges({ ...base, freeMode: 'set', freeUntil: '2026-10-31' });
  assert.equal(free.feeOverrides.commissionFreeUntil, '2026-10-31T22:00:00.000Z');
  assert.deepEqual(bulkDealChanges({ ...base, freeMode: 'clear' }), { feeOverrides: { commissionFreeUntil: null } });
});

test('activityLabel names known actions and falls back to the raw key', async () => {
  const { activityLabel } = await import('../src/admin/utils/sellerDeal.js');
  assert.equal(activityLabel('staff.password_set', false), 'set a temporary password');
  assert.equal(activityLabel('security.login', true), 'سجّل الدخول');
  assert.equal(activityLabel('weird.thing', false), 'weird.thing');
});

test('history formats product commission and warnings', async () => {
  const { formatHistoryValue, historyLines } = await import('../src/admin/utils/sellerDeal.js');
  assert.equal(formatHistoryValue('productCommission', { product: 'Honey', rate: 4 }), 'Honey: 4%');
  assert.equal(formatHistoryValue('productCommission', { product: 'Honey', rate: null }), 'Honey: seller deal');
  const [line] = historyLines({ changes: { warning: { from: null, to: { strike: true, text: 'Late again' } } } });
  assert.deepEqual([line.single, line.to], [true, 'Strike: Late again']);
});
