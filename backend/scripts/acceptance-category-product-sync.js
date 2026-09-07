/**
 * Category ↔ product sync — acceptance tests (definition of done).
 *
 * Run:  npm run test:acceptance:categories
 * Keeps DB clean: creates prefixed fixtures and deletes them at the end.
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import connectDB from '../src/config/db.js';
import Product from '../src/models/Product.js';
import Category from '../src/models/Category.js';
import HomepageSection from '../src/models/HomepageSection.js';
import {
  applyProductCategoryQueryToFilter,
  mergeCategoryIntoProductFilter,
} from '../src/utils/categoryTree.js';
import {
  resolveProductCategoryFields,
  resolveProductCategoryFieldsFromImport,
} from '../src/utils/productCategorySync.js';
import { attachSectionCategoryMeta } from '../src/utils/homepageSectionCategory.js';
import { scanProductCategoryIntegrity, diagnoseProductCategory } from '../src/utils/repairCategoryLinks.js';

const PREFIX = `acc-${Date.now()}`;
const results = [];

function pass(name, detail = '') {
  results.push({ name, ok: true, detail });
  console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ''}`);
}

function fail(name, detail = '') {
  results.push({ name, ok: false, detail });
  console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
}

async function expectThrows(label, fn, includes = '') {
  try {
    await fn();
    fail(label, `expected error${includes ? ` containing "${includes}"` : ''}`);
    return false;
  } catch (err) {
    const msg = err?.message || String(err);
    if (includes && !msg.toLowerCase().includes(includes.toLowerCase())) {
      fail(label, `wrong error: ${msg}`);
      return false;
    }
    pass(label, includes || msg.slice(0, 80));
    return true;
  }
}

async function productInFilter(productId, query) {
  const filter = { _id: productId, isActive: true };
  await applyProductCategoryQueryToFilter(filter, query);
  return Product.exists(filter);
}

async function createCategory({ nameEn, slug, parent = null, level = 1, isActive = true }) {
  return Category.create({
    nameAr: nameEn,
    nameEn,
    slug: `${PREFIX}-${slug}`,
    parentCategory: parent?._id || null,
    level,
    isActive,
    sortOrder: 0,
  });
}

async function cleanup() {
  const slugRx = new RegExp(`^${PREFIX}`);
  const cats = await Category.find({ slug: slugRx }).select('_id');
  const catIds = cats.map((c) => c._id);
  await Product.deleteMany({ slug: slugRx });
  await Product.deleteMany({ subCategory: { $in: catIds } });
  await HomepageSection.deleteMany({ titleEn: slugRx });
  await Category.deleteMany({ _id: { $in: catIds } });
}

async function runCreateFlow() {
  console.log('\n— Create flow —');

  const main = await createCategory({ nameEn: 'Accept Main', slug: 'main', level: 1 });
  const mid = await createCategory({ nameEn: 'Accept Mid', slug: 'mid', parent: main, level: 2 });
  const leaf = await createCategory({ nameEn: 'Accept Leaf', slug: 'leaf', parent: mid, level: 3 });

  const fields = await resolveProductCategoryFields({
    mainCategory: main._id,
    subCategory: leaf._id,
    category: leaf._id,
  });

  const product = await Product.create({
    nameAr: 'منتج قبول',
    nameEn: `${PREFIX}-product`,
    slug: `${PREFIX}-product`,
    price: 10,
    stock: 5,
    isActive: true,
    ...fields,
  });

  const adminByLeaf = await productInFilter(product._id, { subCategory: String(leaf._id) });
  const adminByMain = await productInFilter(product._id, { mainCategory: String(main._id) });
  const storefrontLeaf = await productInFilter(product._id, { category: leaf._id });
  const storefrontParent = await productInFilter(product._id, { category: mid._id });

  if (adminByLeaf) pass('Admin list: leaf subCategory filter');
  else fail('Admin list: leaf subCategory filter');

  if (adminByMain) pass('Admin list: main category filter');
  else fail('Admin list: main category filter');

  if (storefrontLeaf) pass('Storefront: leaf category filter');
  else fail('Storefront: leaf category filter');

  if (storefrontParent) pass('Storefront: parent category expands to leaf');
  else fail('Storefront: parent category expands to leaf');

  const searchHit = await Product.exists({
    _id: product._id,
    $or: [
      { nameEn: { $regex: PREFIX, $options: 'i' } },
      { nameAr: { $regex: 'منتج', $options: 'i' } },
    ],
  });
  if (searchHit) pass('Search: product findable by name');
  else fail('Search: product findable by name');

  const section = await HomepageSection.create({
    type: 'product_grid',
    titleEn: `${PREFIX}-section`,
    titleAr: 'قسم قبول',
    category: mid._id,
    productQuery: { limit: 8, sort: 'newest' },
    isActive: true,
    sortOrder: 9999,
  });
  await section.populate('category', 'slug nameAr nameEn isActive');
  const sectionFilter = { isActive: true };
  await mergeCategoryIntoProductFilter(sectionFilter, mid._id);
  const inSection = await Product.exists({ _id: product._id, ...sectionFilter });
  if (inSection) pass('Homepage section: product via parent category link');
  else fail('Homepage section: product via parent category link');

  const meta = attachSectionCategoryMeta(section, {});
  if (!meta.categoryIssue) pass('Homepage section: category meta healthy');
  else fail('Homepage section: category meta healthy', meta.categoryIssue);

  return { main, mid, leaf, product, section };
}

async function runEditFlow(ctx) {
  console.log('\n— Edit flow —');
  const { main, leaf, product } = ctx;

  const leaf2 = await createCategory({ nameEn: 'Accept Leaf 2', slug: 'leaf-2', parent: main, level: 2 });
  const newFields = await resolveProductCategoryFields({
    mainCategory: main._id,
    subCategory: leaf2._id,
    category: leaf2._id,
  });

  await Product.updateOne({ _id: product._id }, { $set: newFields });

  const stillOnOld = await productInFilter(product._id, { subCategory: String(leaf._id) });
  const onNew = await productInFilter(product._id, { subCategory: String(leaf2._id) });

  if (!stillOnOld) pass('Edit: old leaf filter no longer matches');
  else fail('Edit: old leaf filter no longer matches');

  if (onNew) pass('Edit: new leaf filter matches');
  else fail('Edit: new leaf filter matches');

  const doc = await Product.findById(product._id);
  if (
    String(doc.mainCategory) === String(main._id)
    && String(doc.subCategory) === String(leaf2._id)
    && String(doc.category) === String(leaf2._id)
  ) {
    pass('Edit: mainCategory / subCategory / category in sync');
  } else {
    fail('Edit: mainCategory / subCategory / category in sync');
  }

  ctx.leaf2 = leaf2;
}

async function runEdgeCases(ctx) {
  console.log('\n— Edge cases —');
  const { main, mid, product } = ctx;

  const inactive = await createCategory({
    nameEn: 'Accept Inactive',
    slug: 'inactive-leaf',
    parent: main,
    level: 2,
    isActive: false,
  });

  await expectThrows(
    'Inactive category: create rejected',
    () => resolveProductCategoryFields({
      mainCategory: main._id,
      subCategory: inactive._id,
      category: inactive._id,
    }),
    'inactive',
  );

  await expectThrows(
    'Parent (non-leaf) category: create rejected',
    () => resolveProductCategoryFields({
      mainCategory: main._id,
      subCategory: mid._id,
      category: mid._id,
    }),
    'subcategory',
  );

  await expectThrows(
    'Import bad slug: rejected',
    () => resolveProductCategoryFieldsFromImport({ categorySlug: `${PREFIX}-does-not-exist` }),
    'not found',
  );

  await expectThrows(
    'Import parent slug as leaf: rejected',
    () => resolveProductCategoryFieldsFromImport({ categorySlug: mid.slug }),
    'subcategor',
  );

  const fakeId = new mongoose.Types.ObjectId();
  await Product.collection.updateOne(
    { _id: product._id },
    { $set: { subCategory: fakeId, category: fakeId } },
  );

  const orphanedDoc = await Product.findById(product._id).lean();
  const diagnosis = await diagnoseProductCategory(orphanedDoc);
  const hasOrphan = diagnosis.issues?.some((i) => i.code === 'orphaned_ref');
  if (hasOrphan) {
    pass('Orphaned category ref: integrity scan flags product');
  } else {
    fail('Orphaned category ref: integrity scan flags product', diagnosis.issues?.map((i) => i.code).join(', ') || 'none');
  }

  const scan = await scanProductCategoryIntegrity({ sampleLimit: 50 });
  if (scan.issueCount > 0) pass('Integrity scan: detects issues in database', `${scan.issueCount} total`);
  else fail('Integrity scan: detects issues in database');

  const fields = await resolveProductCategoryFields({
    mainCategory: main._id,
    subCategory: ctx.leaf2._id,
    category: ctx.leaf2._id,
  });
  await Product.collection.updateOne({ _id: product._id }, { $set: fields });

  const bulkTarget = await resolveProductCategoryFields({
    mainCategory: main._id,
    subCategory: ctx.leaf2._id,
    category: ctx.leaf2._id,
  });
  await Product.collection.updateOne({ _id: product._id }, { $set: bulkTarget });
  const afterBulk = await Product.findById(product._id);
  if (String(afterBulk.subCategory) === String(ctx.leaf2._id)) {
    pass('Bulk category change: subCategory updated');
  } else {
    fail('Bulk category change: subCategory updated');
  }

  await expectThrows(
    'Bulk to parent category: rejected',
    () => resolveProductCategoryFields({
      mainCategory: main._id,
      subCategory: mid._id,
      category: mid._id,
    }),
    'subcategory',
  );

  const deletedSection = await HomepageSection.create({
    type: 'category_spotlight',
    titleEn: `${PREFIX}-orphan-section`,
    titleAr: 'قسم يتيم',
    category: fakeId,
    isActive: true,
    sortOrder: 9998,
  });
  const orphanMeta = {};
  attachSectionCategoryMeta(deletedSection, orphanMeta);
  if (orphanMeta.categoryIssue === 'missing') {
    pass('Homepage section: deleted category → categoryIssue missing');
  } else {
    fail('Homepage section: deleted category → categoryIssue missing', orphanMeta.categoryIssue || 'none');
  }
}

async function main() {
  console.log(`Category/product acceptance tests (${PREFIX})`);
  await connectDB();

  try {
    const ctx = await runCreateFlow();
    await runEditFlow(ctx);
    await runEdgeCases(ctx);
  } finally {
    await cleanup();
    await mongoose.disconnect();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    console.error('\nFailed:');
    failed.forEach((r) => console.error(`  - ${r.name}: ${r.detail}`));
    process.exit(1);
  }
  console.log('\nAll acceptance checks passed.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Acceptance run failed:', err);
  process.exit(1);
});
