import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  rangeFromPreset,
  feeFormFromSettings,
  feePayloadFromForm,
  cairoDayStart,
  describeRule,
  ruleState,
  sortRows,
  pctChange,
  previousRange,
  newPlan,
} from '../src/admin/utils/sellerFeesAdmin.js';

const NOW = new Date('2026-10-16T10:00:00Z');

test('range presets are Cairo calendar dates', () => {
  assert.deepEqual(rangeFromPreset('7d', NOW), { from: '2026-10-10', to: '2026-10-16' });
  assert.deepEqual(rangeFromPreset('month', NOW), { from: '2026-10-01', to: '2026-10-16' });
  assert.deepEqual(rangeFromPreset('lastMonth', NOW), { from: '2026-09-01', to: '2026-09-30' });
  assert.deepEqual(rangeFromPreset('lastMonth', new Date('2026-01-10T10:00:00Z')), { from: '2025-12-01', to: '2025-12-31' });
  assert.deepEqual(previousRange({ from: '2026-10-10', to: '2026-10-16' }), { from: '2026-10-03', to: '2026-10-09' });
});

test('cairoDayStart handles summer and winter time', () => {
  assert.equal(cairoDayStart('2026-07-01'), '2026-06-30T21:00:00.000Z'); // UTC+3
  assert.equal(cairoDayStart('2026-12-01'), '2026-11-30T22:00:00.000Z'); // UTC+2
});

test('settings → form → payload round-trips, keeping "inherit" as null', () => {
  const settings = {
    defaultCommissionRate: 10,
    fees: { fixedFeePerItem: 2, vatPercent: 14, paymentFees: [{ method: 'cod', percent: 0, fixed: 3 }] },
    plans: [{ key: 'pro', nameEn: 'Pro', commissionRate: 7, monthlyFee: 300, fixedFeePerItem: null }],
    commissionRules: [{ _id: 'r1', name: 'Ramadan', rate: 5, categories: ['c1'], startsAt: '2026-02-17T22:00:00.000Z', endsAt: '2026-03-19T22:00:00.000Z' }],
    payoutSchedule: { frequency: 'weekly', weekday: 4 },
  };
  const form = feeFormFromSettings(settings);
  assert.equal(form.commissionRules[0].startsAt, '2026-02-18');
  assert.equal(form.commissionRules[0].endsAt, '2026-03-19', 'end date shows the last included day');
  const payload = feePayloadFromForm(form);
  assert.equal(payload.plans[0].fixedFeePerItem, null);
  assert.equal(payload.plans[0].monthlyFee, 300);
  assert.equal(payload.fees.vatPercent, 14);
  assert.equal(payload.commissionRules[0].endsAt, '2026-03-19T22:00:00.000Z');
  assert.equal(payload.payoutSchedule.weekday, 4);
});

test('rule summaries and states read like plain language', () => {
  const rule = { categories: ['c1'], minPrice: '1000', maxPrice: '', fulfillment: 'store', active: true, startsAt: '2026-10-20', endsAt: '' };
  assert.equal(describeRule(rule, { categoryName: () => 'Phones' }), 'Phones · store-shipped · 1000+ EGP · from 2026-10-20');
  assert.equal(describeRule({}, {}), 'All sales');
  assert.equal(ruleState(rule, NOW), 'scheduled');
  assert.equal(ruleState({ ...rule, startsAt: '', endsAt: '2026-10-01' }, NOW), 'ended');
  assert.equal(ruleState({ ...rule, active: false }, NOW), 'off');
  assert.equal(ruleState({ ...rule, startsAt: '' }, NOW), 'live');
});

test('helpers: sorting, percent change, plan keys', () => {
  const rows = [{ seller: { nameEn: 'b' }, netProfit: 5 }, { seller: { nameEn: 'a' }, netProfit: 9 }];
  assert.deepEqual(sortRows(rows, 'netProfit').map((r) => r.netProfit), [9, 5]);
  assert.deepEqual(sortRows(rows, 'name', 'asc').map((r) => r.seller.nameEn), ['a', 'b']);
  assert.equal(pctChange(150, 100), 50);
  assert.equal(pctChange(5, 0), null);
  assert.equal(newPlan([{ key: 'plan-2' }]).key, 'plan-3');
  assert.equal(newPlan([]).isDefault, true);
});
