/**
 * Lists product barcodes used by more than one product.
 *
 *   node scripts/check-duplicate-barcodes.js                 # report only
 *   node scripts/check-duplicate-barcodes.js --create-index  # also add a unique index (only if no duplicates)
 *
 * --create-index first unsets empty-string barcodes, then creates a unique partial
 * index on non-empty `barcode` values. Fix any reported duplicates in the admin first.
 */
import 'dotenv/config';
import connectDB from '../src/config/db.js';
import Product from '../src/models/Product.js';

const INDEX_NAME = 'barcode_unique_non_empty';
const createIndex = process.argv.includes('--create-index');

await connectDB();

const duplicates = await Product.aggregate([
  { $match: { barcode: { $type: 'string', $gt: '' } } },
  { $group: { _id: '$barcode', count: { $sum: 1 }, products: { $push: { id: '$_id', nameEn: '$nameEn', slug: '$slug' } } } },
  { $match: { count: { $gt: 1 } } },
  { $sort: { count: -1 } },
]);

if (duplicates.length) {
  console.log(`Found ${duplicates.length} duplicated barcode(s):`);
  duplicates.forEach((d) => {
    console.log(`\n  ${d._id} (${d.count} products)`);
    d.products.forEach((p) => console.log(`    - ${p.nameEn || '(no name)'}  [${p.slug}]  ${p.id}`));
  });
} else {
  console.log('No duplicated barcodes.');
}

if (createIndex) {
  if (duplicates.length) {
    console.error('\nNot creating the unique index — resolve the duplicates above first.');
    process.exit(1);
  }
  const { modifiedCount } = await Product.collection.updateMany({ barcode: '' }, { $unset: { barcode: '' } });
  console.log(`Unset ${modifiedCount} empty barcode value(s).`);
  await Product.collection.createIndex(
    { barcode: 1 },
    { name: INDEX_NAME, unique: true, partialFilterExpression: { barcode: { $type: 'string', $gt: '' } } },
  );
  console.log(`Unique index "${INDEX_NAME}" is in place.`);
}

process.exit(0);
