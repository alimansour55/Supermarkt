import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Order from '../src/models/Order.js';

dotenv.config();

const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
if (!uri) {
  console.error('No MONGODB_URI');
  process.exit(1);
}

await mongoose.connect(uri);

const q1 = await Order.countDocuments({ 'returns.0': { $exists: true } });
const q2 = await Order.countDocuments({ returns: { $exists: true, $ne: [] } });
const samples = await Order.find({ returns: { $exists: true, $not: { $size: 0 } } })
  .select('orderNumber returns')
  .limit(10)
  .lean();

console.log('returns.0 exists:', q1);
console.log('returns non-empty:', q2);
console.log('samples:', JSON.stringify(samples, null, 2));

await mongoose.disconnect();
