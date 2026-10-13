import mongoose from 'mongoose';

/**
 * One abandoned-cart "episode": a customer left items in their cart, we reminded them
 * (one or more steps), and the episode ends recovered (they ordered inside the attribution
 * window) or expired. Kept separate from Cart so the job never bumps the cart's updatedAt,
 * which is our "last activity" signal.
 */
const recoveryStepSchema = new mongoose.Schema(
  {
    step: { type: Number, required: true, min: 0 },
    sentAt: { type: Date, required: true },
    channels: { type: [String], default: [] },
    couponCode: { type: String, default: null },
  },
  { _id: false },
);

const cartRecoverySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status: {
      type: String,
      enum: ['active', 'recovered', 'expired'],
      default: 'active',
      index: true,
    },
    /** Number of reminder steps already sent (next step to send = stage). */
    stage: { type: Number, default: 0, min: 0 },
    /** Cart's updatedAt the last time the job looked at it — delays count from here. */
    cartActivityAt: { type: Date, required: true },
    cartValue: { type: Number, default: 0, min: 0 },
    itemCount: { type: Number, default: 0, min: 0 },
    steps: { type: [recoveryStepSchema], default: [] },
    firstSentAt: { type: Date, default: null },
    lastSentAt: { type: Date, default: null },
    couponCodes: { type: [String], default: [] },
    recoveredOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
    recoveredOrderNumber: { type: String, default: null },
    recoveredAt: { type: Date, default: null },
    recoveredRevenue: { type: Number, default: 0, min: 0 },
    /** How many reminders had been sent when the order came in. */
    recoveredAfterStep: { type: Number, default: null },
    couponUsed: { type: String, default: null },
    couponDiscount: { type: Number, default: 0, min: 0 },
    closedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// At most one open episode per customer — also makes concurrent job runs safe.
cartRecoverySchema.index({ user: 1 }, { unique: true, partialFilterExpression: { status: 'active' }, name: 'one_active_per_user' });
cartRecoverySchema.index({ createdAt: -1 });

const CartRecovery = mongoose.model('CartRecovery', cartRecoverySchema);

export default CartRecovery;
