/**
 * Odoo (POS / Inventory) — external JSON-RPC API, works with Odoo 14–18, online or self-hosted.
 * Login: database name, user login and an API key (Odoo → Preferences → Account Security → New API key).
 * Pulls products with barcode/internal reference, sale price, cost and on-hand quantity —
 * per warehouse when warehouse codes are given.
 */
import { fetchJson } from '../outboundHttp.js';

const PAGE = 500;
const MAX_PAGES = 200;

function rpc(config, service, method, args) {
  const base = String(config.url || '').replace(/\/+$/, '');
  return fetchJson(`${base}/jsonrpc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', method: 'call', params: { service, method, args }, id: Date.now() }),
    timeoutMs: 60000,
  }).then((json) => {
    if (json?.error) throw new Error(json.error.data?.message || json.error.message || 'Odoo error');
    return json?.result;
  });
}

async function login(config) {
  const uid = await rpc(config, 'common', 'login', [config.database, config.username, config.apiKey]);
  if (!uid) throw new Error('Odoo rejected the login — check database, user and API key');
  return uid;
}

const exec = (config, uid, model, method, args, kwargs = {}) => rpc(config, 'object', 'execute_kw', [config.database, uid, config.apiKey, model, method, args, kwargs]);

async function readProducts(config, uid, context = {}) {
  const out = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    // eslint-disable-next-line no-await-in-loop
    const rows = await exec(config, uid, 'product.product', 'search_read', [[['active', '=', true]]], {
      fields: ['default_code', 'barcode', 'qty_available', 'lst_price', 'standard_price'],
      limit: PAGE,
      offset: page * PAGE,
      context,
    });
    out.push(...(rows || []));
    if (!rows || rows.length < PAGE) break;
  }
  return out;
}

export default {
  key: 'odoo',
  name: 'Odoo',
  description: 'Odoo POS / Inventory (online or self-hosted). Brings stock per warehouse, prices and costs.',
  docsUrl: 'https://www.odoo.com/documentation/18.0/developer/reference/external_api.html',
  fields: [
    { key: 'url', label: 'Odoo address', type: 'url', required: true, help: 'e.g. https://mycompany.odoo.com' },
    { key: 'database', label: 'Database name', type: 'text', required: true },
    { key: 'username', label: 'User login (email)', type: 'text', required: true },
    { key: 'apiKey', label: 'API key', type: 'password', required: true, help: 'Odoo → your avatar → Preferences → Account Security → New API key' },
    { key: 'warehouses', label: 'Warehouse codes (optional)', type: 'text', required: false, help: 'Comma separated, e.g. WH,BR2 — leave empty for total stock' },
  ],
  capabilities: ['stock', 'prices'],

  async test(config) {
    const uid = await login(config);
    const warehouses = await exec(config, uid, 'stock.warehouse', 'search_read', [[]], { fields: ['code', 'name'], limit: 50 }).catch(() => []);
    return {
      ok: true,
      message: `Connected as user #${uid}${warehouses.length ? ` — ${warehouses.length} warehouse(s)` : ''}`,
      locations: warehouses.map((w) => ({ code: w.code, name: w.name })),
    };
  },

  async pull(config) {
    const uid = await login(config);
    const codeOf = (p) => p.barcode || p.default_code || '';
    const wanted = String(config.warehouses || '').split(',').map((s) => s.trim()).filter(Boolean);

    const products = await readProducts(config, uid);
    const prices = products.filter(codeOf).map((p) => ({ code: codeOf(p), price: p.lst_price, costPrice: p.standard_price }));

    let stock;
    if (!wanted.length) {
      stock = products.filter(codeOf).map((p) => ({ code: codeOf(p), quantity: p.qty_available || 0 }));
    } else {
      const warehouses = await exec(config, uid, 'stock.warehouse', 'search_read', [[['code', 'in', wanted]]], { fields: ['id', 'code'] });
      stock = [];
      for (const wh of warehouses) {
        // eslint-disable-next-line no-await-in-loop
        const rows = await readProducts(config, uid, { warehouse: wh.id });
        for (const p of rows) if (codeOf(p)) stock.push({ code: codeOf(p), quantity: p.qty_available || 0, location: wh.code });
      }
    }
    return { stock, prices };
  },
};
