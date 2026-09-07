import 'dotenv/config';
import connectDB from '../src/config/db.js';
import User from '../src/models/User.js';

const USERNAME = 'superadmin';
const adminPassword = process.env.ADMIN_PASSWORD?.trim()
  || (process.env.NODE_ENV !== 'production' ? 'admin123' : null);

if (!adminPassword) {
  console.error('Set ADMIN_PASSWORD in backend/.env before running this script.');
  process.exit(1);
}

await connectDB();

const admin = await User.findOne({ role: 'super_admin' }).select('+password');
if (!admin) {
  console.error('No super_admin user found. Run: npm run seed');
  process.exit(1);
}

admin.username = USERNAME;
admin.password = adminPassword;
admin.isActive = true;
admin.role = 'super_admin';
await admin.save();

console.log('Super admin login repaired:');
console.log(`  Username: ${USERNAME}`);
console.log(`  Password: (from ADMIN_PASSWORD in .env)`);
console.log('  Login at: /admin/login');

process.exit(0);
