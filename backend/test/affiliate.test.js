/** Share & earn rules — pure, no database. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  affiliateBaseAmount,
  calculateAffiliateReward,
  checkAffiliateAttribution,
  describeAffiliateReward,
  effectiveAffiliateRate,
  generateAffiliateCode,
  holdUntilFrom,
  isValidAffiliateCode,
  normalizeAffiliateSettings,
} from '../src/utils/affiliateRules.js';

const ON = { enabled: true, minOrderTotal: 0, maxRewardPerOrder: 0 };
const order = (over = {}) => ({ subtotal: 500, discount: 0, pointsDiscount: 0, deliveryFee: 30, total: 530, ...over });

test('settings: defaults, clamping and unknown values', () => {
  const s = normalizeAffiliateSettings({});
  assert.equal(s.enabled, false);
  assert.equal(s.rewardType, 'wallet');
  const odd = normalizeAffiliateSettings({ percent: 250, holdDays: -3, rewardType: 'cash', attributionDays: 0 });
  assert.equal(odd.percent, 100);
  assert.equal(odd.holdDays, 0);
  assert.equal(odd.rewardType, 'wallet');
  assert.equal(odd.attributionDays, 1);
});

test('base amount: products after discounts and refunds, never delivery', () => {
  assert.equal(affiliateBaseAmount(order()), 500);
  assert.equal(affiliateBaseAmount(order({ discount: 50, pointsDiscount: 20 })), 430);
  assert.equal(affiliateBaseAmount(order({ refundAmount: 600 })), 0);
});

test('percent reward in wallet money', () => {
  const r = calculateAffiliateReward({ settings: { ...ON, percent: 5 }, order: order() });
  assert.equal(r.eligible, true);
  assert.equal(r.rewardType, 'wallet');
  assert.equal(r.rewardAmount, 25);
  assert.equal(r.cashValue, 25);
});

test('percent reward is capped per order', () => {
  const r = calculateAffiliateReward({ settings: { ...ON, percent: 10, maxRewardPerOrder: 30 }, order: order() });
  assert.equal(r.rewardAmount, 30);
});

test('points reward converts money using the point value', () => {
  // 5% of 500 = EGP 25; 1 point = EGP 0.1 → 250 points
  const r = calculateAffiliateReward({
    settings: { ...ON, rewardType: 'points', percent: 5 }, order: order(), pointValueEGP: 0.1,
  });
  assert.equal(r.rewardAmount, 250);
  assert.equal(r.cashValue, 25);
});

test('fixed points per order, cap in points', () => {
  const r = calculateAffiliateReward({
    settings: { ...ON, rewardType: 'points', calcType: 'fixed', fixedAmount: 200, maxRewardPerOrder: 150 },
    order: order(),
    pointValueEGP: 0.1,
  });
  assert.equal(r.rewardAmount, 150);
  assert.equal(r.cashValue, 15);
});

test('fixed reward shrinks with a partial return', () => {
  const settings = { ...ON, calcType: 'fixed', fixedAmount: 40 };
  assert.equal(calculateAffiliateReward({ settings, order: order() }).rewardAmount, 40);
  assert.equal(calculateAffiliateReward({ settings, order: order({ refundAmount: 250 }) }).rewardAmount, 20);
});

test('minimum order is checked on the original value', () => {
  const settings = { ...ON, percent: 5, minOrderTotal: 300 };
  assert.equal(calculateAffiliateReward({ settings, order: order({ subtotal: 200 }) }).reason, 'below_minimum');
  // a return that drops the value under the minimum still keeps a smaller reward
  const after = calculateAffiliateReward({ settings, order: order({ refundAmount: 300 }) });
  assert.equal(after.eligible, true);
  assert.equal(after.rewardAmount, 10);
});

test('custom affiliate deal overrides the program rate', () => {
  const rate = effectiveAffiliateRate({ ...ON, percent: 3 }, { customCalcType: 'percent', customPercent: 8 });
  assert.deepEqual([rate.calcType, rate.percent, rate.custom], ['percent', 8, true]);
  const r = calculateAffiliateReward({
    settings: { ...ON, percent: 3 }, affiliate: { customCalcType: 'percent', customPercent: 8 }, order: order(),
  });
  assert.equal(r.rewardAmount, 40);
  assert.equal(effectiveAffiliateRate({ ...ON }, { customCalcType: null }).custom, false);
});

test('attribution: blocks self-referral, same phone, inactive links and limits', () => {
  const affiliate = { status: 'active' };
  const owner = { _id: 'a', phone: '01012345678' };
  const buyer = { _id: 'b', phone: '01198765432' };
  const base = { settings: ON, affiliate, owner, buyer };
  assert.equal(checkAffiliateAttribution(base).ok, true);
  assert.equal(checkAffiliateAttribution({ ...base, settings: { enabled: false } }).reason, 'program_off');
  assert.equal(checkAffiliateAttribution({ ...base, buyer: { _id: 'a' } }).reason, 'self_referral');
  assert.equal(checkAffiliateAttribution({ ...base, buyer: { _id: 'c', phone: '+20 101 234 5678' } }).reason, 'self_referral');
  assert.equal(checkAffiliateAttribution({ ...base, affiliate: { status: 'paused' } }).reason, 'link_inactive');
  assert.equal(
    checkAffiliateAttribution({ ...base, settings: { ...ON, newCustomersOnly: true }, buyerPastOrders: 2 }).reason,
    'not_new_customer',
  );
  assert.equal(
    checkAffiliateAttribution({ ...base, settings: { ...ON, maxRewardedOrdersPerBuyer: 1 }, rewardedOrdersFromBuyer: 1 }).reason,
    'buyer_limit',
  );
});

test('codes: generated codes are valid; validation rules', () => {
  for (let i = 0; i < 50; i += 1) assert.ok(isValidAffiliateCode(generateAffiliateCode()));
  assert.ok(isValidAffiliateCode('ahmed_2026'));
  assert.equal(isValidAffiliateCode('ab'), false);
  assert.equal(isValidAffiliateCode('-start'), false);
  assert.equal(isValidAffiliateCode('مرحبا'), false);
});

test('hold period and description', () => {
  const until = holdUntilFrom(new Date('2026-10-01T00:00:00Z'), 7);
  assert.equal(until.toISOString(), '2026-10-08T00:00:00.000Z');
  assert.match(describeAffiliateReward({ ...ON, percent: 5 }, { lang: 'en' }), /5% of the order in your wallet/);
  assert.match(describeAffiliateReward({ ...ON, rewardType: 'points', calcType: 'fixed', fixedAmount: 50 }, { lang: 'ar' }), /50 نقطة/);
});
