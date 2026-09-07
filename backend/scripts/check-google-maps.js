/**
 * Validate GOOGLE_MAPS_API_KEY and Places API (New) access.
 * Usage: node scripts/check-google-maps.js
 */
import 'dotenv/config';

const key = process.env.GOOGLE_MAPS_API_KEY?.trim();
const testQuery = 'صيدلية القاهرة';

if (!key) {
  console.error('❌ GOOGLE_MAPS_API_KEY is not set in backend/.env');
  process.exit(1);
}

console.log('Checking backend Google Maps key…');

const response = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Goog-Api-Key': key,
    'X-Goog-FieldMask': 'suggestions.placePrediction.placeId,suggestions.placePrediction.text',
  },
  body: JSON.stringify({
    input: testQuery,
    includedRegionCodes: ['eg'],
    languageCode: 'ar',
  }),
});

const body = await response.json().catch(() => ({}));

if (response.ok && body.suggestions?.length) {
  console.log('✅ Places API (New) works — sample:', body.suggestions[0].placePrediction?.text?.text);
  process.exit(0);
}

const message = body.error?.message || `HTTP ${response.status}`;
console.error('❌ Places API (New) failed:', message);

if (message.toLowerCase().includes('blocked')) {
  console.error('\nFix: Google Cloud Console → APIs & Services → Credentials');
  console.error('  → Edit your BACKEND key → API restrictions');
  console.error('  → Add: Places API (New), Geocoding API');
}

if (message.toLowerCase().includes('quota')) {
  console.error('\nFix: Enable billing in Google Cloud (free tier ~$200/month) or wait for daily quota reset.');
}

process.exit(1);
