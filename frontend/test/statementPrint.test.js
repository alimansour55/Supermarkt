import { test } from 'node:test';
import assert from 'node:assert/strict';
import { feeInvoiceHtml, statementHtml, monthOptions, ledgerLabel } from '../src/seller/statementPrint.js';

const statement = {
  month: '2026-10',
  invoiceNumber: 'SF-SHOP-202610',
  issuer: { nameAr: 'سوق', nameEn: 'Souq', addressAr: 'القاهرة', addressEn: 'Cairo', taxId: '123-456' },
  seller: { nameAr: 'متجر', nameEn: 'Shop <b>', legalName: '', taxId: '999', commercialRegisterNo: 'CR1', address: { city: 'Giza' } },
  openingBalance: 10,
  closingBalance: 854.6,
  totals: {
    byType: { sale: 1000, commission: -100, fee_vat: -15.4 },
    fees: 90, vat: 15.4, feesWithVat: 105.4,
    invoiceLines: [{ type: 'commission', amount: 100 }, { type: 'commission_reversal', amount: -20 }, { type: 'fixed_fee', amount: 10 }],
  },
  entries: [{ date: '2026-10-05T10:00:00Z', type: 'sale', amount: 1000, reference: 'SH-1', note: '' }],
};

test('fee invoice lists fees, VAT and the total, escapes names', () => {
  const html = feeInvoiceHtml(statement, false);
  assert.match(html, /SF-SHOP-202610/);
  assert.match(html, /Commission/);
  assert.match(html, /Commission refunded/);
  assert.match(html, /-20\.00 EGP/);
  assert.match(html, /105\.40 EGP/);
  assert.match(html, /Tax ID: 123-456/);
  assert.match(html, /Shop &lt;b&gt;/);
  assert.doesNotMatch(html, /Shop <b>/);
  assert.match(feeInvoiceHtml(statement, true), /dir="rtl"/);
});

test('statement shows opening, transactions and closing balance', () => {
  const html = statementHtml(statement, false);
  assert.match(html, /Opening balance/);
  assert.match(html, /SH-1/);
  assert.match(html, /854\.60 EGP/);
});

test('monthOptions: newest first, across the year boundary', () => {
  const opts = monthOptions(new Date('2026-02-10T10:00:00Z'), 3);
  assert.deepEqual(opts.map((o) => o.value), ['2026-02', '2026-01', '2025-12']);
  assert.equal(ledgerLabel('payout', true), 'تحويلات');
  assert.equal(ledgerLabel('mystery', false), 'mystery');
});
