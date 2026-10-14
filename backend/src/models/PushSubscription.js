import mongoose from 'mongoose';

/** A browser's Web Push subscription for a signed-in user (drivers today). */
const pushSubscriptionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    endpoint: { type: String, required: true, unique: true },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
    userAgent: { type: String, trim: true, maxlength: 300, default: '' },
    lastUsedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

const PushSubscription = mongoose.model('PushSubscription', pushSubscriptionSchema);

export default PushSubscription;
