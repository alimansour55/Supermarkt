/**
 * Abandoned-cart recovery job against a throwaway MongoDB database.
 * Skips itself when MongoDB is not reachable.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

const MONGO_BASE = (process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/marketplus').replace(/\/[^/?]*(\?.*)?$/, '');
const TEST_DB_URI = `${MONGO_BASE}/marketplus_cart_recovery_test`;
const HOUR = 60 * 60 * 1000;

let mongoose;
let skip = false;
let svc;
let Cart;
let CartRecovery;
let Coupon;
let User;
let Product;
let Category;
let StoreSettings;
let UserNotification;
let assertCouponRedeemable;
let product;

before(async () => {
  mongoose = (await import('mongoose')).default;
  try {
    await mongoose.connect(TEST_DB_URI, { serverSelectionTimeoutMS: 2000 });
  } catch {
    skip = true;
    return;
  }
  await mongoose.connection.dropDatabase();
  svc = await import('../src/services/cartRecovery.service.js');
  ({ assertCouponRedeemable } = await import('../src/services/coupon.service.js'));
  ({ default: Cart } = await import('../src/models/Cart.js'));
  ({ default: CartRecovery } = await import('../src/models/CartRecovery.js'));
  ({ default: Coupon } = await import('../src/models/Coupon.js'));
  ({ default: User } = await import('../src/models/User.js'));
  ({ default: Product } = await import('../src/models/Product.js'));
  ({ default: Category } = await import('../src/models/Category.js'));
  ({ default: StoreSettings } = await import('../src/models/StoreSettings.js'));
  ({ default: UserNotification } = await import('../src/models/UserNotification.js'));
  await CartRecovery.syncIndexes();
  const category = await Category.create({ nameAr: 'بقالة', nameEn: 'Grocery', slug: 'grocery-cr', isActive: true });
  product = await Product.create({ nameAr: 'أرز', nameEn: 'Rice', price: 60, stock: 50, category: category._id, sku: 'SKU-CR-1', slug: 'rice-cr' });
});

after(async () => {
  if (mongoose?.connection?.readyState === 1) {
    if (!skip) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});

async function setSettings(overrides = {}) {
  await StoreSettings.deleteMany({});
  await StoreSettings.create({ key: 'main' });
  return svc.updateCartRecoverySettings({ enabled: true, minCartValue: 50, ...overrides });
}

/** A customer whose cart (2 × 60 EGP) was last touched `idleHours` ago. */
async function abandonedCustomer(idleHours, extra = {}) {
  const user = await User.create({ name: 'Mona Ali', phone: `+2010${Math.floor(Math.random() * 1e8)}`, email: `c${Date.now()}${Math.random()}@x.test`, ...extra });
  const cart = await Cart.create({ user: user._id, items: [{ product: product._id, quantity: 2 }] });
  const at = new Date(Date.now() - idleHours * HOUR);
  await Cart.collection.updateOne({ _id: cart._id }, { $set: { updatedAt: at } });
  return { user, cart };
}

test('settings are normalized: clamped, defaulted and sorted by delay', (t) => {
  if (skip) return t.skip('MongoDB not reachable');
  const s = svc.normalizeCartRecoverySettings({
    enabled: true,
    minCartValue: -5,
    steps: [
      { delayHours: 48, coupon: { enabled: true, discountType: 'percent', discountValue: 250 } },
      { delayHours: 2 },
      { delayHours: 5 },
      { delayHours: 9 },
    ],
  });
  assert.equal(s.minCartValue, 0);
  assert.equal(s.steps.length, svc.MAX_RECOVERY_STEPS);
  assert.deepEqual(s.steps.map((x) => x.delayHours), [2, 5, 48]);
  assert.equal(s.steps[2].coupon.discountValue, 100);
  assert.equal(svc.normalizeCartRecoverySettings(null).enabled, false);
});

test('disabled feature sends nothing', async (t) => {
  if (skip) return t.skip('MongoDB not reachable');
  await setSettings({ enabled: false });
  await abandonedCustomer(3);
  const summary = await svc.runCartRecovery();
  assert.equal(summary.sent, 0);
  assert.equal(await CartRecovery.countDocuments(), 0);
});

test('reminder steps fire once each, with a coupon locked to the customer', async (t) => {
  if (skip) return t.skip('MongoDB not reachable');
  await CartRecovery.deleteMany({});
  await Cart.deleteMany({});
  await setSettings();
  const { user, cart } = await abandonedCustomer(2);

  // Step 1 (after 1h): reminder, no coupon.
  let summary = await svc.runCartRecovery();
  assert.equal(summary.sent, 1);
  let ep = await CartRecovery.findOne({ user: user._id });
  assert.equal(ep.stage, 1);
  assert.equal(ep.cartValue, 120);
  assert.equal(ep.couponCodes.length, 0);
  const note = await UserNotification.findOne({ user: user._id, type: 'cart_reminder' });
  assert.match(note.messageEn, /2 items worth EGP 120/);

  // Re-running immediately must not resend.
  summary = await svc.runCartRecovery();
  assert.equal(summary.sent, 0);

  // Step 2 (after 24h): coupon minted, single use, only for this customer.
  await Cart.collection.updateOne({ _id: cart._id }, { $set: { updatedAt: new Date(Date.now() - 25 * HOUR) } });
  summary = await svc.runCartRecovery();
  assert.equal(summary.sent, 1);
  ep = await CartRecovery.findOne({ user: user._id });
  assert.equal(ep.stage, 2);
  assert.equal(ep.couponCodes.length, 1);
  const coupon = await Coupon.findOne({ code: ep.couponCodes[0] });
  assert.equal(coupon.source, 'cart_recovery');
  assert.equal(coupon.usageLimit, 1);
  assert.equal(String(coupon.assignedUser), String(user._id));

  await assert.doesNotReject(assertCouponRedeemable({ code: coupon.code, userId: user._id, subtotal: 120 }));
  const stranger = new mongoose.Types.ObjectId();
  await assert.rejects(assertCouponRedeemable({ code: coupon.code, userId: stranger, subtotal: 120 }), /Invalid discount code/);

  // No further steps configured.
  summary = await svc.runCartRecovery();
  assert.equal(summary.sent, 0);
});

test('an order inside the window marks the episode recovered and retires its coupons', async (t) => {
  if (skip) return t.skip('MongoDB not reachable');
  const ep = await CartRecovery.findOne({ status: 'active', 'couponCodes.0': { $exists: true } });
  const code = ep.couponCodes[0];
  await mongoose.connection.collection('orders').insertOne({
    user: ep.user, orderNumber: 'ORD-CR-1', total: 115, discount: 12, couponCode: code,
    orderStatus: 'pending', paymentStatus: 'pending', createdAt: new Date(), updatedAt: new Date(),
  });

  const summary = await svc.runCartRecovery();
  assert.equal(summary.recovered, 1);
  const done = await CartRecovery.findById(ep._id);
  assert.equal(done.status, 'recovered');
  assert.equal(done.recoveredRevenue, 115);
  assert.equal(done.recoveredAfterStep, 2);
  assert.equal(done.couponUsed, code);
  assert.equal(done.couponDiscount, 12);
  assert.equal((await Coupon.findOne({ code })).isActive, false);

  const stats = await svc.getCartRecoveryStats({ days: 30 });
  assert.equal(stats.recovered, 1);
  assert.equal(stats.recoveredRevenue, 115);
  assert.equal(stats.recoveredWithCoupon, 1);
  const step2 = stats.perStep.find((s) => s.step === 1);
  assert.equal(step2.recovered, 1);
});

test('skips staff, small carts, and customers inside the cooldown', async (t) => {
  if (skip) return t.skip('MongoDB not reachable');
  await CartRecovery.deleteMany({});
  await Cart.deleteMany({});
  await setSettings({ minCartValue: 500 });
  await abandonedCustomer(2); // 120 EGP < 500
  await abandonedCustomer(2, { role: 'admin', username: `adm${Date.now()}` });
  let summary = await svc.runCartRecovery();
  assert.equal(summary.sent, 0);

  await setSettings({ cooldownDays: 3 });
  const { user } = await abandonedCustomer(2);
  await CartRecovery.collection.insertOne({
    user: user._id, status: 'expired', stage: 1, cartActivityAt: new Date(), steps: [], couponCodes: [],
    createdAt: new Date(Date.now() - 24 * HOUR), updatedAt: new Date(),
  });
  summary = await svc.runCartRecovery();
  assert.equal(await CartRecovery.countDocuments({ user: user._id, status: 'active' }), 0);
});

test('an episode with no order expires after the attribution window', async (t) => {
  if (skip) return t.skip('MongoDB not reachable');
  await CartRecovery.deleteMany({});
  await Cart.deleteMany({});
  await setSettings({ attributionDays: 1 });
  const userId = new mongoose.Types.ObjectId();
  const old = new Date(Date.now() - 10 * 24 * HOUR);
  await CartRecovery.collection.insertOne({
    user: userId, status: 'active', stage: 2, cartActivityAt: old, steps: [], couponCodes: [],
    firstSentAt: old, lastSentAt: old, createdAt: old, updatedAt: old,
  });
  const summary = await svc.runCartRecovery();
  assert.equal(summary.expired, 1);
});

test('fillTemplate leaves unknown placeholders intact', (t) => {
  if (skip) return t.skip('MongoDB not reachable');
  assert.equal(svc.fillTemplate('Hi {name}, {nope}', { name: 'Mona' }), 'Hi Mona, {nope}');
});
