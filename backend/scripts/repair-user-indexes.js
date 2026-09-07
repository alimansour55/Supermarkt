import 'dotenv/config';
import connectDB from '../src/config/db.js';
import User from '../src/models/User.js';

await connectDB();

const nullEmail = await User.updateMany(
  { $or: [{ email: null }, { email: '' }] },
  { $unset: { email: '' } },
);
const nullPhone = await User.updateMany(
  { $or: [{ phone: null }, { phone: '' }] },
  { $unset: { phone: '' } },
);

console.log(`Unset null/empty email on ${nullEmail.modifiedCount} user(s)`);
console.log(`Unset null/empty phone on ${nullPhone.modifiedCount} user(s)`);

try {
  await User.collection.dropIndex('email_1');
  console.log('Dropped legacy email_1 index');
} catch (e) {
  console.log('email_1:', e.message);
}

try {
  await User.collection.dropIndex('phone_1');
  console.log('Dropped legacy phone_1 index');
} catch (e) {
  console.log('phone_1:', e.message);
}

try {
  await User.collection.dropIndex('username_1');
  console.log('Dropped legacy username_1 index');
} catch (e) {
  console.log('username_1:', e.message);
}

await User.syncIndexes();
console.log('User indexes synced');

process.exit(0);
