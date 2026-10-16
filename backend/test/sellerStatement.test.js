/** Seller statement / fee invoice math — pure, no database. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { statementTotals, cairoMonthRange, statementCsvRows } from '../src/utils/sellerStatement.js';

test('cairoMonthRange follows Cairo midnight across summer time', () => {
  assert.deepEqual(cairoMonthRange('2026-07'), { from: new Date('2026-06-30T21:00:00Z'), to: new Date('2026-07-31T21:00:00Z') });
  // Summer time ends on the last Thursday of October: November starts at UTC+2.
  assert.deepEqual(cairoMonthRange('2026-10'), { from: new Date('2026-09-30T21:00:00Z'), to: new Date('2026-10-31T22:00:00Z') });
  assert.deepEqual(cairoMonthRange('2026-12'), { from: new Date('2026-11-30T22:00:00Z'), to: new Date('2026-12-31T22:00:00Z') });
});

test('statementTotals: fees positive, reversals reduce them, VAT apart, net = sum', () => {
  const t = statementTotals([
    { type: 'sale', amount: 500 },
    { type: 'delivery_fee', amount: 30 },
    { type: 'commission', amount: -50 },
    { type: 'payment_fee', amount: -5.25 },
    { type: 'subscription_fee', amount: -100 },
    { type: 'fee_vat', amount: -21.74 },
    { type: 'return', amount: -100 },
    { type: 'commission_reversal', amount: 10 },
    { type: 'cod_collected', amount: -200 },
    { type: 'payout', amount: -20 },
  ]);
  assert.equal(t.sales, 530);
  assert.equal(t.returns, 100);
  assert.equal(t.fees, 145.25);
  assert.equal(t.vat, 21.74);
  assert.equal(t.feesWithVat, 166.99);
  assert.equal(t.cashCollected, 200);
  assert.equal(t.paidOut, 20);
  assert.equal(t.net, 43.01);
  assert.deepEqual(t.invoiceLines.map((l) => l.type), ['commission', 'commission_reversal', 'payment_fee', 'subscription_fee']);
});

test('statementCsvRows wraps entries with opening and closing balances', () => {
  const rows = statementCsvRows({
    openingBalance: 10,
    closingBalance: 60,
    entries: [{ date: '2026-10-05T21:30:00Z', type: 'sale', amount: 50, reference: 'SH-1', note: '' }],
  });
  assert.deepEqual(rows.map((r) => [r.date, r.type, r.amount]), [['', 'opening_balance', 10], ['2026-10-06', 'sale', 50], ['', 'closing_balance', 60]]);
});
