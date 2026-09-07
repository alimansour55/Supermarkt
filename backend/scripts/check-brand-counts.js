import 'dotenv/config';
import connectDB from '../src/config/db.js';
import Product from '../src/models/Product.js';
import Brand from '../src/models/Brand.js';
import { countActiveProductsForBrand } from '../src/utils/brandProductFilter.js';

await connectDB();

const brands = await Brand.find({ isActive: true });
const mismatches = [];

for (const b of brands) {
  const exact = await Product.countDocuments({ isActive: true, brand: b.queryValue });
  const unified = await countActiveProductsForBrand(Product, Brand, b);
  if (exact !== unified) {
    mismatches.push({ name: b.queryValue, exact, unified });
  }
}

console.log('Mismatches:', mismatches.length ? mismatches : 'none');

const agg = await Product.aggregate([
  { $match: { isActive: true, brand: { $nin: [null, ''] } } },
  { $group: { _id: '$brand', count: { $sum: 1 } } },
  { $sort: { count: -1 } },
]);
console.log('Distinct brand values:', agg);

process.exit(0);
