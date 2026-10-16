/** Seller monthly performance trend — pure, no database. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sellerMonthlyTrend, lastMonthKeys } from '../src/utils/sellerTrend.js';

const NOW = new Date('2026-10-16T10:00:00Z');
const DAY = 86400000;

test('lastMonthKeys walks back across a year boundary', () => {
  assert.deepEqual(lastMonthKeys(3, new Date('2026-02-10T10:00:00Z')), ['2025-12', '2026-01', '2026-02']);
  assert.deepEqual(lastMonthKeys(1, NOW), ['2026-10']);
});

test('sellerMonthlyTrend: parcels, sales, cancel and late rates per Cairo month', () => {
  const sep = new Date('2026-09-10T10:00:00Z');
  const oct = new Date('2026-10-02T10:00:00Z');
  const rows = sellerMonthlyTrend([
    { createdAt: sep, status: 'delivered', fulfilledBy: 'seller', shippedAt: new Date(sep.getTime() + DAY), subtotal: 100 },
    { createdAt: sep, status: 'delivered', fulfilledBy: 'seller', shippedAt: new Date(sep.getTime() + 5 * DAY), subtotal: 50 },
    { createdAt: sep, status: 'cancelled', fulfilledBy: 'seller', cancelledByRole: 'seller', subtotal: 70 },
    { createdAt: sep, status: 'cancelled', fulfilledBy: 'seller', cancelledByRole: 'customer', subtotal: 20 },
    { createdAt: oct, status: 'delivered', fulfilledBy: 'store', subtotal: 300 },
    { createdAt: oct, status: 'pending', fulfilledBy: 'seller', subtotal: 40 }, // 14 days, never shipped → late
    // Last day of September in UTC is already October in Cairo.
    { createdAt: new Date('2026-09-30T22:30:00Z'), status: 'delivered', fulfilledBy: 'store', subtotal: 10 },
  ], { months: 3, handlingDays: 2, now: NOW });

  assert.deepEqual(rows.map((r) => r.month), ['2026-08', '2026-09', '2026-10']);
  assert.deepEqual(rows[0], { month: '2026-08', parcels: 0, sales: 0, cancelRate: 0, lateShipRate: 0 });
  assert.deepEqual(rows[1], { month: '2026-09', parcels: 4, sales: 150, cancelRate: 25, lateShipRate: 50 });
  assert.deepEqual(rows[2], { month: '2026-10', parcels: 3, sales: 350, cancelRate: 0, lateShipRate: 100 });
});
