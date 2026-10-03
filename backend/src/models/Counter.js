import mongoose from 'mongoose';

/**
 * Generic atomic sequence counter. `_id` is a namespaced key (e.g.
 * "order:260910" for the order-number sequence on store-day 2026-09-10);
 * `seq` is incremented atomically via findOneAndUpdate({ $inc }, { upsert: true }).
 */
const counterSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    seq: { type: Number, default: 0 },
  },
  { versionKey: false },
);

export default mongoose.model('Counter', counterSchema);
