/**
 * Backfill the category materialized path (ancestors / depth / level) and each
 * product's categoryAncestors, so category product listings work for products
 * attached at any depth — not only leaf nodes.
 *
 * Idempotent. Safe to run repeatedly.
 *
 * Run:      npm run migrate:category-tree
 * Dry run:  npm run migrate:category-tree -- --dry-run
 */
import 'dotenv/config';
import connectDB from '../src/config/db.js';
import { repairCategoryLinks } from '../src/utils/repairCategoryLinks.js';

const dryRun = process.argv.includes('--dry-run');

async function main() {
  await connectDB();
  console.log(`Category tree migration ${dryRun ? '(dry run)' : ''}\n`);

  const result = await repairCategoryLinks({ dryRun });

  console.log('Result:');
  console.log(`  Categories updated (ancestors/depth/level): ${result.categoriesFixed}`);
  console.log(`  Products updated (categoryAncestors + links): ${result.productsFixed || result.productsWouldFix}`);
  console.log(`  Products already consistent:                  ${result.productsOk}`);
  console.log(`  Products needing manual fix:                  ${result.productsUnrepairable}`);

  if (dryRun) console.log('\nRe-run without --dry-run to apply.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
