import mongoose from 'mongoose';

/**
 * Idempotency record: an update with the same (connection, key) is applied once.
 * The stored `result` is replayed to the caller on a retry. Kept 30 days.
 */
const integrationEventSchema = new mongoose.Schema(
  {
    connection: { type: mongoose.Schema.Types.ObjectId, ref: 'IntegrationConnection', required: true },
    key: { type: String, required: true, maxlength: 200 },
    result: { type: mongoose.Schema.Types.Mixed, default: null },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);

integrationEventSchema.index({ connection: 1, key: 1 }, { unique: true });
integrationEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

const IntegrationEvent = mongoose.model('IntegrationEvent', integrationEventSchema);

export default IntegrationEvent;
