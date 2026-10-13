import mongoose from 'mongoose';
import { describe, expect, it } from 'vitest';
import User from '../src/models/User.js';
import Coupon from '../src/models/Coupon.js';
import WalletTransaction from '../src/models/WalletTransaction.js';
import { creditWallet, spendWalletForOrder } from '../src/services/wallet.service.js';
import { releaseCouponRedemption, reserveCouponRedemption } from '../src/services/coupon.service.js';
import { runAtomic, supportsTransactions } from '../src/utils/transaction.js';

const oid = () => new mongoose.Types.ObjectId();

async function insertCustomer(fields = {}) {
  const _id = oid();
  await User.collection.insertOne({
    _id, name: 'Test', phone: '01000000000', role: 'customer', walletBalance: 0, ...fields,
  });
  return _id;
}

const MODES = [
  ['transaction', undefined],
  ['compensating fallback', 'off'],
];

describe('runAtomic', () => {
  it('uses real transactions on a replica set', () => {
    expect(supportsTransactions()).toBe(true);
    process.env.MONGODB_TRANSACTIONS = 'off';
    expect(supportsTransactions()).toBe(false);
  });

  it.each(MODES)('undoes wallet spend and coupon claim when a later step fails (%s)', async (_label, mode) => {
    if (mode) process.env.MONGODB_TRANSACTIONS = mode;
    const userId = await insertCustomer({ walletBalance: 100 });
    await Coupon.collection.insertOne({
      code: 'ONCE', isActive: true, usageLimit: 1, usedCount: 0,
    });
    const order = { _id: oid(), orderNumber: 'T-1' };

    await expect(runAtomic(async ({ session, onRollback }) => {
      expect(await reserveCouponRedemption('ONCE', session)).toBeTruthy();
      onRollback(() => releaseCouponRedemption('ONCE'));

      const spent = await spendWalletForOrder({ userId, order, walletApplied: 60, session });
      expect(spent.balanceAfter).toBe(40);
      onRollback(() => creditWallet({ userId, amount: 60, type: 'reversal', method: 'order' }));

      throw new Error('stock ran out');
    })).rejects.toThrow('stock ran out');

    expect((await User.findById(userId).lean()).walletBalance).toBe(100);
    expect((await Coupon.findOne({ code: 'ONCE' }).lean()).usedCount).toBe(0);
    if (!mode) {
      // A real abort leaves no ledger trace at all.
      expect(await WalletTransaction.countDocuments({ user: userId })).toBe(0);
    }
  });

  it('commits everything when the work succeeds', async () => {
    const userId = await insertCustomer({ walletBalance: 50 });

    await runAtomic(({ session }) => spendWalletForOrder({
      userId, order: { _id: oid(), orderNumber: 'T-2' }, walletApplied: 20, session,
    }));

    expect((await User.findById(userId).lean()).walletBalance).toBe(30);
    expect(await WalletTransaction.countDocuments({ user: userId, type: 'spend' })).toBe(1);
  });

  it('refuses to spend more than the balance', async () => {
    const userId = await insertCustomer({ walletBalance: 10 });

    const spent = await spendWalletForOrder({
      userId, order: { _id: oid(), orderNumber: 'T-3' }, walletApplied: 25,
    });

    expect(spent).toBeNull();
    expect((await User.findById(userId).lean()).walletBalance).toBe(10);
  });
});
