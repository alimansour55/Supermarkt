import mongoose from 'mongoose';
import {
  AFFILIATE_CALC_TYPES,
  AFFILIATE_JOIN_MODES,
  AFFILIATE_REWARD_TYPES,
  DEFAULT_AFFILIATE_SETTINGS as D,
} from '../utils/affiliateRules.js';

/** Share & earn program rules — a single document (key 'main'). */
const affiliateSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'main', unique: true },
    enabled: { type: Boolean, default: D.enabled },
    joinMode: { type: String, enum: AFFILIATE_JOIN_MODES, default: D.joinMode },
    rewardType: { type: String, enum: AFFILIATE_REWARD_TYPES, default: D.rewardType },
    calcType: { type: String, enum: AFFILIATE_CALC_TYPES, default: D.calcType },
    percent: { type: Number, min: 0, max: 100, default: D.percent },
    fixedAmount: { type: Number, min: 0, default: D.fixedAmount },
    maxRewardPerOrder: { type: Number, min: 0, default: D.maxRewardPerOrder },
    minOrderTotal: { type: Number, min: 0, default: D.minOrderTotal },
    holdDays: { type: Number, min: 0, max: 90, default: D.holdDays },
    attributionDays: { type: Number, min: 1, max: 90, default: D.attributionDays },
    newCustomersOnly: { type: Boolean, default: D.newCustomersOnly },
    maxRewardedOrdersPerBuyer: { type: Number, min: 0, default: D.maxRewardedOrdersPerBuyer },
    termsAr: { type: String, default: '' },
    termsEn: { type: String, default: '' },
  },
  { timestamps: true },
);

const AffiliateSettings = mongoose.model('AffiliateSettings', affiliateSettingsSchema);
export default AffiliateSettings;
