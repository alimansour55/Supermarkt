/**
 * Local development only — create (or reset) a demo marketplace seller you can sign in with at
 * /seller-center/login. Refuses to run in production.
 *
 *   npm run seed:demo-seller --prefix backend
 *
 * Login: demo-seller@marketplus.test / DemoSeller#2026  (override with DEMO_SELLER_PASSWORD)
 */
import 'dotenv/config';
import connectDB from '../src/config/db.js';
import Seller from '../src/models/Seller.js';
import User from '../src/models/User.js';
import { syncSellerProductVisibility } from '../src/services/marketplace.service.js';

if (process.env.NODE_ENV === 'production') {
  console.error('seed-demo-seller is for local development only.');
  process.exit(1);
}

const EMAIL = 'demo-seller@marketplus.test';
const PASSWORD = process.env.DEMO_SELLER_PASSWORD || 'DemoSeller#2026';
const status = process.argv.includes('--pending') ? 'under_review' : 'active';

await connectDB();

let seller = await Seller.findOne({ email: EMAIL });
if (!seller) {
  seller = await Seller.create({
    nameAr: 'متجر العسل التجريبي',
    nameEn: 'Demo Honey Shop',
    slug: 'demo-honey-shop',
    contactName: 'Demo Seller',
    email: EMAIL,
    phone: '+201000000099',
    address: { city: 'Cairo', governorate: 'Cairo', street: '1 Demo St' },
    status,
    statusHistory: [{ status }],
    allowedFulfillment: ['seller', 'store'],
    termsAcceptedAt: new Date(),
    ...(status === 'active' ? { approvedAt: new Date() } : {}),
  });
} else {
  seller.status = status;
  await seller.save();
}

let owner = await User.findOne({ email: EMAIL }).select('+password');
if (!owner) {
  owner = new User({ name: 'Demo Seller', email: EMAIL, role: 'seller_owner', seller: seller._id });
}
owner.password = PASSWORD;
owner.isActive = true;
owner.seller = seller._id;
await owner.save();

seller.owner = owner._id;
await seller.save();
await syncSellerProductVisibility(seller._id);

console.log(`Demo seller ready (${status}). Sign in at /seller-center/login with ${EMAIL}`);
process.exit(0);
