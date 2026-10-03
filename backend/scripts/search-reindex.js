/**
 * Rebuild the Meilisearch product index from MongoDB.
 *   npm run search:reindex
 * Needs MEILI_HOST (and MEILI_API_KEY when the engine has a master key) in backend/.env.
 */
import '../src/config/loadEnv.js';
import mongoose from 'mongoose';
import connectDB from '../src/config/db.js';
import '../src/models/Category.js';
import '../src/models/Product.js';
import { fullSync, isSearchEngineConfigured } from '../src/services/searchIndex.service.js';

if (!isSearchEngineConfigured()) {
  console.error('MEILI_HOST is not set — nothing to index.');
  process.exit(1);
}

await connectDB();
try {
  await fullSync();
} catch (error) {
  console.error('Reindex failed:', error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
