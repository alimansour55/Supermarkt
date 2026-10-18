import mongoose from 'mongoose';
import { AFFILIATE_REWARD_TYPES, COMMISSION_STATUSES } from '../utils/affiliateRules.js';

/** One order bought through someone's link, and what the link owner earns for it. */
const affiliateCommissionSchema = new mongoose.Schema(
  {
    affiliate: { type: mongoose.Schema.Types.ObjectId, ref: 'Affiliate', required: true, index: true },
    /** The link owner who gets the reward. */
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, unique: true },
    orderNumber: { type: String, default: '' },
    code: { type: String, default: '' },
    status: { type: String, enum: COMMISSION_STATUSES, default: 'pending', index: true },
    rewardType: { type: String, enum: AFFILIATE_REWARD_TYPES, required: true },
    /** Order value the reward was calculated on (EGP). */
    baseAmount: { type: Number, default: 0 },
    /** In the reward unit: EGP for wallet, whole points for points. */
    rewardAmount: { type: Number, default: 0 },
    /** EGP value of the reward (equals rewardAmount for wallet). */
    cashValue: { type: Number, default: 0 },
    /** Snapshot of the rate used: "percent:5" or "fixed:20". */
    rateLabel: { type: String, default: '' },
    deliveredAt: { type: Date, default: null },
    holdUntil: { type: Date, default: null, index: true },
    paidAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    reversedAt: { type: Date, default: null },
    /** Why it was cancelled/reversed, in plain words. */
    note: { type: String, default: '' },
    /** Reward was paid, the order was refunded, but the balance was too low to take it back. */
    clawbackFailed: { type: Boolean, default: false },
    walletTransaction: { type: mongoose.Schema.Types.ObjectId, ref: 'WalletTransaction', default: null },
  },
  { timestamps: true },
);

affiliateCommissionSchema.index({ affiliate: 1, createdAt: -1 });
affiliateCommissionSchema.index({ status: 1, holdUntil: 1 });
affiliateCommissionSchema.index({ affiliate: 1, buyer: 1, status: 1 });

const AffiliateCommission = mongoose.model('AffiliateCommission', affiliateCommissionSchema);
export default AffiliateCommission;
