/**
 * Upsert cleaning / household / baby / hygiene catalog (36 main categories).
 * Run: npm run seed:cleaning-catalog
 */
import 'dotenv/config';
import connectDB from '../config/db.js';
import Category from '../models/Category.js';
import Product from '../models/Product.js';
import { CLEANING_CATALOG_TREES } from './cleaningCatalog.data.js';
import {
  slugify,
  categoryImagePath,
  brandImagePath,
  buildProductDoc,
} from './cleaningCatalog.utils.js';
import { repairCategoryLinks } from '../utils/repairCategoryLinks.js';

async function upsertCategory(filter, payload) {
  return Category.findOneAndUpdate(
    filter,
    { $set: payload },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

async function upsertProduct(slug, payload) {
  return Product.findOneAndUpdate(
    { slug },
    { $set: payload },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

async function seedCleaningCatalog() {
  await connectDB();

  let mainCount = 0;
  let brandCount = 0;
  let productCount = 0;
  let productUpdated = 0;
  let productCreated = 0;

  console.log('Seeding cleaning catalog (upsert mode)...');

  for (const tree of CLEANING_CATALOG_TREES) {
    const { main, brands } = tree;

    const mainCategory = await upsertCategory(
      { slug: main.slug },
      {
        nameAr: main.nameAr,
        nameEn: main.nameEn,
        slug: main.slug,
        image: categoryImagePath(main.slug),
        level: 1,
        parentCategory: null,
        icon: main.icon || '🛒',
        color: main.color || 'bg-primary-50',
        sortOrder: main.sortOrder ?? 0,
        isActive: true,
      },
    );
    mainCount += 1;

    for (const entry of brands) {
      const brand = entry.brand;
      const brandCategory = await upsertCategory(
        { slug: brand.slug },
        {
          nameAr: brand.nameAr,
          nameEn: brand.nameEn,
          slug: brand.slug,
          image: brandImagePath(brand.slug),
          level: 2,
          parentCategory: mainCategory._id,
          icon: main.icon || '🏷️',
          color: main.color || 'bg-slate-50',
          sortOrder: brand.sortOrder ?? 0,
          isActive: true,
        },
      );
      brandCount += 1;

      for (const product of entry.products) {
        const productSlug = slugify(product.nameEn);
        const existing = await Product.findOne({ slug: productSlug }).select('_id');
        const payload = buildProductDoc({
          product,
          productSlug,
          main,
          brand,
          mainId: mainCategory._id,
          subId: brandCategory._id,
        });

        await upsertProduct(productSlug, payload);
        productCount += 1;
        if (existing) productUpdated += 1;
        else productCreated += 1;
      }
    }
  }

  console.log('Repairing category/product links...');
  const { categoriesFixed, productsFixed } = await repairCategoryLinks();
  if (categoriesFixed || productsFixed) {
    console.log(`Repaired ${categoriesFixed} categories, ${productsFixed} products`);
  }

  const dbMain = await Category.countDocuments({ level: 1, isActive: true });
  const dbBrand = await Category.countDocuments({ level: 2, isActive: true });
  const dbProducts = await Product.countDocuments({ isActive: true });

  console.log('\nCleaning catalog seed complete.');
  console.log(`  Main categories processed: ${mainCount}`);
  console.log(`  Brand subcategories processed: ${brandCount}`);
  console.log(`  Products processed: ${productCount} (${productCreated} new, ${productUpdated} updated)`);
  console.log(`  Database totals: ${dbMain} mains, ${dbBrand} brands, ${dbProducts} active products`);
  console.log('\nVerify: homepage categories, category → brand → product pages, Arabic/English search, admin edit.');

  process.exit(0);
}

seedCleaningCatalog().catch((err) => {
  console.error('Cleaning catalog seed failed:', err);
  process.exit(1);
});
