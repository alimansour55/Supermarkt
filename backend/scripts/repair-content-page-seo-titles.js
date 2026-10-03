import 'dotenv/config';
import connectDB from '../src/config/db.js';
import ContentPage from '../src/models/ContentPage.js';

await connectDB();

const pages = await ContentPage.find({});
let updated = 0;

for (const page of pages) {
  let changed = false;
  if (page.seoTitleAr && page.seoTitleAr.includes('سوق+')) {
    page.seoTitleAr = '';
    changed = true;
  }
  if (page.seoTitleEn && page.seoTitleEn.includes('MarketPlus')) {
    page.seoTitleEn = '';
    changed = true;
  }
  if (changed) {
    await page.save();
    updated += 1;
  }
}

console.log(`Cleared stale SEO titles on ${updated} content page(s).`);
process.exit(0);
