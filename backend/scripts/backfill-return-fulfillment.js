import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Order from '../src/models/Order.js';

dotenv.config();
await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);

const orders = await Order.find({ 'returns.0': { $exists: true } });
let updated = 0;

for (const order of orders) {
  let dirty = false;
  for (const ret of order.returns || []) {
    if (ret.status === 'approved' && !ret.fulfillmentStatus) {
      ret.fulfillmentStatus = 'confirmed';
      dirty = true;
    }
    if (ret.status === 'pending' && !ret.fulfillmentStatus) {
      ret.fulfillmentStatus = 'requested';
      dirty = true;
    }
  }
  if (dirty) {
    await order.save();
    updated += 1;
  }
}

console.log(`Backfilled fulfillment on ${updated} order(s)`);
await mongoose.disconnect();
