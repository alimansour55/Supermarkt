import mongoose from 'mongoose';

/** One line in a connection's sync log. Kept 30 days. */
const integrationLogSchema = new mongoose.Schema(
  {
    connection: { type: mongoose.Schema.Types.ObjectId, ref: 'IntegrationConnection', required: true },
    direction: { type: String, enum: ['in', 'out'], required: true },
    kind: {
      type: String,
      enum: ['stock', 'prices', 'orders', 'webhook', 'file', 'connector', 'agent', 'test'],
      required: true,
    },
    status: { type: String, enum: ['ok', 'partial', 'error', 'skipped'], required: true },
    message: { type: String, default: '' },
    counts: {
      received: { type: Number, default: 0 },
      updated: { type: Number, default: 0 },
      unchanged: { type: Number, default: 0 },
      unmatched: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
    },
    unmatched: { type: [String], default: [] },
    problems: { type: [{ _id: false, code: String, message: String }], default: [] },
    dryRun: { type: Boolean, default: false },
    durationMs: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);

integrationLogSchema.index({ connection: 1, createdAt: -1 });
integrationLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

const IntegrationLog = mongoose.model('IntegrationLog', integrationLogSchema);

export default IntegrationLog;
