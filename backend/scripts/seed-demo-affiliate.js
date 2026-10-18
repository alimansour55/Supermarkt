/**
 * Local development only — create (or reuse) two demo shoppers for trying Share & earn:
 * a link owner and a friend who buys through the link. Prints a sign-in token for each
 * (paste it into localStorage "marketplus_token" in the browser). Refuses to run in production.
 *
 *   node scripts/seed-demo-affiliate.js            (add --enable to switch the program on)
 *
 * Accounts: phone +201000000081 (link owner), +201000000082 (buyer), staff username
 * demo_affiliate_admin (admin, random password — sign in with the printed token).
 */
import 'dotenv/config';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import connectDB from '../src/config/db.js';
import User from '../src/models/User.js';
import { generateToken } from '../src/utils/generateToken.js';
import { joinAffiliateProgram, saveAffiliateSettings } from '../src/services/affiliate.service.js';

if (process.env.NODE_ENV === 'production') {
  console.error('seed-demo-affiliate is for local development only.');
  process.exit(1);
}

await connectDB();

async function demoUser(name, phone) {
  return (await User.findOne({ phone })) || User.create({ name, phone, role: 'user' });
}

if (process.argv.includes('--enable')) await saveAffiliateSettings({ enabled: true });

const owner = await demoUser('Demo Sharer', '+201000000081');
const buyer = await demoUser('Demo Friend', '+201000000082');
const admin = (await User.findOne({ username: 'demo_affiliate_admin' })) || await User.create({
  name: 'Demo Admin', username: 'demo_affiliate_admin', role: 'admin', password: crypto.randomBytes(18).toString('base64url'),
});
let code = null;
if (process.argv.includes('--enable')) code = (await joinAffiliateProgram(owner._id)).code;

console.log(JSON.stringify({
  ownerId: String(owner._id),
  ownerToken: generateToken(owner._id),
  buyerId: String(buyer._id),
  buyerToken: generateToken(buyer._id),
  adminToken: generateToken(admin._id, { sv: admin.sessionVersion || 0 }),
  code,
}));
await mongoose.disconnect();
