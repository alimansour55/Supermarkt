import mongoose from 'mongoose';
import { AFFILIATE_CALC_TYPES, AFFILIATE_STATUSES } from '../utils/affiliateRules.js';

/** A customer's share-and-earn link. One per user; `code` is what goes in `?ref=`. */
const affiliateSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    status: { type: String, enum: AFFILIATE_STATUSES, default: 'active', index: true },
    /** Admin-negotiated deal (influencers). Null = use the program defaults. */
    customCalcType: { type: String, enum: [...AFFILIATE_CALC_TYPES, null], default: null },
    customPercent: { type: Number, min: 0, max: 100, default: null },
    customFixedAmount: { type: Number, min: 0, default: null },
    clicks: { type: Number, default: 0, min: 0 },
    lastClickAt: { type: Date, default: null },
    /** Private staff note — never shown to the customer. */
    adminNote: { type: String, trim: true, default: '' },
    statusChangedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

const Affiliate = mongoose.model('Affiliate', affiliateSchema);
export default Affiliate;
