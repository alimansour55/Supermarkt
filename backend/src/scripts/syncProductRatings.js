/**
 * Reset every product.rating from approved reviews only (clears fake seed ratings).
 * Run: npm run sync-ratings
 */
import 'dotenv/config';
import connectDB from '../config/db.js';
import Product from '../models/Product.js';
import { syncAllProductRatings } from '../utils/productRating.js';

const run = async () => {
  await connectDB();
  const result = await syncAllProductRatings(Product);
  console.log(`Synced ratings: ${result.updated}/${result.total} products updated`);
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
