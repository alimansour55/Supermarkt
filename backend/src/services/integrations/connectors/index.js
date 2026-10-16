/**
 * Ready-made connectors. Each one knows how to log in to one outside system and pull
 * its stock and prices into the common shape:
 *   pull(config) → { stock: [{ code, quantity, location? }], prices: [{ code, price?, costPrice? }] }
 * Adding a system = adding a file here with the same shape.
 */
import loyverse from './loyverse.js';
import odoo from './odoo.js';
import zohoInventory from './zohoInventory.js';
import square from './square.js';
import genericJson from './genericJson.js';

export const CONNECTORS = [loyverse, odoo, zohoInventory, square, genericJson];

export function getConnector(key) {
  return CONNECTORS.find((c) => c.key === key) || null;
}

/** What the admin screen needs — never includes anything secret. */
export function describeConnectors() {
  return CONNECTORS.map(({ key, name, description, docsUrl, fields, capabilities }) => ({
    key, name, description, docsUrl, fields, capabilities,
  }));
}

/** Check required fields; returns a list of missing labels. */
export function missingConnectorFields(connector, config) {
  return connector.fields
    .filter((f) => f.required && !String(config?.[f.key] ?? '').trim())
    .map((f) => f.label);
}
