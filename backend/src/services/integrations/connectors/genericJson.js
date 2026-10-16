/**
 * Any system that can show its stock as JSON at a web address (many local Egyptian
 * systems and custom ERPs can). You tell us where the list is and which field is which.
 *
 * Paths use dots: "data.items" or "stock.qty". Example response:
 *   { "data": { "items": [ { "barcode": "622…", "qty": 12, "price": 25.5, "branch": "B1" } ] } }
 */
import { fetchJson } from '../outboundHttp.js';

export function getPath(obj, path) {
  if (!path) return obj;
  return String(path).split('.').filter(Boolean).reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
}

async function load(config) {
  const headers = { Accept: 'application/json' };
  if (config.headerName && config.headerValue) headers[config.headerName] = config.headerValue;
  const json = await fetchJson(config.url, { headers, timeoutMs: 60000 });
  const list = getPath(json, config.itemsPath);
  if (!Array.isArray(list)) throw new Error(`No list found at "${config.itemsPath || '(top level)'}" in the response`);
  return list;
}

export default {
  key: 'generic-json',
  name: 'Any system with a JSON link',
  description: 'For custom or local systems that can publish their stock list as JSON.',
  docsUrl: '',
  fields: [
    { key: 'url', label: 'Address of the stock list', type: 'url', required: true },
    { key: 'headerName', label: 'Login header name (optional)', type: 'text', required: false, help: 'e.g. Authorization or X-Api-Key' },
    { key: 'headerValue', label: 'Login header value (optional)', type: 'password', required: false },
    { key: 'itemsPath', label: 'Where the list is', type: 'text', required: false, help: 'e.g. data.items — empty if the response is the list itself' },
    { key: 'codeField', label: 'Barcode/SKU field', type: 'text', required: true, help: 'e.g. barcode' },
    { key: 'quantityField', label: 'Quantity field', type: 'text', required: false, help: 'e.g. qty' },
    { key: 'priceField', label: 'Price field', type: 'text', required: false },
    { key: 'costField', label: 'Cost field', type: 'text', required: false },
    { key: 'locationField', label: 'Branch field', type: 'text', required: false },
  ],
  capabilities: ['stock', 'prices'],

  async test(config) {
    const list = await load(config);
    const first = list[0];
    const code = first ? getPath(first, config.codeField) : undefined;
    if (first && (code === undefined || code === null || code === '')) {
      throw new Error(`The first item has no "${config.codeField}" field`);
    }
    return { ok: true, message: `Connected — ${list.length} item(s) in the list` };
  },

  async pull(config) {
    const list = await load(config);
    const stock = [];
    const prices = [];
    for (const row of list) {
      const code = getPath(row, config.codeField);
      if (code === undefined || code === null || code === '') continue;
      const location = config.locationField ? getPath(row, config.locationField) : undefined;
      if (config.quantityField) stock.push({ code, quantity: getPath(row, config.quantityField), location });
      if (config.priceField || config.costField) {
        prices.push({
          code,
          price: config.priceField ? getPath(row, config.priceField) : undefined,
          costPrice: config.costField ? getPath(row, config.costField) : undefined,
        });
      }
    }
    return { stock, prices };
  },
};
