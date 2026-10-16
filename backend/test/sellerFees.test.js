/** Seller fee engine — pure, no database. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  effectiveFeeConfig,
  resolveCommission,
  computeShipmentFees,
  computeReturnReversal,
  unitCommission,
  payoutRunKey,
  cairoMonthKey,
} from '../src/utils/sellerFees.js';

const FOOD = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const SNACKS = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const PHONES = 'cccccccccccccccccccccccc';
const SELLER = { _id: 'dddddddddddddddddddddddd', approvedAt: new Date('2026-10-01') };
const snack = { category: SNACKS, categoryAncestors: [FOOD], mainCategory: FOOD };
const phone = { category: PHONES, mainCategory: PHONES };
const NOW = new Date('2026-10-16T10:00:00Z');

const base = {
  defaultCommissionRate: 10,
  storeFulfillmentFeePerItem: 5,
  payoutHoldDays: 14,
  categoryCommissions: [{ category: FOOD, rate: 6 }],
  fees: {},
  plans: [],
  commissionRules: [],
};

test('category rate applies to subcategories; default otherwise', () => {
  assert.equal(resolveCommission({ settings: base, product: snack, now: NOW }).rate, 6);
  assert.equal(resolveCommission({ settings: base, product: phone, now: NOW }).rate, 10);
});

test('seller deals beat normal rules; campaign rules beat seller deals', () => {
  const seller = { ...SELLER, commissionRate: 4 };
  const rule = { name: 'Phones', rate: 8, categories: [PHONES] };
  const s1 = { ...base, commissionRules: [rule] };
  assert.equal(resolveCommission({ settings: s1, product: phone, now: NOW }).rate, 8);
  assert.equal(resolveCommission({ settings: s1, seller, product: phone, now: NOW }).rate, 4);
  const s2 = { ...base, commissionRules: [{ ...rule, overrideSellerDeals: true }] };
  const r = resolveCommission({ settings: s2, seller, product: phone, now: NOW });
  assert.equal(r.rate, 8);
  assert.equal(r.label, 'Phones');
});

test('rules respect price bands, dates, fulfillment and new-seller windows (first match wins)', () => {
  const settings = {
    ...base,
    commissionRules: [
      { name: 'Expired', rate: 1, endsAt: '2026-10-01' },
      { name: 'Premium', rate: 5, minPrice: 1000 },
      { name: 'FBS', rate: 7, fulfillment: 'store' },
      { name: 'Welcome', rate: 2, newSellerDays: 30 },
    ],
  };
  const at = (unitPrice, fulfilledBy, seller = null) => resolveCommission({ settings, seller, product: phone, unitPrice, fulfilledBy, now: NOW }).label;
  assert.equal(at(1500, 'seller'), 'Premium');
  assert.equal(at(100, 'store'), 'FBS');
  assert.equal(at(100, 'seller', SELLER), 'Welcome');
  assert.equal(at(100, 'seller', { ...SELLER, approvedAt: new Date('2026-01-01') }), '');
});

test('plans, seller overrides and commission-free periods', () => {
  const settings = {
    ...base,
    fees: { fixedFeePerItem: 3 },
    plans: [
      { key: 'basic', nameEn: 'Basic', isDefault: true, commissionRate: 12, monthlyFee: 0 },
      { key: 'pro', nameEn: 'Pro', commissionRate: 8, fixedFeePerItem: 0, monthlyFee: 299 },
    ],
  };
  assert.equal(resolveCommission({ settings, product: phone, now: NOW }).rate, 12);
  const pro = { ...SELLER, feePlan: 'pro' };
  assert.equal(resolveCommission({ settings, seller: pro, product: phone, now: NOW }).rate, 8);
  assert.equal(effectiveFeeConfig(settings, pro).monthlyFee, 299);
  assert.equal(effectiveFeeConfig(settings, pro).fixedFeePerItem, 0);
  assert.equal(effectiveFeeConfig(settings, { feeOverrides: { monthlyFee: 0 }, feePlan: 'pro' }).monthlyFee, 0);
  const free = { ...SELLER, feeOverrides: { commissionFreeUntil: '2026-11-01' } };
  assert.equal(resolveCommission({ settings, seller: free, product: phone, now: NOW }).rate, 0);
});

test('per-item minimum and cap', () => {
  const cfg = { minCommissionPerItem: 5, maxCommissionPerItem: 100 };
  assert.equal(unitCommission(20, 10, cfg), 5);
  assert.equal(unitCommission(5000, 10, cfg), 100);
  assert.equal(unitCommission(20, 0, cfg), 0);
  assert.equal(unitCommission(3, 10, cfg), 3);
});

test('shipment fees: commission, fixed fees, payment fee, fulfillment and VAT', () => {
  const settings = {
    ...base,
    fees: {
      fixedFeePerItem: 2,
      fixedFeePerShipment: 10,
      vatPercent: 14,
      paymentFees: [{ method: 'paymob_card', percent: 2, fixed: 1 }],
    },
  };
  const out = computeShipmentFees({
    settings,
    lines: [{ product: phone, quantity: 2, lineTotal: 1000 }, { product: snack, quantity: 1, lineTotal: 100 }],
    fulfilledBy: 'store',
    paymentMethod: 'paymob_card',
    now: NOW,
  });
  assert.equal(out.commissionTotal, 106); // 10% of 1000 + 6% of 100
  assert.equal(out.fixedFees, 16); // 3 items × 2 + 10
  assert.equal(out.fulfillmentFee, 15); // 3 × 5
  assert.equal(out.paymentFee, 23); // 2% of 1100 + 1
  assert.equal(out.feeVat, 22.4); // 14% of 160
  assert.equal(out.sellerNet, 1100 - 160 - 22.4);
  assert.equal(out.items[0].commissionSource, 'default');
});

test('commission on the delivery fee is optional', () => {
  const lines = [{ product: phone, quantity: 1, lineTotal: 200 }];
  const off = computeShipmentFees({ settings: base, lines, deliveryFee: 30, now: NOW });
  const on = computeShipmentFees({ settings: { ...base, fees: { commissionOnDeliveryFee: true } }, lines, deliveryFee: 30, now: NOW });
  assert.equal(off.commissionTotal, 20);
  assert.equal(on.commissionTotal, 23);
});

test('returns give commission back minus the admin fee, with its VAT', () => {
  const r = computeReturnReversal({ line: { lineTotal: 200, commission: 20 }, ratio: 0.5, vatPercent: 14, returnAdminFeePercent: 20 });
  assert.deepEqual(r, { value: 100, commissionBack: 8, adminFeeKept: 2, vatBack: 1.12 });
});

test('payout run keys follow the schedule in Cairo time', () => {
  const fri = new Date('2026-10-16T10:00:00Z'); // Friday in Cairo
  assert.equal(payoutRunKey({ frequency: 'manual' }, fri), null);
  assert.equal(payoutRunKey({ frequency: 'weekly', weekday: 5 }, fri), '2026-10-16');
  assert.equal(payoutRunKey({ frequency: 'weekly', weekday: 0 }, fri), null);
  assert.equal(payoutRunKey({ frequency: 'monthly', monthDay: 16 }, fri), '2026-10');
  assert.equal(payoutRunKey({ frequency: 'monthly', monthDay: 31 }, new Date('2026-02-28T10:00:00Z')), '2026-02');
  const a = payoutRunKey({ frequency: 'biweekly', weekday: 5 }, fri);
  const b = payoutRunKey({ frequency: 'biweekly', weekday: 5 }, new Date('2026-10-23T10:00:00Z'));
  assert.ok((a === null) !== (b === null));
  assert.equal(cairoMonthKey(new Date('2026-10-31T23:30:00Z')), '2026-11');
});

test('sellerDealSummary: per-category rates with their source, live rules, free period', async () => {
  const { sellerDealSummary } = await import('../src/utils/sellerFees.js');
  const settings = {
    defaultCommissionRate: 12,
    categoryCommissions: [{ category: FOOD, rate: 8 }],
    commissionRules: [
      { name: 'Phones week', rate: 4, categories: [PHONES], startsAt: new Date('2026-10-10'), endsAt: new Date('2026-10-20') },
      { name: 'Old promo', rate: 1, endsAt: new Date('2026-09-01') },
      { name: 'Big items', rate: 6, minPrice: 1000 },
    ],
    fees: { fixedFeePerItem: 2, vatPercent: 14 },
  };
  const seller = { ...SELLER, commissionRate: null, categoryCommissions: [{ category: SNACKS, rate: 5 }], feeOverrides: { vatExempt: true } };
  const cats = [{ _id: FOOD, nameEn: 'Food' }, { _id: SNACKS, nameEn: 'Snacks' }, { _id: PHONES, nameEn: 'Phones' }];
  const s = sellerDealSummary({ settings, seller, categories: cats, now: NOW });
  const by = Object.fromEntries(s.categories.map((c) => [c.nameEn, c]));
  assert.deepEqual([by.Food.rate, by.Food.source], [8, 'category']);
  assert.deepEqual([by.Snacks.rate, by.Snacks.source], [5, 'seller_category']);
  assert.deepEqual([by.Phones.rate, by.Phones.source, by.Phones.label], [4, 'rule', 'Phones week']);
  assert.deepEqual(s.baseRate, { rate: 12, source: 'default', label: '' });
  assert.deepEqual(s.rules.map((r) => [r.name, r.conditional]), [['Phones week', false], ['Big items', true]], 'expired rules are hidden');
  assert.equal(s.fees.vatPercent, 0, 'VAT exempt seller');
  assert.equal(s.fees.fixedFeePerItem, 2);
  assert.equal(s.commissionFreeUntil, null);

  const free = sellerDealSummary({ settings, seller: { ...seller, feeOverrides: { commissionFreeUntil: new Date('2026-11-01') } }, categories: cats, now: NOW });
  assert.ok(free.commissionFreeUntil);
  assert.ok(free.categories.every((c) => c.rate === 0 && c.source === 'seller_free'));

  const own = sellerDealSummary({ settings, seller: { ...seller, commissionRate: 9 }, categories: cats, now: NOW });
  assert.equal(own.categories.find((c) => c.nameEn === 'Food').rate, 9, 'negotiated rate beats the category default');
  assert.equal(own.baseRate.source, 'seller');
});
