/**
 * One-time cleanup: drop the retired Product.subCategory field (superseded by
 * `category`) and its index, once no application code reads or writes it.
 *
 * Aborts without changing anything if products still disagree on category vs
 * subCategory, or are missing categoryAncestors — run `npm run migrate:category-tree`
 * first in that case.
 *
 * Run:      npm run migrate:drop-subcategory
 * Dry run:  npm run migrate:drop-subcategory -- --dry-run
 */
import 'dotenv/config';
import connectDB from '../src/config/db.js';
import { removeProductSubCategoryField } from '../src/utils/removeProductSubCategoryField.js';

const dryRun = process.argv.includes('--dry-run');

async function main() {
  await connectDB();
  console.log(`Drop Product.subCategory migration ${dryRun ? '(dry run)' : ''}\n`);

  const result = await removeProductSubCategoryField({ dryRun });

  if (result.reason === 'mismatch') {
    console.error(`Aborted: ${result.scan.mismatched.length} product(s) have subCategory != category.`);
    console.error('Run `npm run migrate:category-tree` first, then retry. Sample:');
    result.scan.mismatched.slice(0, 10).forEach((p) => {
      console.error(`  - ${p.slug || p._id}: category=${p.category} subCategory=${p.subCategory}`);
    });
    process.exit(1);
  }

  if (result.reason === 'missing_ancestors') {
    console.error(`Aborted: ${result.scan.missingAncestors} product(s) are missing categoryAncestors.`);
    console.error('Run `npm run migrate:category-tree` first, then retry.');
    process.exit(1);
  }

  console.log(`Products with a stale subCategory field: ${result.scan.staleFieldCount}`);

  if (dryRun) {
    console.log('\nDry run — nothing changed. Re-run without --dry-run to apply.');
    process.exit(0);
  }

  console.log(`Unset subCategory on ${result.modifiedCount} product(s).`);
  console.log(`Dropped subCategory_1 index: ${result.indexDropped ? 'yes' : 'already gone'}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
