import mongoose from 'mongoose';
import { DEFAULT_MARKETPLACE_SETTINGS as D } from '../constants/marketplace.js';

const categoryCommissionSchema = new mongoose.Schema(
  {
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    rate: { type: Number, min: 0, max: 100, required: true },
  },
  { _id: false },
);

/** Fee charged per payment method ('*' = any method without its own row). */
const paymentFeeSchema = new mongoose.Schema(
  {
    method: { type: String, trim: true, required: true },
    percent: { type: Number, min: 0, max: 100, default: 0 },
    fixed: { type: Number, min: 0, default: 0 },
  },
  { _id: false },
);

/**
 * A seller plan (Amazon "Individual / Professional"). Empty (null) fields inherit the
 * marketplace defaults. One plan may be the default for sellers without a plan.
 */
const feePlanSchema = new mongoose.Schema(
  {
    key: { type: String, trim: true, required: true },
    nameAr: { type: String, trim: true, default: '' },
    nameEn: { type: String, trim: true, default: '' },
    descriptionAr: { type: String, trim: true, default: '' },
    descriptionEn: { type: String, trim: true, default: '' },
    isDefault: { type: Boolean, default: false },
    commissionRate: { type: Number, min: 0, max: 100, default: null },
    minCommissionPerItem: { type: Number, min: 0, default: null },
    maxCommissionPerItem: { type: Number, min: 0, default: null },
    fixedFeePerItem: { type: Number, min: 0, default: null },
    fixedFeePerShipment: { type: Number, min: 0, default: null },
    storeFulfillmentFeePerItem: { type: Number, min: 0, default: null },
    monthlyFee: { type: Number, min: 0, default: null },
    payoutHoldDays: { type: Number, min: 0, max: 90, default: null },
  },
  { _id: false },
);

/**
 * A commission rule: conditions (all optional — empty matches everything) → a rate and,
 * optionally, its own fixed fee per item. Checked in list order; the first match wins.
 */
const commissionRuleSchema = new mongoose.Schema({
  name: { type: String, trim: true, default: '' },
  active: { type: Boolean, default: true },
  rate: { type: Number, min: 0, max: 100, required: true },
  fixedFeePerItem: { type: Number, min: 0, default: null },
  /** Campaign rules apply even to sellers with their own negotiated rate. */
  overrideSellerDeals: { type: Boolean, default: false },
  categories: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }],
  sellers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Seller' }],
  plans: [{ type: String, trim: true }],
  fulfillment: { type: String, enum: ['any', 'store', 'seller'], default: 'any' },
  minPrice: { type: Number, min: 0, default: null },
  maxPrice: { type: Number, min: 0, default: null },
  startsAt: { type: Date, default: null },
  endsAt: { type: Date, default: null },
  /** Only sellers approved within this many days (welcome offers). */
  newSellerDays: { type: Number, min: 0, default: null },
});

/** Singleton (key = 'main') — marketplace rules, kept apart from the storefront StoreSettings. */
const marketplaceSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'main', unique: true },
    enabled: { type: Boolean, default: D.enabled },
    registrationOpen: { type: Boolean, default: D.registrationOpen },
    defaultCommissionRate: { type: Number, min: 0, max: 100, default: D.defaultCommissionRate },
    categoryCommissions: { type: [categoryCommissionSchema], default: [] },
    payoutHoldDays: { type: Number, min: 0, max: 90, default: D.payoutHoldDays },
    storeFulfillmentFeePerItem: { type: Number, min: 0, default: D.storeFulfillmentFeePerItem },
    sellerShipmentDeliveryFee: { type: Number, min: 0, default: D.sellerShipmentDeliveryFee },
    reviewContentEdits: { type: Boolean, default: D.reviewContentEdits },
    minPayoutAmount: { type: Number, min: 0, default: D.minPayoutAmount },
    /** Marketplace fees on top of commission (see utils/sellerFees.js). */
    fees: {
      minCommissionPerItem: { type: Number, min: 0, default: 0 },
      maxCommissionPerItem: { type: Number, min: 0, default: 0 },
      fixedFeePerItem: { type: Number, min: 0, default: 0 },
      fixedFeePerShipment: { type: Number, min: 0, default: 0 },
      monthlyFee: { type: Number, min: 0, default: 0 },
      commissionOnDeliveryFee: { type: Boolean, default: false },
      vatPercent: { type: Number, min: 0, max: 100, default: 0 },
      /** Share of the commission the marketplace keeps when an item is returned. */
      returnAdminFeePercent: { type: Number, min: 0, max: 100, default: 0 },
      paymentFees: { type: [paymentFeeSchema], default: [] },
    },
    plans: { type: [feePlanSchema], default: [] },
    commissionRules: { type: [commissionRuleSchema], default: [] },
    /** Automatic payout runs: payouts are generated on schedule; staff still mark them paid. */
    payoutSchedule: {
      frequency: { type: String, enum: ['manual', 'weekly', 'biweekly', 'monthly'], default: 'manual' },
      weekday: { type: Number, min: 0, max: 6, default: 0 },
      monthDay: { type: Number, min: 1, max: 31, default: 1 },
    },
    /**
     * Account-health enforcement. Warnings with a strike count toward `maxStrikes` within
     * `strikeWindowDays`; reaching it suspends the store only when `autoSuspend` is on.
     * `autoWarnAtRisk` sends a (non-strike) notice when health turns "at risk".
     */
    enforcement: {
      autoWarnAtRisk: { type: Boolean, default: true },
      maxStrikes: { type: Number, min: 1, max: 20, default: 3 },
      strikeWindowDays: { type: Number, min: 7, max: 365, default: 90 },
      autoSuspend: { type: Boolean, default: false },
    },
    termsAr: { type: String, trim: true, default: '' },
    termsEn: { type: String, trim: true, default: '' },
  },
  { timestamps: true },
);

const MarketplaceSettings = mongoose.model('MarketplaceSettings', marketplaceSettingsSchema);

export default MarketplaceSettings;
