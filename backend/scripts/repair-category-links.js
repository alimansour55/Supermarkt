/**
 * Repair product ↔ category links and category levels.
 * Run: npm run repair:categories
 * Dry run: npm run repair:categories -- --dry-run
 */
import 'dotenv/config';
import connectDB from '../src/config/db.js';
import {
  repairCategoryLinks,
  scanProductCategoryIntegrity,
} from '../src/utils/repairCategoryLinks.js';

const dryRun = process.argv.includes('--dry-run');
const scanOnly = process.argv.includes('--scan');

async function main() {
  await connectDB();

  console.log(`Category repair ${dryRun ? '(dry run)' : ''}${scanOnly ? ' — scan only' : ''}\n`);

  const scan = await scanProductCategoryIntegrity({ sampleLimit: 20 });
  console.log('Scan summary:');
  console.log(`  Total products:     ${scan.totalProducts}`);
  console.log(`  Healthy:            ${scan.healthyCount}`);
  console.log(`  With issues:        ${scan.issueCount}`);
  console.log(`  Auto-repairable:    ${scan.repairableCount}`);
  console.log(`  Needs manual fix:   ${scan.unrepairableCount}`);
  console.log('  By issue type:', scan.byIssue);

  if (scan.samples.length) {
    console.log('\nSample issues:');
    scan.samples.slice(0, 10).forEach((row) => {
      console.log(`  - ${row.slug}: ${row.issues.map((i) => i.code).join(', ')}`);
    });
  }

  if (scanOnly) {
    process.exit(0);
  }

  const result = await repairCategoryLinks({ dryRun });
  console.log('\nRepair result:');
  console.log(`  Categories fixed:   ${result.categoriesFixed}`);
  console.log(`  Products fixed:     ${result.productsFixed}`);
  console.log(`  Products would fix: ${result.productsWouldFix}`);
  console.log(`  Unrepairable:       ${result.productsUnrepairable}`);
  console.log(`  Already OK:         ${result.productsOk}`);

  if (dryRun) {
    console.log('\nRe-run without --dry-run to apply changes.');
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('Repair failed:', err);
  process.exit(1);
});
