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
import { SEED_CATEGORIES, SEED_PRODUCTS, SEED_COUPONS, SEED_BANNERS } from './seedData.js';
import { normalizePhone } from '../utils/phone.js';

const ADMIN_DEMO_PHONE = normalizePhone('01012345678');
/** Regular customer for storefront checkout demos (SMS OTP in dev). */
const CUSTOMER_DEMO_PHONE = normalizePhone('01098765432');

const seed = async () => {
  await connectDB();

  console.log('Clearing existing catalog...');
  await Product.deleteMany({});
  await Category.deleteMany({});
  await Coupon.deleteMany({});

  console.log('Seeding categories...');
  const categoryMap = {};
  for (const cat of SEED_CATEGORIES) {
    const created = await Category.create(cat);
    categoryMap[cat.slug] = created._id;
  }

  console.log('Seeding products...');
  for (const p of SEED_PRODUCTS) {
    await Product.create({
      nameAr: p.nameAr,
      nameEn: p.nameEn,
      slug: p.slug,
      price: p.price,
      oldPrice: p.oldPrice || undefined,
      category: categoryMap[p.categorySlug],
      emoji: p.emoji,
      unit: p.unit,
      rating: p.rating,
      stock: p.stock,
      isOffer: p.isOffer,
      isFeatured: p.isFeatured ?? false,
      brand: p.brand || 'MarketPlus',
      soldCount: p.soldCount ?? Math.floor(Math.random() * 400) + 50,
      isActive: true,
    });
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

  console.log('Ensuring admin user...');
  let admin = await User.findOne({
    $or: [{ phone: ADMIN_DEMO_PHONE }, { email: 'admin@marketplus.com' }],
  });
  if (!admin) {
    admin = await User.create({
      name: 'MarketPlus Admin',
      phone: ADMIN_DEMO_PHONE,
      role: 'super_admin',
      isPhoneVerified: true,
      mfaEnabled: true,
    });
    console.log(`Admin created: 01012345678 (SMS OTP — see console in dev)`);
  } else {
    admin.phone = ADMIN_DEMO_PHONE;
    admin.role = 'super_admin';
    admin.isPhoneVerified = true;
    admin.mfaEnabled = true;
    admin.password = undefined;
    await admin.save({ validateBeforeSave: false });
    console.log(`Admin updated: 01012345678`);
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
    customer = await User.create({
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
  console.log('Admin panel:       01012345678  →  enter 1012345678 in the app');
  console.log('OTP: shown on screen + backend console when NODE_ENV=development');
  console.log('Coupons to try:    FIRST20, SAVE50, or FREESHIP');
  console.log('');

  console.log(`Done! ${SEED_CATEGORIES.length} categories, ${SEED_PRODUCTS.length} products, ${SEED_COUPONS.length} coupons, ${SEED_BANNERS.length} banners.`);
  process.exit(0);
};

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
