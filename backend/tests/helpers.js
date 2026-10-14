/**
 * Shared setup for the integration tests: an in-memory MongoDB, the real Express app
 * on a random port, and small factories. Each test file runs in its own process.
 *
 * mongodb-memory-server downloads a mongod binary on first run. Set
 * MONGOMS_SYSTEM_BINARY to use an existing mongod instead.
 */
import { after, before, beforeEach } from 'node:test';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'driver-tests-secret';

const { default: app } = await import('../src/app.js');
export const { default: User } = await import('../src/models/User.js');
export const { default: Order } = await import('../src/models/Order.js');
export const { default: StoreSettings } = await import('../src/models/StoreSettings.js');
export const { default: DeliveryTracking } = await import('../src/models/DeliveryTracking.js');
export const { default: UserNotification } = await import('../src/models/UserNotification.js');
export const { default: Notification } = await import('../src/models/Notification.js');
export const { default: AuditLog } = await import('../src/models/AuditLog.js');
export const { default: DriverCashLedger } = await import('../src/models/DriverCashLedger.js');
const { invalidateStoreSettingsCache } = await import('../src/services/storeSettings.service.js');

// SMS is simulated in tests (no gateway configured) and logged to the console — capture it.
export const smsLog = [];
const realLog = console.log;
console.log = (...args) => {
  const line = args.join(' ');
  if (smsLog.capture) smsLog.push(line);
  if (!process.env.TEST_QUIET) realLog(...args);
};

let mongo;
let server;
let baseUrl;
let orderSeq = 0;
let userSeq = 0;

before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  server = app.listen(0);
  baseUrl = `http://127.0.0.1:${server.address().port}/api`;
});

after(async () => {
  server?.close();
  await mongoose.disconnect();
  await mongo?.stop();
});

beforeEach(async () => {
  await mongoose.connection.db.dropDatabase();
  await Promise.all(mongoose.modelNames().map((name) => mongoose.model(name).syncIndexes()));
  invalidateStoreSettingsCache();
});

function tokenFor(user) {
  return jwt.sign({ id: user._id }, process.env.JWT_SECRET);
}

export async function api(method, path, user, body) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(user ? { Authorization: `Bearer ${tokenFor(user)}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, body: json };
}

export async function makeUser(role, extra = {}) {
  userSeq += 1;
  return User.create({
    name: `${role} ${userSeq}`,
    role,
    phone: `0100000${String(userSeq).padStart(4, '0')}`,
    ...(role === 'user' ? {} : { username: `${role}${userSeq}`, password: 'Passw0rd!123' }),
    ...extra,
  });
}

export async function makeOrder({ customer, driver = null, status = 'out_for_delivery', ...extra }) {
  orderSeq += 1;
  return Order.create({
    orderNumber: `T${1000 + orderSeq}`,
    user: customer._id,
    items: [
      { nameAr: 'منتج', nameEn: 'Item', price: 30, quantity: 2 },
      { nameAr: 'خبز', nameEn: 'Bread', price: 40, quantity: 1 },
    ],
    shippingAddress: { street: 'Tahrir St', city: 'Cairo', lat: 30.05, lng: 31.24 },
    phone: '01000000000',
    subtotal: 100,
    total: 100,
    paymentMethod: 'cod',
    paymentStatus: 'pending',
    orderStatus: status,
    assignedDriver: driver?._id || null,
    assignedDriverAt: driver ? new Date() : null,
    ...extra,
  });
}

export async function setDriverSettings(driverSettings) {
  await StoreSettings.findOneAndUpdate(
    { key: 'main' },
    { $set: { driverSettings } },
    { upsert: true, setDefaultsOnInsert: true },
  );
  invalidateStoreSettingsCache();
}

/** Fire-and-forget notices land shortly after the response; poll briefly. */
export async function waitFor(model, filter, count = 1) {
  for (let i = 0; i < 40; i += 1) {
    const found = await model.find(filter).lean();
    if (found.length >= count) return found;
    await new Promise((r) => setTimeout(r, 25));
  }
  return model.find(filter).lean();
}

export const waitForNotifications = (filter, count = 1) => waitFor(UserNotification, filter, count);
