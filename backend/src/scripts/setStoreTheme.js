/**
 * Set the storefront theme (themeColor / themeShade) on the singleton StoreSettings doc.
 * Run: node src/scripts/setStoreTheme.js hyperone 600
 */
import 'dotenv/config';
import connectDB from '../config/db.js';
import StoreSettings from '../models/StoreSettings.js';

const [, , color = 'hyperone', shadeArg = '600'] = process.argv;
const shade = Number(shadeArg);

const run = async () => {
  await connectDB();
  const settings = await StoreSettings.findOne();
  if (!settings) {
    console.error('No StoreSettings document found.');
    process.exit(1);
  }
  settings.themeColor = color;
  settings.themeShade = shade;
  if (settings.themeRotation) settings.themeRotation.enabled = false;
  await settings.save();
  console.log(`StoreSettings theme set to ${color} / ${shade}`);
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
