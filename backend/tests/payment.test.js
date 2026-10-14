import mongoose from 'mongoose';
import { describe, expect, it } from 'vitest';
import Order from '../src/models/Order.js';
import { markOrderFailed, markOrderPaid } from '../src/controllers/payment.controller.js';

async function insertOrder(fields = {}) {
  const _id = new mongoose.Types.ObjectId();
  await Order.collection.insertOne({
    _id,
    orderNumber: `T${_id}`,
    user: new mongoose.Types.ObjectId(),
    items: [],
    total: 100,
    paymentStatus: 'pending',
    orderStatus: 'pending',
    ...fields,
  });
  return _id;
}

describe('payment status transitions', () => {
  it('marks paid once even when webhook and confirm race', async () => {
    const id = await insertOrder();

    const results = await Promise.all([markOrderPaid(id, 'pi_1'), markOrderPaid(id, 'pi_1')]);

    expect(results.every((o) => o.paymentStatus === 'paid')).toBe(true);
    expect((await Order.findById(id).lean()).stripeSessionId).toBe('pi_1');
  });

  it('a late failure event never downgrades a paid order', async () => {
    const id = await insertOrder({ paymentStatus: 'paid' });

    expect(await markOrderFailed(id)).toBeNull();
    expect((await Order.findById(id).lean()).paymentStatus).toBe('paid');
  });

  it('marks an unpaid order failed', async () => {
    const id = await insertOrder();

    expect((await markOrderFailed(id)).paymentStatus).toBe('failed');
  });
});
