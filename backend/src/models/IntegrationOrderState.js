import mongoose from 'mongoose';

/**
 * What the integrations layer last saw of an order, so the order scanner only emits an
 * event when something actually changed — and whether a connected system has
 * acknowledged the order (taken its items out of its own stock).
 */
const integrationOrderStateSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, unique: true },
    orderStatus: { type: String, default: '' },
    paymentStatus: { type: String, default: '' },
    approvedReturnIds: { type: [String], default: [] },
    acknowledgedAt: { type: Date, default: null },
    acknowledgedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'IntegrationConnection', default: null },
    externalReference: { type: String, trim: true, default: '' },
  },
  { timestamps: true },
);

const IntegrationOrderState = mongoose.model('IntegrationOrderState', integrationOrderStateSchema);

export default IntegrationOrderState;
