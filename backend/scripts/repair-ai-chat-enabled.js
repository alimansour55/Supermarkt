import 'dotenv/config';
import connectDB from '../src/config/db.js';
import StoreSettings from '../src/models/StoreSettings.js';
import { invalidateStoreSettingsCache } from '../src/services/storeSettings.service.js';

await connectDB();

const settings = await StoreSettings.findOneAndUpdate(
  { key: 'main' },
  { $set: { aiChatEnabled: true } },
  { new: true, upsert: true, setDefaultsOnInsert: true },
);

invalidateStoreSettingsCache();

console.log('AI chat enabled:', settings.aiChatEnabled);
process.exit(0);
