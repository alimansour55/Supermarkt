/**
 * Loyverse POS — https://developer.loyverse.com/docs/
 * Login: an access token from Loyverse Back Office → Settings → Access tokens.
 * Pulls items (barcode/SKU, price, cost) and inventory levels per store.
 */
import { fetchJson } from '../outboundHttp.js';

const BASE = 'https://api.loyverse.com/v1.0';
const MAX_PAGES = 200;

const call = (config, path) => fetchJson(`${BASE}${path}`, {
  headers: { Authorization: `Bearer ${config.accessToken}`, Accept: 'application/json' },
  timeoutMs: 30000,
});

async function pagesOf(config, path, key) {
  const out = [];
  let cursor = '';
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const sep = path.includes('?') ? '&' : '?';
    // eslint-disable-next-line no-await-in-loop
    const json = await call(config, `${path}${sep}limit=250${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
    out.push(...(json?.[key] || []));
    cursor = json?.cursor;
    if (!cursor) break;
  }
  return out;
}

export default {
  key: 'loyverse',
  name: 'Loyverse POS',
  description: 'Free cashier app for phones and tablets. Brings stock per store, prices and costs.',
  docsUrl: 'https://developer.loyverse.com/docs/',
  fields: [
    { key: 'accessToken', label: 'Access token', type: 'password', required: true, help: 'Loyverse Back Office → Settings → Access tokens → Add access token' },
  ],
  capabilities: ['stock', 'prices'],

  async test(config) {
    const json = await call(config, '/stores');
    const stores = json?.stores || [];
    return { ok: true, message: `Connected — ${stores.length} store(s) found`, locations: stores.map((s) => ({ code: s.id, name: s.name })) };
  },

  async pull(config) {
    const items = await pagesOf(config, '/items', 'items');
    const codeByVariant = new Map();
    const prices = [];
    for (const item of items) {
      for (const v of item.variants || []) {
        const code = v.barcode || v.sku;
        if (!code) continue;
        codeByVariant.set(v.variant_id, code);
        const price = v.default_price ?? v.stores?.find((s) => s.price != null)?.price;
        prices.push({ code, price: price ?? undefined, costPrice: v.cost ?? undefined });
      }
    }
    const levels = await pagesOf(config, '/inventory', 'inventory_levels');
    const stock = levels
      .filter((l) => codeByVariant.has(l.variant_id))
      .map((l) => ({ code: codeByVariant.get(l.variant_id), quantity: l.in_stock ?? 0, location: l.store_id }));
    return { stock, prices };
  },
};
