import mongoose from 'mongoose';

/**
 * One link between the store and an outside system (cashier/POS, ERP, accounting…).
 *
 * `door` is how the two talk:
 *   api       — the outside system calls our Open API with this connection's key
 *   webhook   — we push order events to `webhook.url`
 *   file      — we read a CSV export on a schedule (URL) or when one is uploaded
 *   connector — we pull from a known system (Loyverse, Odoo…) with its own login
 *   agent     — the shop-PC agent reads a local cashier database and calls the API
 * Any connection can also receive webhooks, and every connection gets an API key.
 */
export const INTEGRATION_DOORS = ['api', 'webhook', 'file', 'connector', 'agent'];

export const INTEGRATION_SCOPES = [
  'stock:write',
  'prices:write',
  'products:read',
  'orders:read',
  'orders:write',
  'locations:read',
];

export const WEBHOOK_EVENTS = [
  'order.created',
  'order.paid',
  'order.status_changed',
  'order.cancelled',
  'order.return_approved',
];

const locationMapSchema = new mongoose.Schema(
  {
    externalCode: { type: String, trim: true, required: true },
    location: { type: mongoose.Schema.Types.ObjectId, ref: 'FulfillmentLocation', required: true },
  },
  { _id: false },
);

/** File door: which column header holds which field. Empty = not in the file. */
const fileColumnsSchema = new mongoose.Schema(
  {
    code: { type: String, trim: true, default: '' },
    quantity: { type: String, trim: true, default: '' },
    price: { type: String, trim: true, default: '' },
    oldPrice: { type: String, trim: true, default: '' },
    costPrice: { type: String, trim: true, default: '' },
    location: { type: String, trim: true, default: '' },
  },
  { _id: false },
);

const integrationConnectionSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, required: true, maxlength: 80 },
    door: { type: String, enum: INTEGRATION_DOORS, required: true },
    status: { type: String, enum: ['active', 'paused'], default: 'active', index: true },
    /** Test mode: everything is checked and logged, nothing is saved and no webhooks go out. */
    testMode: { type: Boolean, default: false },

    apiKey: {
      prefix: { type: String, default: null, index: true },
      hash: { type: String, default: null, select: false },
      last4: { type: String, default: '' },
      createdAt: { type: Date, default: null },
      lastUsedAt: { type: Date, default: null },
    },
    scopes: { type: [{ type: String, enum: INTEGRATION_SCOPES }], default: [] },
    /** Optional allow-list of caller IPs (exact match). Empty = any IP. */
    allowedIps: { type: [String], default: [] },

    /** What this connection is the "boss" of. Off = its updates for that field are ignored. */
    rules: {
      stock: { type: Boolean, default: true },
      prices: { type: Boolean, default: false },
      costPrices: { type: Boolean, default: false },
    },

    /** External branch/store code → our branch. Unknown codes fall back to defaultLocation. */
    locationMap: { type: [locationMapSchema], default: [] },
    defaultLocation: { type: mongoose.Schema.Types.ObjectId, ref: 'FulfillmentLocation', default: null },

    webhook: {
      url: { type: String, trim: true, default: '' },
      /** Encrypted (see integrations/secrets.js). */
      secret: { type: String, default: '', select: false },
      events: { type: [{ type: String, enum: WEBHOOK_EVENTS }], default: [] },
      enabled: { type: Boolean, default: false },
    },

    file: {
      sourceUrl: { type: String, trim: true, default: '' },
      columns: { type: fileColumnsSchema, default: () => ({}) },
      /** '' = detect (comma, semicolon, tab). */
      delimiter: { type: String, default: '' },
      lastFileHash: { type: String, default: '' },
    },

    connector: {
      key: { type: String, trim: true, default: '' },
      /** Encrypted JSON of the connector's login fields. */
      config: { type: String, default: '', select: false },
      cursor: { type: mongoose.Schema.Types.Mixed, default: null },
    },

    /** Pull doors (file URL, connector): minutes between runs. */
    syncIntervalMinutes: { type: Number, min: 1, max: 1440, default: 5 },
    nextRunAt: { type: Date, default: null, index: true },
    runningSince: { type: Date, default: null },

    lastSyncAt: { type: Date, default: null },
    lastSuccessAt: { type: Date, default: null },
    lastError: { type: String, default: '' },
    lastErrorAt: { type: Date, default: null },
    lastAlertAt: { type: Date, default: null },
    consecutiveFailures: { type: Number, default: 0 },
    /** Codes we could not match recently (most recent first, capped). */
    unmatchedCodes: {
      type: [{ _id: false, code: String, seenAt: Date, count: { type: Number, default: 1 } }],
      default: [],
    },

    agent: {
      version: { type: String, default: '' },
      hostname: { type: String, default: '' },
      lastSeenAt: { type: Date, default: null },
    },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

integrationConnectionSchema.index({ 'webhook.enabled': 1, status: 1 });

const IntegrationConnection = mongoose.model('IntegrationConnection', integrationConnectionSchema);

export default IntegrationConnection;
