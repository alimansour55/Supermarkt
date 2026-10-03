import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  paymobCallbackSigningString,
  paymobRedirectSigningString,
  verifyPaymobCallback,
  verifyPaymobRedirect,
  interpretPaymobTransaction,
} from '../src/services/payments/paymob.service.js';
import {
  chargeSignature,
  notificationSignature,
  verifyFawryNotification,
  interpretFawryStatus,
  fawryAmount,
  fawryMobile,
} from '../src/services/payments/fawry.service.js';
import { paymobIntegrationsFor, isPaymentMethodConfigured } from '../src/config/payments.js';

// The worked example from Paymob's HMAC documentation.
const PAYMOB_DOC_TX = {
  amount_cents: 100,
  created_at: '2020-03-25T18:39:44.719228',
  currency: 'EGP',
  error_occured: false,
  has_parent_transaction: false,
  id: 2556706,
  integration_id: 6741,
  is_3d_secure: true,
  is_auth: false,
  is_capture: false,
  is_refunded: false,
  is_standalone_payment: true,
  is_voided: false,
  order: { id: 4778239, merchant_order_id: 'MP-1-1-abcd' },
  owner: 4705,
  pending: false,
  source_data: { pan: '2346', sub_type: 'MasterCard', type: 'card' },
  success: true,
};
const PAYMOB_DOC_STRING = '1002020-03-25T18:39:44.719228EGPfalsefalse25567066741truefalsefalsefalsetruefalse47782394705false2346MasterCardcardtrue';
const sign = (s, key) => crypto.createHmac('sha512', key).update(s).digest('hex');

test('Paymob callback signing string matches the documented example', () => {
  assert.equal(paymobCallbackSigningString(PAYMOB_DOC_TX), PAYMOB_DOC_STRING);
});

test('Paymob callback HMAC verifies, and rejects tampering', () => {
  const secret = 'test_hmac_secret';
  const hmac = sign(PAYMOB_DOC_STRING, secret);
  assert.equal(verifyPaymobCallback(PAYMOB_DOC_TX, hmac, secret), true);
  assert.equal(verifyPaymobCallback({ ...PAYMOB_DOC_TX, amount_cents: 1 }, hmac, secret), false);
  assert.equal(verifyPaymobCallback(PAYMOB_DOC_TX, hmac, 'other_secret'), false);
  assert.equal(verifyPaymobCallback(PAYMOB_DOC_TX, '', secret), false);
  assert.equal(verifyPaymobCallback(PAYMOB_DOC_TX, hmac, ''), false);
});

test('Paymob redirect query signs the same fields (flat keys, order = order id)', () => {
  const query = {
    amount_cents: '100', created_at: '2020-03-25T18:39:44.719228', currency: 'EGP', error_occured: 'false',
    has_parent_transaction: 'false', id: '2556706', integration_id: '6741', is_3d_secure: 'true', is_auth: 'false',
    is_capture: 'false', is_refunded: 'false', is_standalone_payment: 'true', is_voided: 'false', order: '4778239',
    owner: '4705', pending: 'false', 'source_data.pan': '2346', 'source_data.sub_type': 'MasterCard',
    'source_data.type': 'card', success: 'true', merchant_order_id: 'MP-1-1-abcd',
  };
  assert.equal(paymobRedirectSigningString(query), PAYMOB_DOC_STRING);
  const secret = 's';
  assert.equal(verifyPaymobRedirect({ ...query, hmac: sign(PAYMOB_DOC_STRING, secret) }, secret), true);
  assert.equal(verifyPaymobRedirect({ ...query, success: 'false', hmac: sign(PAYMOB_DOC_STRING, secret) }, secret), false);

  const tx = interpretPaymobTransaction(query);
  assert.equal(tx.state, 'paid');
  assert.equal(tx.merchantOrderId, 'MP-1-1-abcd');
  assert.equal(tx.amountCents, 100);
  assert.equal(tx.maskedPan, '2346');
});

test('interpretPaymobTransaction maps states', () => {
  assert.equal(interpretPaymobTransaction(PAYMOB_DOC_TX).state, 'paid');
  assert.equal(interpretPaymobTransaction({ ...PAYMOB_DOC_TX, success: false }).state, 'failed');
  assert.equal(interpretPaymobTransaction({ ...PAYMOB_DOC_TX, success: false, pending: true }).state, 'pending');
  assert.equal(interpretPaymobTransaction({ ...PAYMOB_DOC_TX, is_refunded: true }).state, 'refund_event');
  assert.equal(interpretPaymobTransaction({ ...PAYMOB_DOC_TX, has_parent_transaction: true }).state, 'refund_event');
  const tx = interpretPaymobTransaction(PAYMOB_DOC_TX);
  assert.equal(tx.merchantOrderId, 'MP-1-1-abcd');
  assert.equal(tx.transactionId, '2556706');
  assert.equal(tx.sourceSubType, 'MasterCard');
});

test('Fawry charge signature follows merchantCode+ref+profile+method+amount(2dp)+key', () => {
  const expected = crypto.createHash('sha256')
    .update('MC123' + '1700000000000123' + '' + 'PAYATFAWRY' + '159.90' + 'KEY').digest('hex');
  assert.equal(chargeSignature({
    merchantCode: 'MC123', merchantRefNum: '1700000000000123', paymentMethod: 'PAYATFAWRY', amount: 159.9, secureKey: 'KEY',
  }), expected);
});

test('Fawry notification signature verifies, and rejects tampering', () => {
  const body = {
    fawryRefNumber: '9990001', merchantRefNumber: '1700000000000123', paymentAmount: 161.4, orderAmount: 159.9,
    orderStatus: 'PAID', paymentMethod: 'PayAtFawry', paymentRefrenceNumber: '24480',
  };
  const expected = crypto.createHash('sha256')
    .update('9990001' + '1700000000000123' + '161.40' + '159.90' + 'PAID' + 'PayAtFawry' + '24480' + 'KEY').digest('hex');
  assert.equal(notificationSignature(body, 'KEY'), expected);
  assert.equal(verifyFawryNotification({ ...body, messageSignature: expected }, 'KEY'), true);
  assert.equal(verifyFawryNotification({ ...body, orderAmount: 1, messageSignature: expected }, 'KEY'), false);
  // Order-creation notifications carry no payment reference number.
  const fresh = { ...body, orderStatus: 'NEW', paymentRefrenceNumber: undefined };
  assert.equal(verifyFawryNotification({ ...fresh, messageSignature: notificationSignature(fresh, 'KEY') }, 'KEY'), true);
});

test('Fawry helpers', () => {
  assert.equal(fawryAmount(10), '10.00');
  assert.equal(fawryAmount('99.5'), '99.50');
  assert.equal(fawryMobile('+201012345678'), '01012345678');
  assert.equal(fawryMobile('01012345678'), '01012345678');
  assert.equal(interpretFawryStatus('PAID'), 'paid');
  assert.equal(interpretFawryStatus('New'), 'pending');
  assert.equal(interpretFawryStatus('EXPIRED'), 'failed');
  assert.equal(interpretFawryStatus('PARTIAL_REFUNDED'), 'refund_event');
});

test('a gateway method is only offered when its keys and integration id exist', () => {
  const saved = { ...process.env };
  try {
    for (const key of Object.keys(process.env)) if (/^(PAYMOB|FAWRY)_/.test(key)) delete process.env[key];
    assert.equal(isPaymentMethodConfigured('paymob_card'), false);
    assert.equal(isPaymentMethodConfigured('fawry'), false);
    assert.equal(isPaymentMethodConfigured('cod'), true);

    Object.assign(process.env, { PAYMOB_SECRET_KEY: 'sk', PAYMOB_PUBLIC_KEY: 'pk', PAYMOB_HMAC_SECRET: 'h' });
    assert.equal(isPaymentMethodConfigured('paymob_card'), false); // no integration id yet
    process.env.PAYMOB_INTEGRATION_CARD = '111';
    process.env.PAYMOB_INTEGRATION_APPLE_PAY = '222';
    assert.equal(isPaymentMethodConfigured('paymob_card'), true);
    assert.deepEqual(paymobIntegrationsFor('paymob_card'), [111, 222]);
    assert.equal(isPaymentMethodConfigured('paymob_wallet'), false);
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
  }
});
