/**
 * Zoho Inventory — https://www.zoho.com/inventory/api/v1/
 * Login: a Self Client (api-console.zoho.com) client id/secret and a refresh token with
 * scope ZohoInventory.items.READ, plus the organization id and data-centre domain.
 * Pulls items with EAN/UPC/SKU, selling rate, purchase rate and stock on hand.
 */
import { fetchJson } from '../outboundHttp.js';

const MAX_PAGES = 200;
const tokenCache = new Map();

async function accessToken(config) {
  const dc = config.dataCenter || 'com';
  const cacheKey = `${config.clientId}:${dc}`;
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
  const params = new URLSearchParams({
    refresh_token: config.refreshToken,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: 'refresh_token',
  });
  const json = await fetchJson(`https://accounts.zoho.${dc}/oauth/v2/token?${params}`, { method: 'POST' });
  if (!json?.access_token) throw new Error(json?.error ? `Zoho login failed: ${json.error}` : 'Zoho login failed');
  tokenCache.set(cacheKey, { token: json.access_token, expiresAt: Date.now() + (json.expires_in || 3600) * 1000 });
  return json.access_token;
}

async function call(config, path) {
  const token = await accessToken(config);
  const dc = config.dataCenter || 'com';
  const sep = path.includes('?') ? '&' : '?';
  return fetchJson(`https://www.zohoapis.${dc}/inventory/v1${path}${sep}organization_id=${encodeURIComponent(config.organizationId)}`, {
    headers: { Authorization: `Zoho-oauthtoken ${token}` },
    timeoutMs: 30000,
  });
}

export default {
  key: 'zoho-inventory',
  name: 'Zoho Inventory',
  description: 'Zoho Inventory / Zoho POS items. Brings stock, prices and costs.',
  docsUrl: 'https://www.zoho.com/inventory/api/v1/',
  fields: [
    { key: 'organizationId', label: 'Organization ID', type: 'text', required: true, help: 'Zoho Inventory → Settings → Organization profile' },
    { key: 'clientId', label: 'Client ID', type: 'text', required: true },
    { key: 'clientSecret', label: 'Client secret', type: 'password', required: true },
    { key: 'refreshToken', label: 'Refresh token', type: 'password', required: true, help: 'From a Self Client with scope ZohoInventory.items.READ' },
    { key: 'dataCenter', label: 'Data centre', type: 'text', required: false, help: 'com, eu, in, com.au, sa … (default com)' },
  ],
  capabilities: ['stock', 'prices'],

  async test(config) {
    const json = await call(config, '/items?per_page=1');
    return { ok: true, message: `Connected — ${json?.items?.length ? 'items found' : 'no items yet'}` };
  },

  async pull(config) {
    const stock = [];
    const prices = [];
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      // eslint-disable-next-line no-await-in-loop
      const json = await call(config, `/items?per_page=200&page=${page}`);
      for (const item of json?.items || []) {
        const code = item.ean || item.upc || item.sku;
        if (!code) continue;
        stock.push({ code, quantity: item.available_stock ?? item.stock_on_hand ?? 0 });
        prices.push({ code, price: item.rate, costPrice: item.purchase_rate });
      }
      if (!json?.page_context?.has_more_page) break;
    }
    return { stock, prices };
  },
};
