/**
 * End-to-end payment flow against fake Paymob / Fawry gateways and a throwaway MongoDB
 * database. Skips itself when MongoDB is not reachable (e.g. the lint/build CI job).
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import crypto from 'node:crypto';

const MONGO_BASE = (process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/marketplus').replace(/\/[^/?]*(\?.*)?$/, '');
const TEST_DB_URI = `${MONGO_BASE}/marketplus_payments_test`;
const HMAC_SECRET = 'flow_test_hmac_secret';
const FAWRY_KEY = 'flow_test_fawry_key';

let mongoose;
let Order;
let User;
let app;
let api;
let gateway;
let apiUrl;
let token;
let user;
let skip = false;

const gw = { intentions: [], transactions: new Map(), fawryStatus: new Map(), fawryCharges: [], refundsFail: false };

function startServer(handler) {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

async function readBody(req) {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}

function fakeGateway(req, res) {
  const send = (status, body) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  };
  const url = new URL(req.url, 'http://gw');
  readBody(req).then((body) => {
    if (req.method === 'POST' && url.pathname === '/v1/intention/') {
      if (req.headers.authorization !== 'Token sk_test_flow') return send(401, { detail: 'bad key' });
      if (!body.billing_data?.phone_number) return send(400, { billing_data: { phone_number: ['required'] } });
      gw.intentions.push(body);
      return send(201, { id: `int_${gw.intentions.length}`, intention_order_id: 9000 + gw.intentions.length, client_secret: `csk_${gw.intentions.length}` });
    }
    if (req.method === 'POST' && url.pathname === '/api/auth/tokens') return send(201, { token: 'inquiry_token' });
    if (req.method === 'GET' && url.pathname.startsWith('/api/acceptance/transactions/')) {
      const tx = gw.transactions.get(url.pathname.split('/').pop());
      return tx ? send(200, tx) : send(404, { detail: 'not found' });
    }
    if (req.method === 'POST' && url.pathname === '/api/acceptance/void_refund/refund') {
      return send(201, { id: 7770001, success: true, amount_cents: body.amount_cents });
    }
    if (req.method === 'POST' && url.pathname === '/ECommerceWeb/Fawry/payments/charge') {
      const expected = crypto.createHash('sha256')
        .update(`${body.merchantCode}${body.merchantRefNum}${body.paymentMethod}${Number(body.amount).toFixed(2)}${FAWRY_KEY}`)
        .digest('hex');
      if (body.signature !== expected) return send(200, { statusCode: 9901, statusDescription: 'bad signature' });
      gw.fawryCharges.push(body);
      gw.fawryStatus.set(body.merchantRefNum, 'NEW');
      return send(200, { statusCode: 200, referenceNumber: String(7000000 + gw.fawryCharges.length) });
    }
    if (req.method === 'GET' && url.pathname === '/ECommerceWeb/Fawry/payments/status/v2') {
      const ref = url.searchParams.get('merchantRefNumber');
      return send(200, { statusCode: 200, orderStatus: gw.fawryStatus.get(ref) || 'NEW', fawryRefNumber: '7000001' });
    }
    if (req.method === 'POST' && url.pathname === '/ECommerceWeb/Fawry/payments/refund') {
      return send(200, { statusCode: 9954, statusDescription: 'Refund not allowed for cash payments' });
    }
    return send(404, { detail: `no route ${req.method} ${url.pathname}` });
  });
}

const paymobTx = (order, overrides = {}) => ({
  id: 5550000 + Math.floor(Math.random() * 1000),
  pending: false,
  amount_cents: Math.round(order.total * 100),
  success: true,
  is_auth: false,
  is_capture: false,
  is_standalone_payment: true,
  is_voided: false,
  is_refunded: false,
  is_3d_secure: true,
  integration_id: 111,
  has_parent_transaction: false,
  created_at: '2026-10-03T12:00:00.000000',
  currency: 'EGP',
  error_occured: false,
  owner: 1,
  order: { id: 9001, merchant_order_id: order.payment.reference },
  source_data: { pan: '2346', sub_type: 'MasterCard', type: 'card' },
  ...overrides,
});

const paymobHmac = (obj) => {
  const fields = ['amount_cents', 'created_at', 'currency', 'error_occured', 'has_parent_transaction', 'id',
    'integration_id', 'is_3d_secure', 'is_auth', 'is_capture', 'is_refunded', 'is_standalone_payment', 'is_voided',
    'order.id', 'owner', 'pending', 'source_data.pan', 'source_data.sub_type', 'source_data.type', 'success'];
  const s = fields.map((f) => f.split('.').reduce((o, k) => o?.[k], obj) ?? '').map(String).join('');
  return crypto.createHmac('sha512', HMAC_SECRET).update(s).digest('hex');
};

async function call(method, path, body, { auth = true } = {}) {
  const res = await fetch(`${apiUrl}${path}`, {
    method,
    redirect: 'manual',
    headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* redirects */ }
  return { status: res.status, body: json, location: res.headers.get('location') };
}

let orderSeq = 0;
async function makeOrder(paymentMethod, total = 159.9) {
  orderSeq += 1;
  return Order.create({
    orderNumber: `TEST-${Date.now()}-${orderSeq}`,
    user: user._id,
    items: [{ nameAr: 'حليب', nameEn: 'Milk', price: total, quantity: 1 }],
    shippingAddress: { street: '1 Test St', city: 'Cairo' },
    phone: '+201012345678',
    subtotal: total,
    deliveryFee: 0,
    total,
    paymentMethod,
    paymentStatus: 'pending',
    orderStatus: 'pending',
  });
}

before(async () => {
  gateway = await startServer(fakeGateway);
  const gatewayUrl = `http://127.0.0.1:${gateway.address().port}`;
  Object.assign(process.env, {
    NODE_ENV: 'test',
    MONGODB_URI: TEST_DB_URI,
    JWT_SECRET: 'flow_test_jwt_secret_at_least_32_characters',
    CLIENT_URL: 'http://client.test',
    PAYMOB_BASE_URL: gatewayUrl,
    PAYMOB_SECRET_KEY: 'sk_test_flow',
    PAYMOB_PUBLIC_KEY: 'pk_test_flow',
    PAYMOB_HMAC_SECRET: HMAC_SECRET,
    PAYMOB_API_KEY: 'api_key_flow',
    PAYMOB_INTEGRATION_CARD: '111',
    PAYMOB_INTEGRATION_APPLE_PAY: '222',
    PAYMOB_INTEGRATION_WALLET: '333',
    FAWRY_BASE_URL: gatewayUrl,
    FAWRY_MERCHANT_CODE: 'MCFLOW',
    FAWRY_SECURE_KEY: FAWRY_KEY,
  });
  delete process.env.PAYMOB_INTEGRATION_VALU;
  delete process.env.MEILI_HOST;

  mongoose = (await import('mongoose')).default;
  try {
    await mongoose.connect(TEST_DB_URI, { serverSelectionTimeoutMS: 2000 });
  } catch {
    skip = true;
    return;
  }
  await mongoose.connection.dropDatabase();
  ({ default: Order } = await import('../src/models/Order.js'));
  ({ default: User } = await import('../src/models/User.js'));
  ({ default: app } = await import('../src/app.js'));
  const { generateToken } = await import('../src/utils/generateToken.js');

  api = await startServer(app);
  apiUrl = `http://127.0.0.1:${api.address().port}/api`;
  process.env.PUBLIC_API_URL = apiUrl;

  user = await User.create({ name: 'Mona Test', phone: '+201012345678' });
  token = generateToken(user._id);
});

after(async () => {
  if (mongoose?.connection?.readyState === 1) {
    if (!skip) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
  api?.close();
  gateway?.close();
});

test('public settings only list configured gateway methods', async (t) => {
  if (skip) return t.skip('MongoDB not reachable');
  const { body } = await call('GET', '/store-settings', null, { auth: false });
  const ids = body.data.paymentMethods.map((m) => m.id);
  assert.ok(ids.includes('paymob_card'));
  assert.ok(ids.includes('paymob_wallet'));
  assert.ok(ids.includes('fawry'));
  assert.ok(!ids.includes('paymob_valu'), 'valU has no integration id → hidden');
  assert.ok(!ids.includes('stripe'));
  assert.equal(body.data.paymentMethods.find((m) => m.id === 'fawry').online, true);
});

test('Paymob card: start → signed webhook → paid exactly once', async (t) => {
  if (skip) return t.skip('MongoDB not reachable');
  const order = await makeOrder('paymob_card');
  const start = await call('POST', '/payment/start', { orderId: order._id });
  assert.equal(start.status, 200, JSON.stringify(start.body));
  assert.equal(start.body.action, 'redirect');
  assert.match(start.body.url, /\/unifiedcheckout\/\?publicKey=pk_test_flow&clientSecret=csk_/);

  const intention = gw.intentions.at(-1);
  assert.equal(intention.amount, 15990);
  assert.deepEqual(intention.payment_methods, [111, 222]);
  assert.match(intention.notification_url, /\/payment\/paymob\/webhook$/);
  assert.match(intention.redirection_url, /\/payment\/paymob\/return\/web\/ar$/);

  const pending = await Order.findById(order._id);
  assert.equal(pending.payment.provider, 'paymob');
  assert.equal(pending.payment.reference, intention.special_reference);

  const obj = paymobTx(pending);
  const forged = await call('POST', '/payment/paymob/webhook?hmac=deadbeef', { type: 'TRANSACTION', obj }, { auth: false });
  assert.equal(forged.status, 401);
  assert.equal((await Order.findById(order._id)).paymentStatus, 'pending');

  const hmac = paymobHmac(obj);
  for (let i = 0; i < 2; i += 1) { // duplicate delivery must be a no-op
    const res = await call('POST', `/payment/paymob/webhook?hmac=${hmac}`, { type: 'TRANSACTION', obj }, { auth: false });
    assert.equal(res.status, 200);
  }
  const paid = await Order.findById(order._id);
  assert.equal(paid.paymentStatus, 'paid');
  assert.equal(paid.payment.transactionId, String(obj.id));
  assert.equal(paid.payment.maskedPan, '2346');
  assert.ok(paid.payment.paidAt);

  const status = await call('GET', `/payment/status/${order._id}`);
  assert.equal(status.body.order.paymentStatus, 'paid');
  assert.equal(status.body.payment.provider, 'paymob');
});

test('Paymob: wrong amount is flagged, never marked paid', async (t) => {
  if (skip) return t.skip('MongoDB not reachable');
  const order = await makeOrder('paymob_wallet', 200);
  await call('POST', '/payment/start', { orderId: order._id });
  assert.deepEqual(gw.intentions.at(-1).payment_methods, [333]);
  const obj = paymobTx(await Order.findById(order._id), { amount_cents: 100 });
  await call('POST', `/payment/paymob/webhook?hmac=${paymobHmac(obj)}`, { type: 'TRANSACTION', obj }, { auth: false });
  const after = await Order.findById(order._id);
  assert.equal(after.paymentStatus, 'pending');
  assert.equal(after.payment.amountMismatch, true);
});

test('Paymob return without a valid HMAC is confirmed through the inquiry API', async (t) => {
  if (skip) return t.skip('MongoDB not reachable');
  const order = await makeOrder('paymob_card', 50);
  await call('POST', '/payment/start', { orderId: order._id, channel: 'app', lang: 'en' });
  assert.match(gw.intentions.at(-1).redirection_url, /\/return\/app\/en$/);
  const obj = paymobTx(await Order.findById(order._id));
  gw.transactions.set(String(obj.id), obj);

  const qs = new URLSearchParams({ id: String(obj.id), success: 'true', merchant_order_id: obj.order.merchant_order_id, hmac: 'not-valid' });
  const res = await call('GET', `/payment/paymob/return/app?${qs}`, null, { auth: false });
  assert.equal(res.status, 302);
  assert.match(res.location, /^marketplus:\/\/app\/payment\/result\?order_id=.+&status=paid$/);
  assert.equal((await Order.findById(order._id)).paymentStatus, 'paid');

  const web = await call('GET', `/payment/paymob/return/web/en?${qs}`, null, { auth: false });
  assert.match(web.location, /^http:\/\/client\.test\/en\/payment\/result\?order_id=/);
  // Older links without a language segment fall back to Arabic.
  const legacy = await call('GET', `/payment/paymob/return/web?${qs}`, null, { auth: false });
  assert.match(legacy.location, /^http:\/\/client\.test\/ar\/payment\/result\?order_id=/);
});

test('Paymob declined payment → failed, then a retry can still succeed', async (t) => {
  if (skip) return t.skip('MongoDB not reachable');
  const order = await makeOrder('paymob_card', 75);
  await call('POST', '/payment/start', { orderId: order._id });
  const declined = paymobTx(await Order.findById(order._id), { success: false });
  await call('POST', `/payment/paymob/webhook?hmac=${paymobHmac(declined)}`, { type: 'TRANSACTION', obj: declined }, { auth: false });
  assert.equal((await Order.findById(order._id)).paymentStatus, 'failed');

  const retry = await call('POST', '/payment/start', { orderId: order._id });
  assert.equal(retry.body.action, 'redirect');
  const reloaded = await Order.findById(order._id);
  assert.equal(reloaded.paymentStatus, 'pending');
  assert.equal(reloaded.payment.references.length, 2);
  const ok = paymobTx(reloaded);
  await call('POST', `/payment/paymob/webhook?hmac=${paymobHmac(ok)}`, { type: 'TRANSACTION', obj: ok }, { auth: false });
  assert.equal((await Order.findById(order._id)).paymentStatus, 'paid');
});

test('Fawry: reference number, reused while valid, paid by signed notification', async (t) => {
  if (skip) return t.skip('MongoDB not reachable');
  const order = await makeOrder('fawry', 159.9);
  const first = await call('POST', '/payment/start', { orderId: order._id });
  assert.equal(first.body.action, 'reference');
  assert.match(first.body.referenceNumber, /^7\d+$/);
  const again = await call('POST', '/payment/start', { orderId: order._id });
  assert.equal(again.body.referenceNumber, first.body.referenceNumber);
  assert.equal(gw.fawryCharges.length, 1);
  assert.equal(gw.fawryCharges[0].customerMobile, '01012345678');

  const reloaded = await Order.findById(order._id);
  const notification = {
    fawryRefNumber: first.body.referenceNumber,
    merchantRefNumber: reloaded.payment.reference,
    paymentAmount: 161.4,
    orderAmount: 159.9,
    orderStatus: 'PAID',
    paymentMethod: 'PayAtFawry',
    paymentRefrenceNumber: '24480',
  };
  const sig = (b) => crypto.createHash('sha256').update(
    `${b.fawryRefNumber}${b.merchantRefNumber}${b.paymentAmount.toFixed(2)}${b.orderAmount.toFixed(2)}${b.orderStatus}${b.paymentMethod}${b.paymentRefrenceNumber}${FAWRY_KEY}`,
  ).digest('hex');

  const forged = await call('POST', '/payment/fawry/webhook', { ...notification, messageSignature: 'x' }, { auth: false });
  assert.equal(forged.status, 401);
  const res = await call('POST', '/payment/fawry/webhook', { ...notification, messageSignature: sig(notification) }, { auth: false });
  assert.equal(res.status, 200);
  assert.equal((await Order.findById(order._id)).paymentStatus, 'paid');
});

test('Fawry: missed notification is caught by the status pull', async (t) => {
  if (skip) return t.skip('MongoDB not reachable');
  const order = await makeOrder('fawry', 20);
  await call('POST', '/payment/start', { orderId: order._id });
  const ref = (await Order.findById(order._id)).payment.reference;
  gw.fawryStatus.set(ref, 'PAID');
  const status = await call('GET', `/payment/status/${order._id}`);
  assert.equal(status.body.order.paymentStatus, 'paid');
});

test('refunds: Paymob through the gateway, Fawry cash flagged for manual refund', async (t) => {
  if (skip) return t.skip('MongoDB not reachable');
  const { processOnlineRefund } = await import('../src/services/payments/payment.service.js');

  const card = await Order.findOne({ paymentMethod: 'paymob_card', paymentStatus: 'paid' });
  const cardRefund = await processOnlineRefund(card, 10, 'test');
  assert.deepEqual(cardRefund, { refundId: '7770001', status: 'succeeded' });
  assert.equal(card.payment.refunds[0].status, 'succeeded');

  const fawry = await Order.findOne({ paymentMethod: 'fawry', paymentStatus: 'paid' });
  const fawryRefund = await processOnlineRefund(fawry, 5, 'test');
  assert.equal(fawryRefund.status, 'manual_required');
  assert.match(fawry.payment.refunds[0].note, /manual/);
});

test('an order can only be paid with a configured method', async (t) => {
  if (skip) return t.skip('MongoDB not reachable');
  const order = await makeOrder('paymob_valu', 30);
  const res = await call('POST', '/payment/start', { orderId: order._id });
  assert.equal(res.status, 503);
});
