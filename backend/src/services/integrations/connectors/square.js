/**
 * Square POS — https://developer.squareup.com/reference/square
 * Login: a production access token (Developer Dashboard → your app → Credentials).
 * Pulls item variations (UPC/SKU, price) and IN_STOCK counts per location.
 */
import { fetchJson } from '../outboundHttp.js';

const BASE = 'https://connect.squareup.com/v2';
const VERSION = '2024-10-17';
const MAX_PAGES = 200;

const call = (config, path, { method = 'GET', body } = {}) => fetchJson(`${BASE}${path}`, {
  method,
  headers: {
    Authorization: `Bearer ${config.accessToken}`,
    'Square-Version': VERSION,
    'Content-Type': 'application/json',
  },
  body: body ? JSON.stringify(body) : undefined,
  timeoutMs: 30000,
});

export default {
  key: 'square',
  name: 'Square POS',
  description: 'Square point of sale. Brings stock per location and prices.',
  docsUrl: 'https://developer.squareup.com/reference/square',
  fields: [
    { key: 'accessToken', label: 'Access token', type: 'password', required: true, help: 'Square Developer Dashboard → your app → Production → Access token' },
  ],
  capabilities: ['stock', 'prices'],

  async test(config) {
    const json = await call(config, '/locations');
    const locations = json?.locations || [];
    return { ok: true, message: `Connected — ${locations.length} location(s)`, locations: locations.map((l) => ({ code: l.id, name: l.name })) };
  },

  async pull(config) {
    const codeById = new Map();
    const prices = [];
    let cursor = '';
    for (let page = 0; page < MAX_PAGES; page += 1) {
      // eslint-disable-next-line no-await-in-loop
      const json = await call(config, `/catalog/list?types=ITEM${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
      for (const obj of json?.objects || []) {
        for (const variation of obj.item_data?.variations || []) {
          const data = variation.item_variation_data || {};
          const code = data.upc || data.sku;
          if (!code) continue;
          codeById.set(variation.id, code);
          const amount = data.price_money?.amount;
          if (amount != null) prices.push({ code, price: amount / 100 });
        }
      }
      cursor = json?.cursor;
      if (!cursor) break;
    }

    const stock = [];
    const ids = [...codeById.keys()];
    for (let i = 0; i < ids.length; i += 500) {
      let countCursor = '';
      for (let page = 0; page < MAX_PAGES; page += 1) {
        // eslint-disable-next-line no-await-in-loop
        const json = await call(config, '/inventory/counts/batch-retrieve', {
          method: 'POST',
          body: { catalog_object_ids: ids.slice(i, i + 500), states: ['IN_STOCK'], ...(countCursor ? { cursor: countCursor } : {}) },
        });
        for (const c of json?.counts || []) {
          stock.push({ code: codeById.get(c.catalog_object_id), quantity: Number(c.quantity) || 0, location: c.location_id });
        }
        countCursor = json?.cursor;
        if (!countCursor) break;
      }
    }
    return { stock, prices };
  },
};
