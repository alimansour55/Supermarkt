import mongoose from 'mongoose';

/** One webhook event waiting to be (or already) delivered to one connection. Kept 30 days. */
const webhookDeliverySchema = new mongoose.Schema(
  {
    connection: { type: mongoose.Schema.Types.ObjectId, ref: 'IntegrationConnection', required: true },
    eventId: { type: String, required: true },
    event: { type: String, required: true },
    payload: { type: mongoose.Schema.Types.Mixed, required: true },
    status: { type: String, enum: ['pending', 'delivered', 'failed'], default: 'pending' },
    attempts: { type: Number, default: 0 },
    nextAttemptAt: { type: Date, default: Date.now },
    lockedUntil: { type: Date, default: null },
    lastStatusCode: { type: Number, default: null },
    lastError: { type: String, default: '' },
    deliveredAt: { type: Date, default: null },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);

webhookDeliverySchema.index({ status: 1, nextAttemptAt: 1 });
webhookDeliverySchema.index({ connection: 1, createdAt: -1 });
webhookDeliverySchema.index({ connection: 1, eventId: 1 }, { unique: true });
webhookDeliverySchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

const WebhookDelivery = mongoose.model('WebhookDelivery', webhookDeliverySchema);

export default WebhookDelivery;
