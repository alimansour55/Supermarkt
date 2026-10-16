import mongoose from 'mongoose';

/**
 * Store-wide integration rules (a single document).
 *
 * onlineOrderHold — how long an online order's items stay subtracted from the stock that
 * outside systems report, so the next stock update doesn't "give back" items already sold online:
 *   ack             — until a connected system acknowledges the order (it took the items out itself)
 *   until_delivered — until the order is delivered (the shop rings it up in the cashier when packing)
 *   none            — never; the outside system's number is used as-is
 */
export const ONLINE_ORDER_HOLD_MODES = ['ack', 'until_delivered', 'none'];

const integrationSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'default', unique: true },
    stockBuffer: { type: Number, min: 0, max: 1000, default: 0 },
    onlineOrderHold: { type: String, enum: ONLINE_ORDER_HOLD_MODES, default: 'until_delivered' },
    /** When the hold mode last changed — older orders are never held, so switching modes can't drop stock at once. */
    holdSince: { type: Date, default: () => new Date() },
    /** Branches whose stock is sold online. Empty = every active branch. */
    onlineLocations: [{ type: mongoose.Schema.Types.ObjectId, ref: 'FulfillmentLocation' }],
    alertEmails: { type: [String], default: [] },
    alertOnUnmatched: { type: Boolean, default: true },
    /** Order scanner: orders updated after this have not been looked at yet. */
    orderScanCursor: { type: Date, default: () => new Date() },
  },
  { timestamps: true },
);

const IntegrationSettings = mongoose.model('IntegrationSettings', integrationSettingsSchema);

export async function getIntegrationSettings() {
  const existing = await IntegrationSettings.findOne({ key: 'default' });
  if (existing) return existing;
  try {
    return await IntegrationSettings.create({ key: 'default' });
  } catch (err) {
    if (err?.code === 11000) return IntegrationSettings.findOne({ key: 'default' });
    throw err;
  }
}

export default IntegrationSettings;
