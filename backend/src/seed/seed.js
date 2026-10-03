/**
 * Demo seed data — categories, products, coupons, banners for MarketPlus storefront.
 * Run: npm run seed (from project root)
 */
import 'dotenv/config';
import connectDB from '../config/db.js';
import Category from '../models/Category.js';
import Product from '../models/Product.js';
import Coupon from '../models/Coupon.js';
import User from '../models/User.js';
import Banner from '../models/Banner.js';
import ContentPage from '../models/ContentPage.js';
import StoreSettings from '../models/StoreSettings.js';
import { CONTENT_PAGE_SLUGS, DEFAULT_CONTENT_PAGES } from '../constants/contentPages.js';
import { DEFAULT_NAVIGATION, DEFAULT_PAYMENT_METHODS, DEFAULT_SEO } from '../constants/storeDefaults.js';
import { seedNotificationTemplates } from '../services/notificationTemplate.service.js';
import { SEED_CATEGORY_TREES, SEED_DEEP_CATEGORY_DEMO, SEED_PRODUCTS, SEED_COUPONS, SEED_BANNERS } from './seedData.js';
import { normalizePhone } from '../utils/phone.js';
import { repairCategoryLinks } from '../utils/repairCategoryLinks.js';
import { syncAllProductRatings } from '../utils/productRating.js';

const ADMIN_DEMO_PHONE = normalizePhone('01012345678');
/** Regular customer for storefront checkout demos (SMS OTP in dev). */
const CUSTOMER_DEMO_PHONE = normalizePhone('01098765432');

const seed = async () => {
  await connectDB();

  console.log('Clearing existing catalog...');
  await Product.deleteMany({});
  await Category.deleteMany({});
  await Coupon.deleteMany({});

  console.log('Seeding categories (3 main trees)...');
  const categoryMap = {};
  const mainMap = {};
  let subCount = 0;

  for (const tree of SEED_CATEGORY_TREES) {
    const main = await Category.create({
      ...tree.main,
      level: 1,
      parentCategory: null,
    });
    categoryMap[tree.main.slug] = main._id;
    mainMap[tree.main.slug] = main._id;

    for (const sub of tree.subs) {
      const created = await Category.create({
        ...sub,
        level: 2,
        parentCategory: main._id,
      });
      categoryMap[sub.slug] = created._id;
      subCount += 1;
    }
  }

  console.log('Seeding 4-level demo category tree...');
  const demoMain = await Category.create({
    ...SEED_DEEP_CATEGORY_DEMO.main,
    parentCategory: null,
  });
  const demoL2 = await Category.create({
    ...SEED_DEEP_CATEGORY_DEMO.level2,
    parentCategory: demoMain._id,
  });
  const demoL3 = await Category.create({
    ...SEED_DEEP_CATEGORY_DEMO.level3,
    parentCategory: demoL2._id,
  });
  const demoL4 = await Category.create({
    ...SEED_DEEP_CATEGORY_DEMO.level4,
    parentCategory: demoL3._id,
  });
  categoryMap[demoL4.slug] = demoL4._id;
  mainMap[demoMain.slug] = demoMain._id;
  subCount += 3;

  await Product.create({
    ...SEED_DEEP_CATEGORY_DEMO.product,
    mainCategory: demoMain._id,
    category: demoL4._id,
    isActive: true,
  });

  console.log('Seeding products...');
  for (const p of SEED_PRODUCTS) {
    const subId = categoryMap[p.subCategorySlug];
    const mainId = mainMap[p.mainCategorySlug];
    if (!subId || !mainId) {
      console.warn(`Skipping product ${p.slug}: missing category`);
      continue;
    }
    await Product.create({
      nameAr: p.nameAr,
      nameEn: p.nameEn,
      slug: p.slug,
      price: p.price,
      oldPrice: p.oldPrice || undefined,
      mainCategory: mainId,
      category: subId,
      emoji: p.emoji,
      unit: p.unit,
      stock: p.stock,
      isOffer: p.isOffer,
      isFeatured: p.isFeatured ?? false,
      brand: p.brand || 'MarketPlus',
      soldCount: p.soldCount ?? Math.floor(Math.random() * 400) + 50,
      isActive: true,
    });
  }

  console.log('Syncing product ratings from approved reviews...');
  const { total: ratingTotal, updated: ratingsUpdated } = await syncAllProductRatings(Product);
  console.log(`Ratings synced: ${ratingsUpdated}/${ratingTotal} products updated`);

  console.log('Repairing category/product links...');
  const { categoriesFixed, productsFixed } = await repairCategoryLinks();
  if (categoriesFixed || productsFixed) {
    console.log(`Repaired ${categoriesFixed} categories, ${productsFixed} products`);
  }

  console.log('Seeding coupons...');
  for (const coupon of SEED_COUPONS) {
    await Coupon.create(coupon);
  }

  console.log('Seeding banners...');
  await Banner.deleteMany({});
  for (const banner of SEED_BANNERS) {
    await Banner.create(banner);
  }

  console.log('Seeding content pages...');
  for (let i = 0; i < CONTENT_PAGE_SLUGS.length; i += 1) {
    const slug = CONTENT_PAGE_SLUGS[i];
    await ContentPage.findOneAndUpdate(
      { slug },
      { ...DEFAULT_CONTENT_PAGES[slug], sortOrder: i, isActive: true },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }

  console.log('Seeding store settings defaults...');
  let storeSettings = await StoreSettings.findOne({ key: 'main' });
  if (!storeSettings) {
    await StoreSettings.create({
      key: 'main',
      navigation: DEFAULT_NAVIGATION,
      seo: DEFAULT_SEO,
      paymentMethods: DEFAULT_PAYMENT_METHODS,
    });
  } else {
    if (!storeSettings.navigation?.headerLinks?.length) storeSettings.navigation = DEFAULT_NAVIGATION;
    if (!storeSettings.seo?.defaultTitleAr) storeSettings.seo = DEFAULT_SEO;
    if (!storeSettings.paymentMethods?.length) storeSettings.paymentMethods = DEFAULT_PAYMENT_METHODS;
    await storeSettings.save();
  }

  console.log('Seeding notification templates...');
  await seedNotificationTemplates();

  console.log('Ensuring admin user...');
  const adminPassword = process.env.ADMIN_PASSWORD?.trim() || (process.env.NODE_ENV !== 'production' ? 'admin123' : null);
  let admin = await User.findOne({
    $or: [{ phone: ADMIN_DEMO_PHONE }, { email: 'admin@marketplus.com' }, { username: 'superadmin' }],
  });
  if (!admin) {
    await User.create({
      name: 'MarketPlus Admin',
      username: 'superadmin',
      phone: ADMIN_DEMO_PHONE,
      role: 'super_admin',
      isPhoneVerified: true,
      mfaEnabled: true,
      password: adminPassword || 'admin123',
      isActive: true,
    });
    console.log('Admin created: username superadmin');
  } else {
    admin.phone = ADMIN_DEMO_PHONE;
    admin.username = 'superadmin';
    admin.role = 'super_admin';
    admin.isPhoneVerified = true;
    admin.mfaEnabled = true;
    admin.isActive = true;
    if (adminPassword) {
      admin.password = adminPassword;
    }
    await admin.save();
    console.log(`Admin updated: username ${admin.username}`);
  }

  console.log('Ensuring demo shopper...');
  const demoAddress = {
    label: 'Home',
    street: '15 Nile Street',
    building: '12',
    floor: '3',
    city: 'Cairo',
    governorate: 'Cairo',
    area: 'Maadi',
    isDefault: true,
  };
  let customer = await User.findOne({ phone: CUSTOMER_DEMO_PHONE });
  if (!customer) {
    await User.create({
      name: 'Demo Shopper',
      phone: CUSTOMER_DEMO_PHONE,
      role: 'user',
      isPhoneVerified: true,
      mfaEnabled: true,
      addresses: [demoAddress],
    });
    console.log('Demo shopper created: 01098765432 (role: user)');
  } else {
    customer.name = 'Demo Shopper';
    customer.role = 'user';
    customer.isPhoneVerified = true;
    customer.mfaEnabled = true;
    customer.password = undefined;
    if (!customer.addresses?.length) {
      customer.addresses = [demoAddress];
    }
    await customer.save({ validateBeforeSave: false });
    console.log('Demo shopper updated: 01098765432');
  }

  console.log('');
  console.log('--- Demo accounts (development) ---');
  console.log('Storefront login:  01098765432  →  enter 1098765432 in the app');
  console.log('Admin panel:       /admin/login  →  username: superadmin + ADMIN_PASSWORD (dev default: admin123)');
  console.log('Admin OTP (legacy):  01012345678  →  enter 1012345678 in the app');
  console.log('OTP: shown on screen + backend console when NODE_ENV=development');
  console.log('Coupons to try:    FIRST20, SAVE50, or FREESHIP');
  console.log('');

  console.log('4-level demo path: /category/grocery-demo/dairy-demo/milk-demo/fresh-milk-demo');
  console.log(`Done! ${SEED_CATEGORY_TREES.length + 1} main categories, ${subCount} nested categories, ${SEED_PRODUCTS.length + 1} products, ${SEED_COUPONS.length} coupons, ${SEED_BANNERS.length} banners.`);
  process.exit(0);
};

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
