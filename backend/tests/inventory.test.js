import mongoose from 'mongoose';
import { describe, expect, it } from 'vitest';
import Product from '../src/models/Product.js';
import StockReservation from '../src/models/StockReservation.js';
import {
  commitOrderInventory,
  decrementLineStock,
  incrementLineStock,
  syncInventoryReservations,
} from '../src/services/inventoryReservation.service.js';
import { restoreOrderInventory } from '../src/services/orderManagement.service.js';
import { runAtomic } from '../src/utils/transaction.js';

const oid = () => new mongoose.Types.ObjectId();

/** Raw insert: these tests exercise stock arithmetic, not product validation. */
async function insertProduct(fields = {}) {
  const _id = oid();
  await Product.collection.insertOne({
    _id,
    slug: `product-${_id}`,
    nameAr: 'منتج',
    nameEn: 'Product',
    isActive: true,
    stock: 0,
    reservedStock: 0,
    soldCount: 0,
    variants: [],
    ...fields,
  });
  return Product.findById(_id);
}

describe('decrementLineStock', () => {
  it('never sells more than the stock under concurrent checkouts', async () => {
    const product = await insertProduct({ stock: 3 });

    const results = await Promise.all(
      Array.from({ length: 10 }, () => decrementLineStock(product, null, 1)),
    );

    expect(results.filter(Boolean)).toHaveLength(3);
    const after = await Product.findById(product._id).lean();
    expect(after.stock).toBe(0);
    expect(after.soldCount).toBe(3);
  });

  it('refuses a quantity larger than the stock and leaves it untouched', async () => {
    const product = await insertProduct({ stock: 2 });

    expect(await decrementLineStock(product, null, 3)).toBe(false);
    expect((await Product.findById(product._id).lean()).stock).toBe(2);
  });

  it('decrements only the matching variant', async () => {
    const small = oid();
    const large = oid();
    const product = await insertProduct({
      variants: [
        { _id: small, valueAr: 'صغير', valueEn: 'Small', stock: 5, reservedStock: 0 },
        { _id: large, valueAr: 'كبير', valueEn: 'Large', stock: 1, reservedStock: 0 },
      ],
    });

    expect(await decrementLineStock(product, large, 1)).toBe(true);
    expect(await decrementLineStock(product, large, 1)).toBe(false);

    const after = await Product.findById(product._id).lean();
    expect(after.variants.find((v) => v._id.equals(small)).stock).toBe(5);
    expect(after.variants.find((v) => v._id.equals(large)).stock).toBe(0);
  });

  it('incrementLineStock puts stock back and floors soldCount at 0', async () => {
    const product = await insertProduct({ stock: 1, soldCount: 0 });

    await incrementLineStock(product, null, 2);

    const after = await Product.findById(product._id).lean();
    expect(after.stock).toBe(3);
    expect(after.soldCount).toBe(0);
  });
});

describe('commitOrderInventory', () => {
  it('takes stock and clears the user reservation', async () => {
    const user = oid();
    const product = await insertProduct({ stock: 5 });
    await syncInventoryReservations(user, [{ productId: product._id, quantity: 2 }]);
    expect((await Product.findById(product._id).lean()).reservedStock).toBe(2);

    await commitOrderInventory(user, [{ product: product._id, quantity: 2 }]);

    const after = await Product.findById(product._id).lean();
    expect(after.stock).toBe(3);
    expect(after.reservedStock).toBe(0);
    expect(await StockReservation.countDocuments({ user })).toBe(0);
  });

  it.each([
    ['transaction', undefined],
    ['compensating fallback', 'off'],
  ])('rolls every line back when one is sold out (%s)', async (_label, mode) => {
    if (mode) process.env.MONGODB_TRANSACTIONS = mode;
    const user = oid();
    const plenty = await insertProduct({ stock: 10 });
    const scarce = await insertProduct({ stock: 1 });

    await expect(runAtomic(({ session, onRollback }) => commitOrderInventory(
      user,
      [
        { product: plenty._id, quantity: 4 },
        { product: scarce._id, quantity: 2 },
      ],
      { session, onRollback, lang: 'en' },
    ))).rejects.toMatchObject({ statusCode: 409 });

    expect((await Product.findById(plenty._id).lean()).stock).toBe(10);
    expect((await Product.findById(scarce._id).lean()).stock).toBe(1);
  });
});

describe('restoreOrderInventory', () => {
  it('returns cancelled quantities to stock', async () => {
    const product = await insertProduct({ stock: 0, soldCount: 3 });

    await restoreOrderInventory([{ product: product._id, quantity: 3 }]);

    const after = await Product.findById(product._id).lean();
    expect(after.stock).toBe(3);
    expect(after.soldCount).toBe(0);
  });
});
