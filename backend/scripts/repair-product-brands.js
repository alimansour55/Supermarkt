/**
 * Align product.brand with Brand.queryValue for storefront brand filtering.
 * Run: npm run repair:brands
 * Dry run: npm run repair:brands -- --dry-run
 */
import 'dotenv/config';
import connectDB from '../src/config/db.js';
import { repairProductBrands } from '../src/utils/repairProductBrands.js';

const dryRun = process.argv.includes('--dry-run');

async function main() {
  await connectDB();

  console.log(`Product brand repair ${dryRun ? '(dry run)' : ''}\n`);

  const result = await repairProductBrands({ dryRun });

  console.log('Result:');
  console.log(`  Brands created:     ${result.brandsCreated}`);
  console.log(`  Brands merged:      ${result.brandsMerged ?? 0}`);
  console.log(`  Brands deleted:     ${result.brandsDeleted ?? 0}`);
  console.log(`  Products fixed:     ${result.productsFixed}`);
  console.log(`  Already OK:         ${result.productsOk}`);
  console.log(`  Unrepairable:       ${result.productsUnrepairable}`);

  if (result.samples.length) {
    console.log('\nSamples:');
    result.samples.forEach((row) => {
      if (row.issue) {
        console.log(`  - ${row.slug}: ${row.issue}`);
      } else {
        console.log(`  - ${row.slug}: ${row.from || '(empty)'} → ${row.to} (${row.reason})`);
      }
    });
  }

  if (dryRun) {
    console.log('\nRe-run without --dry-run to apply changes.');
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('Repair failed:', err);
  process.exit(1);
});
